import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import test from 'node:test'

// GAP-001 acceptance checks against the PACKED artifact:
// pack -> install the tarball in an empty consumer -> import every advertised entry point ->
// observe the recoverable missing-engine error -> recover the engine -> compile the
// documented program through the INSTALLED compiler -> render it visibly in a real browser
// (no repository-relative patches) -> uninstall. Uses the dev dependencies the existing
// browser tests already require (esbuild, playwright); the engine recovery fetches the
// published engine from the CDN exactly as a consumer would.

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DOCUMENTED_PROGRAM = 'search synth, filter\nnoise(scaleX: 60).bloom().write(o0)\nrender(o0)'
const execFileP = promisify(execFile)

test('packed artifact: pack, install, import exports, error recovery, first render, uninstall', { timeout: 240000 }, async t => {
  const tmp = mkdtempSync(join(tmpdir(), 'nm-gap001-'))
  t.after(() => rmSync(tmp, { recursive: true, force: true }))

  // 1. Pack the real tarball.
  const pack = JSON.parse((await execFileP('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', tmp], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 })).stdout)
  const tarball = join(tmp, pack[0].filename)

  // 2. Install into an empty consumer.
  const consumer = join(tmp, 'consumer')
  mkdirSync(consumer)
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'gap001-consumer', private: true, type: 'module' }, null, 2))
  await execFileP('npm', ['install', tarball, '--ignore-scripts', '--no-audit', '--no-fund', '--legacy-peer-deps'], { cwd: consumer })
  const installed = join(consumer, 'node_modules', 'noisemaker-for-babylonjs')
  // The consumer supplies the Babylon peer itself (as a real consumer would).
  await execFileP('npm', ['install', '@babylonjs/core@9.13.0', '--no-audit', '--no-fund', '--legacy-peer-deps'], { cwd: consumer })

  // 3. Import every advertised entry point from the installed copy.
  const imports = await runConsumerProbe(consumer, `
    const [root, compiler, runtime] = await Promise.all([
      import('noisemaker-for-babylonjs'),
      import('noisemaker-for-babylonjs/compiler'),
      import('noisemaker-for-babylonjs/runtime')
    ])
    return {
      root: Object.keys(root).sort(), compiler: Object.keys(compiler).sort(), runtime: Object.keys(runtime).sort()
    }`)
  assert.deepEqual(imports, {
    root: ['BabylonBackend', 'FrameExportQueue', 'NoisemakerRenderer', 'reconstructGraph'],
    compiler: ['exportFatGraph'],
    runtime: ['BabylonBackend', 'FrameExportQueue', 'NoisemakerRenderer', 'reconstructGraph']
  })

  // 4. Error recovery: without the vendored engine the compiler fails with an actionable
  //    error naming the fetch script by absolute path (valid from any consumer cwd).
  const recoveryMessage = await runConsumerProbe(consumer, `
    const { exportFatGraph } = await import('noisemaker-for-babylonjs/compiler')
    try { await exportFatGraph(${JSON.stringify(DOCUMENTED_PROGRAM)}); return 'UNEXPECTED SUCCESS' }
    catch (err) { return String(err.message) }`)
  assert.match(recoveryMessage, /Vendored engine missing/)
  const fetchLine = recoveryMessage.split('\n').find(l => l.includes('Run: bash '))
  assert.ok(fetchLine, `missing-engine error must name the recovery command, got: ${recoveryMessage}`)
  const fetchScript = fetchLine.match(/Run: bash (\S+)/)[1]
  assert.equal(fetchScript, join(installed, 'vendor', 'fetch.sh'))
  assert.equal(existsSync(fetchScript), true, 'recovery instruction must point at an existing script')

  // 5. Recover the engine the documented way: run the installed fetch script, which
  //    downloads the published engine from the CDN into the installed package — the same
  //    recovery a consumer performs. Then compile the documented program through the
  //    INSTALLED compiler.
  await execFileP('bash', [fetchScript], { cwd: installed, timeout: 120000 })
  writeFileSync(join(consumer, 'fatgraph.json'), JSON.stringify(await compileDocumentedProgram(consumer)))
  const compiled = JSON.parse(readFileSync(join(consumer, 'fatgraph.json'), 'utf8'))
  assert.equal(compiled.renderSurface, 'o0')
  assert.ok(compiled.passes.length >= 2, `documented program must compile to passes (got ${compiled.passes.length})`)
  assert.equal(compiled.passes.length, Object.keys(compiled.programs).length)
  for (const program of Object.values(compiled.programs)) {
    assert.ok(typeof (program.fragment || program.glsl) === 'string' && (program.fragment || program.glsl).length > 0,
      'every compiled program must carry non-empty shader text')
  }

  // 6. First render: the compiled program drives NoisemakerRenderer (installed package +
  //    recovered engine + consumer-provided Babylon) to a visible, non-uniform texture.
  const distinctColors = await renderProbe(consumer, join(tmp, 'first-render.png'))
  assert.ok(distinctColors > 100, `rendered texture must be visibly non-uniform (got ${distinctColors} distinct colors)`)

  // 7. Uninstall cleanly.
  await execFileP('npm', ['uninstall', 'noisemaker-for-babylonjs', '--no-audit', '--no-fund', '--legacy-peer-deps'], { cwd: consumer })
  assert.equal(existsSync(installed), false, 'installed package must be removable')
})

