import assert from 'node:assert/strict'
import test from 'node:test'

import { exportFatGraph } from '../src/compiler/index.js'

const sourcePosition = (lex, source, line, column) => {
  const matches = lex(source).filter(token => token.position && token.position.line === line && token.position.column === column)
  assert.equal(matches.length, 1, `expected 1 token match for (${line}, ${column}) in source: ${source}`)
  return { start: matches[0].position.start, end: matches[0].position.end }
}

test('compiler exportFatGraph produces fat graph with passes, programs, and valid shaders', async () => {
  const fat = await exportFatGraph('search synth\nnoise().write(o0)\nrender(o0)')
  assert.equal(fat.renderSurface, 'o0')
  assert.equal(fat.passes.length, 2)
  assert.equal(Object.keys(fat.programs).length, 2)

  for (const [id, program] of Object.entries(fat.programs)) {
    const shaderSource = program.fragment || program.glsl
    assert.ok(typeof shaderSource === 'string' && shaderSource.length > 0, `Program ${id} missing non-empty shader text`)
  }
})

test('compiler handles chained variable alias syntax with terminal write blit', async () => {
  const dsl = `search synth, filter
let eff = rotate(1, 0.1)
noise().eff().write(o0)
render(o0)`
  const fat = await exportFatGraph(dsl)
  assert.equal(fat.renderSurface, 'o0')
  assert.equal(fat.passes.length, 3)
  assert.equal(Object.keys(fat.programs).length, 3)

  const passIds = fat.passes.map(p => p.id)
  assert.deepEqual(passIds, ['node_0_pass_0', 'node_1_pass_0', 'node_2_write_blit'])

  for (const [id, program] of Object.entries(fat.programs)) {
    const shaderSource = program.fragment || program.glsl
    assert.ok(typeof shaderSource === 'string' && shaderSource.length > 0, `Program ${id} missing non-empty shader text`)
  }
})

test('compiler validates legacy MIDI note mode channels as static integers 1-16', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  await bootEngine()
  const { compile } = await import('../vendor/noisemaker/noisemaker-shaders-core.esm.js')

  const modes = ['noteChange', 'gateNote', 'gateVelocity', 'triggerNote', 'velocity']
  for (const mode of modes) {
    for (const channel of ['0', '17', '1.5', 'true', '"1"', 'osc()']) {
      const compiled = compile(
        `search synth\nnoise(scaleX: midi(channel: ${channel}, mode: midiMode.${mode})).write(o0)`
      )
      assert.ok(
        compiled.diagnostics.some(d => d.code === 'S001' || d.code === 'S002'),
        `${mode} channel ${channel} should produce validation diagnostic`
      )
      assert.equal(
        compiled.plans[0].chain[0].args.scaleX._invalid,
        true,
        `${mode} channel ${channel} should mark descriptor inert`
      )
    }
    for (const channel of [1, 16]) {
      const compiled = compile(
        `search synth\nnoise(scaleX: midi(channel: ${channel}, mode: midiMode.${mode})).write(o0)`
      )
      assert.equal(compiled.diagnostics.length, 0, `${mode} channel ${channel} should have 0 diagnostics`)
      assert.equal(compiled.plans[0].chain[0].args.scaleX.channel, channel)
    }
  }
})

test('compiler enforces output surface reference range o0-o7', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  await bootEngine()
  const { compile } = await import('../vendor/noisemaker/noisemaker-shaders-core.esm.js')

  const outOfRangeCases = [
    { name: 'render target', source: 'search synth\nrender(o8)' },
    { name: 'read source', source: 'search synth\nread(o99).write(o0)' },
    { name: 'write target', source: 'search synth\nread(o0).write(o10)' }
  ]

  for (const { name, source } of outOfRangeCases) {
    assert.throws(
      () => compile(source),
      (err) => err instanceof SyntaxError && /Output surface reference 'o\d+' is out of range; expected o0-o7/.test(err.message),
      `${name} should throw SyntaxError for out-of-range output surface`
    )
  }

  const compiled = compile('search synth\nread(o0).write(o7)\nrender(o7)')
  assert.deepEqual(compiled.plans[0].chain[0].args.tex, { kind: 'output', name: 'o0' })
  assert.deepEqual(compiled.plans[0].write, { kind: 'output', name: 'o7' })
  assert.equal(compiled.render, 'o7')

  const memberCompiled = compile(`search synth
let low = foo.o0
let high = foo.o7
let extended = foo.o8
let many = foo.o99`)
  assert.deepEqual(
    memberCompiled.vars.map(({ expr }) => expr.path),
    [['foo', 'o0'], ['foo', 'o7'], ['foo', 'o8'], ['foo', 'o99']]
  )
})

