// Port-side coverage for the upstream 8eeb7b5a..6a0af04d backend-diagnostics sync
// (GAP-007): the BabylonBackend's shader compile/missing-source failures surface one
// structured `ShaderDiagnostic` union — a real `Error` carrying the legacy machine
// `code`, `backend: 'babylon'`, the `stage`, the program id, the byte-identical legacy
// `detail` string, the parsed compiler `messages`, and the offending `source` — mirroring
// the reference backends' shaders/src/runtime/backends/diagnostics.js. Mirrors the
// upstream shaders/tests/test_backend_diagnostics.js cases that apply to this port's
// backend (the WebGPU bind-group-retry cases are engine-bundle-internal and recorded in
// the STATUS sync audit instead).
import assert from 'node:assert/strict'
import test from 'node:test'

import { BabylonBackend, ShaderDiagnostic, parseGLSLInfoLog, DiagnosticCollector } from '../src/runtime/babylonBackend.js'
import { Constants } from '@babylonjs/core/Engines/constants.js'

test('parseGLSLInfoLog parses ERROR/WARNING lines and passes through prose', () => {
  const messages = parseGLSLInfoLog('ERROR: 0:12: bad thing\nWARNING: 0:3: dubious\nplain driver prose')
  assert.deepEqual(messages, [
    { severity: 'error', line: 12, column: undefined, message: 'bad thing' },
    { severity: 'warning', line: 3, column: undefined, message: 'dubious' },
    { severity: 'info', line: undefined, column: undefined, message: 'plain driver prose' }
  ])
  assert.deepEqual(parseGLSLInfoLog(''), [])
  assert.deepEqual(parseGLSLInfoLog(undefined), [])
})

test('BabylonBackend missing shader source keeps its legacy message and gains structure', async () => {
  const backend = Object.create(BabylonBackend.prototype)
  let thrown
  try {
    await backend.compileProgram('probe_missing', {})
  } catch (err) { thrown = err }
  assert.ok(thrown, 'missing source must throw')
  assert.ok(thrown instanceof ShaderDiagnostic, 'must be a ShaderDiagnostic (real Error)')
  assert.ok(thrown instanceof Error, 'must remain a real Error')
  assert.equal(thrown.code, 'ERR_SHADER_MISSING')
  assert.equal(thrown.backend, 'babylon')
  assert.equal(thrown.stage, 'missing-source')
  assert.equal(thrown.program, 'probe_missing')
  assert.equal(thrown.detail, "Shader source missing for program 'probe_missing'.")
  assert.equal(thrown.message, "Shader source missing for program 'probe_missing'.")
})

test('BabylonBackend compile failure surfaces one structured ShaderDiagnostic', async () => {
  const backend = Object.create(BabylonBackend.prototype)
  const log = 'ERROR: 0:7: xyzTex: undeclared identifier\nNOTE: link notes follow'
  // Stub the EffectWrapper ready-poll with a Babylon compilation error, exactly as the
  // browser path reports one via Effect.getCompilationError().
  const wrapper = {
    name: 'probe_compile',
    effect: { isReady: () => false, getCompilationError: () => log }
  }
  const source = 'void main() {}'
  let thrown
  try {
    await backend._whenReady(wrapper, source, 'probe_compile')
  } catch (err) { thrown = err }
  assert.ok(thrown, 'compile failure must reject')
  assert.ok(thrown instanceof ShaderDiagnostic, 'must be a ShaderDiagnostic (real Error)')
  assert.equal(thrown.code, 'ERR_SHADER_COMPILE')
  assert.equal(thrown.backend, 'babylon')
  assert.equal(thrown.stage, 'compile')
  assert.equal(thrown.program, 'probe_compile')
  assert.equal(thrown.detail, log, 'legacy detail string stays byte-identical')
  assert.equal(thrown.source, source)
  assert.equal(thrown.messages[0].severity, 'error')
  assert.equal(thrown.messages[0].line, 7)
  assert.equal(thrown.messages[0].message, 'xyzTex: undeclared identifier')
  assert.equal(thrown.messages[1].severity, 'info')
  assert.equal(thrown.messages[1].message, 'NOTE: link notes follow')
})

