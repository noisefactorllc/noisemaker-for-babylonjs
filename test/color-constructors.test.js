import assert from 'node:assert/strict'
import test from 'node:test'
import { bootEngine } from '../vendor/engine.mjs'

await bootEngine()
const { compile } = await import('../vendor/noisemaker/noisemaker-shaders-core.esm.js')

const solidColor = (color) => {
  const result = compile(`search synth\nsolid(color: ${color}).write(o0)\nrender(o0)`)
  const step = result.plans[0].chain.find(s => s.op === 'synth.solid')
  return { diagnostics: result.diagnostics, color: step.args.color }
}

test('color parameters accept vec3 and vec4 constructors and preserve the supplied components', () => {
  // solid's color default is [0.5, 0.5, 0.5]: three components. The constructor
  // forms must preserve what the program supplies, independently of that length.
  const vec3 = solidColor('vec3(0.3, 0.2, 0.25)')
  assert.deepEqual(vec3.diagnostics, [])
  assert.deepEqual(vec3.color, [0.3, 0.2, 0.25])

  const vec4 = solidColor('vec4(0.3, 0.2, 0.25, 0.4)')
  assert.deepEqual(vec4.diagnostics, [])
  assert.deepEqual(vec4.color, [0.3, 0.2, 0.25, 0.4])

  // Each constructor form resolves exactly like the equivalent array literal.
  assert.deepEqual(solidColor('[0.3, 0.2, 0.25]').color, vec3.color)
  assert.deepEqual(solidColor('[0.3, 0.2, 0.25, 0.4]').color, vec4.color)
})

test('invalid color constructor arity and keyword forms keep the diagnostic and the default', () => {
  // solid's default: [0.5, 0.5, 0.5]
  for (const form of ['vec3(1, 2)', 'vec4(1, 2, 3)', 'vec3(x: 1)']) {
    const bad = solidColor(form)
    assert.ok(bad.diagnostics.some(d => d.code === 'S002'),
      `${form} must raise S002`)
    assert.deepEqual(bad.color, [0.5, 0.5, 0.5], `${form} must fall back to the default`)
  }
})
