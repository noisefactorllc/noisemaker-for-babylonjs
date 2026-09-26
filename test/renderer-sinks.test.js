import assert from 'node:assert/strict'
import test from 'node:test'

import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js'

import { BabylonBackend } from '../src/runtime/babylonBackend.js'
import { NoisemakerRenderer } from '../src/runtime/renderer.js'

const DESCRIPTOR = Object.freeze({
  width: 4,
  height: 3,
  format: 'rgba8unorm',
  colorSpace: 'srgb',
  alphaMode: 'straight',
  fps: 60
})

class FakeWebGL2 {
  constructor () {
    Object.assign(this, {
      TEXTURE_2D: 0x0de1,
      TEXTURE0: 0x84c0,
      TEXTURE_MIN_FILTER: 0x2801,
      TEXTURE_MAG_FILTER: 0x2800,
      TEXTURE_WRAP_S: 0x2802,
      TEXTURE_WRAP_T: 0x2803,
      NEAREST: 0x2600,
      CLAMP_TO_EDGE: 0x812f,
      RGBA8: 0x8058,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      FRAMEBUFFER: 0x8d40,
      COLOR_ATTACHMENT0: 0x8ce0,
      FRAMEBUFFER_COMPLETE: 0x8cd5,
      PIXEL_PACK_BUFFER: 0x88eb,
      STREAM_READ: 0x88e1,
      VERTEX_SHADER: 0x8b31,
      FRAGMENT_SHADER: 0x8b30,
      COMPILE_STATUS: 0x8b81,
      LINK_STATUS: 0x8b82,
      TRIANGLES: 0x0004,
      BLEND: 0x0be2,
      DEPTH_TEST: 0x0b71,
      SCISSOR_TEST: 0x0c11,
      CULL_FACE: 0x0b44,
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      TIMEOUT_EXPIRED: 0x911b,
      CONDITION_SATISFIED: 0x911c,
      WAIT_FAILED: 0x911d,
      ALREADY_SIGNALED: 0x911a
    })
    this.calls = []
    this.shaderSources = []
    this.waitStatus = this.TIMEOUT_EXPIRED
    this._nextId = 1
  }

  _object (kind) { return { kind, id: this._nextId++ } }
  _call (name, ...args) { this.calls.push([name, ...args]) }
  createTexture () { this._call('createTexture'); return this._object('texture') }
  bindTexture (...args) { this._call('bindTexture', ...args) }
  texImage2D (...args) { this._call('texImage2D', ...args) }
  texParameteri (...args) { this._call('texParameteri', ...args) }
  deleteTexture (...args) { this._call('deleteTexture', ...args) }
  createFramebuffer () { this._call('createFramebuffer'); return this._object('framebuffer') }
  bindFramebuffer (...args) { this._call('bindFramebuffer', ...args) }
  framebufferTexture2D (...args) { this._call('framebufferTexture2D', ...args) }
  checkFramebufferStatus (...args) { this._call('checkFramebufferStatus', ...args); return this.FRAMEBUFFER_COMPLETE }
  deleteFramebuffer (...args) { this._call('deleteFramebuffer', ...args) }
  createBuffer () { this._call('createBuffer'); return this._object('buffer') }
  bindBuffer (...args) { this._call('bindBuffer', ...args) }
  bufferData (...args) { this._call('bufferData', ...args) }
  deleteBuffer (...args) { this._call('deleteBuffer', ...args) }
  createShader (type) { this._call('createShader', type); return this._object('shader') }
  shaderSource (shader, source) { this._call('shaderSource', shader, source); this.shaderSources.push(source) }
  compileShader (...args) { this._call('compileShader', ...args) }
  getShaderParameter (...args) { this._call('getShaderParameter', ...args); return true }
  getShaderInfoLog () { return '' }
  deleteShader (...args) { this._call('deleteShader', ...args) }
  createProgram () { this._call('createProgram'); return this._object('program') }
  attachShader (...args) { this._call('attachShader', ...args) }
  linkProgram (...args) { this._call('linkProgram', ...args) }
  getProgramParameter (...args) { this._call('getProgramParameter', ...args); return true }
  getProgramInfoLog () { return '' }
  getUniformLocation (_program, name) { return { name } }
  deleteProgram (...args) { this._call('deleteProgram', ...args) }
  viewport (...args) { this._call('viewport', ...args) }
  disable (...args) { this._call('disable', ...args) }
  activeTexture (...args) { this._call('activeTexture', ...args) }
  useProgram (...args) { this._call('useProgram', ...args) }
  uniform1i (...args) { this._call('uniform1i', ...args) }
  bindVertexArray (...args) { this._call('bindVertexArray', ...args) }
  drawArrays (...args) { this._call('drawArrays', ...args) }
  readPixels (...args) { this._call('readPixels', ...args) }
  fenceSync (...args) { this._call('fenceSync', ...args); return this._object('fence') }
  flush (...args) { this._call('flush', ...args) }
  clientWaitSync (...args) { this._call('clientWaitSync', ...args); return this.waitStatus }
  deleteSync (...args) { this._call('deleteSync', ...args) }
  getBufferSubData (_target, _offset, destination) {
    this._call('getBufferSubData', _target, _offset, destination)
    for (let i = 0; i < destination.length; i++) destination[i] = (i * 17) & 0xff
  }
}