test('structured diagnostics serialize their legacy fields', () => {
  const diagnostic = new ShaderDiagnostic({
    code: 'ERR_SHADER_COMPILE',
    backend: 'babylon',
    stage: 'compile',
    program: 'probe',
    detail: 'ERROR: 0:1: nope',
    messages: parseGLSLInfoLog('ERROR: 0:1: nope'),
    source: 'void main() {}'
  })
  const serialized = JSON.parse(JSON.stringify(diagnostic))
  assert.equal(serialized.name, 'ShaderDiagnostic')
  assert.equal(serialized.code, 'ERR_SHADER_COMPILE')
  assert.equal(serialized.backend, 'babylon')
  assert.equal(serialized.stage, 'compile')
  assert.equal(serialized.program, 'probe')
  assert.equal(serialized.detail, 'ERROR: 0:1: nope')
  assert.equal(serialized.source, 'void main() {}')
  assert.equal(serialized.messages.length, 1)
})

test('compile timeouts keep their plain Error (not a diagnostic union)', async () => {
  const backend = Object.create(BabylonBackend.prototype)
  const wrapper = { name: 'probe_timeout', effect: { isReady: () => false, getCompilationError: () => null } }
  // Shrink the deadline the same way the poll loop reads it (first call is real).
  const originalNow = Date.now
  let firstCall = true
  Date.now = () => {
    if (firstCall) { firstCall = false; return originalNow() }
    return originalNow() + 60000
  }
  try {
    await assert.rejects(backend._whenReady(wrapper, 'src', 'probe_timeout'), /Shader compile timeout \(probe_timeout\)/)
  } finally {
    Date.now = originalNow
  }
})

// ---------------------------------------------------------------------------
// The GAP-007 final legs (upstream dd4606ea/a0e9bbff/e24c844f, engine v1.0.205/206):
// recorded (non-throwing) diagnostics for the historically-silent unknown-format
// rgba8 fallback and the missing-render-target warnings, plus the Pipeline-side
// unknown-dimension-form fallback diagnostic. Mirrors the upstream
// shaders/tests/test_backend_diagnostics.js cases that apply to this port.
// ---------------------------------------------------------------------------

test('unknown texture format keeps the rgba8 fallback but records a structured diagnostic', () => {
  const backend = Object.create(BabylonBackend.prototype)
  backend.diagnostics = new DiagnosticCollector()
  backend._warnedFormatFallbacks = new Set()
  // An unknown format must record exactly once (deduplicated) and keep resolving
  // to the rgba8 table entry; known formats and the absent default never record.
  const rgba8 = backend._resolveFormat('bgra8')
  assert.deepEqual(rgba8, backend._resolveFormat('rgba8'), 'unknown format falls back to rgba8')
  assert.equal(rgba8.type, Constants.TEXTURETYPE_UNSIGNED_BYTE, 'rgba8 is the unsigned-byte RGBA entry')
  assert.equal(backend.diagnostics.records.length, 1)
  assert.deepEqual(
    { ...backend.diagnostics.records[0] },
    { code: 'ERR_UNKNOWN_FORMAT_FALLBACK', backend: 'babylon', stage: 'createTexture', format: 'bgra8', fallback: 'rgba8' }
  )
  backend._resolveFormat('bgra8')
  backend._resolveFormat('rgba16f')
  backend._resolveFormat(undefined)
  backend._resolveFormat(null)
  assert.equal(backend.diagnostics.records.length, 1, 'records are deduplicated per format')
})

