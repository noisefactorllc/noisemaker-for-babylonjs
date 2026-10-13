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
    const field = patch.field || 'glsl'
    assert.ok(shader && typeof shader[field] === 'string', `${patch.id}/${patch.program} carries ${field} GLSL`)
    // bootEngine applies the patches fail-closed; after a successful boot the loaded
    // GLSL must be exactly the patched (upstream) text, never the pinned engine's.
    assert.equal(shader[field], patch.to, `${patch.id}/${patch.program} carries the patched GLSL`)
    assert.notEqual(shader[field], patch.from, `${patch.id}/${patch.program} must not render the pre-sync GLSL`)
  }
})

test('patched GLSL reaches compiled fat graphs (renderLit3d camera basis)', async () => {
  const fat = await exportFatGraph('search synth3d, render\nnoise3d().renderLit3d(specularIntensity: 2, shininess: 256).write(o0)\nrender(o0)')
  const sources = Object.values(fat.programs).map(p => `${p.glsl || ''}${p.fragment || ''}`).join('\n')
  // 700ac32e: right-handed camera basis — cross(forward, worldUp), not cross(worldUp, forward).
  assert.ok(sources.includes('cross(forward, worldUp)'), 'compiled fat graph embeds the patched renderLit3d camera basis')
  assert.ok(!sources.includes('cross(worldUp, forward)'), 'compiled fat graph no longer embeds the mirrored basis')
})

test('patched GLSL reaches compiled fat graphs (pointsBillboardRender highp sampler2D)', async () => {
  // 3f5775c6: deposit/depthKeys/depthMerge carry 65,536 particle IDs and camera depths
  // through float textures; WebGL's default sampler2D precision is lowp even with
  // highp float, so the upstream GLSL declares `precision highp sampler2D` per stage.
  const fat = await exportFatGraph('search synth, points, render\nnoise().pointsEmit().pointsBillboardRender().write(o0)\nrender(o0)')
  const sources = Object.values(fat.programs).map(p => `${p.glsl || ''}${p.fragment || ''}${p.vertex || ''}`).join('\n')
  assert.ok(sources.includes('precision highp float;\nprecision highp sampler2D;\n\n// Billboard Deposit Vertex'),
    'compiled fat graph embeds the patched deposit vertex stage')
  // depthKeys and depthMerge (compiled twice each: read + write sides of the pass split)
  const depthCount = (sources.match(/precision highp float;\nprecision highp sampler2D;\nprecision highp int;/g) || []).length
  assert.ok(depthCount >= 2, `depthKeys and depthMerge reach compiled graphs (found ${depthCount} depth-stage declarations)`)
})
