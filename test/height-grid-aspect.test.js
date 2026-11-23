import { ensurePlaywrightBrowsersPath } from './browser-launch.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { exportFatGraph } from '../tools/export-fat-graph.mjs'
import { ensureBundle, INDEX_HTML } from '../parity/render-candidate.mjs'

// Port of upstream's height-grid proportion rule (75027859): heightGrid laid its particles on
// a square grid, gridScale wide and gridScale deep, and a surface that is not square was
// squeezed into that square. The grid is still gridScale wide; its depth is now gridScale
// times the frame's height over its width (the engine's aspectInv), so what is drawn on the
// grid keeps the frame's proportions. On a square frame the factor is exactly 1, so only a
// frame that is not square can observe the rule. The port has no WebGPU backend, so the rule
// runs on both of its WebGL2 paths — the BabylonBackend candidate and the vendored engine's
// WebGL2Backend reference — driven through the parity harness entry (parity/harness/entry.js,
// whose nmRunFatGraph / nmRunFatGraphWebGL2 take a non-square size as [width, height]).

// Seen from directly above, heightGrid shows its diffuse image as authored: a uvMap diffuse
// image carries u in red and v in green, so each axis reads directly from the presented frame.
const FRAME = (gridScale, stateSize) => `search synth, points, render
testPattern(pattern: uvMap).write(o1)
solid(color: #ffffff).pointsEmit(stateSize: ${stateSize}).heightGrid(gridScale: ${gridScale}, heightScale: 0, diffuseTex: read(o1)).pointsRender(viewMode: perspective, rotateX: 1.5708, density: 100, intensity: 0, inputIntensity: 0).write(o0)
render(o0)`
const UV_MAP = 'search synth\ntestPattern(pattern: uvMap).write(o0)\nrender(o0)'

// A square frame, a wide one and a tall one. The grid fits inside each frame, with few
// enough particles on a pixel that the summed colors still differ from one sampled point
// to the next (upstream's frames).
const FRAMES = [
  { width: 128, height: 128, gridScale: 80, stateSize: 'x128' },
  { width: 256, height: 128, gridScale: 80, stateSize: 'x64' },
  { width: 128, height: 256, gridScale: 50, stateSize: 'x128' }
]

// The box of the lit pixels of a frame.
function litBox (frame) {
  const box = { x0: frame.width, x1: -1, y0: frame.height, y1: -1 }
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      const i = (y * frame.width + x) * 4
      if (frame.data[i] + frame.data[i + 1] + frame.data[i + 2] < 24) continue
      box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x)
      box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y)
    }
  }
  assert.ok(box.x1 >= box.x0, 'the frame must contain lit pixels')
  return { ...box, width: box.x1 - box.x0 + 1, height: box.y1 - box.y0 + 1 }
}

// Points inside the box, toward its corners. Each sample averages the lit pixels of a 7 by 7
// window, so the gaps between particles do not count.
function sample (frame, box) {
  const dx = Math.round(box.width * 0.27); const dy = Math.round(box.height * 0.27)
  const corners = {
    topLeft: [box.x0 + dx, box.y0 + dy], topRight: [box.x1 - dx, box.y0 + dy], bottomLeft: [box.x0 + dx, box.y1 - dy]
  }
  return Object.fromEntries(Object.entries(corners).map(([name, [cx, cy]]) => {
    const sum = [0, 0, 0]
    let lit = 0
    for (let y = cy - 3; y <= cy + 3; y++) {
      for (let x = cx - 3; x <= cx + 3; x++) {
        const i = (y * frame.width + x) * 4
        if (frame.data[i] + frame.data[i + 1] + frame.data[i + 2] === 0) continue
        for (let c = 0; c < 3; c++) sum[c] += frame.data[i + c]
        lit++
      }
    }
    assert.ok(lit > 0, `${name}: the sample window must contain lit pixels`)
    return [name, sum.map(value => value / lit)]
  }))
}
const across = rgb => rgb.topRight[0] - rgb.topLeft[0]
const down = rgb => rgb.bottomLeft[1] - rgb.topLeft[1]

test('heightGrid seen from above shows its image in the frame\'s proportions', { timeout: 300000 }, async () => {
  await ensurePlaywrightBrowsersPath()
  await ensureBundle(false)
  const browser = await chromium.launch({ headless: true,
    args: ['--disable-gpu-sandbox', '--use-angle=metal'] })
  try {
    const page = await browser.newPage()
    const errs = []
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
    page.on('pageerror', e => errs.push(String(e)))
    await page.goto(pathToFileURL(INDEX_HTML).href)
    await page.waitForFunction(() => window.nmReady === true)

    const render = (fat, size, reference = false) => page.evaluate(async args => {
      const fn = args.reference ? window.nmRunFatGraphWebGL2 : window.nmRunFatGraph
      return fn(args.fat, { size: args.size, frames: 2, time: 0.25 })
    }, { fat, size, reference }).catch(e => { throw new Error(e.message + (errs.length ? '\nconsole:\n' + errs.join('\n') : '')) })

    const uvFat = await exportFatGraph(UV_MAP)
    const fats = new Map(FRAMES.map(f => [f, null]))
    for (const f of FRAMES) fats.set(f, await exportFatGraph(FRAME(f.gridScale, f.stateSize)))

    // Every backend and frame is measured before the verdict on the proportions.
    const outOfProportion = []
    for (const [label, reference] of [['BabylonBackend', false], ['WebGL2Backend reference', true]]) {
      const uvFrame = await render(uvFat, 128, reference)
      const authored = sample(uvFrame, litBox(uvFrame))
      for (const f of FRAMES) {
        const { width, height } = f
        const frame = await render(fats.get(f), [width, height], reference)
        const box = litBox(frame)
        const view = sample(frame, box)
        const where = `${label} ${width} x ${height}`
        assert.ok(box.x0 > 0 && box.y0 > 0 && box.x1 < width - 1 && box.y1 < height - 1,
          `${where}: the grid must fit inside the frame (x ${box.x0} to ${box.x1}, y ${box.y0} to ${box.y1})`)
        assert.ok(Math.sign(across(view)) === Math.sign(across(authored)) && Math.abs(across(view)) > 32,
          `${where}: seen from above, image right must be screen right (red ${view.topLeft[0]} -> ${view.topRight[0]})`)
        assert.ok(Math.sign(down(view)) === Math.sign(down(authored)) && Math.abs(down(view)) > 32,
          `${where}: seen from above, image top must be screen top (green ${view.topLeft[1]} -> ${view.bottomLeft[1]}, authored ${authored.topLeft[1]} -> ${authored.bottomLeft[1]})`)
        const shape = width / height
        if (Math.abs(box.width / box.height - shape) > shape * 0.1) {
          outOfProportion.push(`${where}: seen from above, the grid is ${box.width} by ${box.height} pixels, and its frame is ${width} by ${height}`)
        }
      }
    }
    assert.deepEqual(errs, [], 'no console or page errors')
    assert.deepEqual(outOfProportion, [])
    await page.close()
  } finally {
    await browser.close()
  }
})
