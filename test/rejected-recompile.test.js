import assert from 'node:assert/strict'
import test from 'node:test'

import { bootEngine } from '../vendor/engine.mjs'

// Port of the upstream rejected-recompile runtime tests added at engine pin
// 1.0.351 (build b631fc2c, upstream commit b631fc2c "FIX: keep the running
// program when a recompiled shader is rejected"). The port consumes the
// published engine bundle, so bootEngine() supplies Pipeline, Backend and
// WebGL2Backend; only the mock backend and the DSL sources are re-declared
// here. The upstream browser test drives CanvasRenderer.compile(); the same
// contract lives on the pipeline's public compile surface: a candidate graph's
// programs compile without the current graph's programs at risk, and a
// rejection hands the backend its prior programs back.
const engine = await bootEngine()
// bootEngine returns only the loader's subset; the same evaluated core module
// also carries the compile entry points the loader itself uses.
const core = await import('../vendor/noisemaker/noisemaker-shaders-core.esm.js')
const { compileGraph, recompile, Pipeline, WebGL2Backend } = { ...engine, ...core }

const SIZE = 64
const ACCEPTED = 'search synth\nsolid(color: #ff0000).write(o0)\nrender(o0)'
const LATER = 'search synth\nsolid(color: #0000ff).write(o0)\nrender(o0)'
// Step 1 is the tint step; its colorize program does not compile.
const INVALID_TINT = {
  1: { colorize: { glsl: '#version 300 es\nthis is invalid', wgsl: 'this is invalid' } }
}

class MockBackend extends engine.Backend {
  constructor () {
    super(null)
    this.textures = new Map()
    this.programs = new Map()
    this.released = []
  }

  async init () {}

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
    if (JSON.stringify(spec).includes('this is invalid')) {
      throw Object.assign(new Error(`invalid shader for ${id}`), { code: 'ERR_SHADER_COMPILE' })
    }
    this.programs.set(id, { handle: `mock_program_${id}`, type: spec.type || 'render' })
    return this.programs.get(id)
  }

  releaseProgram (program) {
    this.released.push(program)
  }

  executePass () {}

  beginFrame () {}

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

async function acceptedPipeline () {
  const backend = new MockBackend()
  const pipeline = new engine.Pipeline({ passes: [], textures: new Map(), renderSurface: 'o0' }, backend)
  await pipeline.init(SIZE, SIZE)
  const graph = recompile(pipeline, ACCEPTED)
  assert.ok(graph, 'the accepted program compiles')
  await pipeline.compilePrograms()
  return { backend, pipeline, graph }
}

test('a rejected candidate compile restores the accepted programs', async () => {
  const { backend, pipeline, graph } = await acceptedPipeline()
  const acceptedIds = [...backend.programs.keys()].sort()
  const acceptedHandles = new Map([...backend.programs].map(([id, program]) => [id, program]))

  const candidate = compileGraph('search synth, filter\nsolid(color: #0000ff).tint().write(o0)\nrender(o0)',
    { width: SIZE, height: SIZE, shaderOverrides: INVALID_TINT })
  assert.ok(candidate, 'the candidate graph compiles; only its shader is invalid')

  await assert.rejects(() => pipeline.compilePrograms(candidate),
    (error) => error?.code === 'ERR_SHADER_COMPILE',
    'the invalid tint shader is rejected')

  assert.equal(pipeline.graph, graph, 'the current graph is untouched by the rejected candidate')
  assert.deepEqual([...backend.programs.keys()].sort(), acceptedIds,
    'the backend still holds exactly the accepted programs')
  for (const [id, program] of acceptedHandles) {
    assert.equal(backend.programs.get(id), program, `the accepted ${id} program is the same object`)
  }
  assert.equal(backend.released.length, 1,
    'the candidate program compiled before the rejection is released, not leaked')
  assert.ok(!backend.released.some((program) => [...acceptedHandles.values()].includes(program)),
    'only the rejected candidate program is released')
})

test('a later valid compile succeeds after a rejection', async () => {
  const { backend, pipeline, graph } = await acceptedPipeline()
  const acceptedHandles = new Set(backend.programs.values())

  const candidate = compileGraph('search synth, filter\nsolid(color: #0000ff).tint().write(o0)\nrender(o0)',
    { width: SIZE, height: SIZE, shaderOverrides: INVALID_TINT })
  await assert.rejects(() => pipeline.compilePrograms(candidate))

  const later = compileGraph(LATER, { width: SIZE, height: SIZE })
  assert.ok(later, 'the later program compiles')
  await pipeline.compilePrograms(later)
  assert.ok(pipeline.graph === graph, 'compiling a candidate never swaps the graph')
  assert.deepEqual([...backend.programs.keys()].sort(), ['blit', 'node_0_solid'],
    'the later program replaces the accepted programs by id')
  assert.ok(!backend.released.some((program) => acceptedHandles.has(program)),
    'the later compile releases nothing that was still accepted')
})

test('compilePrograms keeps compiling the current graph by default', async () => {
  const { backend, pipeline, graph } = await acceptedPipeline()
  await pipeline.compilePrograms()
  assert.equal(pipeline.graph, graph, 'the default call compiles the current graph')
  assert.deepEqual([...backend.programs.keys()].sort(), ['blit', 'node_0_solid'],
    'the current graph\'s programs are compiled')
})

test('the published WebGL2Backend carries the releaseProgram cleanup hook', () => {
  assert.equal(typeof WebGL2Backend.prototype.releaseProgram, 'function',
    'restorePrograms releases rejected candidate programs through backend.releaseProgram')
})