test('missing render-target paths record structured diagnostics without changing behavior', () => {
  const backend = Object.create(BabylonBackend.prototype)
  backend.textures = new Map()
  backend.programs = new Map([['prog', {}]])
  backend.diagnostics = new DiagnosticCollector()
  backend._warnedMissingRenderTargets = new Set()

  const warnings = []
  const originalWarn = console.warn
  console.warn = (...args) => warnings.push(args.map(String).join(' '))
  try {
    // Single-output pass whose output texture was never created.
    backend.executePass({ id: 'p1', program: 'prog', outputs: { color: 't1' } }, {})
    assert.equal(backend.diagnostics.records.length, 1)
    assert.deepEqual(
      { ...backend.diagnostics.records[0] },
      { code: 'ERR_MISSING_RENDER_TARGET', backend: 'babylon', stage: 'render', kind: 'fbo', pass: 'p1', output: 't1' }
    )
    assert.equal(warnings.length, 1, 'legacy warn unchanged')

    // Points and triangles paths record the same shape.
    backend.executePass({ id: 'p2', program: 'prog', outputs: { color: 't9' }, drawMode: 'points' }, {})
    backend.executePass({ id: 'p3', program: 'prog', outputs: { color: 't10' }, drawMode: 'triangles' }, {})
    assert.deepEqual(
      backend.diagnostics.records.slice(1).map(r => ({ ...r })),
      [
        { code: 'ERR_MISSING_RENDER_TARGET', backend: 'babylon', stage: 'render', kind: 'fbo', pass: 'p2', output: 't9' },
        { code: 'ERR_MISSING_RENDER_TARGET', backend: 'babylon', stage: 'render', kind: 'fbo', pass: 'p3', output: 't10' }
      ]
    )

    // MRT path records one entry per missing output.
    backend.executePass({ id: 'p4', program: 'prog', outputs: { a: 't20', b: 't21' }, drawBuffers: 2 }, {})
    assert.deepEqual(
      backend.diagnostics.records.slice(3).map(r => ({ ...r })),
      [
        { code: 'ERR_MISSING_RENDER_TARGET', backend: 'babylon', stage: 'render', kind: 'mrt', pass: 'p4', output: 't20' },
        { code: 'ERR_MISSING_RENDER_TARGET', backend: 'babylon', stage: 'render', kind: 'mrt', pass: 'p4', output: 't21' }
      ]
    )

    // Legacy console behavior unchanged: every occurrence still warns, records stay deduplicated.
    const firstRound = warnings.length
    backend.executePass({ id: 'p1', program: 'prog', outputs: { color: 't1' } }, {})
    backend.executePass({ id: 'p4', program: 'prog', outputs: { a: 't20', b: 't21' }, drawBuffers: 2 }, {})
    assert.equal(warnings.length, firstRound + 2, 'warnings still fire on every occurrence')
    assert.equal(backend.diagnostics.records.length, 5, 'records are deduplicated per target')
  } finally {
    console.warn = originalWarn
  }
})

test('DiagnosticCollector caps and clears', () => {
  const collector = new DiagnosticCollector(3)
  for (let i = 0; i < 5; i++) collector.add({ i })
  assert.equal(collector.records.length, 3, 'cap trims the oldest records')
  assert.deepEqual(collector.records.map(r => r.i), [2, 3, 4])
  collector.clear()
  assert.equal(collector.records.length, 0)
})

test('Pipeline unknown dimension form keeps the screen-size fallback but records a structured diagnostic', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  const { Pipeline } = await bootEngine()
  const backend = Object.create(BabylonBackend.prototype)
  backend.textures = new Map()
  backend.createTexture = (id, spec) => {
    const rec = { id, width: spec.width, height: spec.height, format: spec.format }
    backend.textures.set(id, rec)
    return rec
  }
  backend.destroyTexture = (id) => { backend.textures.delete(id) }
  const graph = {
    passes: [
      { id: 'p0', inputs: {}, outputs: { color: 'texA' } },
      { id: 'p1', inputs: { src: 'texA' }, outputs: { color: 'texB' } }
    ],
    textures: new Map(Object.entries({
      texA: { width: 64, height: 64, format: 'rgba16f' },
      texB: { width: 64, height: 64, format: 'rgba16f' }
    })),
    allocations: new Map(),
    surfaces: new Map()
  }
  const pipeline = new Pipeline(graph, backend)
  pipeline.width = 64
  pipeline.height = 64

  const warnings = []
  const originalWarn = console.warn
  console.warn = (...args) => warnings.push(args.map(String).join(' '))
  try {
    assert.equal(pipeline.resolveDimension({ bogus: true }, 1000), 1000, 'screen-size fallback unchanged')
    assert.equal(pipeline.diagnostics.records.length, 1)
    assert.deepEqual(
      { ...pipeline.diagnostics.records[0] },
      { code: 'ERR_DIMENSION_FALLBACK', backend: 'Babylon', stage: 'dimension', spec: '{"bogus":true}', fallback: 'screen' }
    )
    pipeline.resolveDimension({ other: 1 }, 1000)
    assert.equal(pipeline.diagnostics.records.length, 2, 'each distinct unknown form is recorded once')

    for (const spec of ['screen', 'auto', 'input', 'resolution', 64, '50%', { param: 'x' }, { screenDivide: 'z' }, { scale: 0.5 }, undefined]) {
      pipeline.resolveDimension(spec, 1000)
    }
    assert.equal(pipeline.diagnostics.records.length, 2, 'recognized forms (incl. input/resolution) and absent specs add no diagnostic')
  } finally {
    console.warn = originalWarn
  }
})
