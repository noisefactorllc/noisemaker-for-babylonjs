import { ensurePlaywrightBrowsersPath } from './browser-launch.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { exportFatGraph } from '../tools/export-fat-graph.mjs'
import { ensureBundle, INDEX_HTML } from '../parity/render-candidate.mjs'

// Port of upstream's voxel edge-tie behavior test (7f3721e9): a voxel ray that passes
// through the edge shared by two cell boundaries crosses both at one distance and enters
// the cell beyond the edge. Whether the two crossings compare equal depends on how a
// shader compiler rounds the ray, so a pixel on such an edge must show what the pixels
// beside it show wherever the surface is one continuous wall. The port has no WebGPU
// backend, so the rule runs on both of its WebGL2 paths: the BabylonBackend candidate and
// the vendored engine's WebGL2Backend reference.

const WHITE = '255,255,255,255'

// A white cliff, lit only from the side it faces, so its face is white and every other
// face is black. `fill` is the part of the 16 x 16 height image that is full height:
// [x, y, width, height].
const cliffProgram = view => `search synth, synth3d, render
heightmap3d(heightTex: read(o1), tex: solid(color: #ffffff), volumeSize: x16, heightScale: 1, baseHeight: 0).renderLandscape3d(${view}, ambient: 0, diffuseIntensity: 1, specularIntensity: 0, bgAlpha: 0).write(o0)
render(o0)`

// Orthographic view of a cliff that faces +z. The frame is an odd number of pixels wide,
// so the rays of its center column cross x and z boundaries at one distance all the way.
const centerCliff = { width: 129, fill: [0, 8, 16, 8], dsl: cliffProgram('lightDirection: vec3(0, 0, 1)') }
// Perspective view, from the volume's axis, of a cliff that faces -x. Every ray of the
// screen diagonal crosses x and y boundaries at one distance.
const diagonalCliff = { width: 128, fill: [12, 0, 4, 16], dsl: cliffProgram('viewMode: perspective, rotateX: 0, lightDirection: vec3(-1, 0, 0)') }

function pixel (frame, width, x, y) {
  const at = (y * width + x) * 4
  return `${frame[at]},${frame[at + 1]},${frame[at + 2]},${frame[at + 3]}`
}

test('a voxel ray through an edge shows the face the neighboring voxels leave exposed', { timeout: 300000 }, async () => {
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

    const render = (fat, size, fill, reference = false) => page.evaluate(async args => {
      const fn = args.reference ? window.nmRunFatGraphWebGL2 : window.nmRunFatGraph
      const result = await fn(args.fat, {
        size: args.size, frames: 2, time: 0.25,
        external: { height: { size: 16, fill: args.fill } }
      })
      return result.data
    }, { fat, size, fill, reference }).catch(e => { throw new Error(e.message + (errs.length ? '\nconsole:\n' + errs.join('\n') : '')) })

    for (const [label, reference] of [['BabylonBackend', false], ['WebGL2Backend reference', true]]) {
      // Orthographic view, center column. Where the pixels on both sides of the center
      // column look at the cliff face, so does the column.
      const centerFat = await exportFatGraph(centerCliff.dsl)
      const centerFrame = await render(centerFat, centerCliff.width, centerCliff.fill, reference)
      const middle = (centerCliff.width - 1) / 2
      const faceRows = Array.from({ length: centerCliff.width }, (_, y) => y).filter(y =>
        pixel(centerFrame, centerCliff.width, middle - 1, y) === WHITE &&
        pixel(centerFrame, centerCliff.width, middle + 1, y) === WHITE)
      assert.ok(faceRows.length > 8, `${label}: the center column must cross the lit cliff face (found ${faceRows.length} face rows)`)
      const offFace = faceRows.filter(y => pixel(centerFrame, centerCliff.width, middle, y) !== WHITE)
      assert.deepEqual(offFace, [], `${label}: the center column looks at the lit cliff face through voxel edges, and ${offFace.length} of its ${faceRows.length} pixels there show ${offFace.length ? pixel(centerFrame, centerCliff.width, middle, offFace[0]) : ''}`)

      // Perspective view, screen diagonal. The diagonal pixels look at the cliff face
      // through its voxel edges; the pixels beside them do not.
      const diagonalFat = await exportFatGraph(diagonalCliff.dsl)
      const diagonalFrame = await render(diagonalFat, diagonalCliff.width, diagonalCliff.fill, reference)
      for (const at of [92, 96, 100]) {
        const beside = [pixel(diagonalFrame, diagonalCliff.width, at - 1, at), pixel(diagonalFrame, diagonalCliff.width, at + 1, at)]
        assert.deepEqual(beside, [WHITE, WHITE], `${label}: the pixels beside ${at},${at} must look at the lit cliff face (saw ${beside.join(' / ')})`)
        assert.equal(pixel(diagonalFrame, diagonalCliff.width, at, at), WHITE, `${label}: pixel ${at},${at} looks at the lit cliff face through a voxel edge`)
      }
    }
    assert.deepEqual(errs, [], 'no console or page errors')
    await page.close()
  } finally {
    await browser.close()
  }
})