function makeBackend (descriptor = DESCRIPTOR) {
  const gl = new FakeWebGL2()
  const backend = Object.create(BabylonBackend.prototype)
  backend.gl = gl
  backend.engine = { wipeCaches: () => gl._call('wipeCaches') }
  backend._emptyVAO = { kind: 'empty-vao' }
  backend.textures = new Map([
    ['source', {
      internal: { _hardwareTexture: { underlyingResource: { kind: 'source-texture' } } },
      width: descriptor.width,
      height: descriptor.height
    }]
  ])
  return { gl, backend }
}

class FakeObservable {
  constructor () { this.observers = new Set() }
  add (callback) { this.observers.add(callback); return callback }
  remove (callback) { this.observers.delete(callback) }
  notify () { for (const callback of [...this.observers]) callback() }
}

test('renderer forwards load options into the Pipeline constructor', async () => {
  const seen = []
  class OptionPipeline {
    constructor (_graph, _backend, options) { seen.push({ ...options }) }
    async init () {}
    dispose () {}
  }
  const renderer = new NoisemakerRenderer(new NullEngine(), { Pipeline: OptionPipeline })
  try {
    await renderer.loadGraph({ textures: {} }, { size: 32, texturePooling: true })
    assert.deepEqual(seen, [{ size: 32, texturePooling: true }])
  } finally {
    renderer.dispose()
  }
})

test('renderer sink and export APIs require an active pipeline', () => {
  const renderer = new NoisemakerRenderer({}, {})
  const sink = { configure () {}, submit () {}, close () {} }

  assert.throws(() => renderer.addSink(sink), /no active pipeline/i)
  assert.throws(() => renderer.createFrameExportQueue(), /no active pipeline/i)
})

test('renderer delegates sink and export registration to the active pipeline', () => {
  const renderer = new NoisemakerRenderer({}, {})
  const sink = { configure () {}, submit () {}, close () {} }
  const remove = () => {}
  const queue = { poll () {} }
  const options = { slots: 2 }
  const calls = []
  const backend = {
    createFrameExportQueue (received) {
      calls.push(['queue', this, received])
      return queue
    }
  }
  renderer.pipeline = {
    backend,
    addSink (received) {
      calls.push(['sink', this, received])
      return remove
    }
  }

  assert.equal(renderer.addSink(sink), remove)
  assert.equal(renderer.createFrameExportQueue(options), queue)
  assert.deepEqual(calls, [
    ['sink', renderer.pipeline, sink],
    ['queue', backend, options]
  ])
})

test('renderer safely queries output sink deferral through active pipeline', () => {
  const renderer = new NoisemakerRenderer({}, {})
  assert.equal(renderer.shouldDeferRender(), false)

  let deferResult = true
  renderer.pipeline = {
    shouldDeferRender () { return deferResult }
  }

  assert.equal(renderer.shouldDeferRender(), true)
  deferResult = false
  assert.equal(renderer.shouldDeferRender(), false)

  renderer.pipeline = {}
  assert.equal(renderer.shouldDeferRender(), false)
})

