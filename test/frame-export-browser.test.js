import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { chromium } from 'playwright'

import { exportFatGraph } from '../tools/export-fat-graph.mjs'
import { ensureBundle, INDEX_HTML, ROOT } from '../parity/render-candidate.mjs'

test('Babylon frame export matches synchronous top-down pixels in a real WebGL2 context', async () => {
  await ensureBundle(false)
  const fat = await exportFatGraph(readFileSync(join(ROOT, 'parity/programs/noise.dsl'), 'utf8'))
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu-sandbox', '--use-angle=metal'] })

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

test('NoisemakerRenderer replaces lost GPU state and resumes rendering after context restoration', async () => {
  await ensureBundle(false)
  const fat = await exportFatGraph(readFileSync(join(ROOT, 'parity/programs/noise.dsl'), 'utf8'))
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu-sandbox', '--use-angle=metal'] })

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
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu-sandbox', '--use-angle=metal'] })

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
