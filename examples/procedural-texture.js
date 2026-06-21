// Example: a Noisemaker effect as a live procedural texture on a Babylon mesh.
//
// Built by examples/build.mjs (which also generates demo.fatgraph.json from a DSL program via
// the reference compiler). Demonstrates the consumer surface: NoisemakerRenderer drives the
// reused reference Pipeline on a BabylonBackend and exposes a stable texture any material samples.

import { Engine } from '@babylonjs/core/Engines/engine.js'
import { Scene } from '@babylonjs/core/scene.js'
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js'
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js'
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js'
import '@babylonjs/core/Shaders/postprocess.vertex.js' // EffectRenderer's default vertex
import { Pipeline } from '../../noisemaker/shaders/src/runtime/pipeline.js'
import { NoisemakerRenderer } from '../src/runtime/renderer.js'
import fatGraph from './demo.fatgraph.json'

async function main () {
  const canvas = document.getElementById('app')
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: false }, true)
  const scene = new Scene(engine)

  const cam = new ArcRotateCamera('cam', Math.PI / 4, Math.PI / 3, 5, Vector3.Zero(), scene)
  cam.attachControl(canvas, true)
  new HemisphericLight('l', new Vector3(0, 1, 0), scene)

  // Drive the noisemaker effect.
  const nm = new NoisemakerRenderer(engine, { Pipeline, size: 512 })
  await nm.loadGraph(fatGraph)

  // Wrap the renderer's stable output (a render-target InternalTexture) in a scene Texture.
  const tex = new Texture(null, scene)
  tex._texture = nm.outputInternalTexture
  tex.wrapU = Texture.CLAMP_ADDRESSMODE
  tex.wrapV = Texture.CLAMP_ADDRESSMODE

  const box = MeshBuilder.CreateBox('box', { size: 2 }, scene)
  const mat = new StandardMaterial('m', scene)
  mat.diffuseTexture = tex
  mat.emissiveTexture = tex
  mat.disableLighting = true
  box.material = mat

  let t = 0
  engine.runRenderLoop(() => {
    t = (t + 1 / 600) % 1 // normalized 0..1 over a ~10s loop
    nm.renderFrame(t) // advance the effect; refreshes nm.outputInternalTexture
    box.rotation.y += 0.004
    box.rotation.x += 0.002
    scene.render()
  })
  window.addEventListener('resize', () => engine.resize())
}

main()
