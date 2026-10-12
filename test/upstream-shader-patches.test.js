import assert from 'node:assert/strict'
import test from 'node:test'

import { bootEngine } from '../vendor/engine.mjs'
import { PATCHES } from '../vendor/upstream-shader-patches.mjs'
import { exportFatGraph } from '../src/compiler/index.js'

test('every upstream shader patch targets a registered effect program and is applied at boot', async () => {
  assert.ok(PATCHES.length > 0, 'the patch list must not be empty')
  const { getEffect } = await bootEngine()
  for (const patch of PATCHES) {
    const effect = getEffect(patch.id)
    assert.ok(effect, `effect ${patch.id} is registered`)
    const shader = effect.shaders && effect.shaders[patch.program]
    assert.ok(shader && typeof shader.glsl === 'string', `${patch.id}/${patch.program} carries GLSL`)
    // bootEngine applies the patches fail-closed; after a successful boot the loaded
    // GLSL must be exactly the patched (upstream) text, never the pinned engine's.
    assert.equal(shader.glsl, patch.to, `${patch.id}/${patch.program} carries the patched GLSL`)
    assert.notEqual(shader.glsl, patch.from, `${patch.id}/${patch.program} must not render the pre-sync GLSL`)
  }
})

test('patched GLSL reaches compiled fat graphs (renderLit3d camera basis)', async () => {
  const fat = await exportFatGraph('search synth3d, render\nnoise3d().renderLit3d(specularIntensity: 2, shininess: 256).write(o0)\nrender(o0)')
  const sources = Object.values(fat.programs).map(p => `${p.glsl || ''}${p.fragment || ''}`).join('\n')
  // 700ac32e: right-handed camera basis — cross(forward, worldUp), not cross(worldUp, forward).
  assert.ok(sources.includes('cross(forward, worldUp)'), 'compiled fat graph embeds the patched renderLit3d camera basis')
  assert.ok(!sources.includes('cross(worldUp, forward)'), 'compiled fat graph no longer embeds the mirrored basis')
})
