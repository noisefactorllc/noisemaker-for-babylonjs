import { ensurePlaywrightBrowsersPath } from './browser-launch.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { bootEngine } from '../vendor/engine.mjs'
import { BabylonBackend } from '../src/runtime/babylonBackend.js'
import { exportFatGraph } from '../tools/export-fat-graph.mjs'
import { ensureBundle, INDEX_HTML } from '../parity/render-candidate.mjs'

test('empty render outputs preserve compute storage targets', () => {
  const convert = BabylonBackend.prototype._convertComputeToRender
  assert.deepEqual(convert({ outputs: {}, storageTextures: { color: 'stored' } }).outputs,
    { color: 'stored' })
  assert.deepEqual(convert({ outputs: { outputBuffer: 'explicit' }, storageTextures: { color: 'stored' } }).outputs,
    { color: 'explicit' })
})

test('triangle counts resolve screen and invalid uniform overrides from mesh dimensions', () => {
  const backend = Object.create(BabylonBackend.prototype)
  backend.textures = new Map([['mesh_positions', { width: 3, height: 2 }]])
  for (const count of ['auto', 'screen', 'input']) {
    for (const value of [undefined, 0, -1, '9', null]) {
      assert.equal(backend._triCount({ count, countUniform: 'vertices',
        uniforms: { vertices: value }, inputs: { meshPositions: 'mesh_positions_chain_0' } }, {}), 6,
      JSON.stringify({ count, value }))
    }
  }
  assert.equal(backend._triCount({ count: 'screen', countUniform: 'vertices' },
    { globalUniforms: { vertices: 9 } }), 9)
  assert.equal(backend._triCount({ count: 'screen', inputs: { meshPositions: 'global_mesh' } },
    { surfaces: { mesh: { width: 3, height: 4 } } }), 12)
})

test('storage-only and explicit blend factors render like the reference on every fullscreen path',
  { timeout: 60000 }, async () => {
    await ensureBundle(false)
    const browser = await chromium.launch({ headless: true,
      args: ['--disable-gpu-sandbox', '--use-angle=metal'] })
    try {
      const page = await browser.newPage()
      await page.goto(pathToFileURL(INDEX_HTML).href)
      await page.waitForFunction(() => window.nmReady === true)
      const source = [0.5, 0.25, 0.125, 0.5]
      const dest = [0.125, 0.25, 0.5, 0.75]
      const cases = [
        { blend: ['ONE', 'ZERO'], expected: source },
        { blend: ['ZERO', 'ONE'], expected: dest },
        { blend: ['SRC_COLOR', 'ZERO'], expected: source.map(v => v * v) },
        { blend: ['DST_COLOR', 'ZERO'], expected: source.map((v, i) => v * dest[i]) },
        { blend: ['ONE_MINUS_SRC_COLOR', 'ZERO'], expected: source.map(v => v * (1 - v)) },
        { blend: ['ONE_MINUS_DST_COLOR', 'ZERO'], expected: source.map((v, i) => v * (1 - dest[i])) },
        { blend: true, expected: source.map((v, i) => Math.min(1, v + dest[i])) },
        { blend: false, expected: source }
      ]
      for (const mode of ['single', 'mip', 'mrt', 'storage']) {
        for (const { blend, expected } of cases) {
          const options = { mode, blend }
          const reference = await page.evaluate(o => window.nmRunStableBackend({ ...o, reference: true }), options)
          const candidate = await page.evaluate(o => window.nmRunStableBackend(o), options)
          assert.deepEqual(candidate, reference, JSON.stringify(options))
          for (const pixel of candidate.pixels) for (let i = 0; i < 4; i++) {
            assert.ok(Math.abs(pixel[i] - expected[i] * 255) <= 1,
              JSON.stringify({ ...options, pixel, expected }))
          }
          assert.equal(candidate.glError, 0)
        }
      }
    } finally { await browser.close() }
  })

test('nonnumeric authored dimensions retain the declared numeric allocation defaults', async () => {
  const { Pipeline } = await bootEngine()
  const resolve = Pipeline.prototype.resolveDimension
  const func = { type: 'Func', name: 'osc' }
  assert.equal(resolve.call({}, { param: 'volumeSize', power: 2, default: 4096 }, 1024, { volumeSize: func }), 4096)
  assert.equal(resolve.call({}, { param: 'volumeSize', power: 2, paramDefault: 8 }, 1024, { volumeSize: func }), 64)
  assert.equal(resolve.call({}, { screenDivide: 'zoom', default: 2 }, 1024, { zoom: func }), 512)
  assert.equal(resolve.call({}, { screenDivide: 'zoom', default: 2 }, 1024, { zoom: 4 }), 256)
})

test('compiled storage outputs feed surfaces and subsequent effects with scoped allocations',
  { timeout: 60000 }, async () => {
    const { CanvasRenderer } = await bootEngine()
    const renderer = new CanvasRenderer({})
    const fill = '#version 300 es\nprecision highp float;\nout vec4 color;\nvoid main(){color=vec4(1.0,0.5,0.25,1.0);}'
    for (const named of [false, true]) {
      await renderer.registerPortableEffect({ func: named ? 'syncNamedStorage' : 'syncDirectStorage',
        ...(named ? { outputTex: 'work', textures: {
          work: { width: '100%', height: '100%', format: 'rgba16f' }
        } } : {}),
        passes: [{ program: 'fill', storageTextures: { color: named ? 'work' : 'outputTex' } }],
        shaders: { fill: { glsl: fill } }
      })
    }
    await ensureBundle(false)
    const browser = await chromium.launch({ headless: true,
      args: ['--disable-gpu-sandbox', '--use-angle=metal'] })
    try {
      const page = await browser.newPage()
      await page.goto(pathToFileURL(INDEX_HTML).href)
      await page.waitForFunction(() => window.nmReady === true)
      for (const name of ['syncDirectStorage', 'syncNamedStorage']) {
        for (const invert of [false, true]) {
          const fat = await exportFatGraph(`search user, filter\n${name}()${invert ? '.invert()' : ''}.write(o0)\nrender(o0)`)
          const target = fat.passes[0].storageTextures.color
          assert.ok(target.startsWith('global_') || fat.textures[target]?.usage.includes('storage'), target)
          const reference = await page.evaluate(fat => window.nmRunFatGraphWebGL2(fat, { size: 8, frames: 1 }), fat)
          const candidate = await page.evaluate(fat => window.nmRunFatGraph(fat, { size: 8, frames: 1 }), fat)
          assert.deepEqual(candidate.data, reference.data, `${name} invert=${invert}`)
          const expected = invert ? [0, 128, 191, 255] : [255, 128, 64, 255]
          for (let i = 0; i < candidate.data.length; i++) {
            assert.ok(Math.abs(candidate.data[i] - expected[i % 4]) <= 1,
              `${name} invert=${invert} channel=${i} value=${candidate.data[i]}`)
          }
        }
      }
    } finally { await browser.close() }
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