test('mutation introspection excludes builtin pipeline steps', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  await bootEngine()
  const { compile, listSteps, replaceEffect, getCompatibleReplacements } = await import('../vendor/noisemaker/noisemaker-shaders-core.esm.js')

  const compiled = compile('search synth, filter\nnoise(10).bloom(0.5).write(o0)')
  const steps = listSteps(compiled)

  assert.equal(steps.length, 2, 'Should have 2 editable effect steps')
  assert.equal(steps[0].effectName, 'synth.noise')
  assert.equal(steps[0].stepIndex, 0)
  assert.equal(steps[1].effectName, 'filter.bloom')
  assert.equal(steps[1].stepIndex, 1)

  const builtinStep = compiled.plans[0].chain.find(step => step.builtin)
  assert.ok(builtinStep, 'Compiled plan should contain a builtin blit/write step')

  const replaceResult = replaceEffect(compiled, builtinStep.temp, 'blur')
  assert.equal(replaceResult.success, false)
  assert.equal(replaceResult.error, `Step with index ${builtinStep.temp} not found`)

  const compatResult = getCompatibleReplacements(compiled, builtinStep.temp)
  assert.equal(compatResult.success, false)
  assert.equal(compatResult.error, `Step with index ${builtinStep.temp} not found`)
})

test('DSL diagnostics preserve source columns across compiler positions', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  await bootEngine()
  const { compile } = await import('../vendor/noisemaker/noisemaker-shaders-core.esm.js')

  const result = compile('search synth\n  read(123).write(o0)')
  const diagSummary = result.diagnostics.map(({ code, location }) => ({ code, location }))
  assert.deepEqual(diagSummary, [
    { code: 'S001', location: { line: 2, column: 3 } },
    { code: 'S005', location: { line: 2, column: 13 } },
  ])

  const inlineReadResult = compile('search synth\n\n    noise().read(o0).write(o1)')
  const inlineReadDiag = inlineReadResult.diagnostics.find((d) => d.code === 'S001')
  assert.ok(inlineReadDiag, 'inline read produces S001 diagnostic')
  assert.deepEqual(inlineReadDiag.location, { line: 3, column: 13 })
})

test('structured DSL lexer diagnostics attach diagnostic metadata to thrown SyntaxError', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  await bootEngine()
  const { compile, lex } = await import('../vendor/noisemaker/noisemaker-shaders-core.esm.js')

  const cases = [
    {
      source: '@',
      code: 'L001',
      stage: 'lexer',
      severity: 'error',
      message: "Unexpected character '@' at line 1 col 1",
      location: { line: 1, column: 1 },
      span: { start: 0, end: 1 },
    },
    {
      source: '"unterminated',
      code: 'L002',
      stage: 'lexer',
      severity: 'error',
      message: 'Unterminated string literal at line 1 col 1',
      location: { line: 1, column: 1 },
      span: { start: 0, end: 13 },
    },
    {
      source: '/* unclosed',
      code: 'L003',
      stage: 'lexer',
      severity: 'error',
      message: 'Unterminated comment at line 1 col 1',
      location: { line: 1, column: 1 },
      span: { start: 0, end: 11 },
    },
    {
      source: 'search synth\nrender(o99)',
      code: 'L004',
      stage: 'lexer',
      severity: 'error',
      message: "Output surface reference 'o99' is out of range; expected o0-o7 at line 2 col 8",
      location: { line: 2, column: 8 },
      span: { start: 20, end: 23 },
    },
  ]

  for (const { source, code, stage, severity, message, location, span } of cases) {
    for (const entryPoint of [lex, compile]) {
      assert.throws(
        () => entryPoint(source),
        (err) => {
          assert.equal(err.name, 'SyntaxError')
          assert.equal(err.message, message)
          assert.deepEqual(err.diagnostic, { code, stage, severity, message, location, span })
          return true
        }
      )
    }
  }
})

