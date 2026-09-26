// Port-side coverage for the upstream 9d3474df..2f47612c texture-policy sync (GAP-004):
// authorable 2D `mipmaps` (full chain allocation + per-frame regeneration) and `persistent`
// (contents preserved through recreation at a new size). Mirrors the upstream
// shaders/tests/test_mip_controls.js Pipeline/backend parts against the vendored v1.0.182
// Pipeline, using the same stub-engine patterns as backend-capabilities.test.js. The
// definition-validator and 3D `filter` parts live engine-side (bundle-internal; the port's
// createTexture3D path throws — no shipped effect uses a real 3D texture) and are recorded in
// the STATUS sync section instead.
import assert from 'node:assert/strict'
import test from 'node:test'

import { BabylonBackend } from '../src/runtime/babylonBackend.js'

// Recording stub backend: records createTexture/destroyTexture/copyTexture calls, keeps
// plain records in `textures` (same shape the vendored Pipeline reads: width/height/format/
// mipmaps/mipLevels/persistent/is3D).
function makeRecordingBackend () {
  const backend = Object.create(BabylonBackend.prototype)
  backend.textures = new Map()
  backend.created = []
  backend.destroyed = []
  backend.copies = []
  backend.createTexture = (id, spec) => {
    backend.created.push({ id, spec })
    const rec = {
      id, width: spec.width, height: spec.height, format: spec.format,
      mipmaps: spec.mipmaps === true,
      mipLevels: spec.mipmaps === true ? Math.max(1, Math.floor(Math.log2(Math.max(1, spec.width, spec.height))) + 1) : 1,
      persistent: spec.persistent === true
    }
    backend.textures.set(id, rec)
    return rec
  }
  backend.createTexture3D = (id, spec) => {
    backend.created.push({ id, spec, is3D: true })
    const rec = { id, width: spec.width, height: spec.height, depth: spec.depth, format: spec.format, is3D: true }
    backend.textures.set(id, rec)
    return rec
  }
  backend.destroyTexture = (id) => {
    backend.destroyed.push(id)
    backend.textures.delete(id)
  }
  backend.copyTexture = (srcId, dstId) => backend.copies.push([srcId, dstId])
  return backend
}

function makeFakeEngine () {
  return {
    createRenderTargetTexture: (size, options) => ({
      texture: { getEngine: () => fakeEngineRef, dispose: () => {} },
      dispose: () => {}
    })
  }
}
const fakeEngineRef = makeFakeEngine()

test('Pipeline (v1.0.182) passes mipmaps/persistent policy fields to backend texture creation', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  const { Pipeline } = await bootEngine()

  const backend = makeRecordingBackend()
  const graph = {
    passes: [],
    textures: new Map([
      ['probe_acc', { width: 'screen', height: 'screen', format: 'rgba16f', mipmaps: true, persistent: true }],
      ['probe_scratch', { width: 'screen', height: 'screen', format: 'rgba16f' }]
    ]),
    surfaces: new Map()
  }
  const pipeline = new Pipeline(graph, backend)
  pipeline.width = 256
  pipeline.height = 256
  pipeline.recreateTextures()

  const acc = backend.textures.get('probe_acc')
  assert.ok(acc, 'mipmapped persistent texture must be created')
  assert.equal(acc.mipmaps, true, 'record must expose mipmaps (queryable)')
  assert.ok(acc.mipLevels > 1, 'record must expose the allocated mip level count')
  assert.equal(acc.persistent, true, 'record must expose persistent (queryable)')

  const scratch = backend.textures.get('probe_scratch')
  assert.equal(scratch.mipmaps, false, 'plain texture must not gain a mip chain')
  assert.equal(scratch.persistent, false, 'plain texture must not gain persistence')

  // Global surfaces: the spec's policy fields propagate to both surface halves.
  graph.textures.set('global_o0', { width: 'screen', height: 'screen', format: 'rgba16f', mipmaps: true, persistent: true })
  pipeline.createSurfaces()
  for (const id of ['global_o0_read', 'global_o0_write']) {
    const rec = backend.textures.get(id)
    assert.ok(rec, `${id} must be created`)
    assert.equal(rec.mipmaps, true, `${id} must carry mipmaps`)
    assert.equal(rec.mipLevels > 1, true, `${id} must carry the allocated mip level count`)
    assert.equal(rec.persistent, true, `${id} must carry persistent`)
  }
})

