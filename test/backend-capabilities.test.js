import assert from 'node:assert/strict'
import test from 'node:test'

import { BabylonBackend } from '../src/runtime/babylonBackend.js'

class BudgetWebGL2 {
  constructor ({ maxDrawBuffers, maxTextureSize, maxColorBytesPerSample }) {
    Object.assign(this, {
      MAX_DRAW_BUFFERS: 0x8824,
      MAX_TEXTURE_SIZE: 0x0d33,
      TEXTURE_2D: 0x0de1,
      RGBA32F: 0x8814,
      RGBA16F: 0x881a,
      RGBA: 0x1908,
      FLOAT: 0x1406,
      HALF_FLOAT: 0x140b,
      FRAMEBUFFER: 0x8d40,
      DRAW_FRAMEBUFFER: 0x8ca9,
      READ_FRAMEBUFFER: 0x8ca8,
      DRAW_FRAMEBUFFER_BINDING: 0x8ca6,
      READ_FRAMEBUFFER_BINDING: 0x8caa,
      COLOR_ATTACHMENT0: 0x8ce0,
      FRAMEBUFFER_COMPLETE: 0x8cd5,
      FRAMEBUFFER_UNSUPPORTED: 0x8cdd,
      INVALID_FRAMEBUFFER_OPERATION: 0x0506,
      NO_ERROR: 0,
      TEXTURE_MIN_FILTER: 0x2801,
      TEXTURE_MAG_FILTER: 0x2800,
      TEXTURE_WRAP_S: 0x2802,
      TEXTURE_WRAP_T: 0x2803,
      LINEAR: 0x2601,
      CLAMP_TO_EDGE: 0x812f,
      UNPACK_FLIP_Y_WEBGL: 0x9240,
      UNSIGNED_BYTE: 0x1401
    })
    this.maxDrawBuffers = maxDrawBuffers
    this.maxTextureSize = maxTextureSize
    this.maxColorBytesPerSample = maxColorBytesPerSample
    this.liveTextures = new Set()
    this.liveFramebuffers = new Set()
    this.errors = []
    this._nextId = 1
    this._boundTexture = null
    this._boundDrawFramebuffer = null
    this._boundReadFramebuffer = null
    this.texParameters = []
    this.pixelStore = {}
  }

  _object (kind) { return { kind, id: this._nextId++ } }

  getParameter (parameter) {
    if (parameter === this.MAX_DRAW_BUFFERS) return this.maxDrawBuffers
    if (parameter === this.MAX_TEXTURE_SIZE) return this.maxTextureSize
    if (parameter === this.DRAW_FRAMEBUFFER_BINDING) return this._boundDrawFramebuffer
    if (parameter === this.READ_FRAMEBUFFER_BINDING) return this._boundReadFramebuffer
    throw new Error(`Unexpected parameter ${parameter}`)
  }

  createVertexArray () { return this._object('vertex-array') }
  createTexture () {
    const texture = this._object('texture')
    this.liveTextures.add(texture)
    return texture
  }

  bindTexture (_target, texture) { this._boundTexture = texture }
  texImage2D (_target, _level, internalFormat, _format, _type, source) {
    if (this._boundTexture) {
      this._boundTexture.internalFormat = internalFormat
      this._boundTexture.uploadedSource = source
    }
  }
  texParameteri (target, pname, param) {
    this.texParameters.push({ target, pname, param })
  }
  pixelStorei (pname, param) {
    this.pixelStore[pname] = param
  }
  deleteTexture (texture) { this.liveTextures.delete(texture) }

  createFramebuffer () {
    const framebuffer = this._object('framebuffer')
    framebuffer.attachments = new Map()
    this.liveFramebuffers.add(framebuffer)
    return framebuffer
  }

  bindFramebuffer (target, framebuffer) {
    if (target === this.FRAMEBUFFER || target === this.DRAW_FRAMEBUFFER) {
      this._boundDrawFramebuffer = framebuffer
    }
    if (target === this.FRAMEBUFFER || target === this.READ_FRAMEBUFFER) {
      this._boundReadFramebuffer = framebuffer
    }
  }

  framebufferTexture2D (_target, attachment, _textarget, texture) {
    if (texture) this._boundDrawFramebuffer.attachments.set(attachment, texture)
    else this._boundDrawFramebuffer.attachments.delete(attachment)
  }

