// babylonBackend.js — a Noisemaker render `Backend` implemented on @babylonjs/core.
//
// This is the ONLY new runtime component in the Babylon port: it satisfies the same
// abstract interface (`shaders/src/runtime/backend.js`) that the reference WebGL2 /
// WebGPU backends satisfy, so the *unchanged* reference `Pipeline` drives it. Every
// GPU operation mirrors `backends/webgl2.js` exactly, translated to Babylon's
// engine abstractions (so it runs on both WebGL2 and — via Babylon's GLSL→WGSL — WebGPU).
//
// Parity-load-bearing rules reproduced from webgl2.js:
//   - ALL 2D textures: NEAREST min/mag, CLAMP_TO_EDGE wrap (surfaces are sampled NEAREST;
//     critical for coord-resampling/warp effects).
//   - Render targets are linear half-float RGBA (rgba16f) by default; no hardware sRGB.
//   - Shader source is used VERBATIM (reference GLSL ES 3.00); the leading `#version` is
//     stripped (Babylon injects its own) and `defines` are forwarded as `#define`s.
//   - Uniform upload order: pass.uniforms first, then state.globalUniforms (skip dupes).
//   - Missing/`none` sampler inputs bind a 1x1 transparent-black texture.
//   - Blend: array [src,dst] → blendFunc; truthy non-array → additive ONE,ONE; else off.

import { Constants } from '@babylonjs/core/Engines/constants.js'
import { EffectWrapper, EffectRenderer } from '@babylonjs/core/Materials/effectRenderer.js'
import { ThinTexture } from '@babylonjs/core/Materials/Textures/thinTexture.js'
import { ShaderLanguage } from '@babylonjs/core/Materials/shaderLanguage.js'
import { Color4 } from '@babylonjs/core/Maths/math.color.js'
import { BabylonFrameExportAdapter } from './babylonFrameExport.js'
import { FrameExportQueue } from './frameExport.js'

// Minimal fullscreen vertex. We supply our OWN (instead of Babylon's default "postprocess"
// vertex) because that one declares `uniform vec2 scale;`, which collides with effects that
// have their own `scale` uniform ("Types of uniform 'scale' differ between VERTEX and FRAGMENT
// shaders"). Most effects address pixels via gl_FragCoord, but a few sample a `v_texCoord`
// varying (the reference DEFAULT_VERTEX_SHADER), so we emit it too (= position*0.5+0.5, same as
// the reference; harmless/unused for the others). EffectRenderer binds its fullscreen quad to
// the `position` attribute; gl_FragCoord then spans the bound target identically to the
// reference fullscreen triangle, and v_texCoord spans [0,1] identically.
const FULLSCREEN_VS = '#version 300 es\nprecision highp float;\nin vec2 position;\nout vec2 v_texCoord;\nvoid main(){ v_texCoord = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }\n'

// One structured diagnostic union for backend shader/compiler failures (port of the
// reference backends' diagnostics.js, GAP-007): every compile/link/missing-source
// failure surfaces as a real `Error` carrying the legacy machine `code`, the
// `backend` ('babylon'), the `stage`, the program id, a `detail` string, the parsed
// compiler `messages`, and the offending `source`. `code`/`detail`/`program`/`source`
// stay enumerable own properties to preserve the legacy thrown-object serialization
// shape. Detail fidelity differs by stage, mirroring upstream f83a427e: missing-source
// keeps the previous message byte-identical; a Babylon compile failure previously
// threw `Shader compile failed (${name}): ${log}` and now carries the RAW compiler
// info-log as `detail`/`message` (the prefix is dropped, matching the reference
// backends' compile diagnostics). No repo consumer matched on the prefixed text.
export class ShaderDiagnostic extends Error {
  constructor (spec) {
    const detail = spec.detail !== undefined && spec.detail !== null ? String(spec.detail) : ''
    super(detail)
    this.name = 'ShaderDiagnostic'
    if (spec.code !== undefined) this.code = spec.code
    this.backend = spec.backend
    this.stage = spec.stage
    this.detail = detail
    this.messages = spec.messages || []
    if (spec.program !== undefined) this.program = spec.program
    if (spec.source !== undefined) this.source = spec.source
  }
}

// Parse a GLSL info log into the structured diagnostic union: `ERROR: 0:LINE:` /
// `WARNING: 0:LINE:` forms become error/warning entries with their line; unprefixed
// driver prose is kept as an info entry so nothing is lost.
export function parseGLSLInfoLog (log) {
  if (typeof log !== 'string' || log.length === 0) return []
  const messages = []
  for (const line of log.split('\n')) {
    if (line.length === 0) continue
    const match = /^(ERROR|WARNING):\s*\d+:(\d+):\s*(.*)$/.exec(line)
    if (match) {
      messages.push({
        severity: match[1].toLowerCase(),
        line: parseInt(match[2], 10),
        column: undefined,
        message: match[3]
      })
    } else {
      messages.push({ severity: 'info', line: undefined, column: undefined, message: line })
    }
  }
  return messages
}

// rgba8/rgba16f/rgba32f/r8/r16f/r32f → Babylon { type, format } (mirrors webgl2 resolveFormat)
function resolveFormat (format) {
  const RGBA = Constants.TEXTUREFORMAT_RGBA
  const RED = Constants.TEXTUREFORMAT_R
  const U8 = Constants.TEXTURETYPE_UNSIGNED_BYTE
  const HF = Constants.TEXTURETYPE_HALF_FLOAT
  const F = Constants.TEXTURETYPE_FLOAT
  const table = {
    rgba8: { type: U8, format: RGBA },
    rgba16f: { type: HF, format: RGBA },
    rgba32f: { type: F, format: RGBA },
    r8: { type: U8, format: RED },
    r16f: { type: HF, format: RED },
    r32f: { type: F, format: RED }
  }
  return table[format] || table.rgba8
}

// Full mip chain length for a 2D texture dimension pair (mirrors webgl2 mipLevelCount).
function mipLevelCount (width, height) {
  const maxDim = Math.max(1, Math.floor(width), Math.floor(height))
  return Math.max(1, Math.floor(Math.log2(maxDim)) + 1)
}

// Size (>= 1) of one mip level for a dimension (mirrors webgl2 mipLevelSize).
function mipLevelSize (dim, level) {
  return Math.max(1, Math.floor(dim / Math.pow(2, level)))
}

// Parse `uniform <type> <name>[N];` declarations out of GLSL source so we can declare
// them to Babylon's Effect and dispatch the correct setter by type. (webgl2.js gets this
// from gl.getActiveUniform; we read it from source — same result for our shaders.)
const UNIFORM_RE = /\buniform\s+(?:highp\s+|mediump\s+|lowp\s+)?(\w+)\s+(\w+)\s*(?:\[\s*\d+\s*\])?\s*;/g
function parseUniforms (source) {
  const uniformTypes = {} // name -> 'float'|'int'|'bool'|'vec2'|...
  const samplerNames = []
  let m
  UNIFORM_RE.lastIndex = 0
  while ((m = UNIFORM_RE.exec(source)) !== null) {
    const type = m[1]
    const name = m[2]
    if (type.startsWith('sampler')) {
      if (!samplerNames.includes(name)) samplerNames.push(name)
    } else {
      uniformTypes[name] = type
    }
  }
  return { uniformTypes, samplerNames, uniformNames: Object.keys(uniformTypes) }
}