test('persistent textures preserve contents across recreation; plain textures do not', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  const { Pipeline } = await bootEngine()

  const backend = makeRecordingBackend()
  const graph = {
    passes: [],
    textures: new Map([
      ['probe_acc', { width: 'screen', height: 'screen', format: 'rgba16f', persistent: true }],
      ['probe_scratch', { width: 'screen', height: 'screen', format: 'rgba16f' }]
    ]),
    surfaces: new Map()
  }
  const pipeline = new Pipeline(graph, backend)
  pipeline.width = 256
  pipeline.height = 256
  pipeline.recreateTextures()
  backend.copies.length = 0

  // Resize → recreateTextures: persistent texture must be copied out and back; the plain
  // texture must be destroyed/recreated without any copies.
  backend.textures.get('probe_acc').persistent = true
  pipeline.width = 128
  pipeline.height = 128
  pipeline.recreateTextures()

  const accCopies = backend.copies.filter(([src, dst]) => src === 'probe_acc' || dst === 'probe_acc')
  assert.ok(accCopies.length >= 2,
    `persistent recreation must copy old content out and back: ${JSON.stringify(backend.copies)}`)
  assert.deepEqual(accCopies[0], ['probe_acc', 'probe_acc__preserve_tmp'])
  const scratchCopies = backend.copies.filter(([src, dst]) => src === 'probe_scratch' || dst === 'probe_scratch')
  assert.equal(scratchCopies.length, 0,
    'non-persistent texture must be recreated without content preservation')
  assert.ok(backend.destroyed.includes('probe_scratch'), 'plain texture must still be recreated')
  assert.ok(backend.textures.has('probe_scratch'), 'plain texture must exist after recreation')
})

test('copyTexture carries the blit-equivalent uScale mapping (1:1 same-size, src/dst ratio on resize)', () => {
  const backend = Object.create(BabylonBackend.prototype)
  const bindPasses = []
  backend.textures = new Map()
  backend._copyWrapper = { name: 'copy' }
  backend.engine = { setAlphaMode: () => {} }
  backend.effectRenderer = { render: () => bindPasses.push({ ...backend._bindPass }) }
  const src = { thin: {}, width: 64, height: 64 }
  const dstSame = { thin: {}, rtw: {}, width: 64, height: 64 }
  const dstBig = { thin: {}, rtw: {}, width: 128, height: 128 }
  backend.textures.set('a', src)
  backend.textures.set('same', dstSame)
  backend.textures.set('big', dstBig)

  backend.copyTexture('a', 'same')
  backend.copyTexture('a', 'big')
  assert.deepEqual(bindPasses[0].__copyScale, [1, 1], 'same-size copy must use the 1:1 texelFetch branch')
  assert.deepEqual(bindPasses[1].__copyScale, [2, 2], 'size-changing copy must carry the src/dst ratio')
  assert.equal(backend._bindPass, null, 'bind pass scratch must be cleared')
})

test('generateMipmaps blits each adjacent mip level pair and skips non-mipmapped textures', () => {
  const backend = Object.create(BabylonBackend.prototype)
  const log = []
  const GL = {
    READ_FRAMEBUFFER: 0x8ca8,
    DRAW_FRAMEBUFFER: 0x8ca9,
    READ_FRAMEBUFFER_BINDING: 0x8caa,
    DRAW_FRAMEBUFFER_BINDING: 0x8ca6,
    COLOR_ATTACHMENT0: 0x8ce0,
    TEXTURE_2D: 0x0de1,
    COLOR_BUFFER_BIT: 0x4000,
    NEAREST: 0x2600
  }
  const prevRead = { binding: 'engine-read' }
  const prevDraw = { binding: 'engine-draw' }
  const fboRead = { fbo: 'mip-read' }
  const fboDraw = { fbo: 'mip-draw' }
  const gl = Object.assign({
    createFramebuffer: () => fboRead,
    getParameter: (p) => (p === GL.READ_FRAMEBUFFER_BINDING ? prevRead : prevDraw),
    bindFramebuffer: (target, fbo) => log.push(['bind', target, fbo]),
    framebufferTexture2D: (target, attachment, texTarget, tex, level) => log.push(['attach', tex, level]),
    blitFramebuffer: (sx0, sy0, sx1, sy1, dx0, dy0, dx1, dy1, mask, filter) => log.push(['blit', [sx1, sy1], [dx1, dy1], filter])
  }, GL)
  backend.gl = gl
  backend.textures = new Map()
  const mipTex = { mipmaps: true, mipLevels: 4, width: 8, height: 8, internal: { _hardwareTexture: { underlyingResource: { tex: 'mip' } } } }
  const plainTex = { mipmaps: false, mipLevels: 1, width: 8, height: 8, internal: { _hardwareTexture: { underlyingResource: { tex: 'plain' } } } }
  backend.textures.set('mip', mipTex)
  backend.textures.set('plain', plainTex)

  // 8x8 → chain 8,4,2,1 = 3 adjacent blits 8→4, 4→2, 2→1.
  backend.generateMipmaps(['mip', 'plain'])
  const blits = log.filter(([op]) => op === 'blit')
  assert.deepEqual(blits.map(([, src, dst]) => [src, dst]), [
    [[8, 8], [4, 4]], [[4, 4], [2, 2]], [[2, 2], [1, 1]]
  ])
  assert.ok(blits.every(([, , , filter]) => filter === GL.NEAREST), 'blits must be NEAREST')
  assert.ok(!log.some(([op, tex]) => op === 'attach' && tex === plainTex), 'non-mipmapped textures must be skipped')
  // Bindings restored to the pre-call state.
  const binds = log.filter(([op]) => op === 'bind')
  assert.deepEqual(binds[binds.length - 2], ['bind', GL.READ_FRAMEBUFFER, prevRead])
  assert.deepEqual(binds[binds.length - 1], ['bind', GL.DRAW_FRAMEBUFFER, prevDraw])
})

