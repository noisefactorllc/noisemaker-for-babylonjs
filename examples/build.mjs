#!/usr/bin/env node
// build.mjs — generate a demo fat graph from DSL + bundle the example for the browser.
//   node examples/build.mjs        # then open examples/index.html
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exportFatGraph } from '../tools/export-fat-graph.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Any Polymorphic-DSL program. Animated, colorized value noise here.
const DSL = 'search synth\nnoise(seed: 1, scaleX: 30, scaleY: 30, octaves: 3, colorMode: 1, speed: 25).write(o0)\nrender(o0)\n'

const fat = await exportFatGraph(DSL)
writeFileSync(join(__dirname, 'demo.fatgraph.json'), JSON.stringify(fat))

await build({
  entryPoints: [join(__dirname, 'procedural-texture.js')],
  bundle: true, format: 'iife', outfile: join(__dirname, 'bundle.js'),
  platform: 'browser', target: 'es2020', loader: { '.json': 'json' }, logLevel: 'info'
})

process.stderr.write('[examples] built examples/bundle.js + demo.fatgraph.json — open examples/index.html\n')
