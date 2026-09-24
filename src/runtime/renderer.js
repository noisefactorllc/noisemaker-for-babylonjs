// renderer.js — NoisemakerRenderer: the consumer-facing host that drives the reference
// Pipeline (via BabylonBackend) and exposes the result as a STABLE Babylon texture any
// material/layer/post-process can sample.
//
// The reference `Pipeline` class is injected (options.Pipeline) rather than hard-imported, so
// this module stays decoupled from the reference repo layout: a host bundles the reference
// runtime (or a vendored copy) and passes the class in. See examples/ for a wired demo.

import { Constants } from '@babylonjs/core/Engines/constants.js'
import { BabylonBackend } from './babylonBackend.js'

// Fat graph (tools/export-fat-graph.mjs) -> the runtime graph shape Pipeline consumes.
export function reconstructGraph (fat) {
  return {
    id: fat.id,
    source: fat.source,
    renderSurface: fat.renderSurface,
    passes: fat.passes,
    programs: fat.programs, // plain object; Pipeline.resolveProgramSpec handles object or Map
    textures: new Map(Object.entries(fat.textures || {})),
    allocations: new Map()
  }
}

export class NoisemakerRenderer {
  /**
   * @param {import('@babylonjs/core').AbstractEngine} engine
   * @param {{ Pipeline: any, size?: number, onContextLost?: Function, onContextRestored?: Function, onError?: Function }} options
   *   `Pipeline` is the reference Pipeline class.
   */
  constructor (engine, options = {}) {
    this.engine = engine
    this._Pipeline = options.Pipeline
    this.size = options.size || 256
    this.backend = null
    this.pipeline = null
    this.graph = null
    this._outId = '__nm_output'
    this._outputTexture = null
    this._time = 0
    this._fatGraph = null
    this._loadOptions = {}
    this._isContextLost = false
    this._disposed = false
    this._lifecycleGeneration = 0
    this._lastBackendInvalidationGeneration = -1
    this._invalidatedBackends = new Set()
    this._onContextLost = options.onContextLost || null
    this._onContextRestored = options.onContextRestored || null
    this._onError = options.onError || null
    this._contextLostObserver = this.engine?.onContextLostObservable?.add?.(() => this._handleContextLost()) ?? null
    this._contextRestoredObserver = this.engine?.onContextRestoredObservable?.add?.(() => {
      this._handleContextRestored().catch(error => this._reportError(error))
    }) ?? null
  }

  /** Compile/load a fat graph and prepare the pipeline + a stable output texture. */
  async loadGraph (fatGraph, opts = {}) {
    if (!this._Pipeline) throw new Error('NoisemakerRenderer requires options.Pipeline (the reference Pipeline class).')
    if (this._disposed) throw new Error('NoisemakerRenderer is disposed')
    const generation = this._advanceLifecycle()
    this._fatGraph = fatGraph
    this._loadOptions = { ...opts }
    return this._loadGraph(fatGraph, opts, generation)
  }

  /** @private Build a fresh backend/pipeline without exposing a partially initialized result. */
  async _loadGraph (fatGraph, opts = {}, generation = this._lifecycleGeneration) {
    const size = opts.size || this.size
    let effectiveSize = size
    const backend = new BabylonBackend(this.engine)
    const graph = reconstructGraph(fatGraph)
    const pipeline = new this._Pipeline(graph, backend)

    try {
      await pipeline.init(size, size)
      if (!this._isLifecycleCurrent(generation) || this._isContextLost || this._disposed) {
        this._disposeStalePipeline(pipeline, generation)
        return null
      }
      effectiveSize = this._loadOptions.size || this.size
      if (effectiveSize !== size) pipeline.resize?.(effectiveSize, effectiveSize)
      backend.createTexture(this._outId, {
        width: effectiveSize, height: effectiveSize, format: 'rgba16f', usage: ['render', 'sample']
      })
    } catch (error) {
      this._disposeStalePipeline(pipeline, generation)
      if (!this._isLifecycleCurrent(generation) || this._isContextLost || this._disposed) return null
      throw error
    }

    if (!this._isLifecycleCurrent(generation) || this._isContextLost || this._disposed) {
      this._disposeStalePipeline(pipeline, generation)
      return null
    }

    const previousPipeline = this.pipeline
    this.size = effectiveSize
    this.backend = backend
    this.graph = graph
    this.pipeline = pipeline
    this._outputTexture = backend.textures.get(this._outId).thin

    if (previousPipeline && previousPipeline !== pipeline) {
      try { previousPipeline.dispose?.() } catch { /* noop */ }
    }
    return this
  }

  /** @private Invalidate pending lifecycle work and record unsafe backend generations. */
  _advanceLifecycle ({ backendLost = false } = {}) {
    this._lifecycleGeneration++
    if (backendLost) this._lastBackendInvalidationGeneration = this._lifecycleGeneration
    return this._lifecycleGeneration
  }