test('Pipeline delegates shouldDeferRender across active, deferring, and throwing sinks', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  const { Pipeline } = await bootEngine()

  const backend = {
    capabilities: { floatBlend: true },
    init () {},
    destroy () {}
  }
  const graph = {
    passes: [],
    programs: {},
    textures: new Map(),
    surfaces: new Map()
  }
  const pipeline = new Pipeline(graph, backend)
  assert.equal(pipeline.shouldDeferRender(), false)

  let shouldDefer = false
  const activeSink = {
    configure () {},
    submit () {},
    deferRender () { return shouldDefer },
    close () {}
  }
  const unregisterActive = pipeline.addSink(activeSink)
  assert.equal(pipeline.shouldDeferRender(), false)

  shouldDefer = true
  assert.equal(pipeline.shouldDeferRender(), true)

  const nonDeferringSink = {
    configure () {},
    submit () {},
    close () {}
  }
  const unregisterNonDeferring = pipeline.addSink(nonDeferringSink)
  assert.equal(pipeline.shouldDeferRender(), true)

  unregisterActive()
  assert.equal(pipeline.shouldDeferRender(), false)

  const throwingSink = {
    configure () {},
    submit () {},
    deferRender () { throw new Error('sink deferral exploded') },
    close () {}
  }
  pipeline.addSink(throwingSink)
  assert.equal(pipeline.shouldDeferRender(), false)
  assert.equal(pipeline.sinkManager.stats.get(throwingSink).failed, 1)

  unregisterNonDeferring()
  pipeline.dispose()
  assert.equal(pipeline.shouldDeferRender(), false)
})

test('renderer disposal closes pipeline-owned sinks through Pipeline.dispose', () => {
  const renderer = new NoisemakerRenderer({}, {})
  const calls = []
  renderer.pipeline = { dispose: () => calls.push('pipeline.dispose') }
  renderer.backend = { destroy: () => calls.push('backend.destroy') }

  renderer.dispose()

  assert.deepEqual(calls, ['pipeline.dispose'])
})

test('renderer context loss abandons sinks and restoration replaces the dead pipeline', async () => {
  const lost = new FakeObservable()
  const restored = new FakeObservable()
  const callbacks = []
  const engine = { onContextLostObservable: lost, onContextRestoredObservable: restored }
  const renderer = new NoisemakerRenderer(engine, {
    onContextLost: () => callbacks.push('lost'),
    onContextRestored: () => callbacks.push('restored')
  })
  const deadPipeline = { dispose: options => callbacks.push(['pipeline.dispose', options]) }
  const deadBackend = { destroy: options => callbacks.push(['backend.destroy', options]) }
  const restoredPipeline = { id: 'restored' }
  renderer.pipeline = deadPipeline
  renderer.backend = deadBackend
  renderer.graph = { id: 'dead' }
  renderer._fatGraph = { id: 'fat' }
  renderer._loadGraph = async (_fat, _opts, generation) => {
    callbacks.push(['load', generation])
    renderer.pipeline = restoredPipeline
    renderer.backend = { id: 'restored-backend' }
    return renderer
  }

  lost.notify()
  assert.equal(renderer.pipeline, null)
  assert.equal(renderer.backend, null)
  assert.deepEqual(callbacks.slice(0, 2), [
    ['pipeline.dispose', { backendLost: true }],
    'lost'
  ])

  restored.notify()
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(renderer.pipeline, restoredPipeline)
  assert.deepEqual(callbacks.slice(2), [
    ['backend.destroy', { abandonRawResources: true }],
    ['load', 2],
    'restored'
  ])
})

