#!/usr/bin/env node
// render-candidate.mjs <name> [--size 256] [--time 0.25] [--frames 8] [--out path] [--rebuild]
//
// Renders the Babylon candidate for a Tier-1 parity program: exports the fat graph, bundles
// the harness (esbuild), launches headless Chromium on ANGLE/Metal (the SAME WebGL2 driver
// the reference golden was rendered on), runs the reference Pipeline with BabylonBackend, and
// writes a top-down linear 8-bit PNG — the exact encoding compare.py expects.

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { deflateSync } from 'node:zlib'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { exportFatGraph } from '../tools/export-fat-graph.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(__dirname, '..')
const HARNESS_DIR = join(__dirname, 'harness')
const ENTRY = join(HARNESS_DIR, 'entry.js')
const BUNDLE = join(HARNESS_DIR, 'bundle.js')
export const INDEX_HTML = join(HARNESS_DIR, 'index.html')
const BUNDLE_INPUTS = [
  ENTRY,
  join(ROOT, 'src/runtime/babylonBackend.js'),
  join(ROOT, 'src/runtime/babylonFrameExport.js'),
  join(ROOT, 'src/runtime/frameExport.js'),
  join(ROOT, 'src/runtime/renderer.js'),
  join(ROOT, 'vendor/noisemaker/noisemaker-shaders-core.esm.js')
]

// ---- minimal PNG encoder: top-down RGBA8 via zlib (matches the golden encoder) ----
function crc32 (buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  }
  return (c ^ 0xffffffff) >>> 0
}
function chunk (type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}
export function encodePNG (width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 6 // bit depth 8, color type 6 (RGBA)
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  const src = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: None
    src.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

function parseArgs (argv) {
  const a = { size: 256, time: 0.25, frames: 8, timestep: 0, rebuild: false, name: argv[0] }
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--size') a.size = +argv[++i]
    else if (k === '--time') a.time = +argv[++i]
    else if (k === '--frames') a.frames = +argv[++i]
    else if (k === '--timestep') a.timestep = +argv[++i]
    else if (k === '--out') a.out = argv[++i]
    else if (k === '--rebuild') a.rebuild = true
  }
  return a
}

export function bundleInputsAreFresh (bundle, inputs) {
  if (!existsSync(bundle)) return false
  const bundleTime = statSync(bundle).mtimeMs
  return inputs.every(input => existsSync(input) && statSync(input).mtimeMs <= bundleTime)
}

// Deterministic external-input fixtures (GAP-004): the host sources fed to BOTH backends for the
// real-input branch of each external-input effect (see parity/harness/entry.js). Applied whenever
// the rendered program appears here. The OBJ mesh is parsed + packed by the ENGINE's own
// loadOBJFromString (its internal parseOBJ/packMeshDataForTextures) and uploaded through
// backend.uploadMeshData — the real host OBJ-load path, on both backends.
export const EXTERNAL_FIXTURE_OBJ = [
  '# deterministic parity fixture mesh (unit cube, outward faces)',
  'v -0.5 -0.5 -0.5', 'v 0.5 -0.5 -0.5', 'v 0.5 0.5 -0.5', 'v -0.5 0.5 -0.5',
  'v -0.5 -0.5 0.5', 'v 0.5 -0.5 0.5', 'v 0.5 0.5 0.5', 'v -0.5 0.5 0.5',
  'vt 0 0', 'vt 1 0', 'vt 1 1', 'vt 0 1',
  'vn 0 0 -1', 'vn 0 0 1', 'vn 1 0 0', 'vn -1 0 0', 'vn 0 1 0', 'vn 0 -1 0',
  'f 1/1/1 2/2/1 3/3/1 4/4/1',
  'f 5/1/2 8/2/2 7/3/2 6/4/2',
  'f 2/1/3 6/2/3 7/3/3 3/4/3',
  'f 4/1/4 8/2/4 5/3/4 1/4/4',
  'f 3/1/5 7/2/5 8/3/5 4/4/5',
  'f 1/1/6 5/2/6 6/3/6 2/4/6'
].join('\n') + '\n'

