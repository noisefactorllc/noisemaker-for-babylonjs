#!/usr/bin/env node
// gen-mode-programs.mjs [--dry] — emit parity/programs/<effect>_<mode>.dsl fixtures for the
// effect x mode coverage matrix: every enum/define-selected "mode" choice of the artistic-filter
// family (the 2026-07 published release), one DSL program per (effect, mode), holding every other
// param at its global default. Complements tools/gen-programs.mjs (which covers each effect's
// single default/canonical program) — this covers the non-default enum branches that a
// default-only sweep never exercises.
//
// The matrix below is CURATED, not auto-derived from vendor/noisemaker/effects/**/*.js `choices`
// blindly: a blind scan over every `define`/`choices` global (including runtime-uniform enums
// with no `define`) across the WHOLE 210-effect catalog turns up ~490 cases, most belonging to
// long-standing effects (noise's 9-way NOISE_TYPE, kaleido's 29-way LOOP_OFFSET, ...) already
// covered at default-parity by the general roster sweep since before this crystallization round.
// This matrix is scoped to the artistic-filter release: the 13 effects named by the crystallization
// brief (texture, strokes, lowPoly, emboss, invert, hatch, halftone, relief, stipple, mosaicTiles,
// morphology, grain, edge) with their choice sets CORRECTED against the vendored ground truth
// (e.g. hatch actually has 6 modes, not the 4 the brief named; texture has 15, not 10) + the other
// 6 new effects that also carry an enum mode (extrude, lensFlare, oilPaint, pondRipples, scatter,
// wind) + one evidence-based substitution: `grain` (filter/grain.js) has NO enum param at all
// (only alpha/pause) so "grain{~10 types}" does not match ground truth; `dither.palette` has
// exactly 10 choices and dither changed content in this exact vendor sync, so it is included
// in grain's place as the better-evidenced match.
//
//   node tools/gen-mode-programs.mjs --dry     # preview
//   node tools/gen-mode-programs.mjs           # write parity/programs/<name>.dsl (skips existing)

import { writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PROGRAMS_DIR = join(ROOT, 'parity', 'programs')
const dry = process.argv.includes('--dry')

function tmpl (func, argsStr) {
  return `search synth, filter\nnoise(seed: 1, scaleX: 50, scaleY: 50).${func}(${argsStr}).write(o0)\nrender(o0)\n`
}

// [fixtureName, func, DSL-args] — one row per (effect, mode) case.
export const CASES = [
  // texture - mode, all 15 vendored choices (brief named only 10 of these)
  ...['canvas', 'crosshatch', 'halftone', 'paper', 'stucco', 'regular', 'soft', 'sprinkles', 'clumped', 'contrasty', 'enlarged', 'stippled', 'horizontal', 'vertical', 'speckle']
    .map(m => [`texture_${m}`, 'texture', `mode: ${m}`]),
  // strokes - mode, 5 choices
  ...['angled', 'sprayed', 'dark', 'sumiE', 'smudge'].map(m => [`strokes_${m}`, 'strokes', `mode: ${m}`]),
  // lowPoly - mode (4, runtime uniform) + border/light compile-time-gated (LP_BORDER/LP_LIGHT) toggles
  ...['flat', 'edges', 'distance2', 'distance3'].map(m => [`lowPoly_${m}`, 'lowPoly', `mode: ${m}`]),
  ['lowPoly_border', 'lowPoly', 'borderWidth: 10'],
  ['lowPoly_light', 'lowPoly', 'lightIntensity: 50'],
  // emboss - style (define STYLE), 2 choices
  ...['color', 'gray'].map(m => [`emboss_${m}`, 'emboss', `style: ${m}`]),
  // invert - mode (runtime uniform), 2 choices
  ...['full', 'solarize'].map(m => [`invert_${m}`, 'invert', `mode: ${m}`]),
  // hatch - mode (define MODE), all 6 vendored choices (brief named only 4 of these)
  ...['pen', 'charcoal', 'chalkCharcoal', 'conte', 'crosshatch', 'coloredPencil'].map(m => [`hatch_${m}`, 'hatch', `mode: ${m}`]),
  // halftone - mode(color/mono, define MODE) x pattern(dot/line/circle, define PATTERN, only
  // meaningful when mode=mono)
  ['halftone_color', 'halftone', 'mode: color'],
  ...['dot', 'line', 'circle'].map(p => [`halftone_mono_${p}`, 'halftone', `mode: mono, pattern: ${p}`]),
  // relief - mode (define MODE), 3 choices
  ...['basRelief', 'plaster', 'notePaper'].map(m => [`relief_${m}`, 'relief', `mode: ${m}`]),
  // stipple - mode (define MODE), all 5 vendored choices (brief named only 3 of these)
  ...['pointillize', 'mezzoDots', 'mezzoLines', 'mezzoStrokes', 'reticulation'].map(m => [`stipple_${m}`, 'stipple', `mode: ${m}`]),
  // mosaicTiles - mode (define MODE), 2 choices
  ...['mosaic', 'shifted'].map(m => [`mosaicTiles_${m}`, 'mosaicTiles', `mode: ${m}`]),
  // morphology - mode(dilate/erode, runtime uniform) x shape(square/round, define SHAPE) - FULL
  // CROSS (the brief explicitly notated this one with x)
  ...['dilate', 'erode'].flatMap(m => ['square', 'round'].map(s => [`morphology_${m}_${s}`, 'morphology', `mode: ${m}, shape: ${s}`])),
  // edge - kernel(fine/bold/contour, runtime uniform) + contourSide(lower/upper, only under contour)
  ...['fine', 'bold', 'contour'].map(k => [`edge_${k}`, 'edge', `kernel: ${k}`]),
  ['edge_contour_upper', 'edge', 'kernel: contour, contourSide: upper'],
  // extrude - type(blocks/pyramids) + depthSource(luminance/random), both define
  ['extrude_blocks', 'extrude', 'type: blocks'],
  ['extrude_pyramids', 'extrude', 'type: pyramids'],
  ['extrude_depthRandom', 'extrude', 'depthSource: random'],
  // lensFlare - lensType, 4 choices
  ...['zoom50_300', 'prime35', 'prime105', 'moviePrime'].map(l => [`lensFlare_${l}`, 'lensFlare', `lensType: ${l}`]),
  // oilPaint - mode, 6 choices
  ...['facet', 'daubs', 'dryBrush', 'fresco', 'knife', 'sponge'].map(m => [`oilPaint_${m}`, 'oilPaint', `mode: ${m}`]),
  // pondRipples - style(3) + wrap(3), both define; wrap's own default (mirror) already covered
  // by the style sweep so only its other 2 values are added
  ...['aroundCenter', 'outFromCenter', 'pondRipples'].map(s => [`pondRipples_${s}`, 'pondRipples', `style: ${s}`]),
  ...['repeat', 'clamp'].map(w => [`pondRipples_wrap_${w}`, 'pondRipples', `wrap: ${w}`]),
  // scatter - mode, 5 choices
  ...['normal', 'darkenOnly', 'lightenOnly', 'anisotropic', 'clumped'].map(m => [`scatter_${m}`, 'scatter', `mode: ${m}`]),
  // wind - method, 3 choices
  ...['wind', 'blast', 'stagger'].map(m => [`wind_${m}`, 'wind', `method: ${m}`]),
  // dither (bonus - see file header: evidence-based substitute for the "grain{~10 types}" mismatch)
  ...['bayer2x2', 'bayer4x4', 'bayer8x8', 'dot', 'line', 'crosshatch', 'noise', 'errorDiffusion'].map(t => [`dither_${t}`, 'dither', `type: ${t}`]),
  ...['monochrome', 'dotMatrixGreen', 'amberMonitor', 'pico8', 'commodore64', 'cgaPalette1', 'zxSpectrum', 'appleII', 'ega'].map(p => [`dither_palette_${p}`, 'dither', `palette: ${p}`])
]

function main () {
  const names = new Set()
  let written = 0; let skipped = 0
  for (const [name, func, args] of CASES) {
    if (names.has(name)) throw new Error('duplicate fixture name: ' + name)
    names.add(name)
    const path = join(PROGRAMS_DIR, `${name}.dsl`)
    const dsl = tmpl(func, args)
    if (dry) { process.stdout.write(`\n# ${name}  (${func})\n${dsl}`); continue }
    if (existsSync(path)) { skipped++; continue }
    writeFileSync(path, dsl)
    written++
  }
  process.stderr.write(`[gen-mode-programs] ${dry ? 'previewed' : 'wrote ' + written + ', skipped ' + skipped + ' existing'} of ${CASES.length} cases\n`)
}

main()
