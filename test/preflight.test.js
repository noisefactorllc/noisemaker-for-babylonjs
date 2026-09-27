/**
 * Static effect preflight (engine GAP-016, upstream 12b4d74f, v1.0.190–v1.0.193).
 *
 * Mirrors the focused upstream `shaders/tests/test_preflight.js` Pipeline-level
 * cases against the vendored published engine. v1.0.193 adds
 * `Pipeline.prototype.preflight(capabilities?)` — the same static analysis as
 * the internal `preflightEffect()`: per-backend authorability, predicted MRT
 * rgba32f→rgba16f demotions under `maxColorBytesPerSample`, predicted
 * `maxTextureSize` clamps, and `maxDrawBuffers` overflows — read-only, before
 * any program is compiled. (`preflightEffect`/`mrtFormatBytes` stay
 * bundle-internal — not on the published export surface — so the analysis is
 * reached through a real `Pipeline` instance, exactly as an author would.)
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { bootEngine } from '../vendor/engine.mjs'

class StubBackend {
  constructor (capabilities) {
    this.textures = new Map()
    if (capabilities) this.capabilities = capabilities
  }

  createTexture (id, spec) {
    this.textures.set(id, { width: spec.width, height: spec.height, format: spec.format })
  }

  destroyTexture (id) {
    this.textures.delete(id)
  }
}

test('engine v1.0.193: Pipeline.preflight() predicts the applyMrtFormatBudget demotion', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  const { Pipeline } = await bootEngine()

  const textures = new Map([
    ['global_xyz', { format: 'rgba32f' }],
    ['global_vel', { format: 'rgba32f' }],
    ['global_rgba', { format: 'rgba8' }],
    ['o0', { format: 'rgba16f' }]
  ])
  const graph = {
    passes: [{
      id: 'emit',
      name: 'emit',
      program: 'emitProgram',
      outputs: { pos: 'global_xyz', vel: 'global_vel', col: 'global_rgba' }
    }],
    textures
  }
  const pipeline = new Pipeline(graph, new StubBackend({
    maxColorBytesPerSample: 32, maxTextureSize: 8192, maxDrawBuffers: 8
  }))
  pipeline.width = 256
  pipeline.height = 256

  const report = pipeline.preflight()
  assert.equal(typeof report.backends, 'object', 'report has a backends section')
  assert.equal(report.backends.webgl2.authorable, true, 'webgl2 authorable')
  assert.equal(report.backends.webgpu.authorable, true, 'webgpu authorable')
  const demoted = report.formatChanges.filter(c => c.from === 'rgba32f' && c.to === 'rgba16f')
  assert.ok(demoted.length >= 1, 'predicted at least one rgba32f → rgba16f demotion')

  // Runtime must agree: after createSurfaces (which applies the MRT format
  // budget) the predicted demotions actually happened.
  pipeline.createSurfaces()
  for (const change of demoted) {
    assert.equal(graph.textures.get(change.texture).format, 'rgba16f',
      `texture ${change.texture} actually demoted by the runtime budget`)
  }
})

test('engine v1.0.193: Pipeline.preflight() without shader specs skips source judgments', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  const { Pipeline } = await bootEngine()

  const graph = {
    passes: [{ program: 'p', outputs: { a: 't1' } }],
    textures: new Map([['t1', { format: 'rgba16f' }]])
  }
  const pipeline = new Pipeline(graph, new StubBackend({ maxTextureSize: 4096 }))
  const report = pipeline.preflight()
  assert.equal(report.backends.webgl2.authorable, true, 'webgl2 not judged without GLSL info')
  assert.equal(report.backends.webgpu.authorable, true, 'webgpu not judged without WGSL info')
  assert.deepEqual(report.backends.webgl2.reasons, [])
  assert.deepEqual(report.backends.webgpu.reasons, [])
})

test('engine v1.0.193: Pipeline.preflight() reports maxDrawBuffers and maxTextureSize limits', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  const { Pipeline } = await bootEngine()

  const graph = {
    passes: [{
      name: 'mrt',
      program: 'mrtProgram',
      outputs: { a: 't1', b: 't2', c: 't3' }
    }],
    textures: new Map([
      ['t1', { format: 'rgba16f' }],
      ['t2', { format: 'rgba16f' }],
      ['t3', { format: 'rgba16f' }],
      ['big', { width: 8192, height: 4096, format: 'rgba8' }]
    ])
  }
  const pipeline = new Pipeline(graph, new StubBackend({
    maxDrawBuffers: 2, maxTextureSize: 4096, maxColorBytesPerSample: 64
  }))
  const report = pipeline.preflight()
  assert.equal(report.backends.webgl2.authorable, false, 'webgl2 not renderable past maxDrawBuffers')
  assert.equal(report.backends.webgpu.authorable, false, 'webgpu not renderable past maxDrawBuffers')
  assert.ok(report.backends.webgl2.reasons[0].includes('3 color attachments'),
    'reason names the attachment count')
  assert.deepEqual(report.clamps, [
    { texture: 'big', field: 'width', requested: 8192, limit: 4096 }
  ], 'out-of-range texture dimensions are reported as clamps')
})

test('engine v1.0.193: Pipeline.preflight() never mutates the graph', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  const { Pipeline } = await bootEngine()

  const graph = {
    passes: [{ program: 'p', outputs: { a: 't1', b: 't2' } }],
    textures: new Map([
      ['t1', { format: 'rgba32f' }],
      ['t2', { format: 'rgba32f' }]
    ])
  }
  const pipeline = new Pipeline(graph, new StubBackend({ maxColorBytesPerSample: 32 }))
  const snapshot = JSON.stringify([...graph.textures.entries()])
  pipeline.preflight()
  assert.equal(JSON.stringify([...graph.textures.entries()]), snapshot,
    'preflight is read-only (the runtime demotion happens in createSurfaces, not preflight)')
})