test('structured DSL parser diagnostics attach diagnostic metadata to thrown SyntaxError', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  await bootEngine()
  const { compile, lex, parse } = await import('../vendor/noisemaker/noisemaker-shaders-core.esm.js')

  const cases = [
    {
      source: 'search synth\nrender o0',
      code: 'P001',
      stage: 'parser',
      severity: 'error',
      message: "Expect '(' at line 2 col 8",
      location: { line: 2, column: 8 },
    },
    {
      source: 'search synth\nrender(o0',
      code: 'P002',
      stage: 'parser',
      severity: 'error',
      message: "Expect ')' at line 2 col 10",
      location: { line: 2, column: 10 },
    },
    {
      source: 'search synth\nlet = 1',
      code: 'P001',
      stage: 'parser',
      severity: 'error',
      message: 'Expected identifier at line 2 col 5',
      location: { line: 2, column: 5 },
    },
    {
      source: 'search synth\nfoo(1',
      code: 'P002',
      stage: 'parser',
      severity: 'error',
      message: "Expect ')' at line 2 col 6",
      location: { line: 2, column: 6 },
    },
    {
      source: 'search synth\nlet x = midi()',
      code: 'P003',
      stage: 'parser',
      severity: 'error',
      message: "midi() requires 'channel' or 'zone' argument at line 2 col 9",
      location: { line: 2, column: 9 },
    },
    {
      source: 'search synth\nlet x = audio()',
      code: 'P003',
      stage: 'parser',
      severity: 'error',
      message: "audio() requires 'band' argument at line 2 col 9",
      location: { line: 2, column: 9 },
    },
    {
      source: 'search synth\nlet x = osc(type: oscKind.sine, bogus: 1)',
      code: 'P003',
      stage: 'parser',
      severity: 'error',
      message: "osc() unknown parameter 'bogus' at line 2 col 9. Valid: type, min, max, speed, offset, seed",
      location: { line: 2, column: 9 },
    },
    {
      source: 'search bogus\nrender(o0)',
      code: 'P004',
      stage: 'parser',
      severity: 'error',
      message: "Invalid namespace 'bogus' at line 1 col 8. Valid namespaces: io, classicNoisedeck, synth, mixer, filter, render, points, synth3d, filter3d, user",
      location: { line: 1, column: 8 },
    },
    {
      source: 'search synth search filter\nrender(o0)',
      code: 'P004',
      stage: 'parser',
      severity: 'error',
      message: 'Only one search directive is allowed per program at line 1 col 14',
      location: { line: 1, column: 14 },
    },
    {
      source: 'let x = 1\nsearch synth\nrender(o0)',
      code: 'P004',
      stage: 'parser',
      severity: 'error',
      message: "'search' directive must appear before other statements at line 2 col 1",
      location: { line: 2, column: 1 },
    },
    {
      source: 'render(o0)',
      code: 'P004',
      stage: 'parser',
      severity: 'error',
      message: "Missing required 'search' directive. Every program must start with 'search <namespace>, ...' to specify namespace search order.",
      location: { line: 1, column: 11 },
    },
    {
      source: 'search synth\nrender(1)',
      code: 'P005',
      stage: 'parser',
      severity: 'error',
      message: 'Expected output reference in render()',
      location: { line: 2, column: 8 },
    },
    {
      source: 'search synth\nlet x = diagProbe().write(o0)',
      code: 'P005',
      stage: 'parser',
      severity: 'error',
      message: "'.write()' is only allowed in statement context at line 2 col 21",
      location: { line: 2, column: 21 },
    },
    {
      source: 'search synth\ndiagProbe().write()',
      code: 'P005',
      stage: 'parser',
      severity: 'error',
      message: 'write() requires an explicit surface reference (e.g., o0, o1, xyz0, vel0, rgba0, mesh0, none) at line 2 col 19',
      location: { line: 2, column: 19 },
    },
    {
      source: 'search synth\ndiagProbe().write3d(1, geo0)',
      code: 'P005',
      stage: 'parser',
      severity: 'error',
      message: 'Expected tex3d reference in write3d() at line 2 col 21',
      location: { line: 2, column: 21 },
    },
    {
      source: 'search synth\ndiagProbe().write3d(vol0, 1)',
      code: 'P005',
      stage: 'parser',
      severity: 'error',
      message: 'Expected geo reference in write3d() at line 2 col 27',
      location: { line: 2, column: 27 },
    },
    {
      source: 'search synth\nread(o0).subchain(name: 1) { .noise() }',
      code: 'P006',
      stage: 'parser',
      severity: 'error',
      message: 'Expected string value for subchain name at line 2 col 25',
      location: { line: 2, column: 25 },
    },
    {
      source: 'search synth\nread(o0).subchain(name:',
      code: 'P006',
      stage: 'parser',
      severity: 'error',
      message: 'Expected string value for subchain name at line 2 col 24',
      location: { line: 2, column: 24 },
    },
    {
      source: 'search synth\nread(o0).subchain() { noise() }',
      code: 'P006',
      stage: 'parser',
      severity: 'error',
      message: "Expected '.' before chain element in subchain body at line 2 col 23",
      location: { line: 2, column: 23 },
    },
    {
      source: 'search synth\nread(o0).subchain() {',
      code: 'P006',
      stage: 'parser',
      severity: 'error',
      message: "Expected '.' before chain element in subchain body at line 2 col 22",
      location: { line: 2, column: 22 },
    },
    {
      source: 'search synth\nread(o0).subchain() {}',
      code: 'P006',
      stage: 'parser',
      severity: 'error',
      message: 'Subchain body cannot be empty at line 2 col 10',
      location: { line: 2, column: 10 },
    },
    {
      source: 'search synth\nread(o0).subchain() { /* empty */ }',
      code: 'P006',
      stage: 'parser',
      severity: 'error',
      message: 'Subchain body cannot be empty at line 2 col 10',
      location: { line: 2, column: 10 },
    },
    {
      source: 'search synth\nlet x = from(a: 1, b: 2)',
      code: 'P007',
      stage: 'parser',
      severity: 'error',
      message: "'from' does not support named arguments at line 2 col 9",
      location: { line: 2, column: 9 },
    },
    {
      source: 'search synth\nlet x = from(synth)',
      code: 'P007',
      stage: 'parser',
      severity: 'error',
      message: "'from' requires exactly two arguments (namespace, call) at line 2 col 9",
      location: { line: 2, column: 9 },
    },
    {
      source: 'search synth\nlet x = from(1, probe())',
      code: 'P007',
      stage: 'parser',
      severity: 'error',
      message: "'from' namespace argument must be an identifier at line 2 col 9",
      location: { line: 2, column: 9 },
    },
    {
      source: 'search synth\nlet x = from(synth, 1)',
      code: 'P007',
      stage: 'parser',
      severity: 'error',
      message: "'from' second argument must be a call expression at line 2 col 9",
      location: { line: 2, column: 9 },
    },
    {
      source: 'search synth\nnd.noise()',
      code: 'P007',
      stage: 'parser',
      severity: 'error',
      message: "Inline namespace syntax 'nd.noise()' is not allowed. Use 'search nd' at the start of the program instead, at line 2 col 1",
      location: { line: 2, column: 1 },
    },
    {
      source: 'search synth\ndiagProbe(1, x: 2)',
      code: 'P007',
      stage: 'parser',
      severity: 'error',
      message: 'Cannot mix positional and keyword arguments at line 2 col 14',
      location: { line: 2, column: 14 },
    },
    {
      source: 'search synth\ndiagProbe(x: 1, 2)',
      code: 'P007',
      stage: 'parser',
      severity: 'error',
      message: 'Cannot mix positional and keyword arguments at line 2 col 17',
      location: { line: 2, column: 17 },
    },
    {
      source: '// 😀\r\nsearch synth\r\n\tdiagProbe(1, x: 2)',
      code: 'P007',
      stage: 'parser',
      severity: 'error',
      message: 'Cannot mix positional and keyword arguments at line 3 col 15',
      location: { line: 3, column: 15 },
    },
    {
      source: 'search synth\nlet x = "😀"; nd.noise()',
      code: 'P007',
      stage: 'parser',
      severity: 'error',
      message: "Inline namespace syntax 'nd.noise()' is not allowed. Use 'search nd' at the start of the program instead, at line 2 col 15",
      location: { line: 2, column: 15 },
    },
    {
      source: 'search synth\nlet x = ;',
      code: 'P001',
      stage: 'parser',
      severity: 'error',
      message: "Expected expression after '=' at line 2 col 9",
      location: { line: 2, column: 9 },
    },
    {
      source: 'search synth\ndiagProbe(a: )',
      code: 'P001',
      stage: 'parser',
      severity: 'error',
      message: "Expected expression after '=' at line 2 col 14",
      location: { line: 2, column: 14 },
    },
    {
      source: 'search synth\nlet x = [1 2]',
      code: 'P001',
      stage: 'parser',
      severity: 'error',
      message: "Expected ']' at line 2 col 12",
      location: { line: 2, column: 12 },
    },
    {
      source: 'search synth\nlet x = foo.+',
      code: 'P001',
      stage: 'parser',
      severity: 'error',
      message: "Expected identifier after '.' at line 2 col 13",
      location: { line: 2, column: 13 },
    },
    {
      source: 'search synth\ndiagProbe(; 1)',
      code: 'P001',
      stage: 'parser',
      severity: 'error',
      message: 'Unexpected token SEMICOLON at line 2 col 11',
      location: { line: 2, column: 11 },
    },
    {
      source: 'search synth\nlet x = "😀"; let y = [1 2]',
      code: 'P001',
      stage: 'parser',
      severity: 'error',
      message: "Expected ']' at line 2 col 26",
      location: { line: 2, column: 26 },
    },
  ]

  for (const { source, code, stage, severity, message, location, span } of cases) {
    const entryPoints = [compile]
    if (typeof parse === 'function') {
      entryPoints.push((src) => parse(lex(src)))
    }
    const expectedSpan = span !== undefined ? span : (location ? sourcePosition(lex, source, location.line, location.column) : null)
    for (const entryPoint of entryPoints) {
      assert.throws(
        () => entryPoint(source),
        (err) => {
          assert.equal(err.name, 'SyntaxError')
          assert.equal(err.message, message)
          assert.deepEqual(err.diagnostic, { code, stage, severity, message, location, span: expectedSpan })
          assert.equal(err.propertyIsEnumerable('diagnostic'), false)
          assert.equal(JSON.stringify(err), '{}')
          return true
        }
      )
    }
  }

  const tokensWithoutPositions = lex('search synth\nrender o0').map(({ type, lexeme }) => ({ type, lexeme, line: 2, col: 8 }))
  assert.throws(
    () => parse(tokensWithoutPositions),
    (err) => {
      assert.equal(err.message, "Expect '(' at line 2 col 8")
      assert.deepEqual(err.diagnostic, {
        code: 'P001',
        stage: 'parser',
        severity: 'error',
        message: err.message,
        location: { line: 2, column: 8 },
        span: null,
      })
      return true
    }
  )
})

