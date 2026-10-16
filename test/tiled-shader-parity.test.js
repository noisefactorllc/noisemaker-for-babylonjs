import { ensurePlaywrightBrowsersPath } from './browser-launch.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { exportFatGraph } from '../tools/export-fat-graph.mjs'
import { ensureBundle, INDEX_HTML } from '../parity/render-candidate.mjs'

function difference(a, b) {
  assert.equal(a.length, b.length)
  let max = 0, channels = 0
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i])
    max = Math.max(max, d)
    if (d) channels++
  }
  return { max, channels }
}

test('upstream tile contracts render through BabylonBackend', { timeout: 300000 }, async t => {
  await ensureBundle(false)
  const browser = await chromium.launch({ headless: true,
    args: ['--disable-gpu-sandbox', '--use-angle=metal'] })
  try {
    const page = await browser.newPage()
    await page.goto(pathToFileURL(INDEX_HTML).href)
    await page.waitForFunction(() => window.nmReady === true)
    const render = (fat, size, tileRegion, crop, reference = false) => page.evaluate(async args => {
      const result = await window[args.reference ? "nmRunFatGraphWebGL2" : "nmRunFatGraph"](args.fat, {
        size: args.size, frames: 2, time: 0.25, tileRegion: args.tileRegion
      })
      if (!args.crop) return result.data
      const { x, y, size } = args.crop
      const data = []
      for (let row = y; row < y + size; row++) {
        data.push(...result.data.slice((row * args.size + x) * 4,
          (row * args.size + x + size) * 4))
      }
      return data
    }, { fat, size, tileRegion, crop, reference })

    const modes = [
      ['blur', 5], ['derivDivide', 5], ['edge', 5], ['emboss', 5],
      ['outline', 5], ['shadow', 5], ['sharpen', 5], ['sobel', 5],
      ['litEdge', 5], ['derivatives', 5], ['blurSharpen', 5],
      ['smoothEdge', 5], ['pixels', 3], ['posterize', 10], ['cga', 3],
      ['subpixel', 5], ['bloom', 5], ['zoomBlur', 4]
    ]
    for (const [mode, amount] of modes) {
      for (const scale of ['cga', 'subpixel'].includes(mode) ? [1, 3] : [1]) {
        await t.test(mode + ' uses full-image pixels at renderScale ' + scale, async () => {
          const fat = await exportFatGraph('search classicNoisedeck\nnoise(seed: 1).effects(effect: ' +
            mode + ', effectAmt: ' + amount + ').write(o0)\nrender(o0)')
          // Scaled subpixels snap to 24px cells; their input halo must exceed that reach.
          const fullSize = scale === 3 ? 256 : 128
          const tileSize = scale === 3 ? 128 : 64
          const margin = scale === 3 ? 48 : 16
          const full = await render(fat, fullSize, { offset: [0, 0], fullResolution: [fullSize, fullSize], renderScale: scale }, undefined, true)
          assert.ok(full.some((v, i) => i % 4 !== 3 && v > 0), 'untiled output must contain visible pixels')
          for (const offset of [[13, 29], [45, 61]]) {
            const actual = await render(fat, tileSize, { offset, fullResolution: [fullSize, fullSize], renderScale: scale },
              { x: margin, y: tileSize - margin - 32, size: 32 })
            const expected = []
            // Both backends read top-down; offsets use bottom-origin coordinates.
            for (let row = 0; row < 32; row++) {
              const y = fullSize - offset[1] - margin - 32 + row
              const x = offset[0] + margin
              expected.push(...full.slice((y * fullSize + x) * 4, (y * fullSize + x + 32) * 4))
            }
            const diff = difference(actual, expected)
            assert.equal(diff.max, 0, JSON.stringify({ mode, scale, offset, ...diff }))
          }
        })
      }
    }

    for (const offset of [[0, 0], [256, 512]]) {
      await t.test('glyphMap caps scaled cells at tile offset ' + offset.join(','), async () => {
        const dsl = cellSize => 'search synth, filter\ngradient(type: linear, color1: #999999, color2: #999999, colorCount: 2).glyphMap(cellSize: ' +
          cellSize + ').write(o0)\nrender(o0)'
        const region = { offset, fullResolution: [4096, 4096], renderScale: 32 }
        const actual = await render(await exportFatGraph(dsl(32)), 512, region)
        const capped = await render(await exportFatGraph(dsl(16)), 512, region, undefined, true)
        assert.ok(capped.some((v, i) => i % 4 !== 3 && v > 0), 'capped glyph output must be visible')
        assert.equal(difference(actual, capped).max, 0, 'a 1024px scaled cell must use the 512px tile cap')
      })
    }

    await t.test('zoomBlur stays inside its 256px tile halo', async () => {
      const fat = await exportFatGraph('search classicNoisedeck\nnoise(seed: 1).effects(effect: zoomBlur, effectAmt: 20).write(o0)\nrender(o0)')
      const a = await render(fat, 1024, { offset: [1024, 1024], fullResolution: [8192, 8192] },
        { x: 480, y: 480, size: 64 })
      const b = await render(fat, 2048, { offset: [512, 512], fullResolution: [8192, 8192] },
        { x: 992, y: 992, size: 64 }, true)
      const diff = difference(a, b)
      assert.equal(diff.max, 0, 'extra tile padding must not change bounded zoom taps: ' + JSON.stringify(diff))
      // Negative control: the same ROI must detect removal of the tap budget.
      const unbounded = structuredClone(fat)
      const program = unbounded.programs[unbounded.passes.find(p => p.effectFunc === 'effects').program]
      const clamp = 'tapB = min(max(tapB, -tapBudget), tapBudget);'
      assert.ok(program.glsl.includes(clamp), 'the compiled graph must contain the tested bound')
      program.glsl = program.glsl.replace(clamp, '')
      const unsafe = await render(unbounded, 1024,
        { offset: [1024, 1024], fullResolution: [8192, 8192] },
        { x: 480, y: 480, size: 64 })
      assert.ok(difference(unsafe, b).max > 0, 'the ROI must reject unbounded zoom taps')
    })
  } finally {
    await browser.close()
  }
})
