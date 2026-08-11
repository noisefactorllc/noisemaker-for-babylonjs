// Babylon parity-harness entry (bundled to an IIFE by render-candidate.mjs).
//
// Runs the UNCHANGED reference `Pipeline` with the new `BabylonBackend` injected, in a real
// headless-Chromium WebGL2 context (NullEngine can't render). Exposes window.nmRunFatGraph,
// which a Playwright driver calls with a fat graph (from tools/export-fat-graph.mjs).

import { Engine } from '@babylonjs/core/Engines/engine.js'
import '@babylonjs/core/Shaders/postprocess.vertex.js' // register EffectRenderer's default vertex
// The fat graph already embeds GLSL, so the runtime only needs `Pipeline` from the vendored
// published engine (vendor/noisemaker — the same artifact noisedeck.app ships). In a browser the
// core ESM evaluates directly (HTMLElement exists); no sibling checkout, nothing in `..`.
import { Pipeline, WebGL2Backend } from '../../vendor/noisemaker/noisemaker-shaders-core.esm.js'
import { BabylonBackend } from '../../src/runtime/babylonBackend.js'
import { NoisemakerRenderer } from '../../src/runtime/renderer.js'

function reconstruct (fat) {
  return {
    id: fat.id,
    source: fat.source,
    renderSurface: fat.renderSurface,
    passes: fat.passes,
    programs: fat.programs, // plain object: resolveProgramSpec handles object or Map
    textures: new Map(Object.entries(fat.textures || {})),
    allocations: new Map()
  }
}

window.nmRunFatGraph = async function (fat, opts = {}) {
  const size = opts.size || 256
  const time = (opts.time ?? 0.25)
  const frames = opts.frames || 8

  // Fresh canvas per run (a canvas owns one WebGL2 context) so a single page can render many
  // programs in sequence; disposed at the end to free the context for the next program.
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  document.body.appendChild(canvas)

  const engine = new Engine(canvas, false, {
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
    alpha: false,
    stencil: false,
    antialias: false,
    powerPreference: 'high-performance'
  }, false)

  const backend = new BabylonBackend(engine)
  const graph = reconstruct(fat)
  const pipeline = new Pipeline(graph, backend)

  await pipeline.init(size, size)
  // Test hook (mesh raster parity): upload identical synthetic geometry to the mesh surfaces that
  // meshRender reads (global_mesh0_positions/normals). meshLoader normally fills these host-side
  // from an OBJ (externalMesh); injecting the SAME float geometry the reference gets lets us prove
  // the triangle raster (projection/depth/cull/lighting) is byte-identical. No-op unless requested.
  if (opts.injectMesh) {
    const gl = backend.gl
    const writeTex = (texId, data) => {
      const rec = backend.textures.get(texId)
      if (!rec) return false
      const glTex = rec.internal?._hardwareTexture?.underlyingResource
      gl.bindTexture(gl.TEXTURE_2D, glTex)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, rec.width, rec.height, gl.RGBA, gl.FLOAT, new Float32Array(data))
      gl.bindTexture(gl.TEXTURE_2D, null)
      return true
    }
    writeTex('global_mesh0_positions', opts.injectMesh.positions)
    writeTex('global_mesh0_normals', opts.injectMesh.normals)
    engine.wipeCaches(true)
  }
  // Pinned time (ts=0): feedback/state surfaces settle (8-frame default). ts>0 ADVANCES time
  // per frame (tt=(t+i*ts)%1) — matches the golden harness's --timestep, used to evolve
  // continuous solvers (navierStokes/reactionDiffusion) over ~30s for a steady-state compare.
  const ts = opts.timestep || 0
  for (let i = 0; i < frames; i++) pipeline.render(ts > 0 ? (time + i * ts) % 1 : time)

  // Resolve the render surface's current read texture (mirrors Pipeline's present step).
  const name = graph.renderSurface
  const surf = pipeline.surfaces.get(name) || pipeline.surfaces.get(String(name).replace(/^global_/, ''))
  let readId = pipeline.frameReadTextures.get(name)
  if (!readId && surf) readId = surf.read
  if (!readId) throw new Error('nmRunFatGraph: render surface not found: ' + name)

  const px = await backend.readPixels(readId)
  const out = { width: px.width, height: px.height, data: Array.from(px.data), readId, renderSurface: name }

  if (opts.debug) {
    const caps = engine.getCaps ? engine.getCaps() : {}
    const dbg = {
      readId,
      renderSurface: name,
      caps: { blendFloat: caps.blendFloat, colorBufferFloat: caps.colorBufferFloat, textureFloat: caps.textureFloat, textureHalfFloat: caps.textureHalfFloat, textureFloatLinearFiltering: caps.textureFloatLinearFiltering, textureHalfFloatLinearFiltering: caps.textureHalfFloatLinearFiltering },
      surfaces: {},
      textures: [],
      programs: [...backend.programs.keys()]
    }
    for (const [sname, surf] of pipeline.surfaces) dbg.surfaces[sname] = { read: surf.read, write: surf.write }
    for (const [id, rec] of backend.textures) {
      try {
        const p = await backend.readPixels(id)
        let max = 0; let nz = 0
        for (let i = 0; i < p.data.length; i++) { if (p.data[i] > max) max = p.data[i]; if (p.data[i] !== 0) nz++ }
        const ci = ((p.height >> 1) * p.width + (p.width >> 1)) * 4
        dbg.textures.push({ id, w: p.width, h: p.height, max, nzFrac: +(nz / p.data.length).toFixed(3), center: Array.from(p.data.slice(ci, ci + 4)) })
      } catch (e) { dbg.textures.push({ id, error: String(e) }) }
    }
    out.debug = dbg
  }

  try { engine.dispose() } catch { /* noop */ }
  try { canvas.remove() } catch { /* noop */ }
  return out
}