export const EXTERNAL_FIXTURES = {
  // media: deterministic non-square host image (odd dimensions exercise the aspect/crop math),
  // uploaded on the compiled media pass's imageTex id (flipY:false — the video path) with the
  // imageSize uniform mirroring the UI's size reporting.
  media_image: { media: { width: 161, height: 97 } },
  // text: output-sized deterministic overlay canvas (the shader samples textTex in normalized
  // output space; canvas defaults to the render size) uploaded with flipY:true.
  text_glyphs: { text: {} },
  // roll: the engine's own MidiState with deterministic note events + clock.
  roll_midi: { midi: { clockCount: 96, notes: [
    { ch: 1, key: 60, velocity: 100, order: 1 },
    { ch: 1, key: 64, velocity: 64, order: 2 },
    { ch: 2, key: 48, velocity: 127, order: 3 },
    { ch: 9, key: 84, velocity: 32, order: 4 }
  ] } },
  // meshLoader: the deterministic OBJ above through the engine's own parser/pack/upload path.
  mesh_obj: { obj: EXTERNAL_FIXTURE_OBJ }
}

export async function ensureBundle (rebuild) {
  if (!rebuild && bundleInputsAreFresh(BUNDLE, BUNDLE_INPUTS)) return
  await build({
    entryPoints: [ENTRY], bundle: true, format: 'iife', outfile: BUNDLE,
    platform: 'browser', target: 'es2020', logLevel: 'warning'
  })
}

async function main () {
  const args = parseArgs(process.argv.slice(2))
  if (!args.name) {
    process.stderr.write('usage: render-candidate.mjs <name> [--size N --time T --frames F --out p --rebuild]\n')
    process.exit(2)
  }
  const dslPath = join(ROOT, 'parity', 'programs', `${args.name}.dsl`)
  if (!existsSync(dslPath)) throw new Error('no DSL program: ' + dslPath)
  const dsl = readFileSync(dslPath, 'utf8')
  const out = args.out || join(ROOT, 'parity', 'out', `${args.name}.candidate.png`)
  mkdirSync(dirname(out), { recursive: true })

  await ensureBundle(args.rebuild)
  const fat = await exportFatGraph(dsl)

  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu-sandbox', '--use-angle=metal'] })
  try {
    const page = await browser.newPage()
    const errs = []
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
    page.on('pageerror', e => errs.push(String(e)))
    await page.goto(pathToFileURL(INDEX_HTML).href)
    await page.waitForFunction(() => window.nmReady === true, { timeout: 30000 })
    // NM_GOLDEN: render the reference golden via the vendored WebGL2Backend (same engine + fat
    // graph as the candidate — only the backend differs). NM_VIA_RENDERER: drive through the
    // consumer-facing NoisemakerRenderer host. Default: the BabylonBackend candidate.
    const mode = process.env.NM_GOLDEN ? 'golden' : (process.env.NM_VIA_RENDERER ? 'viaRenderer' : 'candidate')
    const result = await page.evaluate(async ({ fat, opts, mode }) => {
      const fn = mode === 'golden' ? window.nmRunFatGraphWebGL2 : (mode === 'viaRenderer' ? window.nmRunViaRenderer : window.nmRunFatGraph)
      try { return { ok: true, ...(await fn(fat, opts)) } } catch (e) { return { ok: false, error: String((e && e.stack) || e) } }
    }, { fat, opts: { size: args.size, time: args.time, frames: args.frames, timestep: args.timestep, debug: !!process.env.NM_DEBUG, external: EXTERNAL_FIXTURES[args.name] }, mode })
    if (!result.ok) throw new Error('harness error: ' + result.error + (errs.length ? '\nconsole:\n' + errs.join('\n') : ''))
    if (process.env.NM_DEBUG && result.debug) process.stderr.write('[debug] ' + JSON.stringify(result.debug, null, 2) + '\n')
    writeFileSync(out, encodePNG(result.width, result.height, Uint8Array.from(result.data)))
    process.stderr.write(`[render-candidate] wrote ${out} (${result.width}x${result.height})\n`)
  } finally {
    await browser.close()
  }
}

// Only run when invoked directly (render-batch.mjs imports the helpers above).
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(e => { process.stderr.write(`[render-candidate] FAILED: ${e?.stack || e}\n`); process.exit(1) })
}