test('renderer restores the latest resized dimensions after context loss', async () => {
  const lost = new FakeObservable()
  const restored = new FakeObservable()
  const engine = new NullEngine()
  let finishRestoration
  const restorationFinished = new Promise(resolve => { finishRestoration = resolve })
  class TrackingPipeline {
    constructor (_graph, backend) { this.backend = backend }
    async init (width, height) { Object.assign(this, { width, height }) }
    resize (width, height) { Object.assign(this, { width, height }) }
    dispose (options = {}) {
      if (!options.backendLost) this.backend?.destroy()
      this.backend = null
    }
  }
  engine.onContextLostObservable = lost
  engine.onContextRestoredObservable = restored
  const renderer = new NoisemakerRenderer(engine, {
    Pipeline: TrackingPipeline,
    onContextRestored: finishRestoration
  })

  try {
    await renderer.loadGraph({ textures: {} }, { size: 64 })
    renderer.resize(128)
    lost.notify()
    restored.notify()
    await restorationFinished

    assert.equal(renderer.size, 128)
    assert.equal(renderer.pipeline.width, 128)
    assert.equal(renderer.pipeline.height, 128)
    assert.equal(renderer.backend.textures.get(renderer._outId).width, 128)
    assert.equal(renderer.backend.textures.get(renderer._outId).height, 128)
  } finally {
    renderer.dispose()
    engine.dispose()
  }
})

test('renderer applies a resize requested during context restoration', async () => {
  const lost = new FakeObservable()
  const restored = new FakeObservable()
  const engine = new NullEngine()
  let pipelineCount = 0
  let beginRestoration
  let releaseRestoration
  let finishRestoration
  const restorationStarted = new Promise(resolve => { beginRestoration = resolve })
  const restorationGate = new Promise(resolve => { releaseRestoration = resolve })
  const restorationFinished = new Promise(resolve => { finishRestoration = resolve })
  class DeferredPipeline {
    constructor (_graph, backend) {
      this.backend = backend
      this.index = ++pipelineCount
    }

    async init (width, height) {
      Object.assign(this, { width, height })
      if (this.index === 2) {
        beginRestoration()
        await restorationGate
      }
    }

    resize (width, height) { Object.assign(this, { width, height }) }
    dispose (options = {}) {
      if (!options.backendLost) this.backend?.destroy()
      this.backend = null
    }
  }
  engine.onContextLostObservable = lost
  engine.onContextRestoredObservable = restored
  const renderer = new NoisemakerRenderer(engine, {
    Pipeline: DeferredPipeline,
    onContextRestored: finishRestoration
  })

  try {
    await renderer.loadGraph({ textures: {} }, { size: 64 })
    lost.notify()
    restored.notify()
    await restorationStarted
    renderer.resize(128)
    releaseRestoration()
    await restorationFinished

    assert.equal(renderer.size, 128)
    assert.equal(renderer.pipeline.width, 128)
    assert.equal(renderer.pipeline.height, 128)
    assert.equal(renderer.backend.textures.get(renderer._outId).width, 128)
    assert.equal(renderer.backend.textures.get(renderer._outId).height, 128)
  } finally {
    renderer.dispose()
    engine.dispose()
  }
})

test('renderer disposal forwards backend-loss state and removes engine observers', () => {
  const lost = new FakeObservable()
  const restored = new FakeObservable()
  const engine = { onContextLostObservable: lost, onContextRestoredObservable: restored }
  const renderer = new NoisemakerRenderer(engine, {})
  const calls = []
  renderer.pipeline = { dispose: options => calls.push(options) }

  renderer.dispose({ backendLost: true })

  assert.deepEqual(calls, [{ backendLost: true }])
  assert.equal(lost.observers.size, 0)
  assert.equal(restored.observers.size, 0)
})

test('renderer disposal during context loss abandons retained managed resources', () => {
  const lost = new FakeObservable()
  const restored = new FakeObservable()
  const calls = []
  const renderer = new NoisemakerRenderer({
    onContextLostObservable: lost,
    onContextRestoredObservable: restored
  }, {})
  renderer.pipeline = { dispose: options => calls.push(['pipeline.dispose', options]) }
  renderer.backend = { destroy: options => calls.push(['backend.destroy', options]) }

  lost.notify()
  renderer.dispose()
  restored.notify()

  assert.deepEqual(calls, [
    ['pipeline.dispose', { backendLost: true }],
    ['backend.destroy', { abandonRawResources: true }]
  ])
  assert.equal(lost.observers.size, 0)
  assert.equal(restored.observers.size, 0)
})