// Exercise the public sink + asynchronous frame-export contract through Babylon's real WebGL2
// context, then compare the queued PBO result with the backend's established synchronous reader.
window.nmRunFrameExport = async function (fat, opts = {}) {
  const size = opts.size || 256
  const time = opts.time ?? 0.25
  const frames = opts.frames || 8
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  document.body.appendChild(canvas)

  const engine = new Engine(canvas, false, {
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
    alpha: false,
    stencil: false,
    antialias: false,
    powerPreference: 'high-performance'
  }, false)
  const backend = new BabylonBackend(engine)
  const graph = reconstruct(fat)
  const pipeline = new Pipeline(graph, backend)
  await pipeline.init(size, size)

  const queue = backend.createFrameExportQueue({ slots: 2 })
  let exported = null
  pipeline.addSink({
    configure (descriptor) { queue.configure(descriptor) },
    submit (textureId, timestamp) {
      if (exported) return false
      return queue.enqueue(textureId, timestamp, (frame, completedTimestamp) => {
        if (exported) return
        exported = {
          width: frame.width,
          height: frame.height,
          rowStride: frame.rowStride,
          data: Array.from(frame.data),
          timestamp: completedTimestamp
        }
      })
    },
    close (options) { queue.close(options) }
  })

  for (let i = 0; i < frames; i++) {
    pipeline.render(time, 1000 + i)
    queue.poll()
  }
  for (let i = 0; i < 120 && !exported; i++) {
    await new Promise(resolve => setTimeout(resolve, 0))
    queue.poll()
  }
  if (!exported) throw new Error('Babylon frame export did not complete')

  const name = graph.renderSurface
  const surface = pipeline.surfaces.get(name) || pipeline.surfaces.get(String(name).replace(/^global_/, ''))
  const readId = pipeline.frameReadTextures.get(name) ?? surface?.read
  if (!readId) throw new Error('nmRunFrameExport: render surface not found: ' + name)
  const synchronous = await backend.readPixels(readId)
  const out = {
    width: exported.width,
    height: exported.height,
    rowStride: exported.rowStride,
    timestamp: exported.timestamp,
    exported: exported.data,
    synchronous: Array.from(synchronous.data),
    stats: { ...queue.stats }
  }

  try { pipeline.dispose() } catch { /* noop */ }
  try { engine.dispose() } catch { /* noop */ }
  try { canvas.remove() } catch { /* noop */ }
  return out
}

