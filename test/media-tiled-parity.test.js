import './browser-launch.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
import { exportFatGraph } from '../tools/export-fat-graph.mjs'
import { ensureBundle, INDEX_HTML, encodePNG } from '../parity/render-candidate.mjs'

test('media host input uses global tile coordinates', { timeout: 60000 }, async () => {
  await ensureBundle(false)
  const fat = await exportFatGraph('search synth\nmedia(position: 4, scaleAmt: 73, rotation: 17, offsetX: 9, offsetY: -7, tiling: 1).write(o0)\nrender(o0)')
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ['--disable-gpu-sandbox', '--use-angle=metal'] })
  const evidence = { cases: [], shader: fat.programs[fat.passes.find(p => p.effectFunc === 'media').program].glsl }
  const directory = process.env.NM_MEDIA_EVIDENCE
  if (directory) mkdirSync(directory, { recursive: true })
  const retain = (name, size, data) => {
    const pixels = Uint8Array.from(data)
    if (directory) writeFileSync(join(directory, name + '.png'), encodePNG(size, size, pixels))
    return createHash('sha256').update(pixels).digest('hex')
  }
  try {
    const page = await browser.newPage()
    await page.goto(pathToFileURL(INDEX_HTML).href)
    await page.waitForFunction(() => window.nmReady === true)
    evidence.renderer = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2')
      const extension = gl.getExtension('WEBGL_debug_renderer_info')
      const renderer = extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      return renderer
    })
    evidence.browser = browser.version()
    const render = (size, offset, reference) => page.evaluate(async args => {
      const result = await window[args.reference ? 'nmRunFatGraphWebGL2' : 'nmRunFatGraph'](args.fat, {
        size: args.size, frames: 2, time: 0.25,
        tileRegion: { offset: args.offset, fullResolution: [128, 128], renderScale: 1 },
        external: { media: { width: 161, height: 97 } }
      })
      return result
    }, { fat, size, offset, reference })
    const full = await render(128, [0, 0], true)
    assert.ok(full.external?.media?.texId, 'reference must upload an actual media texture')
    assert.equal(full.external.media.width, 161)
    assert.equal(full.external.media.height, 97)
    evidence.reference_external = full.external
    assert.ok(full.data.some((value, index) => index % 4 !== 3 && value > 0))
    evidence.full_sha256 = retain('full', 128, full.data)
    for (const offset of [[13, 29], [45, 61]]) {
      const tile = await render(64, offset, false)
      assert.ok(tile.external?.media?.texId, 'candidate must upload an actual media texture')
      assert.equal(tile.external.media.width, 161)
      assert.equal(tile.external.media.height, 97)
      const entry = { offset, external: tile.external, tile_sha256: retain('tile-' + offset.join('-'), 64, tile.data), maximum_difference: 0, different_channels: 0 }
      let nonzero = 0
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) for (let channel = 0; channel < 4; channel++) {
        const actual = tile.data[((16 + y) * 64 + 16 + x) * 4 + channel]
        const expected = full.data[((128 - offset[1] - 16 - 32 + y) * 128 + offset[0] + 16 + x) * 4 + channel]
        const difference = Math.abs(actual - expected)
        entry.maximum_difference = Math.max(entry.maximum_difference, difference)
        if (difference) entry.different_channels++
        if (channel !== 3 && expected > 0) nonzero++
      }
      entry.nonzero_expected_channels = nonzero
      evidence.cases.push(entry)
      assert.ok(nonzero > 2000, 'the graded crop must contain the uploaded image')
      assert.equal(entry.maximum_difference, 0, JSON.stringify(entry))
    }
  } finally {
    if (directory) writeFileSync(join(directory, 'result.json'), JSON.stringify(evidence, null, 2))
    await browser.close()
  }
})
