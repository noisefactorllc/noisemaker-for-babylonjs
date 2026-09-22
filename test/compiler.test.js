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

