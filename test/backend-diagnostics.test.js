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

import { BabylonBackend, ShaderDiagnostic, parseGLSLInfoLog } from '../src/runtime/babylonBackend.js'

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
