#!/usr/bin/env node
// export-fat-graph.mjs — produce a RUNNABLE render graph for the Babylon harness.
//
// Runs the VENDORED published Noisemaker engine (vendor/noisemaker — the same artifact
// noisedeck.app ships) and serializes the runtime graph as a "fat graph": passes +
// programs-with-GLSL-source + textures + renderSurface. The harness reconstructs it and feeds a
// stock `new Pipeline(graph, BabylonBackend)`. GLSL is embedded here, so the browser side never
// needs the engine's effect bundles — only `Pipeline` from the core ESM.
//
// The engine + per-effect mini-bundles are vendored from https://shaders.noisedeck.app/<version>
// (see vendor/fetch.sh); nothing here references a sibling checkout.
//
// Usage:
//   node export-fat-graph.mjs "<dsl>" [out.json]
//   node export-fat-graph.mjs --file program.dsl [out.json]

import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { bootEngine } from '../vendor/engine.mjs'

// Runtime graph -> JSON-serializable "fat graph": Map->object, keep program source, drop
// volatile fields (compiledAt) and the allocations Map (the runtime executor ignores it).
function fatten (graph) {
  const textures = {}
  if (graph.textures instanceof Map) { for (const [k, v] of graph.textures) textures[k] = v }
  else Object.assign(textures, graph.textures || {})

  const programs = {}
  for (const [id, p] of Object.entries(graph.programs || {})) {
    programs[id] = {
      glsl: p.glsl,
      vertex: p.vertex,
      fragment: p.fragment,
      source: p.source,
      uniformLayout: p.uniformLayout || {},
      defines: p.defines || {},
      fragmentEntryPoint: p.fragmentEntryPoint
    }
  }

  return {
    id: graph.id,
    source: graph.source,
    renderSurface: graph.renderSurface ?? null,
    passes: graph.passes,
    textures,
    programs
  }
}

export async function exportFatGraph (dsl) {
  const { compileGraph } = await bootEngine()
  const graph = compileGraph(dsl)
  return fatten(graph)
}

async function main () {
  const argv = process.argv.slice(2)
  if (argv.length === 0) {
    process.stderr.write('usage: node export-fat-graph.mjs "<dsl>" [out.json]\n' +
      '       node export-fat-graph.mjs --file program.dsl [out.json]\n')
    process.exit(2)
  }
  let dsl, outPath
  if (argv[0] === '--file') { dsl = readFileSync(argv[1], 'utf8'); outPath = argv[2] } else { dsl = argv[0]; outPath = argv[1] }

  const fat = await exportFatGraph(dsl)
  const json = JSON.stringify(fat)
  if (outPath) {
    writeFileSync(outPath, json + '\n')
    const nProg = Object.keys(fat.programs).length
    process.stderr.write(`[fat-graph] wrote ${outPath} (${fat.passes.length} passes, ${nProg} programs)\n`)
  } else {
    process.stdout.write(json + '\n')
  }
}

if (basename(process.argv[1] || '') === 'export-fat-graph.mjs') {
  main().catch(err => {
    process.stderr.write(`[fat-graph] FAILED: ${err?.stack || err?.message || JSON.stringify(err)}\n`)
    process.exit(1)
  })
}