// Guarantee `#version 300 es` is first (+ highp precision) so Babylon takes the GLSL ES3 path
// and skips its ES1->ES3 migration. Shared by fragment and custom vertex (deposit) shaders.
function ensureVersion (src) {
  return '#version 300 es\nprecision highp float;\nprecision highp int;\n' + src.replace(/^[ \t]*#version[^\n]*$/m, '')
}

// parseGlobalName — verbatim from webgl2.js (global_<name> and camelCase global<Name>).
function parseGlobalName (texId) {
  if (typeof texId !== 'string') return null
  if (texId.startsWith('global_')) return texId.replace('global_', '')
  if (texId.startsWith('global') && texId.length > 6) {
    const suffix = texId.slice(6)
    if (/^[A-Z0-9]/.test(suffix)) return suffix.charAt(0).toLowerCase() + suffix.slice(1)
  }
  return null
}

export class BabylonBackend {
  constructor (engine) {
    this.engine = engine
    this.textures = new Map() // id -> { internal, thin, rtw, width, height, format }
    this.programs = new Map() // id -> { wrapper, uniformTypes, samplerSet }
    this.uniformBuffers = new Map()
    this.capabilities = {
      isMobile: false, floatBlend: true, floatLinear: false, colorBufferFloat: true,
      maxDrawBuffers: 8, maxTextureSize: 4096, maxColorBytesPerSample: 64,
      maxStateSize: 2048
    }
    this.effectRenderer = new EffectRenderer(engine)
    this._defaultTexture = null // 1x1 transparent black
    // per-pass binding scratch (read by each program's onApply observable, set right
    // before EffectRenderer.render — synchronous, so no race)
    this._bindPass = null
    this._bindState = null
    this._copyWrapper = null
    this._mipReadFbo = null // lazy — generateMipmaps NEAREST blit-chain FBO pair
    this._mipDrawFbo = null
    this._rawFbos = new Map() // glTex → raw FBO for mipmapped-target pass rendering
    this._destroyed = false
  }

  getName () { return 'Babylon' }
  static isAvailable () { return true }

  createFrameExportQueue (options = {}) {
    return new FrameExportQueue(new BabylonFrameExportAdapter(this), options)
  }

  async init () {
    // Raw WebGL2 context for the GPGPU paths (MRT FBOs + points/billboards draws) that don't
    // map onto Babylon's high-level draw API. Babylon still owns resource creation + shader
    // compile; these are the same operations webgl2.js does, on the same context.
    this.gl = this.engine._gl
    this._detectCapabilities()
    this._emptyVAO = this.gl.createVertexArray() // no attributes — points draws use gl_VertexID
    this._mrtFbos = new Map() // cacheKey -> WebGLFramebuffer
    // 1x1 transparent-black default (matches webgl2 defaultTexture for unbound/none inputs).
    const internal = this.engine.createRawTexture(
      new Uint8Array([0, 0, 0, 0]), 1, 1, Constants.TEXTUREFORMAT_RGBA,
      false, false, Constants.TEXTURE_NEAREST_SAMPLINGMODE, null, Constants.TEXTURETYPE_UNSIGNED_BYTE
    )
    internal.wrapU = Constants.TEXTURE_CLAMP_ADDRESSMODE
    internal.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE
    this._defaultTexture = new ThinTexture(internal)
    // Pre-compile the blit/copy program so synchronous blit passes never no-op on a
    // not-yet-ready effect (EffectRenderer.render silently skips an unready effect).
    this._copyWrapper = this._buildCopyWrapper()
    await this._whenReady(this._copyWrapper, this._copyWrapper.fragmentShader, this._copyWrapper.name)
  }

  _detectCapabilities () {
    const gl = this.gl
    this.capabilities.maxDrawBuffers = gl.getParameter(gl.MAX_DRAW_BUFFERS)
    this.capabilities.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
    this.capabilities.maxColorBytesPerSample = this._probeColorBytesPerSample()
  }

  _probeColorBytesPerSample () {
    const gl = this.gl
    const combos = [
      [64, [gl.RGBA32F, gl.RGBA32F, gl.RGBA32F, gl.RGBA32F]],
      [48, [gl.RGBA32F, gl.RGBA32F, gl.RGBA32F]],
      [40, [gl.RGBA32F, gl.RGBA32F, gl.RGBA16F]],
      [32, [gl.RGBA32F, gl.RGBA16F, gl.RGBA16F]]
    ]
    let budget = 16
    const drawFramebuffer = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)
    const readFramebuffer = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)
    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    try {
      for (const [bytes, formats] of combos) {
        if (formats.length > this.capabilities.maxDrawBuffers) continue
        const textures = []
        let complete = false
        try {
          const attachments = []
          for (let i = 0; i < formats.length; i++) {
            const texture = gl.createTexture()
            gl.bindTexture(gl.TEXTURE_2D, texture)
            const internalFormat = formats[i]
            const type = internalFormat === gl.RGBA32F ? gl.FLOAT : gl.HALF_FLOAT
            gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 2, 2, 0, gl.RGBA, type, null)
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, texture, 0)
            textures.push(texture)
            attachments.push(gl.COLOR_ATTACHMENT0 + i)
          }
          gl.drawBuffers(attachments)
          complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
        } finally {
          for (let i = 0; i < textures.length; i++) {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, null, 0)
            gl.deleteTexture(textures[i])
          }
        }
        if (complete) {
          budget = bytes
          break
        }
      }
    } finally {
      gl.bindTexture(gl.TEXTURE_2D, null)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, drawFramebuffer)
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFramebuffer)
      gl.deleteFramebuffer(fbo)
      while (gl.getError() !== gl.NO_ERROR) { /* drain probe errors */ }
      this.engine.wipeCaches(true)
    }
    return budget
  }

  // ---- textures --------------------------------------------------------------

  createTexture (id, spec) {
    const fmt = resolveFormat(spec.format)
    const width = spec.width
    const height = spec.height
    // Every graph texture is a renderable, NEAREST/CLAMP, linear half-float-by-default RGBA
    // target (surfaces, node intermediates, temps). We always make it a render target so it
    // can be both written and sampled.
    // Opt-in mip chain (webgl2.js `spec.mipmaps`): allocate EVERY level up front — sampling an
    // unallocated chain returns black and the per-level blits in generateMipmaps() would run
    // against incomplete framebuffers — then sample with mag NEAREST / min LINEAR_MIPMAP_LINEAR.
    const mipmaps = spec.mipmaps === true
    const mipLevels = mipmaps ? mipLevelCount(width, height) : 1
    const rtw = this.engine.createRenderTargetTexture({ width, height }, {
      // generateMipMaps stays false at creation: Babylon's own gl.generateMipmap() is invalid for
      // non-filterable float formats (the default rgba16f) and would not fill the chain with the
      // frame's level-0 contents anyway — the chain is allocated here and filled by the NEAREST
      // blits in generateMipmaps() (mirrors webgl2.js createTexture).
      generateMipMaps: false,
      generateDepthBuffer: false,
      generateStencilBuffer: false,
      type: fmt.type,
      format: fmt.format,
      samplingMode: Constants.TEXTURE_NEAREST_SAMPLINGMODE,
      noColorAttachment: false
    })
    const internal = rtw.texture
    internal.wrapU = Constants.TEXTURE_CLAMP_ADDRESSMODE
    internal.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE
    if (mipLevels > 1) this._allocateMipChain(internal, width, height, fmt, mipLevels)
    const thin = new ThinTexture(internal)
    const rec = {
      internal,
      thin,
      rtw,
      width,
      height,
      format: spec.format,
      handle: thin,
      mipmaps: mipLevels > 1,
      mipLevels,
      persistent: !!spec.persistent
    }
    this.textures.set(id, rec)
    // Initialize to transparent black (webgl2 clears new render FBOs).
    this._clearRtw(rtw, width, height)
    return rec
  }

  // webgl2.js createTexture mip-chain branch: allocate levels 1..n-1 on the internal GL
  // texture (Babylon only ever allocates level 0 for an RTT with generateMipMaps:false), then
  // move the sampler to mag NEAREST / min LINEAR_MIPMAP_LINEAR WITHOUT gl.generateMipmap()
  // (invalid for non-filterable float formats — the chain is filled by the NEAREST blits in
  // generateMipmaps()). Mirrors the reference's up-front texImage2D chain + texParameter pair.
  _allocateMipChain (internal, width, height, fmt, mipLevels) {
    const gl = this.gl
    const glTex = internal._hardwareTexture?.underlyingResource || null
    if (!glTex) throw new Error('BabylonBackend.createTexture: mip chain allocation could not resolve the internal GL texture')
    // The sized internal format Babylon itself used for level 0 — same helper, same args.
    const internalFormat = this.engine._getRGBABufferInternalSizedFormat(fmt.type, fmt.format)
    // Babylon texture-type enum → GL type enum (the texImage2D chain speaks raw GL).
    const glType = this.engine._getWebGLTextureType(fmt.type)
    const readBinding = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)
    const drawBinding = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)
    try {
      gl.bindTexture(gl.TEXTURE_2D, glTex)
      for (let level = 1; level < mipLevels; level++) {
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, mipLevelSize(width, level), mipLevelSize(height, level), 0, gl.RGBA, glType, null)
      }
      internal.generateMipMaps = true
      // mag NEAREST + min LINEAR_MIPMAP_LINEAR (=TEXTURE_NEAREST_LINEAR_MIPLINEAR); the
      // explicit generateMipMaps=false arg skips Babylon's own gl.generateMipmap() call.
      this.engine.updateTextureSamplingMode(Constants.TEXTURE_NEAREST_LINEAR_MIPLINEAR, internal, false)
    } finally {
      gl.bindTexture(gl.TEXTURE_2D, null)
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readBinding)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, drawBinding)
      this.engine.resetTextureCache?.()
    }
  }

  // webgl2.js generateMipmaps: regenerate the mip chain of mipmapped 2D textures from level 0
  // via a NEAREST blit chain between adjacent levels (works for every renderable format,
  // including non-filterable floats where gl.generateMipmap() is invalid — it is NOT used here).
  // Called by the reference Pipeline after each frame's passes for every `mipmaps: true`
  // texture; textures without a mip chain are skipped. Babylon FBO bindings are saved/restored
  // so the engine's cached GL state stays consistent across the raw blits.
  generateMipmaps (ids) {
    const gl = this.gl
    if (!gl || !ids || !ids.length) return
    if (!this._mipReadFbo) {
      this._mipReadFbo = gl.createFramebuffer()
      this._mipDrawFbo = gl.createFramebuffer()
    }
    const readBinding = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)
    const drawBinding = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)
    try {
      for (const id of ids) {
        const rec = this.textures.get(id)
        if (!rec || !rec.mipmaps || rec.is3D) continue
        const glTex = this._glTexOf(rec)
        if (!glTex) continue
        const { width, height, mipLevels } = rec
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this._mipReadFbo)
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._mipDrawFbo)
        for (let level = 1; level < mipLevels; level++) {
          gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, glTex, level - 1)
          gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, glTex, level)
          gl.blitFramebuffer(
            0, 0, mipLevelSize(width, level - 1), mipLevelSize(height, level - 1),
            0, 0, mipLevelSize(width, level), mipLevelSize(height, level),
            gl.COLOR_BUFFER_BIT,
            gl.NEAREST
          )
        }
      }
    } finally {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readBinding)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, drawBinding)
    }
  }

  createTexture3D (id, spec) {
    // Real GPU 3D textures (Pipeline `spec.is3D`/`spec.depth`). NOT used by any shipped effect:
    // the synth3d/filter3d/render3d/renderLit3d/cubemap "volumes" are 2D ATLASES (e.g. 64×4096 =
    // 64 slices of 64²) the Pipeline allocates via the normal createTexture path and shaders read
    // with texelFetch(volumeCache, ivec2(x, y + z*volSize)). The whole 3D-raymarch + cubemap chain
    // is byte-identical without this. Left throwing as a guard; implement only if an is3D effect lands.
    throw new Error('BabylonBackend.createTexture3D not implemented (no shipped effect uses a real 3D texture; 3D volumes are 2D atlases)')
  }

  // Raw CPU->GPU data upload (webgl2.js `uploadDataTexture`): used by the engine's external-state
  // path ONLY for synth/roll's MIDI note grid (`this.backend.uploadDataTexture('midiNoteGrid',
  // noteGrid|emptyNoteGrid, 128, 16)`, called every frame whether or not a live MIDI source is
  // attached — the empty grid is the no-input fallback, same as media/text's default textures).
  // Mirrors the reference: create (or recreate, if the size changed) an RGBA32F NEAREST/CLAMP
  // texture on first call, texSubImage2D-update it on every call after. Reuses createTexture so
  // the result is a normal `this.textures` record any later sampler-input lookup already finds.
  uploadDataTexture (id, data, width, height) {
    const gl = this.gl
    let rec = this.textures.get(id)
    if (!rec || rec.width !== width || rec.height !== height) {
      rec = this.createTexture(id, { width, height, format: 'rgba32f' })
    }
    const glTex = this._glTexOf(rec)
    try {
      gl.bindTexture(gl.TEXTURE_2D, glTex)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.FLOAT, data)
    } finally {
      gl.bindTexture(gl.TEXTURE_2D, null)
      this.engine.resetTextureCache?.()
    }
  }

  // External media texture upload (webgl2.js `updateTextureFromSource`): used by media input
  // effects (camera/video content, asyncInit updateTexture, VideoFrame).
  // Supports VideoFrame, HTMLVideoElement, HTMLImageElement, HTMLCanvasElement/OffscreenCanvas, ImageBitmap.
  // Borrowed VideoFrames are submitted synchronously; frames requiring display-size scaling are
  // rejected because native WebGL uploads visible pixels without scaling.
  updateTextureFromSource (id, source, options = {}) {
    const gl = this.gl
    if (!gl) return { width: 0, height: 0 }
    let rec = this.textures.get(id)

    const flipY = options.flipY !== false

    // Get source dimensions
    let width, height
    try {
      if (typeof VideoFrame === 'function' && source instanceof VideoFrame) {
        width = source.displayWidth
        height = source.displayHeight
        const rect = source.visibleRect
        const rotated = source.rotation === 90 || source.rotation === 270
        if (!rect || width !== (rotated ? rect.height : rect.width) ||
            height !== (rotated ? rect.width : rect.height)) {
          return { width: 0, height: 0 }
        }
      } else if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
        width = source.videoWidth
        height = source.videoHeight
      } else if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
        width = source.naturalWidth || source.width
        height = source.naturalHeight || source.height
      } else if (
        (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) ||
        (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) ||
        (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap)
      ) {
        width = source.width
        height = source.height
      } else {
        console.warn(`[BabylonBackend] Unknown source type for ${id}`)
        return { width: 0, height: 0 }
      }
    } catch {
      return { width: 0, height: 0 }
    }

    if (width === 0 || height === 0) {
      return { width: 0, height: 0 }
    }

    // Create texture if it doesn't exist or if dimensions changed
    let glTex
    if (!rec || rec.width !== width || rec.height !== height) {
      if (rec) {
        this.destroyTexture(id)
      }

      const internal = this.engine.createRawTexture(
        null, width, height, Constants.TEXTUREFORMAT_RGBA,
        false, false, Constants.TEXTURE_BILINEAR_SAMPLINGMODE, null, Constants.TEXTURETYPE_UNSIGNED_BYTE
      )
      internal.wrapU = Constants.TEXTURE_CLAMP_ADDRESSMODE
      internal.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE
      const thin = new ThinTexture(internal)

      rec = {
        internal,
        thin,
        width,
        height,
        format: 'rgba8',
        handle: thin,
        isExternal: true
      }
      this.textures.set(id, rec)

      glTex = this._glTexOf(rec)
      if (glTex) {
        gl.bindTexture(gl.TEXTURE_2D, glTex)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      }
    } else {
      glTex = this._glTexOf(rec)
      if (glTex) {
        gl.bindTexture(gl.TEXTURE_2D, glTex)
      }
    }

    if (!glTex) return { width: 0, height: 0 }

    try {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source
      )
    } finally {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.bindTexture(gl.TEXTURE_2D, null)
      this.engine.resetTextureCache?.()
    }

    return { width, height }
  }

  destroyTexture (id) {
    const rec = this.textures.get(id)
    if (!rec) return
    try { rec.thin?.dispose?.() } catch { /* noop */ }
    try { rec.rtw?.dispose?.() } catch { /* noop */ }
    try { rec.internal?.dispose?.() } catch { /* noop */ }
    this.textures.delete(id)
  }

  clearTexture (id) {
    const rec = this.textures.get(id)
    if (rec) this._clearRtw(rec.rtw, rec.width, rec.height)
  }

  _clearRtw (rtw, width, height) {
    const engine = this.engine
    engine.bindFramebuffer(rtw, 0, undefined, undefined, true)
    engine.clear(new Color4(0, 0, 0, 0), true, false, false)
    engine.unBindFramebuffer(rtw, true)
  }

  copyTexture (srcId, dstId) {
    const src = this.textures.get(srcId)
    const dst = this.textures.get(dstId)
    if (!src || !dst) return
    this._bindPass = {
      __copySrc: src.thin,
      // webgl2.js blitFramebuffer NEAREST rule, expressed as a level-0 texelFetch: dst pixel d
      // (gl_FragCoord = d + 0.5) reads src texel floor(d_fragCoord * src/dst). Level-0 texelFetch
      // is filter-independent — a mipmapped source must NOT be sampled through the
      // LINEAR_MIPMAP_LINEAR chain on a resize copy (the reference blit reads level 0).
      __copyScale: [src.width / dst.width, src.height / dst.height]
    }
    this.engine.setAlphaMode(Constants.ALPHA_DISABLE)
    this._renderToTextureTarget(dst, { wrapper: this._copyWrapper, uniformTypes: {}, samplerSet: new Set(['src']), hasCustomVertex: false })
    this._bindPass = null
  }

  _buildCopyWrapper () {
    // gl_FragCoord texelFetch copy at level 0 with the src/dst ratio — the exact
    // webgl2.js blitFramebuffer NEAREST mapping for 1:1 AND size-changing copies
    // (persistent-texture preservation through resize); filter-independent, so a
    // mipmapped source is never blended through its chain.
    // MUST carry `#version 300 es` or Babylon runs its ES1->ES3 migration and the effect never compiles.
    const w = new EffectWrapper({
      engine: this.engine,
      name: 'nm_copy',
      useShaderStore: false,
      useAsPostProcess: false,
      allowEmptySourceTexture: true,
      shaderLanguage: ShaderLanguage.GLSL,
      vertexShader: FULLSCREEN_VS,
      samplerNames: ['src'],
      uniformNames: ['uScale'],
      fragmentShader: '#version 300 es\nprecision highp float;\nuniform sampler2D src;\nin vec2 v_texCoord;\nuniform vec2 uScale;\nout vec4 fragColor;\nvoid main(){\n  fragColor = texelFetch(src, ivec2(floor(gl_FragCoord.xy * uScale)), 0);\n}\n'
    })
    w.onApplyObservable.add(() => {
      if (this._bindPass) {
        if (this._bindPass.__copySrc) w.effect.setTexture('src', this._bindPass.__copySrc)
        const scale = this._bindPass.__copyScale || [1, 1]
        w.effect.setFloat2('uScale', scale[0], scale[1])
      }
    })
    return w
  }

  // ---- programs --------------------------------------------------------------

  async compileProgram (id, spec) {
    // The reference `blit` program samples a `v_texCoord` varying emitted by the reference
    // fullscreen vertex; Babylon's EffectRenderer uses its own vertex (vUV), so that varying
    // would be unbound. We render blit passes via _executeBlit (a gl_FragCoord/texelFetch
    // copy — parity-equivalent for a same-size NEAREST blit), so skip compiling it here.
    if (id === 'blit') return null

    const rawSource = spec.source || spec.glsl || spec.fragment
    if (!rawSource) {
      throw new ShaderDiagnostic({
        code: 'ERR_SHADER_MISSING',
        backend: 'babylon',
        stage: 'missing-source',
        program: id,
        detail: `Shader source missing for program '${id}'.`
      })
    }
    // ensureVersion(): `#version 300 es` must be first so Babylon takes the GLSL ES3 path and
    // skips its ES1->ES3 migration (which mangles ES3 source + injects a conflicting glFragColor).
    const cleaned = ensureVersion(rawSource)
    // Points/agent deposit passes ship a custom vertex (texture-fetch + gl_VertexID); all other
    // passes use the shared fullscreen vertex.
    const hasCustomVertex = !!spec.vertex
    const vsource = hasCustomVertex ? ensureVersion(spec.vertex) : FULLSCREEN_VS
    // Uniforms/samplers may live in EITHER stage (a deposit vertex declares xyzTex/resolution).
    const fu = parseUniforms(cleaned)
    const vu = parseUniforms(vsource)
    const uniformTypes = { ...vu.uniformTypes, ...fu.uniformTypes }
    const samplerNames = [...new Set([...vu.samplerNames, ...fu.samplerNames])]
    const uniformNames = Object.keys(uniformTypes)
    const defines = spec.defines && Object.keys(spec.defines).length
      ? Object.entries(spec.defines).map(([k, v]) => `#define ${k} ${v}`)
      : null

    const wrapper = new EffectWrapper({
      engine: this.engine,
      name: id,
      useShaderStore: false,
      useAsPostProcess: false,
      allowEmptySourceTexture: true,
      shaderLanguage: ShaderLanguage.GLSL,
      vertexShader: vsource,
      fragmentShader: cleaned,
      uniformNames,
      samplerNames,
      defines
    })

    // spec.uniformLayout: the std140 packing for effects whose GLSL declares a
    // `layout(std140) uniform` block (only synth/remap ships one in WebGL2). Stored here;
    // the block(s) are extracted lazily on first draw (see _bindUniformBlocks). The ~31 other
    // effects that carry a uniformLayout use plain uniforms in their WebGL2 GLSL (the layout is
    // WGSL/fallback metadata) → ACTIVE_UNIFORM_BLOCKS === 0 → the bind is a no-op for them.
    const rec = { wrapper, uniformTypes, samplerSet: new Set(samplerNames), hasCustomVertex, uniformLayout: spec.uniformLayout || null }
    // Bind inputs + uniforms at draw time (onApply fires after enableEffect, before draw).
    wrapper.onApplyObservable.add(() => {
      if (!this._bindPass || this._bindPass.__copySrc) return
      this._bindInputs(this._bindPass, rec, wrapper.effect, this._bindState)
      this._bindUniforms(this._bindPass, rec, wrapper.effect, this._bindState)
      this._bindUniformBlocks(this._bindPass, rec, this._bindState)
      // webgl2.js viewport precedence (viewportTex branch): a pass rendering into a texture
      // target uses the TARGET's full size — an authored/resolved viewport is inert here.
      // Babylon's EffectRenderer already sets the RT's full-size viewport; no raw override.
    })

    await this._whenReady(wrapper, cleaned, id)
    this.programs.set(id, rec)
    return rec
  }

  _whenReady (wrapper, source, programId) {
    // Runs in the browser (Date/setTimeout available). Babylon may compile via
    // KHR_parallel_shader_compile (async), so poll isReady() yielding to the event loop.
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + 30000
      const tick = () => {
        const eff = wrapper.effect
        if (eff && eff.isReady && eff.isReady()) return resolve()
        const err = eff && typeof eff.getCompilationError === 'function' ? eff.getCompilationError() : null
        if (err) {
          // Structured diagnostic union (GAP-007 port): the legacy detail string stays
          // byte-identical; parsed compiler messages + the offending source ride along.
          const detail = typeof err === 'string' ? err : String(err && err.message ? err.message : err)
          return reject(new ShaderDiagnostic({
            code: 'ERR_SHADER_COMPILE',
            backend: 'babylon',
            stage: 'compile',
            program: programId,
            detail,
            messages: parseGLSLInfoLog(detail),
            source
          }))
        }
        if (Date.now() > deadline) return reject(new Error(`Shader compile timeout (${wrapper.name})`))
        setTimeout(tick, 2)
      }
      tick()
    })
  }

  _resolvePassViewportBox (pass) {
    if (!pass) return null
    const vp = pass.viewportResolved || pass.viewport
    if (!vp) return null
    const x = vp.x ?? 0
    const y = vp.y ?? 0
    const w = vp.w ?? vp.width
    const h = vp.h ?? vp.height
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h)) {
      return { x, y, w, h }
    }
    return null
  }

  // ---- pass execution --------------------------------------------------------

  executePass (pass, state) {
    const effectivePass = (pass.storageTextures || (pass.outputs && pass.outputs.outputBuffer))
      ? this._convertComputeToRender(pass)
      : pass

    if (effectivePass.program === 'blit') {
      return this._executeBlit(effectivePass, state)
    }

    const prog = this.programs.get(effectivePass.program)
    if (!prog) {
      throw { code: 'ERR_PROGRAM_NOT_FOUND', pass: effectivePass.id, program: effectivePass.program }
    }

    const outputKeys = Object.keys(effectivePass.outputs || {})
    const isMRT = effectivePass.drawBuffers > 1 || outputKeys.length > 1
    const dm = effectivePass.drawMode

    // GPGPU scatter draws (agent deposit): custom vertex + gl_VertexID + empty VAO.
    if (dm === 'points' || dm === 'billboards') return this._executePoints(effectivePass, prog, state, dm)
    // Mesh raster (triangles, depth+cull, gl_VertexID geometry fetch) — render/meshRender. Checked
    // before MRT: a triangles pass is single-output here, but keep the order explicit.
    if (dm === 'triangles') return this._executeTriangles(effectivePass, prog, state)
    // Multiple render targets (agent state / 3D volume precompute): fullscreen into N attachments.
    if (isMRT) return this._executeMRT(effectivePass, prog, state, outputKeys)

    // Single-output fullscreen (the proven 2D path).
    const outputId = this._resolveOutputId(effectivePass.outputs?.color ?? Object.values(effectivePass.outputs || {})[0], state)
    const outRec = this.textures.get(outputId)
    if (!outRec) { console.warn(`[BabylonBackend] output texture not found: ${outputId} (pass ${effectivePass.id})`); return }
    this.engine.setAlphaMode(this._resolveAlphaMode(effectivePass.blend))
    this._bindPass = effectivePass
    this._bindState = state
    if (outRec.mipmaps) {
      // A mipmapped output must not be rendered through EffectRenderer: the RTT unbind fires
      // Babylon's auto-mipgen (gl.generateMipmap on the float chain — invalid/different from
      // the reference). Raw FBO + full-size viewport + Babylon-managed draw instead.
      this._renderToTextureTarget(outRec, prog)
    } else {
      this.effectRenderer.render(prog.wrapper, outRec.rtw)
    }
    this._bindPass = null
    this._bindState = null
    this.engine.setAlphaMode(Constants.ALPHA_DISABLE)
  }

  // Render into a texture target through a RAW FBO (Babylon-managed draw, raw framebuffer
  // binding). Used for every pass whose target is a mipmapped texture: EffectRenderer's RTT
  // unbind would trigger Babylon's generateMipmap auto-fill, which neither the reference
  // (NEAREST blit chain after the frame) nor this port uses. The full-size viewport is set
  // explicitly because no Babylon RTT binding runs (webgl2.js viewportTex precedence).
  _renderToTextureTarget (outRec, prog) {
    if (!this._rawFbos) this._rawFbos = new Map()
    const gl = this.gl
    const glTex = this._glTexOf(outRec)
    if (!gl || !glTex) { throw new Error(`BabylonBackend: raw render target unavailable (${outRec.id || 'unknown'})`) }
    let fbo = this._rawFbos.get(glTex)
    if (!fbo) {
      fbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, glTex, 0)
      this._rawFbos.set(glTex, fbo)
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    }
    gl.viewport(0, 0, outRec.width, outRec.height)
    this._drawFullscreenInto(prog, this._bindPass, this._bindState)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.engine.wipeCaches(true)
  }

  // global_<name> output resolves to the current write buffer; non-global ids pass through.
  _resolveOutputId (rawId, state) {
    const g = parseGlobalName(rawId)
    if (g && state.writeSurfaces && state.writeSurfaces[g]) return state.writeSurfaces[g]
    return rawId
  }

  _glTexOf (rec) { return rec?.internal?._hardwareTexture?.underlyingResource || null }

  // MRT: fullscreen draw into N color attachments (agent state writes / 3D volume precompute).
  // Mirrors webgl2 createMRTFBO + the MRT executePass branch; attachment index = output key order.
  _executeMRT (pass, prog, state, outputKeys) {
    const gl = this.gl
    const texes = []
    const ids = []
    let viewportRec = null
    for (const key of outputKeys) {
      const id = this._resolveOutputId(pass.outputs[key], state)
      const rec = this.textures.get(id)
      ids.push(id)
      if (rec) { texes.push(this._glTexOf(rec)); if (!viewportRec) viewportRec = rec }
    }
    if (!texes.length || texes.some(t => !t)) { console.warn(`[BabylonBackend] MRT ${pass.id}: missing output texture`); return }

    const cacheKey = `${pass.id}:${ids.join(',')}`
    let fbo = this._mrtFbos.get(cacheKey)
    if (!fbo) {
      fbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      const bufs = []
      for (let i = 0; i < texes.length; i++) { gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, texes[i], 0); bufs.push(gl.COLOR_ATTACHMENT0 + i) }
      gl.drawBuffers(bufs)
      this._mrtFbos.set(cacheKey, fbo)
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      // Reattach (write buffers ping-pong each frame, so the cached FBO's attachments rotate).
      const bufs = []
      for (let i = 0; i < texes.length; i++) { gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, texes[i], 0); bufs.push(gl.COLOR_ATTACHMENT0 + i) }
      gl.drawBuffers(bufs)
    }
    // webgl2.js viewportTex precedence: texture targets render at the TARGET's full size;
    // authored/resolved viewports are inert for texture passes (viewport overrides removed —
    // they rendered the ca3d volume simulate pass inset and broke pixel parity).
    gl.viewport(0, 0, viewportRec.width, viewportRec.height)
    this.engine.setAlphaMode(this._resolveAlphaMode(pass.blend))
    this._drawFullscreenInto(prog, pass, state)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.engine.setAlphaMode(Constants.ALPHA_DISABLE)
    this.engine.wipeCaches(true)
  }

  // Draw the fullscreen quad with prog's effect into the currently-bound framebuffer.
  // Mirrors EffectRenderer.render: enableEffect THEN notify onApplyObservable (EffectRenderer
  // fires it explicitly; without this the raw-FBO path would never bind samplers/uniforms).
  _drawFullscreenInto (prog, pass, state) {
    const effect = prog.wrapper.effect
    this.engine.enableEffect(prog.wrapper.drawWrapper)
    if (prog.wrapper.onApplyObservable) prog.wrapper.onApplyObservable.notifyObservers({})
    this._bindInputs(pass, prog, effect, state)
    this._bindUniforms(pass, prog, effect, state)
    this._bindUniformBlocks(pass, prog, state)
    this.effectRenderer.bindBuffers(effect)
    this.effectRenderer.draw()
  }

  // points/billboards deposit: enable the custom-vertex effect, bind the single accumulator
  // target + additive blend, and draw `count` vertices with no buffers (gl_VertexID drives it).
  _executePoints (pass, prog, state, drawMode) {
    const gl = this.gl
    const outputId = this._resolveOutputId(pass.outputs?.color ?? Object.values(pass.outputs || {})[0], state)
    const outRec = this.textures.get(outputId)
    if (!outRec) { console.warn(`[BabylonBackend] points ${pass.id}: no output ${outputId}`); return }
    const count = this._pointCount(pass, state)
    if (!count) return
    this.engine.bindFramebuffer(outRec.rtw) // bind FBO + viewport (full target size)
    const effect = prog.wrapper.effect
    this.engine.enableEffect(prog.wrapper.drawWrapper)
    this._bindInputs(pass, prog, effect, state)
    this._bindUniforms(pass, prog, effect, state)
    // Set blend with RAW gl, EXACTLY like webgl2.js — additive deposit MUST be blendFunc(ONE,ONE).
    // Babylon's setAlphaMode(ALPHA_ADD) is (SRC_ALPHA, ONE), which scales each deposit by its own
    // alpha and crushes the HDR trail accumulation (dim/low-contrast output). Raw gl is safe here
    // because the points draw is a raw gl.drawArrays (not a Babylon-managed draw).
    this._setBlendRaw(pass.blend)
    gl.bindVertexArray(this._emptyVAO)
    gl.drawArrays(drawMode === 'billboards' ? gl.TRIANGLES : gl.POINTS, 0, drawMode === 'billboards' ? count * 6 : count)
    gl.bindVertexArray(null)
    gl.disable(gl.BLEND)
    this.engine.unBindFramebuffer(outRec.rtw)
    this.engine.wipeCaches(true) // resync Babylon's cached GL state after the raw draw
  }

  // Raw-GL blend setup matching webgl2.js executePass: array → blendFunc(src,dst); truthy → additive
  // ONE,ONE; falsy → off. (FUNC_ADD equation.)
  _setBlendRaw (blend) {
    const gl = this.gl
    if (!blend) { gl.disable(gl.BLEND); return }
    gl.enable(gl.BLEND)
    gl.blendEquation(gl.FUNC_ADD)
    if (Array.isArray(blend)) gl.blendFunc(this._blendFactorGL(blend[0]), this._blendFactorGL(blend[1]))
    else gl.blendFunc(gl.ONE, gl.ONE)
  }

  _blendFactorGL (f) {
    const gl = this.gl
    if (typeof f === 'number') return f
    const m = {
      zero: gl.ZERO, one: gl.ONE, ZERO: gl.ZERO, ONE: gl.ONE,
      src: gl.SRC_COLOR, 'src-color': gl.SRC_COLOR, SRC_COLOR: gl.SRC_COLOR,
      'one-minus-src': gl.ONE_MINUS_SRC_COLOR, ONE_MINUS_SRC_COLOR: gl.ONE_MINUS_SRC_COLOR,
      dst: gl.DST_COLOR, 'dst-color': gl.DST_COLOR, DST_COLOR: gl.DST_COLOR,
      'one-minus-dst': gl.ONE_MINUS_DST_COLOR, ONE_MINUS_DST_COLOR: gl.ONE_MINUS_DST_COLOR,
      'src-alpha': gl.SRC_ALPHA, SRC_ALPHA: gl.SRC_ALPHA,
      'one-minus-src-alpha': gl.ONE_MINUS_SRC_ALPHA, ONE_MINUS_SRC_ALPHA: gl.ONE_MINUS_SRC_ALPHA,
      'dst-alpha': gl.DST_ALPHA, DST_ALPHA: gl.DST_ALPHA,
      'one-minus-dst-alpha': gl.ONE_MINUS_DST_ALPHA, ONE_MINUS_DST_ALPHA: gl.ONE_MINUS_DST_ALPHA
    }
    return m[f] ?? gl.ONE
  }

  // count: number, or 'auto'/'screen'/'input' → texel count of the agent state texture (xyzTex).
  _pointCount (pass, state) {
    let count = pass.count ?? 1000
    if (count === 'auto' || count === 'screen' || count === 'input') {
      const stateId = pass.inputs?.xyzTex || pass.inputs?.inputTex
      const g = parseGlobalName(stateId)
      const rec = g ? (state.surfaces?.[g] || this.textures.get(this._resolveOutputId(stateId, state))) : this.textures.get(stateId)
      const w = rec?.width; const h = rec?.height
      count = (w && h) ? w * h : 0
    }
    return Math.max(0, count | 0)
  }

  // Mesh triangle raster (render/meshRender): a custom vertex (gl_VertexID + texelFetch of the
  // mesh position/normal textures) draws `count` vertices with depth-test + back-face cull into
  // a single output, exactly like the webgl2.js `drawMode:'triangles'` branch. Geometry lives in
  // the mesh surfaces (global_mesh0_positions/normals); with no host-loaded OBJ those are zeroed,
  // so every triangle is degenerate and the output is just the prior clear (matches the reference's
  // empty-mesh render). meshLoader declares `externalMesh` — external geometry, like media's
  // externalTexture — so this path is correct-if-fed; the parity corpus does not exercise geometry.
  _executeTriangles (pass, prog, state) {
    const gl = this.gl
    const outputId = this._resolveOutputId(pass.outputs?.color ?? pass.outputs?.fragColor ?? Object.values(pass.outputs || {})[0], state)
    const outRec = this.textures.get(outputId)
    if (!outRec) { console.warn(`[BabylonBackend] triangles ${pass.id}: no output ${outputId}`); return }
    const count = this._triCount(pass, state)
    this.engine.bindFramebuffer(outRec.rtw) // bind FBO + viewport (full target size)
    this._ensureDepthBuffer(outRec) // attach a DEPTH_COMPONENT24 renderbuffer to the bound FBO
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true)
    gl.enable(gl.CULL_FACE); gl.frontFace(gl.CCW); gl.cullFace(gl.BACK)
    gl.clear(gl.DEPTH_BUFFER_BIT)
    const effect = prog.wrapper.effect
    this.engine.enableEffect(prog.wrapper.drawWrapper)
    this._bindInputs(pass, prog, effect, state)
    this._bindUniforms(pass, prog, effect, state)
    this._setBlendRaw(pass.blend) // meshRender uses blend:false → BLEND disabled
    gl.bindVertexArray(this._emptyVAO)
    gl.drawArrays(gl.TRIANGLES, 0, count)
    gl.bindVertexArray(null)
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND)
    this.engine.unBindFramebuffer(outRec.rtw)
    this.engine.wipeCaches(true) // resync Babylon's cached GL state after the raw draw
  }

  // A depth renderbuffer for the mesh pass. Babylon's render targets are created without depth
  // (generateDepthBuffer:false); attach our own to the currently-bound FBO, cached by size and
  // reattached (Babylon's RTW FBO is stable per target, but reattach is cheap + safe). The
  // attachment is harmless to later fullscreen 2D passes — they run with DEPTH_TEST disabled.
  _ensureDepthBuffer (outRec) {
    const gl = this.gl
    if (!this._depthRBs) this._depthRBs = new Map()
    const key = `${outRec.width}x${outRec.height}`
    let rb = this._depthRBs.get(key)
    if (!rb) { rb = gl.createRenderbuffer(); this._depthRBs.set(key, rb) }
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, outRec.width, outRec.height)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)
  }

  // Mesh vertex count: number, or 'input'/'auto' → texel count of the mesh position texture
  // (one vertex per texel). countUniform reads the live count from a uniform. Mirrors webgl2.js.
  _triCount (pass, state) {
    let count = pass.count ?? 3
    if (pass.countUniform) {
      const v = (pass.uniforms && pass.uniforms[pass.countUniform]) ?? state?.globalUniforms?.[pass.countUniform]
      if (v != null) return Math.max(0, v | 0)
    }
    if (count === 'input' || count === 'auto') {
      const meshId = pass.inputs?.meshPositions || pass.inputs?.inputTex
      // Same scoped→unscoped chain fallback as input binding (webgl2.js:1220).
      const rec = (meshId && this.textures.get(meshId)) ||
        (meshId && this.textures.get(String(meshId).replace(/_chain_\d+$/, ''))) ||
        this.textures.get(this._resolveOutputId(meshId, state))
      const w = rec?.width; const h = rec?.height
      count = (w && h) ? w * h : 3
    }
    return Math.max(0, count | 0)
  }

  _executeBlit (pass, state) {
    // Internal copy pass (program:'blit'): inputs.src -> outputs.color (a surface).
    let outputId = pass.outputs?.color || Object.values(pass.outputs || {})[0]
    const gname = parseGlobalName(outputId)
    if (gname && state.writeSurfaces && state.writeSurfaces[gname]) outputId = state.writeSurfaces[gname]
    const dst = this.textures.get(outputId)
    if (!dst) return
    const srcThin = this._resolveInput(pass.inputs?.src, state)
    this._bindPass = { __copySrc: srcThin, __copyScale: [1, 1] }
    this.engine.setAlphaMode(Constants.ALPHA_DISABLE)
    this._renderToTextureTarget(dst, { wrapper: this._copyWrapper, uniformTypes: {}, samplerSet: new Set(['src']), hasCustomVertex: false })
    this._bindPass = null
  }

  _convertComputeToRender (pass) {
    const renderPass = { ...pass, type: 'render' }
    if (pass.storageTextures) {
      renderPass.outputs = {}
      for (const [k, texId] of Object.entries(pass.storageTextures)) renderPass.outputs[k] = texId
    }
    if (pass.outputs) {
      renderPass.outputs = {}
      for (const [k, texId] of Object.entries(pass.outputs)) {
        renderPass.outputs[k === 'outputBuffer' ? 'color' : k] = texId
      }
    }
    if (!renderPass.outputs || Object.keys(renderPass.outputs).length === 0) {
      renderPass.outputs = { color: 'outputTex' }
    }
    return renderPass
  }

  _resolveInput (texId, state) {
    if (texId == null || texId === 'none') return this._defaultTexture
    const gname = parseGlobalName(texId)
    if (gname) {
      let rec = this.textures.get(texId) // scoped id first (e.g. global_mesh0_positions_chain_0)
      if (rec) return rec.thin
      // Chain-scope fallback (mirrors webgl2.bindTextures): the expander adds `_chain_N` suffixes,
      // but externally/host-uploaded shared resources (mesh geometry) are stored under the
      // unscoped base id (global_mesh0_positions). Strip the suffix and retry.
      const unscoped = texId.replace(/_chain_\d+$/, '')
      if (unscoped !== texId) { rec = this.textures.get(unscoped); if (rec) return rec.thin }
      const surf = state.surfaces?.[gname]
      if (surf && surf.thin) return surf.thin
      if (surf && surf.handle) return surf.handle
      return this._defaultTexture
    }
    const rec = this.textures.get(texId)
    return rec ? rec.thin : this._defaultTexture
  }

  _bindInputs (pass, prog, effect, state) {
    if (!pass.inputs) return
    for (const [samplerName, texId] of Object.entries(pass.inputs)) {
      if (!prog.samplerSet.has(samplerName)) continue
      effect.setTexture(samplerName, this._resolveInput(texId, state))
    }
  }

  _bindUniforms (pass, prog, effect, state) {
    const types = prog.uniformTypes
    if (pass.uniforms) {
      for (const name in pass.uniforms) {
        if (!(name in types)) continue
        const v = pass.uniforms[name]
        if (v === undefined || v === null) continue
        this._setUniform(effect, name, types[name], v)
      }
    }
    if (state && state.globalUniforms) {
      for (const name in state.globalUniforms) {
        if (pass.uniforms && name in pass.uniforms) continue
        if (!(name in types)) continue
        const v = state.globalUniforms[name]
        if (v === undefined || v === null) continue
        this._setUniform(effect, name, types[name], v)
      }
    }
  }

  _setUniform (effect, name, type, value) {
    switch (type) {
      case 'float':
        effect.setFloat(name, Array.isArray(value) ? value[0] : value)
        break
      case 'int':
        effect.setInt(name, typeof value === 'boolean' ? (value ? 1 : 0) : (value | 0))
        break
      case 'bool':
        effect.setBool(name, typeof value === 'boolean' ? value : !!value)
        break
      case 'vec2': {
        const a = Array.isArray(value) ? value : [value, value]
        effect.setFloat2(name, a[0] ?? 0, a[1] ?? 0)
        break
      }
      case 'vec3': {
        const a = Array.isArray(value) ? value : [value, value, value]
        effect.setFloat3(name, a[0] ?? 0, a[1] ?? 0, a[2] ?? 0)
        break
      }
      case 'vec4': {
        const a = Array.isArray(value) ? value : [value, value, value, value]
        effect.setFloat4(name, a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, a[3] ?? 1)
        break
      }
      case 'mat3':
        // Babylon's setMatrix3x3 wants a Float32Array(9); the reference supplies plain arrays
        // (e.g. cubeBasis = CUBE_FACE_BASES[face], the per-face camera basis in renderCubemap()).
        effect.setMatrix3x3(name, value instanceof Float32Array ? value : new Float32Array(value))
        break
      case 'mat4':
        effect.setMatrix(name, value instanceof Float32Array ? value : new Float32Array(value))
        break
      default:
        // ivecN / uintN / etc. — fall back to float-ish; extend as needed.
        if (Array.isArray(value)) effect.setArray(name, value)
        else effect.setFloat(name, value)
    }
  }

  // ---- std140 uniform blocks (UBO) -------------------------------------------
  // Only synth/remap declares a `layout(std140) uniform RemapUniforms { vec4 data[267]; }` block
  // (its 8-zone polygon-router config — 267 vec4 slots — is too large for individual uniforms).
  // The reference uploads it via a packed UBO (webgl2.js extractUniformBlocks + bindUniformBlocks +
  // packUniformsWithLayout); we mirror that on the raw GL context exactly, so the bytes are identical.
  // Lazily extract on first draw: the program is current (enableEffect just ran), so we can query its
  // active blocks. No-op when the program has no std140 block (every effect except remap).

  _bindUniformBlocks (pass, prog, state) {
    if (!prog.uniformLayout) return
    const gl = this.gl
    if (prog.uniformBlocks === undefined) prog.uniformBlocks = this._extractUniformBlocks(prog.uniformLayout)
    if (!prog.uniformBlocks.length) return
    const merged = this._mergeBlockUniforms(pass, state)
    for (const block of prog.uniformBlocks) {
      const data = this._packUniformsWithLayout(merged, block.layoutArray, block.size)
      gl.bindBuffer(gl.UNIFORM_BUFFER, block.buffer)
      gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data)
      gl.bindBufferBase(gl.UNIFORM_BUFFER, block.bindingPoint, block.buffer)
    }
    gl.bindBuffer(gl.UNIFORM_BUFFER, null)
  }

  _extractUniformBlocks (layout) {
    const gl = this.gl
    const program = gl.getParameter(gl.CURRENT_PROGRAM)
    const blocks = []
    if (!program) return blocks
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS)
    if (!count) return blocks
    const layoutArray = this._normalizeLayout(layout)
    let maxSlot = 0
    for (const e of layoutArray) maxSlot = Math.max(maxSlot, e.slot)
    const layoutSize = (maxSlot + 1) * 16
    for (let i = 0; i < count; i++) {
      const name = gl.getActiveUniformBlockName(program, i)
      if (!name) continue
      const declaredSize = gl.getActiveUniformBlockParameter(program, i, gl.UNIFORM_BLOCK_DATA_SIZE)
      const size = Math.max(declaredSize, layoutSize)
      const bindingPoint = blocks.length
      const buffer = gl.createBuffer()
      gl.bindBuffer(gl.UNIFORM_BUFFER, buffer)
      gl.bufferData(gl.UNIFORM_BUFFER, size, gl.DYNAMIC_DRAW)
      gl.bindBuffer(gl.UNIFORM_BUFFER, null)
      gl.uniformBlockBinding(program, i, bindingPoint)
      this.uniformBuffers.set(`${name}#${this.uniformBuffers.size}`, buffer)
      blocks.push({ name, index: i, bindingPoint, buffer, size, layoutArray })
    }
    return blocks
  }

  _normalizeLayout (layout) {
    if (Array.isArray(layout)) return layout
    const out = []
    for (const [name, spec] of Object.entries(layout || {})) out.push({ name, slot: spec.slot, components: spec.components })
    return out
  }

  // pass.uniforms override state.globalUniforms (same precedence as webgl2.bindUniformBlocks).
  _mergeBlockUniforms (pass, state) {
    const merged = {}
    if (state && state.globalUniforms) {
      for (const k in state.globalUniforms) { const v = state.globalUniforms[k]; if (v !== undefined) merged[k] = v }
    }
    if (pass && pass.uniforms) {
      for (const k in pass.uniforms) { const v = pass.uniforms[k]; if (v !== undefined) merged[k] = v }
    }
    return merged
  }

  _resolveBlockAlias (name, uniforms) {
    if (uniforms[name] !== undefined) return uniforms[name]
    if (name === 'width' && uniforms.resolution) return uniforms.resolution[0]
    if (name === 'height' && uniforms.resolution) return uniforms.resolution[1]
    if (name === 'channels') return 4.0
    return undefined
  }

  // std140 pack: each entry's first component lands at slot*16 + componentOffset, consecutive
  // floats follow (little-endian). Byte-for-byte identical to webgl2.packUniformsWithLayout.
  _packUniformsWithLayout (uniforms, layoutArray, minSize = 0) {
    let maxSlot = 0
    for (const e of layoutArray) maxSlot = Math.max(maxSlot, e.slot)
    const bufferSize = Math.max(minSize, (maxSlot + 1) * 16)
    if (!this._packedBuffer || bufferSize > this._packedBuffer.byteLength) {
      this._packedBuffer = new ArrayBuffer(bufferSize)
      this._packedView = new DataView(this._packedBuffer)
      this._packedBytes = new Uint8Array(this._packedBuffer)
    }
    const view = this._packedView
    this._packedBytes.fill(0, 0, bufferSize)
    const co = { x: 0, y: 4, z: 8, w: 12 }
    for (const entry of layoutArray) {
      const value = this._resolveBlockAlias(entry.name, uniforms)
      if (value === undefined || value === null) continue
      const slotOffset = entry.slot * 16
      const comp = entry.components
      if (comp.length === 1) {
        const offset = slotOffset + co[comp]
        if (typeof value === 'boolean') view.setFloat32(offset, value ? 1.0 : 0.0, true)
        else if (typeof value === 'number') view.setFloat32(offset, value, true)
      } else {
        const offset = slotOffset + co[comp[0]]
        if (Array.isArray(value)) {
          for (let i = 0; i < Math.min(value.length, comp.length); i++) view.setFloat32(offset + i * 4, value[i], true)
        } else if (typeof value === 'number') {
          view.setFloat32(offset, value, true)
        }
      }
    }
    return this._packedBytes.subarray(0, bufferSize)
  }

  _resolveAlphaMode (blend) {
    if (!blend) return Constants.ALPHA_DISABLE
    if (Array.isArray(blend)) {
      const [s, d] = blend
      const add = (x) => String(x).toLowerCase()
      if (add(s) === 'one' && add(d) === 'one') return Constants.ALPHA_ADD
      if (add(s) === 'src-alpha' && add(d) === 'one-minus-src-alpha') return Constants.ALPHA_COMBINE
      // Best-effort: most reference blends are additive deposits.
      return Constants.ALPHA_ADD
    }
    return Constants.ALPHA_ADD
  }

  // ---- frame lifecycle / present / readback ----------------------------------

  beginFrame () { /* no-op: surfaces persist; EffectRenderer does not auto-clear */ }
  endFrame () { /* no-op: engine flushes on readback */ }

  present (textureId) {
    // Offscreen parity reads surfaces directly; on-screen presentation is a P4 concern.
    // A no-op here keeps the reference Pipeline's present step harmless.
  }

  // Mirrors webgl2.readPixels: returns top-down RGBA8 (0..255). Half-float values are
  // quantized with round(v*255), exactly like the reference golden readback.
  async readPixels (textureId) {
    const rec = this.textures.get(textureId)
    if (!rec) throw new Error(`Texture ${textureId} not found`)
    const { internal, width, height } = rec
    const raw = await this.engine._readTexturePixels(internal, width, height, -1, 0, null, true, false, 0, 0)
    const out = new Uint8Array(width * height * 4)
    if (raw instanceof Float32Array) {
      for (let i = 0; i < out.length; i++) {
        out[i] = Math.max(0, Math.min(255, Math.round(raw[i] * 255)))
      }
    } else {
      out.set(raw.subarray(0, out.length))
    }
    // WebGL2 readback is bottom-up; flip rows to top-down to match the golden orientation.
    const flipped = new Uint8Array(width * height * 4)
    const rowBytes = width * 4
    for (let y = 0; y < height; y++) {
      flipped.set(out.subarray((height - 1 - y) * rowBytes, (height - y) * rowBytes), y * rowBytes)
    }
    return { width, height, data: flipped }
  }

  destroy (options = {}) {
    if (this._destroyed) return
    this._destroyed = true
    const { skipTextures = false, abandonRawResources = false } = options

    if (!skipTextures) {
      for (const id of [...this.textures.keys()]) this.destroyTexture(id)
    }
    this.textures.clear()

    for (const program of this.programs.values()) {
      try { program.wrapper?.dispose?.() } catch { /* noop */ }
    }
    this.programs.clear()
    try { this._copyWrapper?.dispose?.() } catch { /* noop */ }
    try { this._defaultTexture?.dispose?.() } catch { /* noop */ }

    if (!abandonRawResources) {
      for (const buf of this.uniformBuffers.values()) { try { this.gl.deleteBuffer(buf) } catch { /* noop */ } }
      for (const fbo of this._rawFbos?.values?.() || []) { try { this.gl.deleteFramebuffer(fbo) } catch { /* noop */ } }
      this._rawFbos = new Map()
      for (const fbo of this._mrtFbos?.values?.() || []) { try { this.gl.deleteFramebuffer(fbo) } catch { /* noop */ } }
      for (const rb of this._depthRBs?.values?.() || []) { try { this.gl.deleteRenderbuffer(rb) } catch { /* noop */ } }
      try { if (this._emptyVAO) this.gl.deleteVertexArray(this._emptyVAO) } catch { /* noop */ }
      for (const fbo of [this._mipReadFbo, this._mipDrawFbo]) {
        if (fbo) { try { this.gl.deleteFramebuffer(fbo) } catch { /* noop */ } }
      }
      this._mipReadFbo = null
      this._mipDrawFbo = null
    this._rawFbos = new Map() // glTex → raw FBO for mipmapped-target pass rendering
    }
    this.uniformBuffers.clear()
    this._mrtFbos?.clear?.()
    this._depthRBs?.clear?.()
    this._emptyVAO = null
    this._copyWrapper = null
    this._defaultTexture = null
    try { this.effectRenderer?.dispose?.() } catch { /* noop */ }
    this.effectRenderer = null
  }
}

export default BabylonBackend