window.nmRunFrameExportAlphaModes = async function () {
  const width = 3
  const height = 2
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  document.body.appendChild(canvas)

  const engine = new Engine(canvas, false, {
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
    alpha: false,
    stencil: false,
    antialias: false,
    powerPreference: 'high-performance'
  }, false)
  const backend = new BabylonBackend(engine)
  let queue = null

  try {
    await backend.init()
    backend.createTexture('source', {
      width,
      height,
      format: 'rgba8',
      usage: ['render', 'sample']
    })

    // texSubImage2D rows begin at the GL bottom; the exporter must return the top row first.
    const source = new Uint8Array([
      255, 0, 255, 128, 0, 255, 255, 64, 255, 255, 0, 0,
      255, 255, 255, 128, 0, 255, 0, 64, 255, 0, 0, 255
    ])
    const gl = backend.gl
    const sourceRecord = backend.textures.get('source')
    gl.bindTexture(gl.TEXTURE_2D, backend._glTexOf(sourceRecord))
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.bindTexture(gl.TEXTURE_2D, null)
    engine.wipeCaches(true)

    queue = backend.createFrameExportQueue({ slots: 2 })
    const exportFrame = async (alphaMode, colorSpace = 'srgb') => {
      let completed = null
      queue.configure({ width, height, format: 'rgba8unorm', colorSpace, alphaMode, fps: 60 })
      if (!queue.enqueue('source', 0, frame => { completed = Array.from(frame.data) })) {
        throw new Error(`Failed to enqueue ${alphaMode} frame export`)
      }
      for (let i = 0; i < 120 && !completed; i++) {
        queue.poll()
        if (!completed) await new Promise(resolve => setTimeout(resolve, 0))
      }
      if (!completed) throw new Error(`${alphaMode} frame export did not complete`)
      return completed
    }

    const straight = await exportFrame('straight')
    const opaque = await exportFrame('opaque')
    const premultiplied = await exportFrame('premultiplied')
    const displayP3 = await exportFrame('straight', 'display-p3')
    return {
      width,
      height,
      rowStride: width * 4,
      straight,
      opaque,
      premultiplied,
      displayP3Accepted: displayP3.every((value, index) => value === straight[index])
    }
  } finally {
    try { queue?.close() } catch { /* noop */ }
    try { backend.destroy() } catch { /* noop */ }
    try { engine.dispose() } catch { /* noop */ }
    try { canvas.remove() } catch { /* noop */ }
  }
}

// Prove the public renderer abandons raw resources on loss and rebuilds only after Babylon has
// restored its managed resources. Chromium's WEBGL_lose_context extension exercises the real path.
window.nmRunRendererContextRestore = async function (fat, opts = {}) {
  const size = opts.size || 256
  const time = opts.time ?? 0.25
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  document.body.appendChild(canvas)
  const engine = new Engine(canvas, false, {
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
    alpha: false,
    stencil: false,
    antialias: false,
    powerPreference: 'high-performance'
  }, false)

  let resolveLost
  let resolveRestored
  const lost = new Promise(resolve => { resolveLost = resolve })
  const restored = new Promise(resolve => { resolveRestored = resolve })
  const nm = new NoisemakerRenderer(engine, {
    Pipeline,
    size,
    onContextLost: resolveLost,
    onContextRestored: resolveRestored
  })
  const rendererLostObserver = nm._contextLostObserver
  const rendererRestoredObserver = nm._contextRestoredObserver
  await nm.loadGraph(fat)
  nm.renderFrame(time, 999)
  const before = Array.from((await nm.readPixels()).data)
  const originalPipeline = nm.pipeline

  const queue = nm.createFrameExportQueue({ slots: 2 })
  let sinkCloseOptions = null
  nm.addSink({
    configure (descriptor) { queue.configure(descriptor) },
    submit (textureId, timestamp) { return queue.enqueue(textureId, timestamp, () => {}) },
    close (options) {
      sinkCloseOptions = options || {}
      queue.close(options)
    }
  })

  const extension = engine._gl.getExtension('WEBGL_lose_context')
  if (!extension) throw new Error('WEBGL_lose_context is unavailable')
  extension.loseContext()
  await Promise.race([
    lost,
    new Promise((_, reject) => setTimeout(() => reject(new Error('context loss timeout')), 5000))
  ])
  await new Promise(resolve => setTimeout(resolve, 0))
  extension.restoreContext()
  await Promise.race([
    restored,
    new Promise((_, reject) => setTimeout(() => reject(new Error('context restoration timeout')), 10000))
  ])

  const replacementPipeline = nm.pipeline
  nm.renderFrame(time, 1000)
  const after = Array.from((await nm.readPixels()).data)
  nm.dispose()
  await new Promise(resolve => setTimeout(resolve, 0))
  const out = {
    pipelineReplaced: !!replacementPipeline && replacementPipeline !== originalPipeline,
    sinkCloseOptions,
    before,
    after,
    contextLostObserversRemoved: Number(!engine.onContextLostObservable.observers.includes(rendererLostObserver)),
    contextRestoredObserversRemoved: Number(!engine.onContextRestoredObservable.observers.includes(rendererRestoredObserver))
  }

  try { engine.dispose() } catch { /* noop */ }
  try { canvas.remove() } catch { /* noop */ }
  return out
}