  drawBuffers (attachments) { this._boundDrawFramebuffer.drawBuffers = [...attachments] }

  checkFramebufferStatus () {
    const bytes = [...this._boundDrawFramebuffer.attachments.values()]
      .reduce((total, texture) => total + (texture.internalFormat === this.RGBA32F ? 16 : 8), 0)
    if (bytes <= this.maxColorBytesPerSample) return this.FRAMEBUFFER_COMPLETE
    this.errors.push(this.INVALID_FRAMEBUFFER_OPERATION)
    return this.FRAMEBUFFER_UNSUPPORTED
  }

  deleteFramebuffer (framebuffer) { this.liveFramebuffers.delete(framebuffer) }
  getError () { return this.errors.shift() ?? this.NO_ERROR }
}

function makeBackend (gl) {
  const wipeCalls = []
  const backend = Object.create(BabylonBackend.prototype)
  const engine = {
    _gl: gl,
    createRawTexture (data, width, height, format, generateMipMaps, invertY, samplingMode, compression, type) {
      if (width === 1 && height === 1) {
        return { getEngine: () => engine }
      }
      const texture = gl?.createTexture()
      const internal = {
        width,
        height,
        format,
        type,
        _hardwareTexture: { underlyingResource: texture },
        dispose () { if (texture) gl?.deleteTexture(texture) },
        getEngine: () => engine
      }
      return internal
    },
    wipeCaches (force) { wipeCalls.push(force) }
  }
  backend.engine = engine
  backend.gl = gl
  backend.textures = new Map()
  backend.capabilities = {
    isMobile: false,
    floatBlend: true,
    floatLinear: false,
    colorBufferFloat: true,
    maxDrawBuffers: 8,
    maxTextureSize: 4096,
    maxStateSize: 2048
  }
  backend._buildCopyWrapper = () => ({})
  backend._whenReady = async () => {}
  return { backend, wipeCalls }
}

test('backend initialization reports device texture and MRT attachment limits', async () => {
  const gl = new BudgetWebGL2({
    maxDrawBuffers: 4,
    maxTextureSize: 8192,
    maxColorBytesPerSample: 32
  })
  const { backend } = makeBackend(gl)

  await backend.init()

  assert.equal(backend.capabilities.maxDrawBuffers, 4)
  assert.equal(backend.capabilities.maxTextureSize, 8192)
  assert.equal(backend.capabilities.maxColorBytesPerSample, 32)
})

test('MRT attachment probing releases temporary state and drains probe errors', async () => {
  const gl = new BudgetWebGL2({
    maxDrawBuffers: 4,
    maxTextureSize: 8192,
    maxColorBytesPerSample: 32
  })
  const { backend, wipeCalls } = makeBackend(gl)

  await backend.init()

  assert.equal(gl.liveTextures.size, 0)
  assert.equal(gl.liveFramebuffers.size, 0)
  assert.equal(gl.getError(), gl.NO_ERROR)
  assert.deepEqual(wipeCalls, [true])
})

test('MRT attachment probing restores existing draw and read framebuffer bindings', async () => {
  const gl = new BudgetWebGL2({
    maxDrawBuffers: 4,
    maxTextureSize: 8192,
    maxColorBytesPerSample: 32
  })
  const drawFramebuffer = gl.createFramebuffer()
  const readFramebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, drawFramebuffer)
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFramebuffer)
  const { backend } = makeBackend(gl)

  await backend.init()

  assert.equal(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), drawFramebuffer)
  assert.equal(gl.getParameter(gl.READ_FRAMEBUFFER_BINDING), readFramebuffer)
})

test('updateTextureFromSource returns zero dimensions when gl context is absent', () => {
  const { backend } = makeBackend(null)
  backend.gl = null
  const res = backend.updateTextureFromSource('tex', { width: 100, height: 100 })
  assert.deepEqual(res, { width: 0, height: 0 })
})