test('array literal numeric coercion diagnostics attach source coordinates and span', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  await bootEngine()
  const { compile, lex, parse } = await import('../vendor/noisemaker/noisemaker-shaders-core.esm.js')

  const failures = [
    ['search synth\nlet y = [1] + 1', 2, 9],
    ['search synth\nlet y = 1 * [1]', 2, 13],
    ['search synth\nlet y = -[1]', 2, 10],
  ]

  for (const [source, line, column] of failures) {
    for (const entryPoint of [source => parse(lex(source)), compile]) {
      assert.throws(
        () => entryPoint(source),
        (err) => {
          assert.equal(err.name, 'SyntaxError')
          assert.equal(err.message, 'Expected number')
          assert.deepEqual(err.diagnostic, {
            code: 'P001',
            stage: 'parser',
            severity: 'error',
            message: 'Expected number',
            location: { line, column },
            span: sourcePosition(lex, source, line, column),
          })
          assert.equal(err.propertyIsEnumerable('diagnostic'), false)
          assert.equal(JSON.stringify(err), '{}')
          return true
        }
      )
    }
  }
})

test('subchain argument validation contract exposes P008, P009, P010 diagnostics', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  await bootEngine()
  const { compile, lex, parse } = await import('../vendor/noisemaker/noisemaker-shaders-core.esm.js')

  // P008 unknown key: warning reported, value discarded
  const unknownRes = compile('search synth, filter\nread(o0).subchain(nme: "typo", name: "ok") { .invert() }.write(o1)')
  assert.equal(unknownRes.diagnostics.length, 1)
  assert.deepEqual(unknownRes.diagnostics[0], {
    code: 'P008',
    message: "Unknown subchain argument 'nme' at line 2 col 19. Valid keys: name, id. The value is discarded.",
    severity: 'warning',
    nodeId: null,
    location: { line: 2, column: 19 },
  })

  // P009 duplicate key: warning reported, last value wins in AST
  const dupRes = compile('search synth, filter\nread(o0).subchain(name: "a", name: "b") { .invert() }.write(o1)')
  assert.equal(dupRes.diagnostics.length, 1)
  assert.deepEqual(dupRes.diagnostics[0], {
    code: 'P009',
    message: "Duplicate subchain argument 'name' at line 2 col 30. The last value wins.",
    severity: 'warning',
    nodeId: null,
    location: { line: 2, column: 30 },
  })
  const subchainBegin = dupRes.plans[0].chain.find((s) => s.op === '_subchain_begin')
  assert.equal(subchainBegin.args.name, 'b')

  // P010 missing separator: warning reported
  const sepRes = compile('search synth, filter\nread(o0).subchain(name: "a" id: "b") { .invert() }.write(o1)')
  assert.equal(sepRes.diagnostics.length, 1)
  assert.deepEqual(sepRes.diagnostics[0], {
    code: 'P010',
    message: "Missing ',' between subchain arguments at line 2 col 29",
    severity: 'warning',
    nodeId: 'b',
    location: { line: 2, column: 29 },
  })

  // Strict opt-in throws SyntaxError across compile and parse entrypoints with non-enumerable diagnostic metadata
  const strictCases = [
    {
      source: 'search synth, filter\nread(o0).subchain(nme: "typo") { .invert() }.write(o1)',
      diagnostic: {
        code: 'P008',
        stage: 'parser',
        severity: 'error',
        message: "Unknown subchain argument 'nme' at line 2 col 19. Valid keys: name, id. The value is discarded.",
        location: { line: 2, column: 19 },
        span: { start: 39, end: 42 },
      },
    },
    {
      source: 'search synth, filter\nread(o0).subchain(name: "a", name: "b") { .invert() }.write(o1)',
      diagnostic: {
        code: 'P009',
        stage: 'parser',
        severity: 'error',
        message: "Duplicate subchain argument 'name' at line 2 col 30. The last value wins.",
        location: { line: 2, column: 30 },
        span: { start: 50, end: 54 },
      },
    },
    {
      source: 'search synth, filter\nread(o0).subchain(name: "a" id: "b") { .invert() }.write(o1)',
      diagnostic: {
        code: 'P010',
        stage: 'parser',
        severity: 'error',
        message: "Missing ',' between subchain arguments at line 2 col 29",
        location: { line: 2, column: 29 },
        span: { start: 49, end: 51 },
      },
    },
  ]

  for (const { source, diagnostic } of strictCases) {
    for (const entryPoint of [
      (s) => compile(s, { subchainArguments: 'strict' }),
      (s) => parse(lex(s), { subchainArguments: 'strict' }),
    ]) {
      assert.throws(
        () => entryPoint(source),
        (err) => {
          assert.equal(err.name, 'SyntaxError')
          assert.equal(err.message, diagnostic.message)
          assert.deepEqual(err.diagnostic, diagnostic)
          assert.equal(err.propertyIsEnumerable('diagnostic'), false)
          assert.equal(JSON.stringify(err), '{}')
          return true
        }
      )
    }
  }
})

