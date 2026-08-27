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
      NO_ERROR: 0
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
  texImage2D (_target, _level, internalFormat) { this._boundTexture.internalFormat = internalFormat }
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
    createRawTexture () { return { getEngine: () => engine } },
    wipeCaches (force) { wipeCalls.push(force) }
  }
  backend.engine = engine
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
