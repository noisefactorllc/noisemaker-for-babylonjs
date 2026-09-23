import assert from 'node:assert/strict'
import test from 'node:test'

import { exportFatGraph } from '../src/compiler/index.js'

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
      span: null,
    },
    {
      source: 'search synth\nrender(o0',
      code: 'P002',
      stage: 'parser',
      severity: 'error',
      message: "Expect ')' at line 2 col 10",
      location: { line: 2, column: 10 },
      span: null,
    },
    {
      source: 'search synth\nlet = 1',
      code: 'P001',
      stage: 'parser',
      severity: 'error',
      message: 'Expected identifier at line 2 col 5',
      location: { line: 2, column: 5 },
      span: null,
    },
    {
      source: 'search synth\nfoo(1',
      code: 'P002',
      stage: 'parser',
      severity: 'error',
      message: "Expect ')' at line 2 col 6",
      location: { line: 2, column: 6 },
      span: null,
    },
    {
      source: 'search synth\nlet x = midi()',
      code: 'P003',
      stage: 'parser',
      severity: 'error',
      message: "midi() requires 'channel' or 'zone' argument at line 2 col 9",
      location: { line: 2, column: 9 },
      span: null,
    },
    {
      source: 'search synth\nlet x = audio()',
      code: 'P003',
      stage: 'parser',
      severity: 'error',
      message: "audio() requires 'band' argument at line 2 col 9",
      location: { line: 2, column: 9 },
      span: null,
    },
    {
      source: 'search synth\nlet x = osc(type: oscKind.sine, bogus: 1)',
      code: 'P003',
      stage: 'parser',
      severity: 'error',
      message: "osc() unknown parameter 'bogus' at line 2 col 9. Valid: type, min, max, speed, offset, seed",
      location: { line: 2, column: 9 },
      span: null,
    },
  ]

  for (const { source, code, stage, severity, message, location, span } of cases) {
    const entryPoints = [compile]
    if (typeof parse === 'function') {
      entryPoints.push((src) => parse(lex(src)))
    }
    for (const entryPoint of entryPoints) {
      assert.throws(
        () => entryPoint(source),
        (err) => {
          assert.equal(err.name, 'SyntaxError')
          assert.equal(err.message, message)
          assert.deepEqual(err.diagnostic, { code, stage, severity, message, location, span })
          assert.equal(err.propertyIsEnumerable('diagnostic'), false)
          assert.equal(JSON.stringify(err), '{}')
          return true
        }
      )
    }
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