test('updateTextureFromSource rejects unknown, invalid, or zero-sized sources', () => {
  const gl = new BudgetWebGL2({ maxDrawBuffers: 4, maxTextureSize: 8192, maxColorBytesPerSample: 32 })
  const { backend } = makeBackend(gl)

  const origWarn = console.warn
  console.warn = () => {}
  try {
    // Unknown source type (not VideoFrame, not Canvas/Image)
    const resUnknown = backend.updateTextureFromSource('tex1', {})
    assert.deepEqual(resUnknown, { width: 0, height: 0 })

    class MockCanvas {
      constructor (w, h) { this.width = w; this.height = h }
    }
    const prevCanvas = globalThis.OffscreenCanvas
    globalThis.OffscreenCanvas = MockCanvas
    try {
      // Zero-sized canvas/image source
      const resZero = backend.updateTextureFromSource('tex2', new MockCanvas(0, 100))
      assert.deepEqual(resZero, { width: 0, height: 0 })
      const resZeroH = backend.updateTextureFromSource('tex3', new MockCanvas(100, 0))
      assert.deepEqual(resZeroH, { width: 0, height: 0 })
    } finally {
      if (prevCanvas) globalThis.OffscreenCanvas = prevCanvas
      else delete globalThis.OffscreenCanvas
    }
  } finally {
    console.warn = origWarn
  }
})

test('updateTextureFromSource handles mock VideoFrame dimensions, rotation, and anamorphic scaling rejection', () => {
  const gl = new BudgetWebGL2({ maxDrawBuffers: 4, maxTextureSize: 8192, maxColorBytesPerSample: 32 })
  const { backend } = makeBackend(gl)

  class MockVideoFrame {
    constructor ({ displayWidth, displayHeight, visibleRect, rotation = 0 }) {
      this.displayWidth = displayWidth
      this.displayHeight = displayHeight
      this.visibleRect = visibleRect
      this.rotation = rotation
    }
  }

  const prevVF = globalThis.VideoFrame
  globalThis.VideoFrame = MockVideoFrame

  try {
    // 1. Plain VideoFrame
    const plain = new MockVideoFrame({
      displayWidth: 1920,
      displayHeight: 1080,
      visibleRect: { width: 1920, height: 1080 },
      rotation: 0
    })
    const resPlain = backend.updateTextureFromSource('vf_plain', plain)
    assert.deepEqual(resPlain, { width: 1920, height: 1080 })
    assert.equal(backend.textures.has('vf_plain'), true)
    const rec = backend.textures.get('vf_plain')
    assert.equal(rec.width, 1920)
    assert.equal(rec.height, 1080)
    assert.equal(rec.isExternal, true)

    // 2. Rotated 90 deg: display dimensions match rotated visible rect
    const rot90 = new MockVideoFrame({
      displayWidth: 1080,
      displayHeight: 1920,
      visibleRect: { width: 1920, height: 1080 },
      rotation: 90
    })
    const res90 = backend.updateTextureFromSource('vf_rot90', rot90)
    assert.deepEqual(res90, { width: 1080, height: 1920 })

    // 3. Rotated 270 deg: display dimensions match rotated visible rect
    const rot270 = new MockVideoFrame({
      displayWidth: 1080,
      displayHeight: 1920,
      visibleRect: { width: 1920, height: 1080 },
      rotation: 270
    })
    const res270 = backend.updateTextureFromSource('vf_rot270', rot270)
    assert.deepEqual(res270, { width: 1080, height: 1920 })

    // 4. Anamorphic display scaling rejection: display dimensions != visible rect dimensions
    const anamorphic = new MockVideoFrame({
      displayWidth: 1920,
      displayHeight: 1080,
      visibleRect: { width: 1440, height: 1080 },
      rotation: 0
    })
    const resAnamorphic = backend.updateTextureFromSource('vf_ana', anamorphic)
    assert.deepEqual(resAnamorphic, { width: 0, height: 0 })

    // 5. Missing visibleRect rejection
    const noRect = new MockVideoFrame({
      displayWidth: 1920,
      displayHeight: 1080,
      visibleRect: null,
      rotation: 0
    })
    const resNoRect = backend.updateTextureFromSource('vf_norect', noRect)
    assert.deepEqual(resNoRect, { width: 0, height: 0 })
  } finally {
    if (prevVF) globalThis.VideoFrame = prevVF
    else delete globalThis.VideoFrame
  }
})

