// Port-side coverage for the upstream 8eeb7b5a..6a0af04d vendor sync (GAP-006 runtime
// texture pooling + the 95743621 viewport-without-clear pooling guard): the vendored
// engine's Pipeline consumes the analyzer's physical allocation plan behind the opt-in
// `texturePooling: true` and reports it through `getResourcePlan()`; the port's
// BabylonBackend supplies the `backend.textures` records that sharing materializes
// through. Mirrors the Pipeline-side cases of the upstream shaders/tests/
// test_resource_pooling.js against the vendored Pipeline + a recording backend, in the
// hand-built-graph pattern of test/mip-controls.test.js.
import assert from 'node:assert/strict'
import test from 'node:test'

import { BabylonBackend } from '../src/runtime/babylonBackend.js'

// Recording stub backend (same shape the vendored Pipeline reads: width/height/format).
function makeRecordingBackend () {
  const backend = Object.create(BabylonBackend.prototype)
  backend.textures = new Map()
  backend.created = []
  backend.destroyed = []
  backend.createTexture = (id, spec) => {
    backend.created.push({ id, spec })
    const rec = { id, width: spec.width, height: spec.height, format: spec.format, persistent: spec.persistent === true, mipmaps: spec.mipmaps === true }
    backend.textures.set(id, rec)
    return rec
  }
  backend.destroyTexture = (id) => {
    backend.destroyed.push(id)
    backend.textures.delete(id)
  }
  return backend
}

function makeGraph (passes, textures, allocations) {
  return {
    passes,
    textures: new Map(Object.entries(textures)),
    allocations: new Map(Object.entries(allocations)),
    surfaces: new Map()
  }
}

async function boot () {
  const { bootEngine } = await import('../vendor/engine.mjs')
  const { Pipeline } = await bootEngine()
  return Pipeline
}

test('default pipeline does not pool: each virtual id keeps its own texture', async () => {
  const Pipeline = await boot()
  const backend = makeRecordingBackend()
  const graph = makeGraph(
    [
      { id: 'p0', inputs: {}, outputs: { color: 'texA' } },
      { id: 'p1', inputs: { src: 'texA' }, outputs: { color: 'texB' } },
      { id: 'p2', inputs: { src: 'texB' }, outputs: { color: 'texC' } }
    ],
    {
      texA: { width: 64, height: 64, format: 'rgba16f' },
      texB: { width: 64, height: 64, format: 'rgba16f' },
      texC: { width: 64, height: 64, format: 'rgba16f' }
    },
    { texA: 'physA', texB: 'physB', texC: 'physA' }
  )
  const pipeline = new Pipeline(graph, backend)
  pipeline.width = 64
  pipeline.height = 64
  pipeline.recreateTextures()

  const a = backend.textures.get('texA')
  const c = backend.textures.get('texC')
  assert.ok(a && c, 'both textures must exist')
  assert.notEqual(a, c, 'without opt-in the reused slot must not share a record')

  const plan = pipeline.getResourcePlan()
  assert.equal(plan.pooling, false, 'plan must report pooling disabled')
  assert.equal(plan.sharedTextures.length, 0, 'no shared groups without opt-in')
  assert.equal(plan.allocations.get('texA'), plan.allocations.get('texC'),
    'the analyzer plan stays queryable')
  for (const entry of plan.textures) {
    assert.equal(entry.virtualTextures.length, 1,
      'each backend texture serves exactly one virtual texture')
  }
})

test('texturePooling opt-in makes disjoint virtual textures share one record', async () => {
  const Pipeline = await boot()
  const backend = makeRecordingBackend()
  const graph = makeGraph(
    [
      { id: 'p0', inputs: {}, outputs: { color: 'texA' } },
      { id: 'p1', inputs: { src: 'texA' }, outputs: { color: 'texB' } },
      { id: 'p2', inputs: { src: 'texB' }, outputs: { color: 'texC' } }
    ],
    {
      texA: { width: 64, height: 64, format: 'rgba16f' },
      texB: { width: 64, height: 64, format: 'rgba16f' },
      texC: { width: 64, height: 64, format: 'rgba16f' }
    },
    { texA: 'physA', texB: 'physB', texC: 'physA' }
  )
  const pipeline = new Pipeline(graph, backend, { texturePooling: true })
  pipeline.width = 64
  pipeline.height = 64
  pipeline.recreateTextures()

  const a = backend.textures.get('texA')
  const c = backend.textures.get('texC')
  assert.ok(a && c, 'both textures must be resolvable')
  assert.equal(a, c, 'pooled members must resolve to the same backend record')

  const b = backend.textures.get('texB')
  assert.notEqual(a, b, 'textures with overlapping lifetimes must stay separate')

  const plan = pipeline.getResourcePlan()
  assert.equal(plan.pooling, true, 'plan must report pooling enabled')
  assert.ok(plan.sharedTextures.some(members =>
    members.includes('texA') && members.includes('texC')),
  `sharedTextures must report the A/C reuse: ${JSON.stringify(plan.sharedTextures)}`)
  const pooledCreates = backend.created.filter(call => call.id === 'texC')
  assert.equal(pooledCreates.length, 0, 'the pooled member must never allocate its own storage')
})

