// Replaced when this kit was built.
//
// Upstream this module re-exports exportFatGraph() from
// ../../tools/export-fat-graph.mjs, which is Node only (it reads effect
// sources off the filesystem) and is deliberately not vendored here.
//
// Noisedeck runs the same transform in the browser and writes the finished fat
// graph straight into index.html, so nothing in this kit needs to compile DSL
// at runtime. If you want to rebuild a graph yourself, use fatten.js.
export function exportFatGraph() {
    throw new Error('use fatten.js in-app')
}