test('renderer retains a stale initializing backend until lost-context cleanup is safe', () => {
  const calls = []
  const renderer = new NoisemakerRenderer({}, {})
  const backend = { destroy: options => calls.push(['backend.destroy', options]) }
  const stalePipeline = {
    backend,
    dispose (options) {
      calls.push(['pipeline.dispose', options])
      this.backend = null
    }
  }
  renderer._isContextLost = true
  renderer._lifecycleGeneration = 2
  renderer._lastBackendInvalidationGeneration = 2

  renderer._disposeStalePipeline(stalePipeline, 1)
  assert.deepEqual(calls, [['pipeline.dispose', { backendLost: true }]])

  renderer.dispose()
  assert.deepEqual(calls, [
    ['pipeline.dispose', { backendLost: true }],
    ['backend.destroy', { abandonRawResources: true }]
  ])
})

test('renderer suppresses a stale initialization failure after lifecycle invalidation', async () => {
  const engine = new NullEngine()
  const calls = []
  let rejectInit
  const initialization = new Promise((resolve, reject) => { rejectInit = reject })
  class DeferredPipeline {
    constructor (_graph, backend) { this.backend = backend }
    init () { return initialization }
    dispose (options) {
      calls.push(['pipeline.dispose', options])
      this.backend.destroy()
      this.backend = null
    }
  }
  const renderer = new NoisemakerRenderer(engine, { Pipeline: DeferredPipeline })

  try {
    const loading = renderer.loadGraph({ textures: {} })
    renderer.dispose()
    rejectInit(new Error('stale initialization failure'))

    assert.equal(await loading, null)
    assert.deepEqual(calls, [['pipeline.dispose', {}]])
  } finally {
    renderer.dispose()
    engine.dispose()
  }
})

test('renderer preserves an initialization failure from the current lifecycle generation', async () => {
  const engine = new NullEngine()
  const calls = []
  class FailingPipeline {
    constructor (_graph, backend) { this.backend = backend }
    async init () { throw new Error('current initialization failure') }
    dispose (options) {
      calls.push(['pipeline.dispose', options])
      this.backend.destroy()
      this.backend = null
    }
  }
  const renderer = new NoisemakerRenderer(engine, { Pipeline: FailingPipeline })

  try {
    await assert.rejects(renderer.loadGraph({ textures: {} }), /current initialization failure/)
    assert.deepEqual(calls, [['pipeline.dispose', {}]])
  } finally {
    renderer.dispose()
    engine.dispose()
  }
})

test('backend abandonment disposes rebuilt managed resources without deleting invalid raw handles', () => {
  const calls = []
  const backend = Object.create(BabylonBackend.prototype)
  backend.gl = {
    deleteBuffer: () => calls.push('deleteBuffer'),
    deleteFramebuffer: () => calls.push('deleteFramebuffer'),
    deleteRenderbuffer: () => calls.push('deleteRenderbuffer'),
    deleteVertexArray: () => calls.push('deleteVertexArray')
  }
  backend.textures = new Map([['texture', {
    thin: { dispose: () => calls.push('thin.dispose') },
    rtw: { dispose: () => calls.push('rtw.dispose') }
  }]])
  backend.programs = new Map([['program', { wrapper: { dispose: () => calls.push('program.dispose') } }]])
  backend.uniformBuffers = new Map([['ubo', { id: 'ubo' }]])
  backend._mrtFbos = new Map([['mrt', { id: 'fbo' }]])
  backend._depthRBs = new Map([['depth', { id: 'rb' }]])
  backend._emptyVAO = { id: 'vao' }
  backend._copyWrapper = { dispose: () => calls.push('copy.dispose') }
  backend._defaultTexture = { dispose: () => calls.push('default.dispose') }
  backend.effectRenderer = { dispose: () => calls.push('renderer.dispose') }

  backend.destroy({ abandonRawResources: true })

  assert.deepEqual(calls, [
    'thin.dispose', 'rtw.dispose', 'program.dispose', 'copy.dispose',
    'default.dispose', 'renderer.dispose'
  ])
  assert.equal(backend.textures.size, 0)
  assert.equal(backend.programs.size, 0)
  assert.equal(backend.uniformBuffers.size, 0)
  assert.equal(backend._mrtFbos.size, 0)
  assert.equal(backend._depthRBs.size, 0)
  assert.equal(backend._emptyVAO, null)
})

