import { ensurePlaywrightBrowsersPath } from './browser-launch.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { bootEngine } from '../vendor/engine.mjs'
import { ensureBundle, INDEX_HTML } from '../parity/render-candidate.mjs'

test('nonnumeric authored dimensions retain the declared numeric allocation defaults', async () => {
  const { Pipeline } = await bootEngine()
  const resolve = Pipeline.prototype.resolveDimension
  const func = { type: 'Func', name: 'osc' }
  assert.equal(resolve.call({}, { param: 'volumeSize', power: 2, default: 4096 }, 1024, { volumeSize: func }), 4096)
  assert.equal(resolve.call({}, { param: 'volumeSize', power: 2, paramDefault: 8 }, 1024, { volumeSize: func }), 64)
  assert.equal(resolve.call({}, { screenDivide: 'zoom', default: 2 }, 1024, { zoom: func }), 512)
  assert.equal(resolve.call({}, { screenDivide: 'zoom', default: 2 }, 1024, { zoom: 4 }), 256)
})

test('storage-only global writes advance current-frame and iteration read bindings', async () => {
  const { Pipeline } = await bootEngine()
  const pipeline = Object.create(Pipeline.prototype)
  pipeline.surfaces = new Map([['memory', { read: 'A', write: 'B' }]])
  pipeline.frameReadTextures = new Map([['memory', 'A']])
  pipeline.frameWriteTextures = new Map([['memory', 'B']])
  const pass = { storageTextures: { color: 'global_memory' } }
  pipeline.updateFrameSurfaceBindings(pass, { writeSurfaces: { memory: 'B' } })
  assert.equal(pipeline.frameReadTextures.get('memory'), 'B')
  assert.equal(pipeline.frameWriteTextures.get('memory'), 'A')
  pipeline.adoptIterationBindings(pass)
  assert.deepEqual(pipeline.surfaces.get('memory'), { read: 'B', write: 'A' })
})

test('persistent and feedback pixels survive skipped producers without persisting frame-local scratch',
  { timeout: 60000 }, async () => {
    await ensureBundle(false)
    const browser = await chromium.launch({ headless: true,
      args: ['--disable-gpu-sandbox', '--use-angle=metal'] })
    try {
      const page = await browser.newPage()
      await page.goto(pathToFileURL(INDEX_HTML).href)
      await page.waitForFunction(() => window.nmReady === true)
      const expected = [51, 153, 204, 255]
      for (const reference of [false, true]) {
        const render = options => page.evaluate(options => window.nmRunPersistentMemory(options),
          { reference, ...options })
        const persistent = await render({ persistent: true })
        const feedback = await render({ readFirst: true })
        const storageFeedback = await render({ readFirst: true, storageOnly: true })
        const scratch = await render({})
        for (const frames of [persistent, feedback, storageFeedback, scratch]) {
          assert.deepEqual(frames.counts, [2, 1, 1, 1], 'the producer must execute once and then skip')
        }
        for (const frames of [persistent.pixels, feedback.pixels.slice(1), storageFeedback.pixels.slice(1)]) {
          for (const pixel of frames) for (let channel = 0; channel < 4; channel++) {
            assert.ok(Math.abs(pixel[channel] - expected[channel]) <= 1,
              JSON.stringify({ reference, pixel, expected }))
          }
        }
        assert.deepEqual(scratch.pixels[0], expected, 'scratch begins with a visible write')
        assert.deepEqual(scratch.pixels[2], [0, 0, 0, 0], 'write-first scratch must remain frame-local')
      }
    } finally { await browser.close() }
  })