// Compile the documented program with the INSTALLED compiler (bare specifier resolution
// happens inside the consumer) and return the resulting fat graph object.
function compileDocumentedProgram (consumer) {
  return runConsumerProbe(consumer, `
    const { exportFatGraph } = await import('noisemaker-for-babylonjs/compiler')
    return exportFatGraph(${JSON.stringify(DOCUMENTED_PROGRAM)})`)
}

// Run an async probe module inside the consumer (its bare specifiers resolve from the
// consumer's own node_modules) and resolve with the JSON value the probe returns.
async function runConsumerProbe (consumer, body) {
  const probe = join(consumer, `probe-${Math.random().toString(36).slice(2)}.mjs`)
  writeFileSync(probe, 'export default (async () => {\n' + body + '\n})()'
    + '.then(v => { console.log("__PROBE__" + JSON.stringify(v === undefined ? null : v)) })\n'
    + '.catch(e => { console.error(e && (e.stack || e.message)); process.exit(1) })\n')
  const { stdout } = await execFileP(process.execPath, [probe], { cwd: consumer })
  const line = stdout.split('\n').find(l => l.startsWith('__PROBE__'))
  assert.ok(line, 'probe must print its result marker')
  return JSON.parse(line.slice('__PROBE__'.length))
}

// Render the compiled program in headless Chromium through the installed package only.
// Returns the number of distinct colors on the canvas (a visible texture is non-uniform).
async function renderProbe (consumer, screenshotPath) {
  const { build } = await import('esbuild')
  const { chromium } = await import('playwright')
  const { createServer } = await import('node:http')
  const { readFile } = await import('node:fs/promises')
  const { extname } = await import('node:path')

  const pageJs = `
    import { Engine } from '@babylonjs/core/Engines/engine.js'
    import { Scene } from '@babylonjs/core/scene.js'
    import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js'
    import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
    import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js'
    import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js'
    import { Texture } from '@babylonjs/core/Materials/Textures/texture.js'
    import { Pipeline } from './node_modules/noisemaker-for-babylonjs/vendor/noisemaker/noisemaker-shaders-core.esm.js'
    import { NoisemakerRenderer } from 'noisemaker-for-babylonjs/runtime'

    async function main () {
      const engine = new Engine(document.getElementById('app'), true, { preserveDrawingBuffer: true }, true)
      const scene = new Scene(engine)
      const cam = new FreeCamera('cam', new Vector3(0, 0, -5), scene)
      cam.setTarget(Vector3.Zero())
      const nm = new NoisemakerRenderer(engine, { Pipeline, size: 128 })
      const fat = (await import('./fatgraph.json', { with: { type: 'json' } })).default
      await nm.loadGraph(fat)
      const plane = MeshBuilder.CreatePlane('p', { size: 2 }, scene)
      const mat = new StandardMaterial('m', scene)
      const tex = new Texture(null, scene)
      tex._texture = nm.outputInternalTexture
      mat.emissiveTexture = tex
      mat.diffuseTexture = tex
      mat.disableLighting = true
      plane.material = mat
      let t = 0
      const step = () => {
        t = (t + 0.05) % 1
        nm.renderFrame(t)
        scene.render()
        if (t < 0.25) { requestAnimationFrame(step); return }
        const probe = document.createElement('canvas')
        probe.width = document.getElementById('app').width
        probe.height = document.getElementById('app').height
        probe.getContext('2d').drawImage(document.getElementById('app'), 0, 0)
        const px = probe.getContext('2d').getImageData(0, 0, probe.width, probe.height).data
        const colors = new Set()
        for (let i = 0; i < px.length; i += 4) colors.add(px[i] + ',' + px[i + 1] + ',' + px[i + 2])
        window.__distinct = colors.size
        window.__probeDone = true
      }
      requestAnimationFrame(step)
    }
    main().catch(e => { document.title = 'FAILED'; document.body.textContent = 'FAILED: ' + (e && (e.stack || e.message)) })
  `
  writeFileSync(join(consumer, 'render-probe-src.mjs'), pageJs)
  writeFileSync(join(consumer, 'render-probe.html'),
    '<!doctype html><canvas id="app" width="256" height="256"></canvas><script type="module" src="./render-probe.mjs"></script>')
  await build({
    entryPoints: [join(consumer, 'render-probe-src.mjs')],
    bundle: true, format: 'esm', platform: 'browser', target: 'es2020', logLevel: 'warning',
    outfile: join(consumer, 'render-probe.mjs')
  })

  const server = createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '')
    readFile(join(consumer, rel)).then(
      body => { res.writeHead(200, { 'content-type': extname(rel) === '.html' ? 'text/html' : 'text/javascript' }); res.end(body) },
      () => { res.writeHead(404); res.end() })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']
    })
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(String(e)))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    await page.goto(`http://127.0.0.1:${server.address().port}/render-probe.html`)
    await page.waitForFunction('window.__probeDone === true || document.title === "FAILED"', null, { timeout: 60000 })
    assert.equal(errors.length, 0, `browser probe reported errors: ${errors.join(' | ')}`)
    await page.screenshot({ path: screenshotPath })
    return await page.evaluate(() => window.__distinct)
  } finally {
    if (browser) await browser.close()
    server.close()
  }
}
