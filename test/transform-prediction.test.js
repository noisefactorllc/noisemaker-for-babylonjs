/**
 * Replacement preflight prediction (engine GAP-008, upstream 403c2a4b, v1.0.187).
 *
 * Mirrors the focused upstream `shaders/tests/test_transform.js` prediction
 * cases against the vendored published engine, using real manifest effects.
 * The bundle's export surface adds `predictReplacement` (v1.0.187) and changes
 * `replaceEffect`/`getCompatibleReplacements` to predict candidate dimensions
 * before mutation: default classification is unchanged, `preflight: true`
 * refuses mutation on hard issues, and every success carries a `prediction`.
 * (`getParamAliases`/`registerParamAliases` stay bundle-internal in v1.0.187 —
 * not on the published export surface — so the param-alias path is not
 * reachable here.)
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { bootEngine } from '../vendor/engine.mjs'

test('engine v1.0.187: replacement prediction — dimensions, manifest backend support, preflight opt-in', async () => {
  await bootEngine()
  const {
    compile, listSteps, getCompatibleReplacements, replaceEffect, predictReplacement
  } = await import('../vendor/noisemaker/noisemaker-shaders-core.esm.js')

  assert.equal(typeof predictReplacement, 'function',
    'v1.0.187 exports predictReplacement on the published surface')

  const compiled = compile('search synth, filter\nnoise(10).bloom(0.5).write(o0)')
  const steps = listSteps(compiled)
  assert.equal(steps.length, 2)
  const bloomStep = steps[1]
  assert.equal(bloomStep.effectName, 'filter.bloom')

  // Listing-time prediction dimensions (empty supplied arguments — never
  // blocks on requires-arguments; dimensions without data report unknown).
  const listing = getCompatibleReplacements(compiled, bloomStep.stepIndex)
  assert.equal(listing.success, true)
  assert.ok(listing.predictions, 'listing returns a predictions map')
  const grain = listing.predictions['filter.grain']
  assert.ok(grain, 'filter.grain is a predicted candidate')
  assert.equal(grain.available, true, 'registered runtime effect is available')
  assert.deepEqual(grain.arguments, { unknown: [], missing: [] })
  assert.deepEqual(grain.types, [])
  assert.deepEqual(grain.ranges, [])
  assert.equal(grain.passes.passes[0].program, 'grain', 'pass prediction names the shader program')
  assert.deepEqual(grain.passes.passes[0].outputs, { fragColor: 'outputTex' })
  assert.ok(Array.isArray(grain.samplerTopology.internalTextures), 'sampler topology lists internal textures')
  assert.deepEqual(grain.samplerTopology.changedFrom.internalTextures,
    ['_brightTex', '_bloomTex'],
    'topology changedFrom carries the replaced effect (bloom) topology')
  assert.equal(grain.backendSupport, undefined, 'backend support is unknown without a manifest')

  // Backend support from an optional options.manifest (effects/manifest.json shape).
  const withManifest = getCompatibleReplacements(compiled, bloomStep.stepIndex, {
    manifest: { 'filter/grain': { description: 'Grain', glsl: { grain: 'combined' }, starter: false } }
  })
  assert.deepEqual(withManifest.predictions['filter.grain'].backendSupport,
    { webgl2: true, webgpu: false },
    'GLSL-only manifest entry marks WebGL2 supported, WebGPU unsupported')
  const missing = getCompatibleReplacements(compiled, bloomStep.stepIndex, {
    manifest: { 'filter/grain': { glsl: {}, wgsl: {} } }
  })
  assert.equal(missing.predictions['filter.grain'].backendSupport.webgl2, false,
    'a manifest entry with no matching program is unsupported')

  // Default classification is unchanged (previously accepted input only
  // changes behavior behind the preflight opt-in).
  assert.ok(listing.compatible.includes('filter.bloom'))
  assert.ok(listing.incompatible.includes('synth.noise'))

  // replaceEffect: default behavior unchanged, prediction attached.
  const unknownArg = replaceEffect(compiled, bloomStep.stepIndex, 'grain', { alphaa: 0.9 })
  assert.equal(unknownArg.success, true, 'unknown arguments stay accepted without opt-in')
  assert.ok(unknownArg.prediction, 'success carries the prediction')
  assert.deepEqual(unknownArg.prediction.arguments.unknown, ['alphaa'])
  assert.ok(unknownArg.prediction.issues.some(i => i.dimension === 'arguments' && i.message.includes('alphaa')))

  // preflight: true refuses hard issues and produces no program.
  const refuseUnknown = replaceEffect(compiled, bloomStep.stepIndex, 'grain', { alphaa: 0.9 }, { preflight: true })
  assert.equal(refuseUnknown.success, false)
  assert.ok(refuseUnknown.error.includes('preflight') && refuseUnknown.error.includes('alphaa'))
  assert.equal(refuseUnknown.program, undefined)

  const refuseRange = replaceEffect(compiled, bloomStep.stepIndex, 'grain', { alpha: 5 }, { preflight: true })
  assert.equal(refuseRange.success, false)
  assert.ok(refuseRange.error.includes('outside range') && refuseRange.error.includes('alpha'))

  const refuseType = replaceEffect(compiled, bloomStep.stepIndex, 'grain', { alpha: 'high' }, { preflight: true })
  assert.equal(refuseType.success, false)
  assert.ok(refuseType.error.includes('expects float'))

  // A valid preflight replacement passes through with the prediction.
  const valid = replaceEffect(compiled, bloomStep.stepIndex, 'grain', { alpha: 0.75 }, { preflight: true })
  assert.equal(valid.success, true)
  assert.equal(valid.program.plans[0].chain[1].op, 'filter.grain')
  assert.equal(valid.program.plans[0].chain[1].args.alpha, 0.75)
  assert.equal(valid.prediction.available, true)
  assert.equal(valid.prediction.issues.length, 0)
})
