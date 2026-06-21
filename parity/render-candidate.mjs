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

export async function ensureBundle (rebuild) {
  if (!rebuild && existsSync(BUNDLE)) {
    const bt = statSync(BUNDLE).mtimeMs
    const srcs = [ENTRY, join(ROOT, 'src/runtime/babylonBackend.js')]
    if (srcs.every(s => statSync(s).mtimeMs <= bt)) return
  }
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
    }, { fat, opts: { size: args.size, time: args.time, frames: args.frames, timestep: args.timestep, debug: !!process.env.NM_DEBUG }, mode })
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
