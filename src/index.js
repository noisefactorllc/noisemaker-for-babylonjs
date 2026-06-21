// noisemaker-babylon — Babylon.js port of the Noisemaker procedural shader engine.
//
// The DSL compiler + render-graph + effects are the REFERENCE engine, reused verbatim (it is
// plain JS driving WebGL2/WebGPU — the exact Babylon environment). This package provides the
// new piece: a `BabylonBackend` that satisfies the reference `Backend` interface so the
// unchanged reference `Pipeline` runs on @babylonjs/core, plus a `NoisemakerRenderer` host that
// exposes the result as a Babylon texture. See ARCHITECTURE.md.
export { BabylonBackend } from './runtime/babylonBackend.js'
export { NoisemakerRenderer, reconstructGraph } from './runtime/renderer.js'
