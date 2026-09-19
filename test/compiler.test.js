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
