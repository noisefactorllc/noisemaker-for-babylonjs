// The Noisemaker DSL compiler is the REFERENCE engine, reused verbatim (plain JS — no port).
// There are two ways to turn DSL into a graph the Babylon NoisemakerRenderer can consume:
//
//   1. Offline / Node (the golden path): `exportFatGraph(dsl)` runs the unchanged reference
//      `compileGraph` and attaches each program's GLSL, producing a "fat graph" JSON. This is
//      re-exported below. (Node-only — it reads effect sources from the filesystem.)
//
//   2. In-browser live DSL: bundle the reference `compileGraph` (or a vendored copy), call it
//      on the DSL, and pass the runtime graph to `NoisemakerRenderer.loadGraph(...)` with the
//      reference `Pipeline` class injected. The graph is the engine-agnostic seam — see
//      ARCHITECTURE.md.
export { exportFatGraph } from '../../tools/export-fat-graph.mjs'