test('number coercion diagnostics represent unavailable locations explicitly', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  await bootEngine()
  const { compile, lex, parse } = await import('../vendor/noisemaker/noisemaker-shaders-core.esm.js')

  for (const source of ['search synth\nlet x = 1 + o0', 'search synth\nlet x = diagProbe() + 1']) {
    for (const entryPoint of [source => parse(lex(source)), compile]) {
      assert.throws(
        () => entryPoint(source),
        (err) => {
          assert.equal(err.name, 'SyntaxError')
          assert.equal(err.message, 'Expected number')
          assert.deepEqual(err.diagnostic, {
            code: 'P001',
            stage: 'parser',
            severity: 'error',
            message: 'Expected number',
            location: null,
            span: null,
          })
          assert.equal(err.propertyIsEnumerable('diagnostic'), false)
          assert.equal(JSON.stringify(err), '{}')
          return true
        }
      )
    }
  }
})

test('valid call forms retain from-override namespaces and mixed automation arguments', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  await bootEngine()
  const { lex, parse } = await import('../vendor/noisemaker/noisemaker-shaders-core.esm.js')

  const ast = parse(lex('search synth\nlet x = from(synth, probe())'))
  assert.deepEqual(ast.vars[0].expr, {
    type: 'Call',
    name: 'probe',
    args: [],
    namespace: {
      name: 'synth',
      path: ['synth'],
      explicit: true,
      source: 'from',
      resolved: 'synth',
      searchOrder: ['synth'],
      fromOverride: true,
    },
  })
  const mixed = parse(lex('search synth\nlet a = midi(1, channel: 2)'))
  assert.equal(mixed.vars[0].expr.channel.value, 2)
})