test('a viewport pass without clear is never pooled (95743621)', async () => {
  const Pipeline = await boot()
  const backend = makeRecordingBackend()
  // The pass writes texA through an authored viewport without `clear: true`, so the
  // sub-region outside the viewport keeps whatever the storage held (a group-mate's
  // content under pooled storage) — pooling must refuse even though lifetimes are
  // disjoint and the analyzer groups the slots.
  const graph = makeGraph(
    [
      { id: 'p0', inputs: {}, outputs: { color: 'texA' }, viewport: { x: 0, y: 0, w: 32, h: 32 } },
      { id: 'p1', inputs: { src: 'texA' }, outputs: { color: 'texB' } },
      { id: 'p2', inputs: { src: 'texB' }, outputs: { color: 'texC' } }
    ],
    {
      texA: { width: 64, height: 64, format: 'rgba16f' },
      texB: { width: 64, height: 64, format: 'rgba16f' },
      texC: { width: 64, height: 64, format: 'rgba16f' }
    },
    { texA: 'physA', texB: 'physB', texC: 'physA' }
  )
  const pipeline = new Pipeline(graph, backend, { texturePooling: true })
  pipeline.width = 64
  pipeline.height = 64
  pipeline.recreateTextures()

  assert.notEqual(backend.textures.get('texA'), backend.textures.get('texC'),
    'a viewport pass without clear must not share storage')
  const plan = pipeline.getResourcePlan()
  assert.ok(!plan.sharedTextures.some(members => members.includes('texC')),
    `the viewport-written texture must not be reported shared: ${JSON.stringify(plan.sharedTextures)}`)

  // A full clear (clear: true, no viewport) overwrites the whole texture and stays poolable.
  graph.passes[0].clear = true
  delete graph.passes[0].viewport
  pipeline.recreateTextures()
  assert.equal(backend.textures.get('texA'), backend.textures.get('texC'),
    'with a full clear the same group is poolable again')
})

test('persistent textures are never pooled even with disjoint lifetimes', async () => {
  const Pipeline = await boot()
  const backend = makeRecordingBackend()
  // texA is persistent and shares texC's analyzer slot: the group must fall back to
  // standalone textures so texA keeps its cross-frame contents.
  const graph = makeGraph(
    [
      { id: 'p0', inputs: {}, outputs: { color: 'texA' } },
      { id: 'p1', inputs: { src: 'texA' }, outputs: { color: 'texB' } },
      { id: 'p2', inputs: { src: 'texB' }, outputs: { color: 'texC' } }
    ],
    {
      texA: { width: 64, height: 64, format: 'rgba16f', persistent: true },
      texB: { width: 64, height: 64, format: 'rgba16f' },
      texC: { width: 64, height: 64, format: 'rgba16f' }
    },
    { texA: 'physA', texB: 'physB', texC: 'physA' }
  )
  const pipeline = new Pipeline(graph, backend, { texturePooling: true })
  pipeline.width = 64
  pipeline.height = 64
  pipeline.recreateTextures()

  assert.notEqual(backend.textures.get('texA'), backend.textures.get('texC'),
    'a persistent member must not share a record with its group partner')
  assert.equal(backend.textures.get('texA').persistent, true,
    'persistent flag must reach the backend record')
})

test('mismatched dimensions in a physical group fall back to standalone textures', async () => {
  const Pipeline = await boot()
  const backend = makeRecordingBackend()
  const graph = makeGraph(
    [
      { id: 'p0', inputs: {}, outputs: { color: 'texA' } },
      { id: 'p1', inputs: { src: 'texA' }, outputs: { color: 'texB' } },
      { id: 'p2', inputs: { src: 'texB' }, outputs: { color: 'texC' } }
    ],
    {
      texA: { width: 64, height: 64, format: 'rgba16f' },
      texB: { width: 64, height: 64, format: 'rgba16f' },
      texC: { width: 32, height: 32, format: 'rgba16f' }
    },
    { texA: 'physA', texB: 'physB', texC: 'physA' }
  )
  const pipeline = new Pipeline(graph, backend, { texturePooling: true })
  pipeline.width = 64
  pipeline.height = 64
  pipeline.recreateTextures()

  assert.notEqual(backend.textures.get('texA'), backend.textures.get('texC'),
    'mismatched specs must fall back to standalone textures')
})

test('textures read before they are written are never pooled', async () => {
  const Pipeline = await boot()
  const backend = makeRecordingBackend()
  // texC's first touch in the pass list is an input read, so it expects the
  // zero-initialized contents a standalone texture would hold.
  const graph = makeGraph(
    [
      { id: 'p0', inputs: { src: 'texC' }, outputs: { color: 'texA' } },
      { id: 'p1', inputs: { src: 'texA' }, outputs: { color: 'texC' } }
    ],
    {
      texA: { width: 64, height: 64, format: 'rgba16f' },
      texC: { width: 64, height: 64, format: 'rgba16f' }
    },
    { texA: 'physA', texC: 'physA' }
  )
  const pipeline = new Pipeline(graph, backend, { texturePooling: true })
  pipeline.width = 64
  pipeline.height = 64
  pipeline.recreateTextures()

  assert.notEqual(backend.textures.get('texA'), backend.textures.get('texC'),
    'a first-read texture must not share storage with a later writer')
})