  /** @private */
  _isLifecycleCurrent (generation) { return this._lifecycleGeneration === generation }

  /** @private Dispose an initialization result that completed after invalidation. */
  _disposeStalePipeline (pipeline, generation) {
    if (!pipeline || pipeline === this.pipeline) return
    const backendLost = this._lastBackendInvalidationGeneration > generation
    const backend = pipeline.backend
    try { pipeline.dispose?.(backendLost ? { backendLost: true } : {}) } catch { /* noop */ }
    if (backendLost) this._retireInvalidatedBackend(backend)
  }

  /** @private Retain invalid GPU state until restoration, or clean it immediately once safe. */
  _retireInvalidatedBackend (backend) {
    if (!backend) return
    if (this._isContextLost && !this._disposed) {
      this._invalidatedBackends.add(backend)
      return
    }
    try { backend.destroy?.({ abandonRawResources: true }) } catch (error) { this._reportError(error) }
  }

  /** @private Dispose Babylon-managed state while abandoning invalid raw WebGL handles. */
  _destroyInvalidatedBackends () {
    const backends = [...this._invalidatedBackends]
    this._invalidatedBackends.clear()
    for (const backend of backends) {
      try { backend.destroy?.({ abandonRawResources: true }) } catch (error) { this._reportError(error) }
    }
  }

  /** @private Close sinks immediately without touching lost GPU handles. */
  _handleContextLost () {
    if (this._disposed || this._isContextLost) return
    this._advanceLifecycle({ backendLost: true })
    this._isContextLost = true

    const deadPipeline = this.pipeline
    if (this.backend) this._invalidatedBackends.add(this.backend)
    this.pipeline = null
    this.backend = null
    this.graph = null
    this._outputTexture = null
    try { deadPipeline?.dispose?.({ backendLost: true }) } catch (error) { this._reportError(error) }
    try { this._onContextLost?.() } catch (error) { this._reportError(error) }
  }

  /** @private Release Babylon-managed remnants, then rebuild against the restored context. */
  async _handleContextRestored () {
    if (this._disposed || !this._isContextLost) return
    const generation = this._advanceLifecycle()
    this._destroyInvalidatedBackends()
    this._isContextLost = false

    if (this._fatGraph) {
      const restored = await this._loadGraph(this._fatGraph, this._loadOptions, generation)
      if (!restored || !this._isLifecycleCurrent(generation)) return
    }
    try { this._onContextRestored?.() } catch (error) { this._reportError(error) }
  }

  /** @private */
  _reportError (error) {
    if (typeof this._onError !== 'function') return
    try { this._onError(error) } catch { /* noop */ }
  }

  /** @private */
  _removeContextObservers () {
    if (this._contextLostObserver) {
      this.engine?.onContextLostObservable?.remove?.(this._contextLostObserver)
      this._contextLostObserver = null
    }
    if (this._contextRestoredObserver) {
      this.engine?.onContextRestoredObservable?.remove?.(this._contextRestoredObserver)
      this._contextRestoredObserver = null
    }
  }

  /** Render one frame at a normalized 0..1 time and refresh the stable output texture. */
  renderFrame (normalizedTime, presentationTimestamp) {
    if (!this.pipeline || this._isContextLost) return
    this._time = normalizedTime ?? this._time
    this.pipeline.render(this._time, presentationTimestamp)
    const id = this._resolveRenderSurfaceId()
    if (id) this.backend.copyTexture(id, this._outId)
  }

  /** Register an output sink on the active pipeline. */
  addSink (sink) {
    if (!this.pipeline) {
      throw new Error('NoisemakerRenderer has no active pipeline; load a graph before adding a sink')
    }
    if (typeof this.pipeline.addSink !== 'function') {
      throw new Error('Active Noisemaker pipeline does not support output sinks')
    }
    return this.pipeline.addSink(sink)
  }

  /**
   * Check if any registered output sink requests deferring the current render tick.
   * Returns false when uninstantiated, disposed, or during context loss.
   * @returns {boolean}
   */
  shouldDeferRender () {
    return Boolean(this.pipeline?.shouldDeferRender?.())
  }

  /** Create a non-blocking frame-export queue for the active Babylon backend. */
  createFrameExportQueue (options = {}) {
    if (!this.pipeline) {
      throw new Error('NoisemakerRenderer has no active pipeline; load a graph before creating a frame export queue')
    }
    const backend = this.pipeline.backend
    if (typeof backend?.createFrameExportQueue !== 'function') return null
    return backend.createFrameExportQueue(options)
  }

  _resolveRenderSurfaceId () {
    const name = this.graph.renderSurface
    if (!name) return null
    const surf = this.pipeline.surfaces.get(name) ||
      this.pipeline.surfaces.get(String(name).replace(/^global_/, ''))
    return this.pipeline.frameReadTextures.get(name) ?? surf?.read ?? null
  }

