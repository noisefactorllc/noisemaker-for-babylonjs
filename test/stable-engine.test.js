import assert from 'node:assert/strict'
import test from 'node:test'
import { bootEngine } from '../vendor/engine.mjs'

await bootEngine()
const { compile, unparse, getEffect, registerOp, Pipeline, Backend, Effect, CanvasRenderer, compileGraph, lex } =
  await import('../vendor/noisemaker/noisemaker-shaders-core.esm.js')

registerOp('user.syncRgbProbe', { name: 'syncRgbProbe', args:
  ['r', 'g', 'b'].map(name => ({ name, type: 'float', default: 1 })) })

test('stable DSL retains element ids through compile and unparse without emitting uniforms', () => {
  const source = 'search synth, filter\nnoise(_id: "source").invert(_id: "filter").write(o0, _id: "out")\nread(_id: "in", surface: o0).write(o1)\nrender(o1)'
  const first = compile(source)
  assert.deepEqual(first.diagnostics, [])
  const ids = result => result.plans.flatMap(plan => plan.chain.map(step => step.args?._id))
  assert.deepEqual(ids(first), ['source', 'filter', 'out', 'in', undefined])
  assert.deepEqual(ids(compile(unparse(first))), ids(first))
  const graph = compileGraph(source)
  assert.ok(graph.passes.every(pass => !Object.hasOwn(pass.uniforms || {}, '_id')))
})

test('stable let-bound colours and expression arguments survive keyword application and unparse', () => {
  const source = 'search synth, user\nlet tint = syncRgbProbe(#804020)\nnoise().tint(g: 0.25).write(o0)'
  const result = compile(source)
  assert.deepEqual(result.diagnostics, [])
  const args = result.plans[0].chain.find(step => step.op === 'user.syncRgbProbe').args
  assert.deepEqual([args.r, args.g, args.b], [128 / 255, 0.25, 32 / 255])
  const expression = 'search synth, mixer\nlet fill = noise(scaleY: 3)\nlet moving = blendMode(tex: fill)\nnoise().moving().write(o0)'
  const first = compile(expression)
  const second = compile(unparse(first, {}, { getEffectDef: getEffect }))
  assert.deepEqual(second.diagnostics, [])
  const semanticPlans = result => JSON.parse(JSON.stringify(result.plans,
    (key, value) => ['loc', 'rawKwargs'].includes(key) ? undefined : value))
  assert.deepEqual(semanticPlans(second), semanticPlans(first))
})

test('excess positionals remain warnings and invalid read chains retain source locations', () => {
  const excess = compile('search synth, user\nnoise().syncRgbProbe(1, 2, 3, 4).write(o0)')
  assert.equal(excess.diagnostics.find(d => d.code === 'S009')?.severity, 'warning')
  const result = compile('search synth, filter, mixer\nlet source = read(o0).invert()\nnoise().blendMode(tex: source).write(o1)')
  const diagnostic = result.diagnostics.find(d => d.code === 'S001' && /only effect calls/.test(d.message))
  assert.ok(diagnostic)
  assert.deepEqual(diagnostic.location, { line: 2, column: 14 })
})

test('time zero and loop wrap use the actual normalized interval', async () => {
  class EmptyBackend extends Backend {
    async init () {}
    createTexture (id, spec) { const texture = { ...spec, id }; this.textures.set(id, texture); return texture }
    destroyTexture (id) { this.textures.delete(id) }
    beginFrame () {}
    endFrame () {}
  }
  for (const duration of [10, 30]) {
    const pipeline = new Pipeline({ passes: [], textures: new Map() }, new EmptyBackend(null))
    try {
      await pipeline.init(8, 8)
      pipeline.setAnimationDuration(duration)
      const step = 1 / (60 * duration)
      for (const [time, expected] of [[1 - step, 0], [0, step], [step, step]]) {
        pipeline.render(time)
        assert.ok(Math.abs(pipeline.globalUniforms.deltaTime - expected) < 1e-9)
      }
      pipeline.syncTime(0)
      pipeline.render(0.25)
      assert.equal(pipeline.globalUniforms.deltaTime, 0.25)
    } finally { pipeline.dispose() }
  }
})

test('prototype property names lex as identifiers and bind effect arguments', () => {
  for (const name of ['toString', 'valueOf', 'constructor', 'hasOwnProperty', '__proto__']) {
    assert.equal(lex(name)[0].type, 'IDENT')
    const compiled = compile(`search synth\nlet ${name} = 2\nnoise(scaleX: ${name}).write(o0)\nrender(o0)`)
    assert.deepEqual(compiled.diagnostics, [])
    const args = compiled.plans[0].chain.find(step => step.op === 'synth.noise').args
    assert.deepEqual(args.scaleX, { _varRef: name, value: 2 })
  }
})

test('a prototype property name lexes as a member segment and reaches condition validation', () => {
  assert.deepEqual(lex('oscKind.toString').map(token => token.type), ['IDENT', 'DOT', 'IDENT', 'EOF'])
  const compiled = compile('search synth\nnoise().write(o0)\nif (oscKind.toString) { noise().write(o1) }\nrender(o0)')
  assert.deepEqual(compiled.diagnostics.map(({ code, message }) => ({ code, message })), [
    { code: 'S001', message: "Unknown enum path: 'oscKind.toString'" }
  ])
})

test('reserved words still lex as keywords', () => {
  const source = 'let render write write3d true false if elif else break continue return search subchain'
  assert.deepEqual(lex(source).map(token => token.type), [
    'LET', 'RENDER', 'WRITE', 'WRITE3D', 'TRUE', 'FALSE', 'IF', 'ELIF',
    'ELSE', 'BREAK', 'CONTINUE', 'RETURN', 'SEARCH', 'SUBCHAIN', 'EOF'
  ])
})

test('portable effects preserve named output contracts and reject empty names', async () => {
  for (const field of ['outputTex', 'outputXyz', 'outputVel', 'outputRgba']) {
    assert.equal(new Effect({ [field]: 'stored' })[field], 'stored')
    const renderer = new CanvasRenderer({})
    await assert.rejects(renderer.registerPortableEffect({ func: `invalid${field}`, [field]: ' ',
      passes: [{ program: 'fill', outputs: { color: 'outputTex' } }],
      shaders: { fill: { glsl: 'void main(){}' } } }), /nonempty texture name/)
  }
})
