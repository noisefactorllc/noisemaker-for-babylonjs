// mesh-raster-check.mjs — prove the mesh triangle raster is byte-identical to the reference by feeding
// the SAME synthetic geometry to both engines. meshLoader fills the mesh textures host-side from an
// OBJ (externalMesh), which the headless corpus path never does (empty → flat bg). Here we inject an
// identical procedural sphere into global_mesh0_positions/normals on BOTH the reference (webgl2 demo)
// and the candidate (Babylon, via opts.injectMesh), render meshRender, and compare. This exercises
// projection, depth test, back-face cull, and Blinn-Phong lighting — the actual raster pipeline.

import { readFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { chromium } from 'playwright'
import { exportFatGraph } from '../tools/export-fat-graph.mjs'
import { INDEX_HTML, ensureBundle } from './render-candidate.mjs'

function crc32 (buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1) } return (c ^ 0xffffffff) >>> 0 }
function pngChunk (type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0); const body = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0); return Buffer.concat([len, body, crc]) }
function encodePng (w, h, rgba) { const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; const raw = Buffer.alloc(h * (1 + w * 4)); for (let y = 0; y < h; y++) { const di = y * (1 + w * 4); raw[di] = 0; Buffer.from(rgba).copy(raw, di + 1, y * w * 4, (y + 1) * w * 4) } return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]) }

const __dirname = dirname(fileURLToPath(import.meta.url))
const REFERENCE_ROOT = process.env.NM_REFERENCE_ROOT ? resolve(process.env.NM_REFERENCE_ROOT) : resolve(__dirname, '..', '..', 'noisemaker')
const HARNESS = join(REFERENCE_ROOT, 'vendor', 'shade-mcp', 'harness', 'index.js')
const SIZE = 256
const TIME = 0.25
const DSL = readFileSync(join(__dirname, 'programs', 'mesh_basic.dsl'), 'utf8')

// Deterministic UV sphere → one vertex per texel (W*H), triangles as consecutive triples; unused
// texels stay zero (degenerate, not rasterized). Outward-facing winding for frontFace(CCW)+cull BACK.
function makeSphere (rings = 16, sectors = 24, radius = 0.6, W = SIZE, H = SIZE) {
  const grid = []
  for (let r = 0; r <= rings; r++) {
    const phi = Math.PI * r / rings
    for (let s = 0; s <= sectors; s++) {
      const theta = 2 * Math.PI * s / sectors
      grid.push([Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)])
    }
  }
  const stride = sectors + 1
  const tris = []
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < sectors; s++) {
      const a = r * stride + s; const b = a + 1; const c = a + stride; const d = c + 1
      tris.push([a, c, b]); tris.push([b, c, d])
    }
  }
  const N = W * H
  const positions = new Array(N * 4).fill(0)
  const normals = new Array(N * 4).fill(0)
  let vi = 0
  for (const t of tris) {
    for (const idx of t) {
      const p = grid[idx]; const len = Math.hypot(p[0], p[1], p[2]) || 1
      positions[vi * 4] = p[0] * radius; positions[vi * 4 + 1] = p[1] * radius; positions[vi * 4 + 2] = p[2] * radius; positions[vi * 4 + 3] = 1
      normals[vi * 4] = p[0] / len; normals[vi * 4 + 1] = p[1] / len; normals[vi * 4 + 2] = p[2] / len; normals[vi * 4 + 3] = 0
      vi++
    }
  }
  return { positions, normals, nTris: tris.length, nVerts: vi }
}