test('compiler exportFatGraph handles subchains with scoped filters', async () => {
  const dsl = `search synth, filter
noise().write(o0)
read(o0).subchain(name: "sub") { .invert() }.write(o1)
render(o1)`
  const fat = await exportFatGraph(dsl)
  assert.equal(fat.renderSurface, 'o1')
  assert.equal(fat.passes.length, 4)
  for (const [id, program] of Object.entries(fat.programs)) {
    const shaderSource = program.fragment || program.glsl
    assert.ok(typeof shaderSource === 'string' && shaderSource.length > 0, `Program ${id} missing non-empty shader text`)
  }
})

test('compiler specializes landscape isosurface define and preserves voxel default', async () => {
  const cases = [
    {
      dsl: 'search synth, synth3d, render\nheightmap3d().renderLandscape3d().write(o0)\nrender(o0)',
      expectedFiltering: 1,
      expectedViewMode: 1
    },
    {
      dsl: 'search synth, synth3d, render\nheightmap3d().renderLandscape3d(filtering: isosurface).write(o0)\nrender(o0)',
      expectedFiltering: 0,
      expectedViewMode: 1
    },
    {
      dsl: 'search synth, synth3d, render\nheightmap3d().renderLandscape3d(filtering: voxel).write(o0)\nrender(o0)',
      expectedFiltering: 1,
      expectedViewMode: 1
    },
    {
      dsl: 'search synth, synth3d, render\nheightmap3d().renderLandscape3d(filtering: isosurface, viewMode: perspective).write(o0)\nrender(o0)',
      expectedFiltering: 0,
      expectedViewMode: 2
    }
  ]

  for (const { dsl, expectedFiltering, expectedViewMode } of cases) {
    const fat = await exportFatGraph(dsl)
    const landscapePass = fat.passes.find(p => p.effectFunc === 'renderLandscape3d')
    assert.ok(landscapePass, 'Fat graph must contain renderLandscape3d pass')

    const program = fat.programs[landscapePass.program]
    assert.ok(program, `Program ${landscapePass.program} must exist`)
    assert.equal(
      program.defines.FILTERING,
      expectedFiltering,
      `FILTERING define must be specialized to ${expectedFiltering}`
    )
    assert.equal(
      program.defines.VIEW_MODE,
      expectedViewMode,
      `VIEW_MODE define must be specialized to ${expectedViewMode}`
    )
    assert.ok(
      !Object.keys(program.uniforms || {}).includes('filtering'),
      'filtering must be a compile-time define, not a runtime uniform'
    )

    const shaderSource = program.fragment || program.glsl
    assert.ok(
      typeof shaderSource === 'string' && shaderSource.length > 0,
      'Landscape program must have non-empty shader source'
    )
    assert.ok(
      shaderSource.includes('traceIsosurface'),
      'Landscape shader source must include traceIsosurface'
    )
  }
})

