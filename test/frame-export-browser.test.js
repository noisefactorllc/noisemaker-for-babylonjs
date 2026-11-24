import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { ensurePlaywrightBrowsersPath } from './browser-launch.mjs'
import { chromium } from 'playwright'

import { exportFatGraph } from '../tools/export-fat-graph.mjs'
import { ensureBundle, INDEX_HTML, ROOT } from '../parity/render-candidate.mjs'

// ANGLE's Metal backend exists only on macOS. On Linux the metal switch falls back
// through a path that never signals GL fence syncs or fills pixel-pack buffers, so the
// async frame-export queue stalls with no GL error; the SwiftShader GL path (the same
// driver parity/render-batch.mjs uses for non-macOS sweeps) completes it.
const LAUNCH_ARGS = process.platform === 'darwin'
  ? ['--disable-gpu-sandbox', '--use-angle=metal']
  : ['--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']

test('Babylon frame export matches synchronous top-down pixels in a real WebGL2 context', async () => {
  await ensureBundle(false)
  const fat = await exportFatGraph(readFileSync(join(ROOT, 'parity/programs/noise.dsl'), 'utf8'))
  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS })

  try {
    const page = await browser.newPage()
    await page.goto(pathToFileURL(INDEX_HTML).href)
    await page.waitForFunction(() => window.nmReady === true, { timeout: 30000 })
    const result = await page.evaluate(
      async ({ fat }) => window.nmRunFrameExport(fat, { size: 16, time: 0.25, frames: 8 }),
      { fat }
    )

    assert.equal(result.width, 16)
    assert.equal(result.height, 16)
    assert.equal(result.rowStride, 64)
    assert.equal(result.timestamp, 1000)
    assert.deepEqual(result.exported, result.synchronous)
    assert.ok(result.stats.accepted >= 1)
    assert.ok(result.stats.completed >= 1)
    assert.equal(result.stats.failed, 0)
  } finally {
    await browser.close()
  }
})

test('Babylon readback expands odd-width single-channel textures to opaque top-down grayscale', async () => {
  await ensureBundle(false)
  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS })
  try {
    const page = await browser.newPage()
    await page.goto(pathToFileURL(INDEX_HTML).href)
    await page.waitForFunction(() => window.nmReady === true, { timeout: 30000 })
    const results = await page.evaluate(() => window.nmRunSingleChannelReadback())
    const expected = [191, 191, 191, 64, 64, 64].flatMap(value => [value, value, value, 255])
    assert.deepEqual(results, ['r8', 'r16f', 'r32f'].map(format => ({ format, pixels: expected, error: 0, packAlignment: 4 })))
  } finally {
    await browser.close()
  }
})

test('the browser compiler keeps the effect program grammar', async () => {
  await ensureBundle(false)
  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS })
  try {
    const page = await browser.newPage()
    await page.goto(pathToFileURL(INDEX_HTML).href)
    await page.waitForFunction(() => window.nmReady === true, { timeout: 30000 })
    const compile = source => page.evaluate(dsl => window.nmCompileEffectGraph(dsl).renderSurface, source)
    assert.equal(await compile('search synth\nread(o0).write(o1)\nrender(o1)'), 'o1')
    await assert.rejects(compile('search synth\nread(o0, tex: o1).write(o2)\nrender(o2)'), /Cannot mix positional and keyword arguments/)
    await assert.rejects(compile('search synth\nlet x = {value: 1}\nread(o0).write(o1)\nrender(o1)'), /Expected expression after '='/)
    await assert.rejects(compile('search synth\nscene(camera()).write(o0)\nrender(o0)'), /Babylon.js requires an effect graph/)
  } finally {
    await browser.close()
  }
})

test('NoisemakerRenderer replaces lost GPU state and resumes rendering after context restoration', async () => {
  await ensureBundle(false)
  const fat = await exportFatGraph(readFileSync(join(ROOT, 'parity/programs/noise.dsl'), 'utf8'))
  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS })

  try {
    const page = await browser.newPage()
    await page.goto(pathToFileURL(INDEX_HTML).href)
    await page.waitForFunction(() => window.nmReady === true, { timeout: 30000 })
    const result = await page.evaluate(
      async ({ fat }) => window.nmRunRendererContextRestore(fat, { size: 16, time: 0.25 }),
      { fat }
    )

    assert.equal(result.pipelineReplaced, true)
    assert.equal(result.sinkCloseOptions.backendLost, true)
    assert.deepEqual(result.before, result.after)
    assert.equal(result.contextLostObserversRemoved, 1)
    assert.equal(result.contextRestoredObserversRemoved, 1)
  } finally {
    await browser.close()
  }
})

test('Babylon frame export applies alpha modes to odd-width RGBA8 pixels in real WebGL2', async () => {
  await ensureBundle(false)
  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS })

  try {
    const page = await browser.newPage()
    await page.goto(pathToFileURL(INDEX_HTML).href)
    await page.waitForFunction(() => window.nmReady === true, { timeout: 30000 })
    const result = await page.evaluate(async () => window.nmRunFrameExportAlphaModes())

    assert.equal(result.width, 3)
    assert.equal(result.height, 2)
    assert.equal(result.rowStride, 12)
    assert.equal(result.displayP3Accepted, true)
    assert.deepEqual(result.straight, [
      255, 255, 255, 128, 0, 255, 0, 64, 255, 0, 0, 255,
      255, 0, 255, 128, 0, 255, 255, 64, 255, 255, 0, 0
    ])
    assert.deepEqual(result.opaque, [
      255, 255, 255, 255, 0, 255, 0, 255, 255, 0, 0, 255,
      255, 0, 255, 255, 0, 255, 255, 255, 255, 255, 0, 255
    ])
    assert.deepEqual(result.premultiplied, [
      128, 128, 128, 128, 0, 64, 0, 64, 255, 0, 0, 255,
      128, 0, 128, 128, 0, 64, 64, 64, 0, 0, 0, 0
    ])
  } finally {
    await browser.close()
  }
})

test('BabylonBackend uploads borrowed VideoFrame and caller can close immediately', async () => {
  await ensureBundle(false)
  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS })

  try {
    const page = await browser.newPage()
    await page.goto(pathToFileURL(INDEX_HTML).href)
    await page.waitForFunction(() => window.nmReady === true, { timeout: 30000 })
    const result = await page.evaluate(async () => window.nmRunVideoFrameUpload())

    assert.equal(result.uploadedWidth, 4)
    assert.equal(result.uploadedHeight, 2)
    assert.equal(result.hasTexture, true)
    assert.equal(result.recWidth, 4)
    assert.equal(result.recHeight, 2)
    assert.equal(result.readbackLength, 4 * 2 * 4)
    assert.ok(result.firstPixelR > 200, `Expected red channel > 200, got ${result.firstPixelR}`)
    assert.ok(result.firstPixelG < 50, `Expected green channel < 50, got ${result.firstPixelG}`)
    assert.equal(result.rejectedWidth, 0)
    assert.equal(result.rejectedHeight, 0)
    assert.equal(result.rotWidth, 2)
    assert.equal(result.rotHeight, 4)
  } finally {
    await browser.close()
  }
})