// GOLDEN path: the SAME vendored Pipeline + fat graph, driven by the reference `WebGL2Backend`
// instead of `BabylonBackend`. This is the purest parity test — identical engine, only the
// backend differs — and it lets the harness mint its own goldens with no sibling checkout.
window.nmRunFatGraphWebGL2 = async function (fat, opts = {}) {
  const size = opts.size || 256
  const time = (opts.time ?? 0.25)
  const frames = opts.frames || 8

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  document.body.appendChild(canvas)
  const gl = canvas.getContext('webgl2', {
    preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: false,
    stencil: false, antialias: false, powerPreference: 'high-performance'
  })

  const backend = new WebGL2Backend(gl, canvas)
  const graph = reconstruct(fat)
  const pipeline = new Pipeline(graph, backend)
  await pipeline.init(size, size)

  const ts = opts.timestep || 0
  for (let i = 0; i < frames; i++) pipeline.render(ts > 0 ? (time + i * ts) % 1 : time)

  const name = graph.renderSurface
  const surf = pipeline.surfaces.get(name) || pipeline.surfaces.get(String(name).replace(/^global_/, ''))
  let readId = pipeline.frameReadTextures.get(name)
  if (!readId && surf) readId = surf.read
  if (!readId) throw new Error('nmRunFatGraphWebGL2: render surface not found: ' + name)

  const px = await backend.readPixels(readId)
  const out = { width: px.width, height: px.height, data: Array.from(px.data), readId, renderSurface: name }
  try { canvas.remove() } catch { /* noop */ }
  return out
}

// Cubemap bake: drive the REUSED Pipeline.renderCubemap() (6-face loop — per face it sets the
// cubeBasis mat3, renders, reads back the output surface) through the BabylonBackend. No new backend
// code: setUniform('cubeBasis', mat3) lands in pass.uniforms → _bindUniforms → setMatrix3x3, and the
// per-face raymarch is the same MRT pass already proven byte-identical. Returns 6 faces in GL order
// (+X,-X,+Y,-Y,+Z,-Z), each { width, height, data } RGBA8 top-down (backend.readPixels).
window.nmRunCubemap = async function (fat, opts = {}) {
  const size = opts.size || 256
  const time = (opts.time ?? 0.25)
  const outputSurface = opts.outputSurface || fat.renderSurface || 'o0'
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  document.body.appendChild(canvas)
  const engine = new Engine(canvas, false, { preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: false, stencil: false, antialias: false, powerPreference: 'high-performance' }, false)
  const backend = new BabylonBackend(engine)
  const graph = reconstruct(fat)
  const pipeline = new Pipeline(graph, backend)
  await pipeline.init(size, size)
  const faces = await pipeline.renderCubemap({ size, outputSurface, time })
  const out = { faces: faces.map(f => ({ width: f.width, height: f.height, data: Array.from(f.data) })) }
  try { engine.dispose(); canvas.remove() } catch { /* noop */ }
  return out
}

// Same render, but driven through the consumer-facing NoisemakerRenderer host (loadGraph →
// renderFrame → stable output texture → readPixels). Proves the integration surface is itself
// pixel-parity, not just the raw backend path.
window.nmRunViaRenderer = async function (fat, opts = {}) {
  const size = opts.size || 256
  const time = (opts.time ?? 0.25)
  const frames = opts.frames || 8
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  document.body.appendChild(canvas)
  const engine = new Engine(canvas, false, { preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: false, stencil: false }, false)
  const nm = new NoisemakerRenderer(engine, { Pipeline, size })
  await nm.loadGraph(fat)
  for (let i = 0; i < frames; i++) nm.renderFrame(time)
  const px = await nm.readPixels()
  const out = { width: px.width, height: px.height, data: Array.from(px.data) }
  try { nm.dispose(); engine.dispose(); canvas.remove() } catch { /* noop */ }
  return out
}

// Cubemap bake through the consumer host (NoisemakerRenderer.renderCubemap) — proves the public
// API bakes a real Babylon-native cube InternalTexture, not just the bare Pipeline path.
window.nmRunCubemapViaRenderer = async function (fat, opts = {}) {
  const size = opts.size || 256
  const time = (opts.time ?? 0.25)
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  document.body.appendChild(canvas)
  const engine = new Engine(canvas, false, { preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: false, stencil: false }, false)
  const nm = new NoisemakerRenderer(engine, { Pipeline, size })
  await nm.loadGraph(fat)
  const { faces, cubeTexture } = await nm.renderCubemap({ size, time, outputSurface: opts.outputSurface })
  const out = {
    faces: faces.map(f => ({ width: f.width, height: f.height, data: Array.from(f.data) })),
    cube: { isCube: !!cubeTexture?.isCube, width: cubeTexture?.width ?? null, isReady: !!cubeTexture?.isReady }
  }
  try { nm.dispose(); engine.dispose(); canvas.remove() } catch { /* noop */ }
  return out
}

window.nmReady = true