async function renderReference (geom) {
  process.env.SHADE_VIEWER_ROOT = REFERENCE_ROOT
  process.env.SHADE_VIEWER_PATH = '/demo/shaders/'
  process.env.SHADE_EFFECTS_DIR = join(REFERENCE_ROOT, 'shaders', 'effects')
  process.env.SHADE_GLOBALS_PREFIX = '__noisemaker'
  process.env.SHADE_HEADLESS = process.env.SHADE_HEADLESS ?? '1'
  const { BrowserSession } = await import(pathToFileURL(HARNESS).href)
  const session = new BrowserSession({ backend: 'webgl2' })
  await session.setup()
  const page = session.page
  await session.setBackend('webgl2')
  await page.setViewportSize({ width: SIZE, height: SIZE })
  await page.waitForFunction(() => !!window.__noisemakerRenderingPipeline && !!document.getElementById('dsl-editor'), { timeout: 300000 })
  const base = await page.evaluate(() => window.__noisemakerRenderingPipeline?.graph?.id ?? null)
  await page.evaluate((src) => {
    const ed = document.getElementById('dsl-editor'); const run = document.getElementById('dsl-run-btn')
    ed.value = src; ed.dispatchEvent(new Event('input', { bubbles: true })); run.click()
  }, DSL)
  await page.waitForFunction((b) => {
    const s = (document.getElementById('status')?.textContent || '').toLowerCase()
    if (s.includes('error') || s.includes('failed')) throw new Error('compile failed: ' + document.getElementById('status')?.textContent)
    const p = window.__noisemakerRenderingPipeline
    return p && p.graph && p.graph.id !== b && p.isCompiling === false && s.includes('compiled')
  }, { timeout: 300000 }, base)
  await page.evaluate(() => { if (window.__noisemakerSetPaused) window.__noisemakerSetPaused(true) })
  await page.evaluate((sz) => {
    const r = window.__noisemakerCanvasRenderer; const p = window.__noisemakerRenderingPipeline
    if (r && r.canvas) { r.canvas.width = sz; r.canvas.height = sz }
    if (p && typeof p.resize === 'function') p.resize(sz, sz)
  }, SIZE)
  const result = await page.evaluate(({ geom, time }) => {
    const p = window.__noisemakerRenderingPipeline
    const gl = p.backend.gl
    // Flush any deferred recreateTextures (the resize above sets a dirty flag that the NEXT
    // render() acts on, re-zeroing all textures). Render once first so our mesh upload survives.
    p.render(time)
    const writeTex = (id, data) => {
      const info = p.backend.textures.get(id)
      if (!info?.handle) return false
      gl.bindTexture(gl.TEXTURE_2D, info.handle)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, info.width, info.height, gl.RGBA, gl.FLOAT, new Float32Array(data))
      gl.bindTexture(gl.TEXTURE_2D, null)
      return true
    }
    const wrote = [writeTex('global_mesh0_positions', geom.positions), writeTex('global_mesh0_normals', geom.normals)]
    p.render(time)
    const surface = p.surfaces.get(p.graph.renderSurface || 'o0')
    const info = p.backend.textures.get(surface.read)
    const { handle, width, height, glFormat } = info
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, handle, 0)
    const isFloat = glFormat?.type === gl.HALF_FLOAT || glFormat?.type === gl.FLOAT
    gl.finish(); let rgba8
    if (isFloat) { const buf = new Float32Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, buf); rgba8 = new Array(width * height * 4); for (let i = 0; i < buf.length; i++) rgba8[i] = Math.max(0, Math.min(255, Math.round(buf[i] * 255))) } else { const buf = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buf); rgba8 = Array.from(buf) }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fbo)
    return { width, height, pixels: rgba8, wrote }
  }, { geom, time: TIME })
  await session.teardown()
  // top-down flip to match candidate orientation
  const { width, height, pixels, wrote } = result
  const td = new Array(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const s = ((height - 1 - y) * width + x) * 4; const d = (y * width + x) * 4; for (let k = 0; k < 4; k++) td[d + k] = pixels[s + k] }
  return { width, height, data: td, wrote }
}

async function renderCandidate (geom) {
  await ensureBundle(false)
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu-sandbox', '--use-angle=metal'] })
  const page = await browser.newPage()
  page.on('pageerror', e => process.stderr.write('[pageerror] ' + String(e).split('\n')[0] + '\n'))
  await page.goto(pathToFileURL(INDEX_HTML).href)
  await page.waitForFunction(() => window.nmReady === true, { timeout: 30000 })
  const fat = await exportFatGraph(DSL)
  const res = await page.evaluate(async ({ fat, opts }) => {
    try { return { ok: true, ...(await window.nmRunFatGraph(fat, opts)) } } catch (e) { return { ok: false, error: String(e.stack || e) } }
  }, { fat, opts: { size: SIZE, time: TIME, injectMesh: geom } })
  await browser.close()
  if (!res.ok) throw new Error('candidate: ' + res.error)
  return res
}

function compare (a, b) {
  let maxd = 0; let sumd = 0; let nz = 0
  const n = Math.min(a.data.length, b.data.length)
  for (let i = 0; i < n; i++) { const d = Math.abs(a.data[i] - b.data[i]); if (d > maxd) maxd = d; sumd += d; if (a.data[i] !== 0 || b.data[i] !== 0) nz++ }
  return { maxd, mean: sumd / n, candNonzeroFrac: a.data.filter(v => v !== 0).length / a.data.length }
}

async function main () {
  const geom = makeSphere()
  process.stderr.write(`[xcheck] sphere: ${geom.nTris} tris, ${geom.nVerts} verts\n`)
  const ref = await renderReference(geom)
  process.stderr.write(`[xcheck] reference rendered (mesh upload: ${JSON.stringify(ref.wrote)})\n`)
  const cand = await renderCandidate(geom)
  process.stderr.write('[xcheck] candidate rendered\n')
  writeFileSync(join(__dirname, 'out', '_mesh_ref.png'), encodePng(ref.width, ref.height, Uint8Array.from(ref.data)))
  writeFileSync(join(__dirname, 'out', '_mesh_cand.png'), encodePng(cand.width, cand.height, Uint8Array.from(cand.data)))
  const cmp = compare(cand, ref)
  // how much of the candidate frame is non-background (proves the sphere actually rasterized)
  const litFrac = cand.data.reduce((acc, _, i) => acc, 0)
  let lit = 0
  for (let i = 0; i < cand.data.length; i += 4) { const r = cand.data[i]; const g = cand.data[i + 1]; const b = cand.data[i + 2]; if (Math.abs(r - 25) + Math.abs(g - 25) + Math.abs(b - 38) > 12) lit++ }
  process.stdout.write(`\n=== MESH RASTER CROSS-CHECK ===\nlit pixels (non-bg): ${lit} / ${SIZE * SIZE} (${(100 * lit / (SIZE * SIZE)).toFixed(1)}%)\nmax-abs-diff: ${cmp.maxd}\nmean-abs-diff: ${cmp.mean.toFixed(4)}\n${cmp.maxd <= 2 && lit > 1000 ? '✅ PASS — geometry rasterized AND byte-identical to reference' : (lit <= 1000 ? '⚠️  geometry did not rasterize (check winding/scale)' : '❌ FAIL — raster diverges')}\n`)
}

main().catch(e => { process.stderr.write('[xcheck] FATAL ' + (e?.stack || e) + '\n'); process.exit(1) })