test('compiler exportFatGraph propagates GAP-005 pass fields onto expanded passes', async () => {
  const fat = await exportFatGraph(`
    search synth, synth3d, render
    heightmap3d().renderLandscape3d().write(o0)
    render(o0)
  `)

  // Verify precompute pass from heightmap3d has name, type, and viewport
  const precomputePass = fat.passes.find(p => p.effectFunc === 'heightmap3d')
  assert.ok(precomputePass, 'Fat graph must contain heightmap3d pass')
  assert.equal(precomputePass.name, 'precompute')
  assert.equal(precomputePass.type, 'compute')
  assert.deepEqual(precomputePass.viewport, {
    width: { param: 'volumeSize', default: 64 },
    height: { param: 'volumeSize', power: 2, default: 4096 }
  })

  // Verify all expanded effect passes contain the GAP-005 contract fields
  for (const pass of fat.passes) {
    if (pass.program === 'blit') continue
    assert.ok('name' in pass, `Pass ${pass.id} must have name property`)
    assert.ok('type' in pass, `Pass ${pass.id} must have type property`)
    assert.ok('clear' in pass, `Pass ${pass.id} must have clear property`)
    assert.ok('viewport' in pass, `Pass ${pass.id} must have viewport property`)
    assert.ok('samplerTypes' in pass, `Pass ${pass.id} must have samplerTypes property`)
    assert.ok('conditions' in pass, `Pass ${pass.id} must have conditions property`)
  }
})

test('Pipeline resolves authored pass viewport into numeric viewportResolved coordinates', async () => {
  const { bootEngine } = await import('../vendor/engine.mjs')
  const { Pipeline } = await bootEngine()

  const pass = {
    viewport: { x: 0, y: 0, width: { param: 'volumeSize', default: 64 }, height: { param: 'volumeSize', power: 2, default: 4096 } },
    uniforms: { volumeSize: 64 }
  }
  const pipeline = Object.create(Pipeline.prototype)
  pipeline.width = 1280
  pipeline.height = 720
  pipeline.resolvePassViewport(pass)

  assert.ok(pass.viewportResolved, 'pass must have viewportResolved populated')
  assert.equal(pass.viewportResolved.w, 64)
  assert.equal(pass.viewportResolved.h, 4096)
  assert.equal(typeof pass.viewportResolved.x, 'number')
  assert.equal(typeof pass.viewportResolved.y, 'number')

  // Numeric box passes through untouched
  const numericPass = {
    viewport: { x: 10, y: 20, w: 300, h: 400 },
    uniforms: {}
  }
  pipeline.resolvePassViewport(numericPass)
  assert.deepEqual(numericPass.viewportResolved, { x: 10, y: 20, w: 300, h: 400 })
})

