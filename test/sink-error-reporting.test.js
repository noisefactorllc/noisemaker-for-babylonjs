import assert from 'node:assert/strict'
import test from 'node:test'

import { bootEngine } from '../vendor/engine.mjs'

// Port of the upstream pipeline sink-error test added at engine pin 1.0.350
// (build db2173e3, upstream commit db2173e3 "FIX: pass a sink's isolated errors
// to its optional onError"). The port consumes the published engine bundle, so
// bootEngine() supplies Pipeline and Backend; only the mock backend and the
// sinks are re-declared here.
const engine = await bootEngine()

class MockBackend extends engine.Backend {
  constructor () {
    super(null)
    this.initCalled = false
    this.textures = new Map()
    this.programs = new Map()
    this.passes = []
    this.frameCount = 0
  }

  async init () {
    this.initCalled = true
  }

  createTexture (id, spec) {
    this.textures.set(id, {
      id,
      handle: `mock_texture_${id}`,
      width: spec.width,
      height: spec.height,
      format: spec.format
    })
    return this.textures.get(id)
  }

  destroyTexture (id) {
    this.textures.delete(id)
  }

  async compileProgram (id, spec) {
    this.programs.set(id, {
      handle: `mock_program_${id}`,
      type: spec.type || 'render'
    })
    return this.programs.get(id)
  }

  executePass () {}

  beginFrame () {
    this.frameCount++
  }

  endFrame () {}

  resize () {}

  async readPixels (textureId) {
    const texture = this.textures.get(textureId)
    return {
      width: texture?.width ?? 1,
      height: texture?.height ?? 1,
      data: new Uint8Array(4)
    }
  }

  getName () {
    return 'Mock'
  }

  static isAvailable () {
    return true
  }
}

test('a sink receives its own isolated configure, deferRender and submit errors', async () => {
  const backend = new MockBackend()
  const pipeline = new engine.Pipeline({ passes: [], textures: new Map(), renderSurface: 'o0' }, backend)
  await pipeline.init(320, 240)

  const configureError = new Error('configure failed')
  const deferError = new Error('defer probe failed')
  const submitError = new Error('submit failed')
  const reported = []
  let failing = false
  const failed = {
    configure () { if (failing) throw configureError },
    deferRender () { if (failing) throw deferError; return false },
    submit () { if (failing) throw submitError; return true },
    close () {},
    onError (error) { reported.push(['failed', error]) }
  }
  // A sink without onError fails exactly as before: counted and isolated.
  const silent = {
    configure () { if (failing) throw new Error('silent configure failed') },
    submit () { if (failing) throw new Error('silent submit failed'); return true },
    close () {}
  }
  // A sink whose reporter throws does not stop the resize or the frame.
  let reporterCalls = 0
  const throwingReporter = {
    configure () { if (failing) throw new Error('configure failed again') },
    submit () { return true },
    close () {},
    onError () {
      reporterCalls++
      throw new Error('reporter failed')
    }
  }
  // A sink that does not fail sees the same calls as before and no report.
  const healthyCalls = []
  const healthy = {
    configure (descriptor) { healthyCalls.push(['configure', descriptor.width, descriptor.height]) },
    deferRender () { healthyCalls.push(['deferRender']); return false },
    submit (textureId, timestamp) { healthyCalls.push(['submit', timestamp]); return true },
    close () {},
    onError (error) { reported.push(['healthy', error]) }
  }
  pipeline.addSink(failed)
  pipeline.addSink(silent)
  pipeline.addSink(throwingReporter)
  pipeline.addSink(healthy)
  healthyCalls.length = 0
  failing = true

  pipeline.resize(640, 480)
  const deferred = pipeline.shouldDeferRender()
  pipeline.render(0, 7)

  assert.equal(deferred, false, 'a throwing deferRender must not defer the frame')
  assert.deepEqual(reported.map(([sink, error]) => [sink, error]),
    [['failed', configureError], ['failed', deferError], ['failed', submitError]],
    'each error must reach only the sink that threw it')
  assert.equal(reporterCalls, 1, 'the throwing reporter must receive its configure error once')
  assert.deepEqual(healthyCalls,
    [['configure', 640, 480], ['deferRender'], ['submit', 7]],
    'a sink that does not fail must see the same calls')
  const stats = pipeline.sinkManager.stats
  const expected = [
    [failed, { accepted: 0, dropped: 0, failed: 3 }],
    [silent, { accepted: 0, dropped: 0, failed: 2 }],
    [throwingReporter, { accepted: 1, dropped: 0, failed: 1 }],
    [healthy, { accepted: 1, dropped: 0, failed: 0 }]
  ]
  for (const [sink, counts] of expected) {
    assert.deepEqual(stats.get(sink), counts, 'sink counters')
  }
  const resizedTexture = backend.textures.get('global_o0_read')
  assert.ok(resizedTexture, 'the resized output texture must exist')
  assert.deepEqual([resizedTexture.width, resizedTexture.height], [640, 480],
    'resize must complete after reported sink errors')
})