test('_allocateMipChain allocates levels 1..n-1 and moves the sampler to NEAREST/LINEAR_MIPMAP_LINEAR', () => {
  const backend = Object.create(BabylonBackend.prototype)
  const log = []
  const GL = {
    TEXTURE_2D: 0x0de1,
    RGBA: 0x1908,
    READ_FRAMEBUFFER: 0x8ca8,
    DRAW_FRAMEBUFFER: 0x8ca9,
    READ_FRAMEBUFFER_BINDING: 0x8caa,
    DRAW_FRAMEBUFFER_BINDING: 0x8ca6,
    HALF_FLOAT: 0x140b,
    RGBA16F: 0x881b,
    RGBA: 0x1908
  }
  const prevRead = { binding: 'engine-read' }
  const prevDraw = { binding: 'engine-draw' }
  const gl = Object.assign({
    getParameter: (p) => (p === GL.READ_FRAMEBUFFER_BINDING ? prevRead : prevDraw),
    bindTexture: (target, tex) => log.push(['bindTex', tex]),
    texImage2D: (target, level, internalFormat, w, h, border, format, type) => log.push(['texImage2D', level, internalFormat, w, h, format, type]),
    bindFramebuffer: (target, fbo) => log.push(['bindFbo', target, fbo])
  }, GL)
  const glTex = { tex: 'level0' }
  const internal = { _hardwareTexture: { underlyingResource: glTex } }
  backend.gl = gl
  backend.engine = {
    _getRGBABufferInternalSizedFormat: (type, format) => (type === GL.HALF_FLOAT ? GL.RGBA16F : GL.RGBA16F),
    _getWebGLTextureType: (type) => (type === GL.HALF_FLOAT ? 0x140b : type),
    updateTextureSamplingMode: (mode, tex, genMips) => log.push(['sampling', mode, genMips])
  }
  backend.engine.resetTextureCache = () => log.push(['resetCache'])

  backend._allocateMipChain(internal, 8, 8, { type: GL.HALF_FLOAT }, 4)
  const levels = log.filter(([op]) => op === 'texImage2D')
  assert.deepEqual(levels.map(([, level, fmt, w, h]) => [level, fmt, w, h]), [
    [1, GL.RGBA16F, 4, 4], [2, GL.RGBA16F, 2, 2], [3, GL.RGBA16F, 1, 1]
  ])
  assert.ok(levels.every((entry) => entry[5] === GL.RGBA && entry[6] === 0x140b), 'GL type must be the translated HALF_FLOAT (0x140b), not Babylon\'s enum (2)')
  const sampling = log.filter(([op]) => op === 'sampling')
  assert.deepEqual(sampling, [['sampling', 6, false]], 'sampler must be NEAREST/LINEAR_MIPMAP_LINEAR without gl.generateMipmap')
  assert.equal(internal.generateMipMaps, true)
  // Bindings restored.
  const fboBinds = log.filter(([op]) => op === 'bindFbo')
  assert.deepEqual(fboBinds[fboBinds.length - 2], ['bindFbo', GL.READ_FRAMEBUFFER, prevRead])
  assert.deepEqual(fboBinds[fboBinds.length - 1], ['bindFbo', GL.DRAW_FRAMEBUFFER, prevDraw])
})
