import { ensurePlaywrightBrowsersPath } from './browser-launch.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { exportFatGraph } from '../tools/export-fat-graph.mjs'
import { ensureBundle, INDEX_HTML } from '../parity/render-candidate.mjs'

// Port of upstream's heightmap-terrain proportion rule (478f94ea): heightmap3d mapped its
// height and color images across the whole square footprint of the volume, so on a frame
// that is not square the terrain squeezed them into a square. The terrain now keeps the
// frame's proportions inside the footprint: on a wide frame it spans the volume's width and
// a centered part of its depth, on a tall frame the depth and a centered part of the width,
// and columns outside the terrain are empty. Each span is a whole, even count of columns,
// taken from the engine's aspect and aspectInv. On a square frame both spans are the whole
// volume, so only a frame that is not square can observe the rule. The port has no WebGPU
// backend, so the rule runs on both of its WebGL2 paths — the BabylonBackend candidate and
// the vendored engine's WebGL2Backend reference — driven through the parity harness entry
// (parity/harness/entry.js, whose nmRunFatGraph / nmRunFatGraphWebGL2 take a non-square
// size as [width, height]).

// Seen from directly above, the terrain shows its diffuse image as authored: a uvMap color
// image carries u in red and v in green, so each axis reads directly from the presented
// frame. The height image is solid white, so every terrain column is full height and the
// top face covers the whole span. Each terrain here fits inside its frame (upstream's
// frames and camera distances).
const FRAMES = [
  { width: 128, height: 128, posZ: -40 },
  { width: 256, height: 128, posZ: -40 },
  { width: 128, height: 256, posZ: -120 }
]
const UV_MAP = 'search synth\ntestPattern(pattern: uvMap).write(o0)\nrender(o0)'
const TERRAIN = posZ => `search synth, synth3d, render
heightmap3d(heightTex: solid(color: #ffffff), tex: testPattern(pattern: uvMap), volumeSize: x16, heightScale: 1).renderLandscape3d(viewMode: perspective, rotateX: 1.5708, posZ: ${posZ}, bgAlpha: 0, ambient: 1, diffuseIntensity: 0, specularIntensity: 0).write(o0)
render(o0)`

// The box of the terrain's pixels: the background is transparent (bgAlpha: 0), and every
// terrain fragment is opaque.
function terrainBox (frame) {
  const box = { x0: frame.width, x1: -1, y0: frame.height, y1: -1 }
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      if (frame.data[(y * frame.width + x) * 4 + 3] === 0) continue
      box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x)
      box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y)
    }
  }
  assert.ok(box.x1 >= box.x0, 'the terrain must be visible')
  return { ...box, width: box.x1 - box.x0 + 1, height: box.y1 - box.y0 + 1 }
}

// Points toward the corners: of the whole frame in the authored image, of the terrain in
// the view. Each sample is one pixel; the uvMap gradient is smooth, so one pixel carries
// the local axis direction.
function sample (frame, width, area) {
  const dx = Math.round((area.x1 - area.x0 + 1) * 0.27); const dy = Math.round((area.y1 - area.y0 + 1) * 0.27)
  const at = (x, y) => {
    const i = (y * width + x) * 4
    return [frame.data[i], frame.data[i + 1], frame.data[i + 2]]
  }
  return {
    topLeft: at(area.x0 + dx, area.y0 + dy), topRight: at(area.x1 - dx, area.y0 + dy),
    bottomLeft: at(area.x0 + dx, area.y1 - dy)
  }
}
const across = rgb => rgb.topRight[0] - rgb.topLeft[0]
const down = rgb => rgb.bottomLeft[1] - rgb.topLeft[1]

test('heightmap3d seen from above shows its terrain in the frame\'s proportions', { timeout: 300000 }, async () => {
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
      return fn(args.fat, { size: args.size, frames: 3, time: 0.25 })
    }, { fat, size, reference }).catch(e => { throw new Error(e.message + (errs.length ? '\nconsole:\n' + errs.join('\n') : '')) })

    const uvFat = await exportFatGraph(UV_MAP)
    const fats = new Map(FRAMES.map(f => [f, null]))
    for (const f of FRAMES) fats.set(f, await exportFatGraph(TERRAIN(f.posZ)))

    // Every backend and frame is measured before the verdict on the proportions.
    const outOfProportion = []
    for (const [label, reference] of [['BabylonBackend', false], ['WebGL2Backend reference', true]]) {
      for (const f of FRAMES) {
        const { width, height } = f
        const authored = await render(uvFat, [width, height], reference)
        const frame = await render(fats.get(f), [width, height], reference)
        const box = terrainBox(frame)
        const view = sample(frame, width, box)
        const image = sample(authored, width, { x0: 0, x1: width - 1, y0: 0, y1: height - 1 })
        const where = `${label} ${width} x ${height}`
        assert.ok(box.x0 > 0 && box.y0 > 0 && box.x1 < width - 1 && box.y1 < height - 1,
          `${where}: the terrain must fit inside the frame (x ${box.x0} to ${box.x1}, y ${box.y0} to ${box.y1})`)
        assert.ok(Math.abs(box.x0 + box.x1 - (width - 1)) <= 3 && Math.abs(box.y0 + box.y1 - (height - 1)) <= 3,
          `${where}: the terrain must be centered in the frame (x ${box.x0} to ${box.x1}, y ${box.y0} to ${box.y1})`)
        assert.ok(Math.abs(across(image)) > 64 && Math.abs(down(image)) > 64,
          `${where}: the uvMap reference must vary along both axes`)
        assert.ok(Math.sign(across(view)) === Math.sign(across(image)) && Math.abs(across(view)) > 64,
          `${where}: seen from above, image right must be screen right (red ${view.topLeft[0]} -> ${view.topRight[0]})`)
        assert.ok(Math.sign(down(view)) === Math.sign(down(image)) && Math.abs(down(view)) > 64,
          `${where}: seen from above, image top must be screen top (green ${view.topLeft[1]} -> ${view.bottomLeft[1]}, authored ${image.topLeft[1]} -> ${image.bottomLeft[1]})`)
        assert.ok(Math.abs(view.bottomLeft[0] - view.topLeft[0]) <= 24 && Math.abs(view.topRight[1] - view.topLeft[1]) <= 24,
          `${where}: seen from above, the image must not be rotated`)
        const shape = width / height
        if (Math.abs(box.width / box.height - shape) > shape * 0.1) {
          outOfProportion.push(`${where}: seen from above, the terrain is ${box.width} by ${box.height} pixels, and its frame is ${width} by ${height}`)
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