test('updateTextureFromSource recreates texture when dimensions change and applies flipY', () => {
  const gl = new BudgetWebGL2({ maxDrawBuffers: 4, maxTextureSize: 8192, maxColorBytesPerSample: 32 })
  const { backend } = makeBackend(gl)

  class MockCanvas {
    constructor (w, h) { this.width = w; this.height = h }
  }
  const prevCanvas = globalThis.OffscreenCanvas
  globalThis.OffscreenCanvas = MockCanvas

  try {
    const source1 = new MockCanvas(64, 32)
    const res1 = backend.updateTextureFromSource('tex', source1, { flipY: true })
    assert.deepEqual(res1, { width: 64, height: 32 })
    const initialRec = backend.textures.get('tex')
    assert.equal(initialRec.width, 64)
    assert.equal(initialRec.height, 32)
    assert.equal(gl.pixelStore[gl.UNPACK_FLIP_Y_WEBGL], false) // reset to false after upload

    // Re-upload with same dimensions reuses texture record
    const resSame = backend.updateTextureFromSource('tex', source1, { flipY: false })
    assert.deepEqual(resSame, { width: 64, height: 32 })
    assert.equal(backend.textures.get('tex'), initialRec)

    // Upload with changed dimensions replaces texture record
    const source2 = new MockCanvas(128, 64)
    const res2 = backend.updateTextureFromSource('tex', source2)
    assert.deepEqual(res2, { width: 128, height: 64 })
    const newRec = backend.textures.get('tex')
    assert.notEqual(newRec, initialRec)
    assert.equal(newRec.width, 128)
    assert.equal(newRec.height, 64)

    // Sampler state checks
    assert.ok(gl.texParameters.some(p => p.pname === gl.TEXTURE_MIN_FILTER && p.param === gl.LINEAR))
    assert.ok(gl.texParameters.some(p => p.pname === gl.TEXTURE_MAG_FILTER && p.param === gl.LINEAR))
    assert.ok(gl.texParameters.some(p => p.pname === gl.TEXTURE_WRAP_S && p.param === gl.CLAMP_TO_EDGE))
    assert.ok(gl.texParameters.some(p => p.pname === gl.TEXTURE_WRAP_T && p.param === gl.CLAMP_TO_EDGE))
  } finally {
    if (prevCanvas) globalThis.OffscreenCanvas = prevCanvas
    else delete globalThis.OffscreenCanvas
  }
})

test('createTexture and destroyTexture track and dispose format-aware texture records', () => {
  let disposedRtw = false
  let disposedInternal = false
  const backend = Object.create(BabylonBackend.prototype)
  backend.textures = new Map()
  backend._clearRtw = () => {}
  const engine = {
    createRenderTargetTexture: (size, options) => ({
      texture: {
        getEngine: () => engine,
        dispose: () => { disposedInternal = true }
      },
      dispose: () => { disposedRtw = true }
    })
  }
  backend.engine = engine

  const rec = backend.createTexture('dyn_tex', { width: 128, height: 128, format: 'rgba32f' })
  assert.equal(rec.width, 128)
  assert.equal(rec.height, 128)
  assert.equal(rec.format, 'rgba32f')
  assert.equal(backend.textures.get('dyn_tex'), rec)

  backend.destroyTexture('dyn_tex')
  assert.equal(backend.textures.has('dyn_tex'), false)
  assert.equal(disposedRtw, true)
  assert.equal(disposedInternal, true)
})