  /** A stable Babylon ThinTexture of the latest rendered frame (for EffectWrapper/PostProcess). */
  get outputTexture () { return this._outputTexture }

  /** The raw InternalTexture of the stable output — wrap in a scene `Texture` for StandardMaterial:
   *    const t = new Texture(null, scene); t._texture = nm.outputInternalTexture;  mat.diffuseTexture = t; */
  get outputInternalTexture () { return this.backend?.textures.get(this._outId)?.internal ?? null }

  /** Inject/override a DSL/effect uniform at runtime (oscillators, params, …). */
  setUniform (name, value) { this.pipeline?.setUniform?.(name, value) }

  /** Resize the render + output to a new square size. */
  resize (size) {
    this.size = size
    this._loadOptions = { ...this._loadOptions, size }
    this.pipeline?.resize?.(size, size)
    this.backend?.destroyTexture?.(this._outId)
    this.backend?.createTexture?.(this._outId, { width: size, height: size, format: 'rgba16f', usage: ['render', 'sample'] })
    this._outputTexture = this.backend?.textures.get(this._outId)?.thin ?? null
  }

  /** Read the current output as top-down linear 8-bit RGBA (parity/export use). */
  async readPixels () { return this.backend.readPixels(this._outId) }

  /**
   * Bake the loaded composition into a cubemap. The graph must end in a cubemap renderer
   * (`renderCubemapSurface`/`renderCubemap3d`) writing to `outputSurface`. Drives the reused
   * `Pipeline.renderCubemap()` (6-face loop: per face it sets the `cubeBasis` camera basis,
   * renders, and reads back the surface), then bakes the faces into a **Babylon-native cube
   * `InternalTexture`** — the parallel of the HLSL port's Unity-native cubemap. Where the reference
   * hands back 6 CPU buffers, here you also get a GPU cube texture ready for a skybox / PBR
   * reflection. Each backend renders its own faces, so this is byte-identical to the reference
   * (all 6 faces verified max-abs-diff 0).
   *
   * @returns {Promise<{ faces: Array<{width:number,height:number,data:Uint8Array}>, cubeTexture: import('@babylonjs/core').InternalTexture }>}
   *   faces in GL order (+X,-X,+Y,-Y,+Z,-Z), RGBA8 top-down; cubeTexture wraps them on the GPU.
   */
  async renderCubemap (opts = {}) {
    if (!this.pipeline?.renderCubemap) throw new Error('NoisemakerRenderer.renderCubemap: the injected Pipeline has no renderCubemap() (update the reference engine).')
    const size = opts.size || this.size
    const outputSurface = opts.outputSurface || this.graph?.renderSurface || 'o0'
    const time = opts.time ?? this._time
    const faces = await this.pipeline.renderCubemap({ size, outputSurface, time })
    // Babylon's cube face order is +X,-X,+Y,-Y,+Z,-Z — identical to the reference, so the 6 buffers
    // drop straight in. invertY:false (readPixels already delivered top-down image rows).
    const data = faces.map(f => (f.data instanceof Uint8Array ? f.data : Uint8Array.from(f.data)))
    const cube = this.engine.createRawCubeTexture(
      data, size, Constants.TEXTUREFORMAT_RGBA, Constants.TEXTURETYPE_UNSIGNED_BYTE,
      false, false, Constants.TEXTURE_NEAREST_SAMPLINGMODE, null
    )
    if (this._cubeInternal && this._cubeInternal !== cube) { try { this._cubeInternal.dispose?.() } catch { /* noop */ } }
    this._cubeInternal = cube
    return { faces, cubeTexture: cube }
  }

  /** The raw cube `InternalTexture` from the last renderCubemap() — wrap in a scene `CubeTexture`:
   *    const ct = new CubeTexture('', scene); ct._texture = nm.cubeInternalTexture; scene.reflectionTexture = ct; */
  get cubeInternalTexture () { return this._cubeInternal ?? null }

  dispose (options = {}) {
    if (this._disposed) return
    const backendLost = options.backendLost === true || this._isContextLost
    this._disposed = true
    this._advanceLifecycle({ backendLost })
    this._removeContextObservers()
    try { this._cubeInternal?.dispose?.() } catch { /* noop */ }
    const pipeline = this.pipeline
    const backend = this.backend
    this.pipeline = null
    this.backend = null
    try {
      if (typeof pipeline?.dispose === 'function') {
        pipeline.dispose(backendLost ? { backendLost: true } : (options.loseContext ? { loseContext: true } : {}))
      } else if (!backendLost) {
        backend?.destroy?.()
      }
    } catch { /* noop */ }
    if (backendLost && backend) this._invalidatedBackends.add(backend)
    this._destroyInvalidatedBackends()
    this.graph = null
    this._fatGraph = null
    this._outputTexture = null
    this._cubeInternal = null
  }
}

export default NoisemakerRenderer