test('Babylon frame export uses a bounded non-blocking queue and packed top-down frames', () => {
  const { gl, backend } = makeBackend()
  const queue = backend.createFrameExportQueue({ slots: 2 })
  let completed = null

  queue.configure(DESCRIPTOR)
  assert.equal(queue._slots.length, 2)
  assert.equal(queue.enqueue('source', 123, (frame, timestamp) => { completed = { frame, timestamp } }), true)

  const beginCalls = gl.calls.map(call => call[0])
  assert.ok(beginCalls.indexOf('drawArrays') < beginCalls.indexOf('readPixels'))
  assert.ok(beginCalls.indexOf('readPixels') < beginCalls.indexOf('fenceSync'))
  assert.ok(beginCalls.indexOf('fenceSync') < beginCalls.indexOf('flush'))
  assert.equal(beginCalls.includes('getBufferSubData'), false)
  assert.match(gl.shaderSources.find(source => source.includes('out vec4 fragColor')), /sourceSize\.y\s*-\s*1/)

  queue.poll()
  assert.equal(completed, null)
  gl.waitStatus = gl.ALREADY_SIGNALED
  queue.poll()

  assert.equal(completed.timestamp, 123)
  assert.equal(completed.frame.width, DESCRIPTOR.width)
  assert.equal(completed.frame.height, DESCRIPTOR.height)
  assert.equal(completed.frame.rowStride, DESCRIPTOR.width * 4)
  assert.deepEqual([...completed.frame.data.slice(0, 5)], [0, 17, 34, 51, 68])
  assert.deepEqual(queue.stats, { accepted: 1, dropped: 0, completed: 1, failed: 0 })
  assert.throws(() => backend.createFrameExportQueue({ slots: 1 }), RangeError)
  assert.throws(() => backend.createFrameExportQueue({ slots: 9 }), RangeError)
})

test('Babylon frame export accepts every canonical color-space and alpha-mode descriptor', () => {
  const alphaModes = new Map([
    ['straight', 0],
    ['opaque', 1],
    ['premultiplied', 2]
  ])

  for (const colorSpace of ['srgb', 'display-p3']) {
    for (const [alphaMode, expectedUniform] of alphaModes) {
      const descriptor = {
        width: 3,
        height: 2,
        format: 'rgba8unorm',
        colorSpace,
        alphaMode,
        fps: 23.976
      }
      const { gl, backend } = makeBackend(descriptor)
      const queue = backend.createFrameExportQueue({ slots: 2 })

      queue.configure(descriptor)
      assert.equal(queue._slots[0].adapterSlot.data.length, 24)
      assert.equal(queue._slots[0].adapterSlot.frame.rowStride, 12)
      assert.equal(queue.enqueue('source', 0, () => {}), true)
      const alphaUniform = gl.calls.find(call =>
        call[0] === 'uniform1i' && call[1]?.name === 'u_alphaMode'
      )
      assert.equal(alphaUniform?.[2], expectedUniform)
      queue.close()
    }
  }
})

test('Babylon frame export rejects noncanonical descriptors before allocating GPU resources', () => {
  const invalidDescriptors = [
    null,
    { ...DESCRIPTOR, width: 0 },
    { ...DESCRIPTOR, width: 1.5 },
    { ...DESCRIPTOR, width: Number.MAX_SAFE_INTEGER },
    { ...DESCRIPTOR, height: -1 },
    { ...DESCRIPTOR, height: Infinity },
    { ...DESCRIPTOR, format: 'rgba8' },
    { ...DESCRIPTOR, colorSpace: 'sRGB' },
    { ...DESCRIPTOR, alphaMode: 'premultipliedAlpha' },
    { ...DESCRIPTOR, fps: 0 },
    { ...DESCRIPTOR, fps: Infinity }
  ]

  for (const descriptor of invalidDescriptors) {
    const { gl, backend } = makeBackend()
    const queue = backend.createFrameExportQueue({ slots: 2 })

    assert.throws(() => queue.configure(descriptor))
    assert.equal(gl.calls.some(call => call[0] === 'createTexture'), false)
    assert.equal(gl.calls.some(call => call[0] === 'createShader'), false)
  }
})