test('Pipeline with BabylonBackend recreates surfaces and regular textures when formats change', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  const { Pipeline } = await bootEngine()

  const backend = Object.create(BabylonBackend.prototype)
  backend.textures = new Map()
  backend._clearRtw = () => {}
  const engine = {
    createRenderTargetTexture: (size, options) => ({
      texture: { getEngine: () => engine, dispose: () => {} },
      dispose: () => {}
    })
  }
  backend.engine = engine

  // 1. Regular texture format change
  const graph = {
    passes: [],
    textures: new Map([['node_0_state', { width: 'screen', height: 'screen', format: 'rgba32f' }]]),
    surfaces: new Map()
  }
  const pipeline = new Pipeline(graph, backend)
  pipeline.width = 256
  pipeline.height = 256
  pipeline.recreateTextures()

  const regularBefore = backend.textures.get('node_0_state')
  assert.equal(regularBefore.format, 'rgba32f')

  // Change format to rgba16f
  graph.textures.get('node_0_state').format = 'rgba16f'
  pipeline.recreateTextures()

  const regularAfter = backend.textures.get('node_0_state')
  assert.equal(regularAfter.format, 'rgba16f')
  assert.notEqual(regularAfter, regularBefore)

  // Preserved when format and dimensions match
  pipeline.recreateTextures()
  assert.equal(backend.textures.get('node_0_state'), regularAfter)

  // 2. Global surface format change
  graph.textures.set('global_o0', { width: 'screen', height: 'screen', format: 'rgba32f', isGlobal: true })
  pipeline.createSurfaces()

  const surfaceBeforeRead = backend.textures.get('global_o0_read')
  const surfaceBeforeWrite = backend.textures.get('global_o0_write')
  assert.equal(surfaceBeforeRead.format, 'rgba32f')
  assert.equal(surfaceBeforeWrite.format, 'rgba32f')

  // Update surface format spec to rgba16f
  graph.textures.get('global_o0').format = 'rgba16f'
  pipeline.createSurfaces()

  const surfaceAfterRead = backend.textures.get('global_o0_read')
  const surfaceAfterWrite = backend.textures.get('global_o0_write')
  assert.equal(surfaceAfterRead.format, 'rgba16f')
  assert.equal(surfaceAfterWrite.format, 'rgba16f')
  assert.notEqual(surfaceAfterRead, surfaceBeforeRead)
  assert.notEqual(surfaceAfterWrite, surfaceBeforeWrite)

  // Preserved when matching
  pipeline.createSurfaces()
  assert.equal(backend.textures.get('global_o0_read'), surfaceAfterRead)
  assert.equal(backend.textures.get('global_o0_write'), surfaceAfterWrite)

  // 3. Stale write-side format recreation in recreateTextures
  surfaceAfterWrite.format = 'rgba32f'
  pipeline.recreateTextures({})
  const recreatedRead = backend.textures.get('global_o0_read')
  const recreatedWrite = backend.textures.get('global_o0_write')
  assert.notEqual(recreatedRead, surfaceAfterRead)
  assert.notEqual(recreatedWrite, surfaceAfterWrite)
  assert.equal(recreatedRead.format, 'rgba16f')
  assert.equal(recreatedWrite.format, 'rgba16f')
})

test('Pipeline with BabylonBackend preserves scoped texture dimensions when setUniform is called', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  const { Pipeline } = await bootEngine()

  const backend = Object.create(BabylonBackend.prototype)
  backend.textures = new Map()
  backend._clearRtw = () => {}
  const engine = {
    createRenderTargetTexture: (size, options) => ({
      texture: { getEngine: () => engine, dispose: () => {} },
      dispose: () => {}
    })
  }
  backend.engine = engine

  const graph = {
    passes: [
      {
        id: 'pass_0',
        uniforms: {
          volumeSize: 128,
          volumeSize_chain_0: 128
        }
      },
      {
        id: 'pass_1',
        uniforms: {
          volumeSize: 64,
          volumeSize_chain_1: 64
        }
      }
    ],
    textures: new Map([
      ['node_0_volumeCache', { width: { param: 'volumeSize_chain_0' }, height: { param: 'volumeSize_chain_0', power: 2 }, format: 'rgba16f' }],
      ['node_1_volumeCache', { width: { param: 'volumeSize_chain_1' }, height: { param: 'volumeSize_chain_1', power: 2 }, format: 'rgba16f' }]
    ]),
    surfaces: new Map()
  }
  const pipeline = new Pipeline(graph, backend)
  pipeline.recreateTextures(pipeline.collectDefaultUniforms())

  const atlasBeforeP0 = backend.textures.get('node_0_volumeCache')
  const atlasBeforeP1 = backend.textures.get('node_1_volumeCache')
  assert.equal(atlasBeforeP0.width, 128)
  assert.equal(atlasBeforeP0.height, 16384)
  assert.equal(atlasBeforeP1.width, 64)
  assert.equal(atlasBeforeP1.height, 4096)

  pipeline.setUniform('volumeSize_chain_1', 32)
  const atlasAfterP0 = backend.textures.get('node_0_volumeCache')
  const atlasAfterP1 = backend.textures.get('node_1_volumeCache')
  assert.equal(atlasAfterP0, atlasBeforeP0)
  assert.notEqual(atlasAfterP1, atlasBeforeP1)
  assert.equal(atlasAfterP0.width, 128)
  assert.equal(atlasAfterP0.height, 16384)
  assert.equal(atlasAfterP1.width, 32)
  assert.equal(atlasAfterP1.height, 1024)
})

