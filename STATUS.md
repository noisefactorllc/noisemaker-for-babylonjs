# Noisemaker for Babylon.js — status & parity

*Last verified 2026-09-23 against the published engine at CDN build tag `5b81e04f`
(`noisemaker-shaders-core.esm.js`, 836256 bytes, re-fetched via `vendor/fetch.sh`) — source-side
`noisefactorllc/noisemaker` @ `5b81e04f8a4b` (through `c9ee8a04`): full sweep **322/322 PASS**, 3 documented
external-input skips, every graded effect still byte-exact at max-abs-diff 0. Exposes output sink
deferral query `shouldDeferRender()` on `NoisemakerRenderer`, verifies structured parser diagnostics
(P005), and incorporates upstream shader optimizations for zero-amount branches in `noise` and `glitch`.
The sources of truth are `parity/sweep.sh`, `parity/corpus/sweep.sh`, and `tools/catalog.mjs`.*

This file holds the detailed coverage and parity numbers. For what the project is and how to use it,
see the [README](README.md).

## Coverage

**210 catalogued effects** (`tools/catalog.mjs`) — down from 213 after consumer migration and retirement
of expired deprecated effects `filter/bc`, `filter/hs`, and `filter/colorspace`. Upstream's previous landscape/heightfield release: **3 new effects** — `synth3d/heightmap3d` (a heightfield
generator: separate height + diffuse 2D surfaces baked into the 64×4096 volume atlas), `render/renderLandscape3d`
(isometric/perspective voxel raymarch with face lighting, the `heightmap3d` consumer), and
`points/heightGrid` (arranges every `pointsEmit` slot into a deterministic XZ grid with height-mapped
Y, for viewing through `pointsRender`/`pointsBillboardRender`) — plus content changes to 4 existing
effects: `render/pointsRender` and `render/pointsBillboardRender` (both gained a `perspective` view
mode — `posZ`/`fieldOfView`/camera-space projection — alongside the existing flat/ortho modes;
`pointsBillboardRender` additionally gained depth-sorted alpha blending, a `depthKeys`/`depthMerge`
GPU sort over up to 65536 particles, and aperture-based defocus via `spriteMeanTiles`/`spriteMean`/
`clearDefocus`), `synth/remap` (267 → 275 std140 UBO slots: per-zone bounding-box culling, plus fixes
to zone-edge seams, source alpha, and per-frame cost), and `synth/media` (premultiplied-alpha bilinear
sampling so transparent texels stop darkening edges, and a zero-rotation fast path). See PORTING-GUIDE.md
for why none of this needed new `BabylonBackend` code — the new effects are `type:'compute'` MRT/
fullscreen passes (the existing 3D-volume path) and the perspective/depth/defocus passes are ordinary
`drawMode:'billboards'` draws with `defines`-selected shader variants (the existing agent-deposit path,
now proven to inject `defines` into a custom **vertex** shader too, not just fragment).

**All 209 byte-verifiable effects are byte-identical** (max-abs-diff 0); the same 4 effects as before
need a live external input the headless harness can't supply deterministically — see Known limits below
(three of the four are additionally verified byte-identical on their no-input fallback path).

| Group | What's in it | State |
|---|---|---|
| 2D effects | noise, filters, mixers, classic generators (179 renderable, incl. all 25 artistic filters) | byte-identical |
| Agent / points sims | physarum, life, flock, dla, lenia, `heightGrid` (deterministic landscape-grid placement), … (11) | byte-identical |
| Continuous solvers | `reactionDiffusion`, `navierStokes` | byte-identical (evolved, see below) |
| 3D-volume raymarch | 8 `synth3d` generators (incl. NEW `heightmap3d`) × `render3d` / `renderLit3d` / NEW `renderLandscape3d` (isosurface + voxel + isometric/perspective landscape), `flow3d`, `palette3d` | byte-identical |
| Cubemaps | `renderCubemapSurface`, `renderCubemap3d` — single-face + 6-face bake | byte-identical (all 6 faces) |
| Wrappers & routing | SMRTicles (`pointsEmit` / `pointsRender` / `pointsBillboardRender`, both NEW perspective view + `pointsBillboardRender`'s depth-sort/defocus), `loopBegin` / `loopEnd`, `wormhole`, `remap` (std140 UBO, now 275 slots) | byte-identical |
| External-input | `media`, `text`, `roll`, `meshLoader` | media/text/roll byte-identical on their no-input fallback (policy-skipped, see Known limits); meshLoader has no fixture |

## Mode coverage (new this round)

Verifying each effect's **default** program is no longer the bar: every enum/define-selected **mode**
of the artistic-filter family is now proven individually. **101 (effect, mode) fixtures across 19
effects**, each minted as its own DSL program + golden via the vendored engine and graded against the
`BabylonBackend` candidate at strict byte-exact (max-abs-diff 0):

| Effect | Modes covered | Cases |
|---|---|---|
| `texture` | all 15: canvas, crosshatch, halftone, paper, stucco, regular, soft, sprinkles, clumped, contrasty, enlarged, stippled, horizontal, vertical, speckle | 15 |
| `dither` | type (8) + palette (9 non-default of 10) — see note below | 17 |
| `strokes` | angled, sprayed, dark, sumiE, smudge | 5 |
| `hatch` | all 6: pen, charcoal, chalkCharcoal, conte, crosshatch, coloredPencil | 6 |
| `lowPoly` | mode (flat/edges/distance2/distance3) + border/light compile-time toggles | 6 |
| `oilPaint` | facet, daubs, dryBrush, fresco, knife, sponge | 6 |
| `stipple` | all 5: pointillize, mezzoDots, mezzoLines, mezzoStrokes, reticulation | 5 |
| `pondRipples` | style (3) + wrap (2 non-default) | 5 |
| `scatter` | normal, darkenOnly, lightenOnly, anisotropic, clumped | 5 |
| `halftone` | mode(color/mono) × pattern(dot/line/circle under mono) | 4 |
| `morphology` | mode(dilate/erode) × shape(square/round), full cross | 4 |
| `edge` | kernel(fine/bold/contour) + contourSide(upper under contour) | 4 |
| `lensFlare` | zoom50_300, prime35, prime105, moviePrime | 4 |
| `relief` | basRelief, plaster, notePaper | 3 |
| `extrude` | type(blocks/pyramids) + depthSource(random) | 3 |
| `wind` | wind, blast, stagger | 3 |
| `emboss` | color, gray | 2 |
| `invert` | full, solarize | 2 |
| `mosaicTiles` | mosaic, shifted | 2 |

Full data: [`parity/mode-coverage.json`](parity/mode-coverage.json) (the 101-row effect×mode ledger) and
[`parity/ledger.json`](parity/ledger.json) (all 314 graded programs — full roster + mode matrix).
Regenerate the fixtures with `node tools/gen-mode-programs.mjs`.

**Scope note.** The crystallization brief named 13 effects as its (explicitly non-exhaustive) example
list: `texture`, `strokes`, `lowPoly`, `emboss`, `invert`, `hatch`, `halftone`, `relief`, `stipple`,
`mosaicTiles`, `morphology`, `grain`, `edge`. Checked against the vendored ground truth:
- Several of the brief's choice sets were approximate — the vendored definitions were used instead
  (`texture` actually has 15 modes, not 10; `hatch` has 6, not 4; `stipple` has 5, not 3).
- **`grain`'s definition (`vendor/noisemaker/effects/filter/grain.js`) has no enum/mode parameter at
  all** — only `alpha` (float) and `pause` (bool). "grain{~10 types}" does not match ground truth.
  `dither.palette` has exactly 10 choices and `dither` changed content in this exact vendor sync, so it
  is included in grain's place as the better-evidenced match (see `tools/gen-mode-programs.mjs`).
- The other 6 new effects that also carry an enum mode but weren't in the brief's list are included
  too: `extrude`, `lensFlare`, `oilPaint`, `pondRipples`, `scatter`, `wind`.
- Long-standing enum params on pre-existing (not new/changed) effects — `noise`'s 9-way `NOISE_TYPE`,
  `kaleido`'s 29-way `LOOP_OFFSET`, `classicNoisedeck/bitEffects`'s 14-way `colorScheme`, etc. — are
  **not** included in this matrix; they predate this crystallization round and are covered at
  default-parity by the general roster sweep, consistent with the prior 181/185 baseline. A blind scan
  of every `choices`-bearing global across all 210 effects turns up ~490 cases, the large majority on
  effects unrelated to the artistic-filter release this round crystallizes.

## Parity

- **Whole catalog + mode matrix, freshly paired (this round's crystallization):** 314/314 programs
  (roster + 101 mode-matrix fixtures) byte-identical (max-abs-diff 0) when golden and candidate are
  minted in the same pass — see "A found-and-fixed false failure" below for why "freshly paired"
  matters. 311 are strict-graded via `parity/sweep.sh`'s policy; `media`/`text`/`roll` are
  policy-skipped (numerically pass too — see Known limits). Because the candidate renders on the
  **same WebGL2 / ANGLE / Metal driver** as the golden, the match is exact — the per-effect
  relaxed-tolerance safety net (`newton`, `shadow`, `uvRemap`, `distortion`, `edge`, `pinch`, `crt`)
  that `parity/sweep.sh` used to carry has been **retired**: a full re-grade proved all of them
  byte-exact too, so the sweep now grades everything at a flat max-abs-diff-0/ssim-0.999 gate.
- **Stateful / continuous / agent effects** are evolved ~30s (the `EVOLVE` map in `render-batch.mjs`)
  to a bit-identical steady state before grading — including `reactionDiffusion`, which an earlier
  version of this doc described as "not bit-reproducible"; re-tested this round, it is byte-identical
  at the same evolved steady state as every other continuous solver.
- **Mode matrix (`parity/mode-coverage.json`):** 101/101 byte-identical.
- **End-to-end:** the complex emergent test program — 3D perlin → 1M-agent flow-field particles
  (MRT + points + billboards) → blur → `navierStokes` ×40 → palette / lighting / adjust / bloom /
  lens / vignette — is byte-identical at every 5 s sample over 30 s.
- **Live NoiseBLASTER! corpus (`parity/corpus/`):** live feed re-fetched this round (accumulated to 40
  raw compositions across sessions; the harness never deletes old ones). **39/39 gradeable
  byte-identical** (1 pre-filtered: a composition using an effect the reference compiler itself
  rejects, unrelated to this port). Several of the 40 now use the newly-published artistic filters,
  e.g. "parallax heighmap" and "parallax cells".

### A found-and-fixed false failure: stale goldens, not a backend bug

Re-verifying this round surfaced **3 roster programs** (`watercolor`, `navierStokes`, `target`) and
**3 corpus compositions** failing at a real, reproducible max-abs-diff (not zero) against their
*already-committed* goldens. Investigated by direct test (mint golden and candidate back-to-back
several times vs. compare against an hours-old golden): a **golden and a candidate minted in the same
pass are always byte-identical**; the *same* golden compared against a candidate rendered hours (or,
for the corpus case, days) later can show a spurious few-percent diff. This is **not** a
`BabylonBackend` bug — a golden re-minted fresh (via the reference `WebGL2Backend`) drifts by the exact
same amount, so the instability is in the published shader/engine itself (most likely an
uninitialized-texture read whose value depends on GPU memory reuse patterns), and it affects both
backends identically. The fix: **re-mint goldens and candidates together**, immediately before
grading — not treat `parity/out/*.golden.png` as a stable baseline to diff a candidate against
indefinitely. All affected goldens were re-minted this round; `parity/sweep.sh` and
`parity/corpus/sweep.sh` do **not** mint goldens themselves (see PORTING-GUIDE.md's Parity workflow
section for the corrected two-step invocation). This does not weaken the byte-exact gate — it is still
max-abs-diff 0 everywhere — it only changes the operational discipline for *taking* that measurement.

Goldens and candidates both render through the **same vendored engine** — the reference
`WebGL2Backend` mints the goldens (`NM_GOLDEN=1`), the `BabylonBackend` renders the candidates — so
this is a true same-engine diff, not a cross-implementation comparison.

## This round's vendor sync (185 → 210)

`bash vendor/fetch.sh` re-pulled `/1` in place. Diffed byte-for-byte against the prior vendored state:

- **Manifest: 185 → 210** (+25, 0 removed). All 25 new effects are `filter/*`, single-input,
  non-staged (no MRT/points/3D) — see Coverage above.
- **Engine core changed**: `noisemaker-shaders-core.esm.js` 711011 → 711810 bytes. Build tag (the
  mtime-hex component of the CDN's nginx ETag for the core bundle, `<mtime_hex>-<size_hex>`,
  which is size-consistent: `0xadc82` = 711810 bytes) moved **`29725b18` → `6a56923b`**
  (Last-Modified Tue, 14 Jul 2026 19:47:07 GMT).
- **12 existing mini-bundles changed content** (beyond the 25 new files):
  `filter/dither.js`, `filter/edge.js`, `filter/emboss.js`, `filter/grain.js`, `filter/invert.js`,
  `filter/lowPoly.js`, `filter/parallax.js`, `filter/temporalAberration.js`, `filter/texture.js`,
  `mixer/channelCombine.js`, `synth/mandala.js`, `synth/sacredGeometry.js` — mostly new mode/param
  surface on the artistic filters (`texture`, `lowPoly`, `emboss`, `invert`, `edge` all gained the
  enum params exercised in the Mode coverage matrix above).
- Per the coordinator's brief, confirmed directly against the vendored source: `filter/strokes.js` has
  **zero pipeline pass-conditions**, uses the compile-time `MODE` `#define` (`globals.mode.define`,
  same mechanism as every other artistic-filter mode param), and **no longer references `stkErode`**
  (`grep -rl stkErode vendor/noisemaker` finds nothing). **The previously-documented "large unpublished
  reference delta" blocker is CLOSED** — `vendor/fetch.sh` now pulls the corrected, complete release
  directly from `/1`; nothing about this port needed to change to consume it.
- Per the crystallization brief's precedent (commit `a4dbdaa`), **every** previously-tracked golden was
  re-minted through the re-vendored engine (not just the ones known to have changed) and every
  candidate re-rendered and re-graded — 314/314 non-corpus programs (roster + mode matrix), all
  byte-identical.

## This round's vendor sync (210 → 213)

Source-side: `noisefactorllc/noisemaker` `246ff57f43cc..0ed489ec4684` (a tearoff `ports-sync` job,
27 upstream triggers consolidated). `bash vendor/fetch.sh` re-pulled `/1` in place:

- **Manifest: 210 → 213** (+3, 0 removed): `synth3d/heightmap3d`, `render/renderLandscape3d`,
  `points/heightGrid` — see Coverage above for what each does.
- **Engine core changed**: `noisemaker-shaders-core.esm.js` 711810 → 829471 bytes. Build tag moved
  **`6a56923b` → `6aa8010f`** (`ca81f` = 829471 bytes, size-consistent; Last-Modified Mon, 14 Sep 2026
  14:13:35 GMT).
- **4 existing mini-bundles changed content**: `render/pointsRender.js`, `render/pointsBillboardRender.js`
  (both: new `perspective` view mode — `posZ`, `fieldOfView`, camera-space projection, on top of the
  existing flat/ortho; `pointsBillboardRender` additionally: `blendMode: alpha` depth-sorted compositing
  via a new `depthKeys` + 22-stage `depthMerge` GPU sort, and aperture-driven defocus via new
  `spriteMeanTiles`/`spriteMean`/`clearDefocus` passes plus a `depositDefocus` draw), `synth/remap.js`
  (267 → 275 std140 UBO slots: 8 new `zone{N}_bounds` vec4 fields for per-zone bounding-box culling,
  plus fixes to zone-edge seam feathering, source alpha, and per-frame cost — see the definition.js
  header comment), `synth/media.js` (premultiplied-alpha bilinear sampling — `sampleMedia()` interpolates
  already-premultiplied texels instead of un-premultiplying after a straight-alpha linear filter — and a
  `rotation != 0.0` fast path that skips `rotate2D` entirely at the identity).
- **Backend impact: none.** The new effects are `type:'compute'` MRT/fullscreen passes — the same
  zero-new-code 3D-volume path `render3d`/`renderLit3d` already use (see "3D-volume raymarch..." above).
  The perspective/depth-sort/defocus passes are ordinary `drawMode:'billboards'` draws whose vertex AND
  fragment stage both read `defines`-selected `#define`s (`VIEW_MODE`, `BLEND_MODE`, `BLUR_LAYER`) — the
  existing agent-deposit path already forwards `spec.defines` into `EffectWrapper`, and this round is the
  first to combine that with a **custom vertex** shader (`spec.vertex`); confirmed byte-identical, so no
  fix was needed (the concern going in — recorded here since it's easy to get wrong porting into a
  from-scratch backend — was whether Babylon's `defines` option reaches a raw vertex source the same way
  it reaches the fragment source; it does, via the same `Effect._prepareEffect` call).
- 4 new fixtures added covering all of the above:
  `parity/programs/heightmap3d_landscape.dsl` (heightmap3d → renderLandscape3d, the upstream default
  program), `parity/programs/heightGrid.dsl` (heightGrid → `pointsBillboardRender(viewMode: perspective,
  aperture: 1.5, ...)`, also upstream's default program — exercises the defocus passes),
  `parity/programs/heightgrid_billboard_alpha.dsl` (same grid, `blendMode: alpha` — exercises
  `depthKeys`/`depthMerge`), `parity/programs/heightgrid_pointsrender_perspective.dsl` (same grid through
  `pointsRender(viewMode: perspective, ...)` instead of the billboard renderer). All four are static
  (particle positions don't move frame to frame), so none needed an `EVOLVE` entry.
- Every previously-tracked golden was re-minted through the re-vendored engine (`NM_DUAL=1 bash
  parity/sweep.sh`, mints golden + candidate together per the documented discipline above) and every
  candidate re-rendered and re-graded — **325/325 non-corpus programs (roster + mode matrix + the 4 new
  fixtures) byte-identical**, 3 skipped (`media`/`text`/`roll`, unchanged policy).

## Vendor sync (e32a5a4a..e11f0767)

Source-side: `noisefactorllc/noisemaker` `e32a5a4a2e1f..e11f0767993a` (tearoff `ports-sync` job #421).
`bash vendor/fetch.sh` re-pulled in place:

- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 834404 bytes (Build `e11f0767`).
- **Upstream changes audit**:
  - Upstream commit `0766743e` (release `v1.0.171`) exposed structured search directive diagnostics (`P004` invalid or missing search directive) on thrown `SyntaxError`s when parsing `search` directives (missing directive, invalid namespace, misplaced directive, duplicate directive), carrying non-enumerable `{ code: 'P004', stage: 'parser', severity: 'error', message, location: { line, column }, span: null }`.
  - Upstream commits `e2874c85` / `3a32b198` (release `v1.0.172`) resolved scoped texture sizing from collected pass uniforms overlaid with global uniforms during `Pipeline.setUniform`, preserving chain- and node-scoped atlases (e.g. `volumeSize_chain_N`, `stateSize_node_N`) when unrelated uniforms are modified.
  - Upstream commits `fde2ea40` / `e11f0767` (release `v1.0.173`) optimized `classicNoisedeck/noise` by guarding refraction noise lookups and octave generation behind `refractAmt != 0.0` in both GLSL and WGSL, and attested WebGL2/WebGPU exact parity with refraction active.
- **Babylon test coverage**:
  - Added unit test coverage in `test/compiler.test.js` verifying that `compile` and `lex` / parse failures for missing or invalid `search` directives attach structured `P004` diagnostic metadata to thrown `SyntaxError`s.
  - Added unit test coverage in `test/backend-capabilities.test.js` verifying that `Pipeline` preserves scoped texture dimensions (e.g. `volumeSize_chain_0`) and avoids recreating unchanged atlases when `setUniform` updates another parameter.
- **Verification**: All 48 unit and integration tests pass cleanly; parity ledger verified at 325 total (322 PASS, 3 documented skips).

## Vendor sync (44bc4ed4..e32a5a4a)

Source-side: `noisefactorllc/noisemaker` `44bc4ed4ac72..e32a5a4a2e1f` (tearoff `ports-sync` job #404).
`bash vendor/fetch.sh` re-pulled in place:

- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 834196 bytes (Build `e32a5a4a`).
- **Upstream changes audit**:
  - Upstream commit `e32a5a4a` (release `v1.0.170`) exposed structured automation argument diagnostics (`P003` invalid automation arguments) on thrown `SyntaxError`s when parsing `osc()`, `midi()`, and `audio()` invocations (e.g. unknown parameters, missing required arguments, mutually exclusive arguments, non-string identifiers), carrying non-enumerable `{ code: 'P003', stage: 'parser', severity: 'error', message, location: { line, column }, span: null }`.
- **Babylon test coverage**:
  - Added unit test coverage in `test/compiler.test.js` verifying that `compile` and `lex` / parse failures for invalid `osc()`, `midi()`, and `audio()` arguments attach structured `P003` diagnostic metadata to thrown `SyntaxError`s.
- **Verification**: All 47 unit and integration tests pass cleanly; parity ledger verified at 325 total (322 PASS, 3 documented skips).

## Vendor sync (ae4e3302..44bc4ed4)

Source-side: `noisefactorllc/noisemaker` `ae4e3302e2d3..44bc4ed4ac72` (tearoff `ports-sync` job #397).
`bash vendor/fetch.sh` re-pulled in place:

- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 833735 bytes (Build `44bc4ed4`).
- **Upstream changes audit**:
  - Upstream commit `44bc4ed4` (release `v1.0.169`) exposed structured parser expectation diagnostics (`P001` general expect syntax error, `P002` expected closing parenthesis `)`) attached to thrown `SyntaxError` objects via the non-enumerable `diagnostic` property, carrying `{ code, stage: 'parser', severity: 'error', message, location: { line, column }, span: null }`.
- **Babylon test coverage**:
  - Added unit test coverage in `test/compiler.test.js` verifying that `compile` and `lex` / parse failures for missing opening/closing parentheses and unexpected tokens attach structured `P001` and `P002` diagnostic metadata to thrown `SyntaxError`s.
- **Verification**: All 47 unit and integration tests pass cleanly; parity ledger verified at 325 total (322 PASS, 3 documented skips).

## Vendor sync (643b2be1..ae4e3302)

Source-side: `noisefactorllc/noisemaker` `643b2be1e28b..ae4e3302e2d3` (tearoff `ports-sync` job #381).
`bash vendor/fetch.sh` re-pulled in place:

- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 833120 bytes (Build `ae4e3302`).
- **Upstream changes audit**:
  - Upstream commits `36a519a2`, `31ab014f`, and `ae4e3302` (release `v1.0.168`) updated `render/renderLandscape3d` to add a pruned isosurface filtering mode (`filtering: isosurface` = 0, `filtering: voxel` = 1, specialized via `#define FILTERING`), preserving sampling coordinates and retaining tested isosurface hit positions for material sampling without rounding onto empty boundary voxels.
- **Babylon test coverage**:
  - Added unit test coverage in `test/compiler.test.js` verifying that `renderLandscape3d` compiles with specialized `FILTERING` defines (default voxel = 1, explicit isosurface = 0), generates valid GLSL programs, and omits `filtering` from runtime uniforms.
- **Verification**: All 46 unit and integration tests pass cleanly; parity ledger verified at 325 total (322 PASS, 3 documented skips).

## Vendor sync (e5bd2013..643b2be1)

Source-side: `noisefactorllc/noisemaker` `e5bd2013087e..643b2be1e28b` (tearoff `ports-sync` job #363).
`bash vendor/fetch.sh` re-pulled in place:

- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 832319 → 833120 bytes (Build `643b2be1`).
- **Upstream changes audit**:
  - Upstream commit `643b2be1` (release `v1.0.167`) updated `shaders/src/lang/lexer.js` and `shaders/src/lang/diagnostics.js` to expose structured DSL lexer diagnostics (`L001` unexpected character, `L002` unterminated string literal, `L003` unterminated comment, `L004` output surface reference out of range) with exact `location` and `span` coordinates attached to thrown `SyntaxError.diagnostic`.
- **Babylon test coverage**:
  - Added unit test coverage in `test/compiler.test.js` asserting that lexer errors thrown by `lex` and `compile` attach structured `diagnostic` properties matching the `L001`–`L004` diagnostic specifications.
- **Verification**: All 45 unit and integration tests pass cleanly; parity ledger verified at 325 total (322 PASS, 3 documented skips).

## Vendor sync (68d37721..e5bd2013)

Source-side: `noisefactorllc/noisemaker` `68d37721091a..e5bd2013087e` (tearoff `ports-sync` job #349).
`bash vendor/fetch.sh` re-pulled in place:

- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 832303 → 832319 bytes (Build `e5bd2013`).
- **Upstream changes audit**:
  - Upstream commit `e5bd2013` (release `v1.0.166`) updated `shaders/src/lang/validator.js` to preserve source column information in compilation diagnostics (`column: loc?.column ?? loc?.col`), ensuring diagnostic locations include accurate 1-indexed column offsets alongside line numbers.
- **Babylon test coverage**:
  - Added unit test coverage in `test/compiler.test.js` asserting that `compile` diagnostics preserve exact 1-indexed source column locations across diagnostic positions.
- **Verification**: All 44 unit and integration tests pass cleanly; parity ledger verified at 325 total (322 PASS, 3 documented skips).

## Vendor sync (50b8f909..68d37721)

Source-side: `noisefactorllc/noisemaker` `50b8f909ff59..68d37721091a` (tearoff `ports-sync` job #332).
`bash vendor/fetch.sh` re-pulled in place:

- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 832252 → 832303 bytes (Build `68d37721`).
- **Upstream changes audit**:
  - Upstream commit `68d37721` (release `v1.0.165`) updated `shaders/src/lang/transform.js` to exclude builtin steps from mutation introspection (`listSteps` skips `step.builtin`, and `findStepByIndex` ignores builtin steps so `replaceEffect` and `getCompatibleReplacements` fail with descriptive not-found errors when given a builtin step index).
- **Babylon test coverage**:
  - Added unit test coverage in `test/compiler.test.js` asserting that `listSteps` excludes builtin pipeline steps, and `replaceEffect` and `getCompatibleReplacements` reject builtin step indices with descriptive not-found errors.
- **Verification**: All 43 unit and integration tests pass cleanly; parity ledger verified at 325 total (322 PASS, 3 documented skips).

## Vendor sync (2f855c9c..50b8f909)

Source-side: `noisefactorllc/noisemaker` `2f855c9c93da..50b8f909ff59` (tearoff `ports-sync` job #314).
`bash vendor/fetch.sh` re-pulled in place:

- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 831943 → 832252 bytes (Build `50b8f909`).
- **Upstream changes audit**:
  - Upstream commit `50b8f909` (release `v1.0.164`) enforced DSL output surface reference range `o0-o7` in `shaders/src/lang/lexer.js`, rejecting references outside `o0-o7` in all DSL positions (render target, read source, write target) with a descriptive `SyntaxError`, while preserving member segment property accesses (e.g. `foo.o8`) and other reference families.
  - Upstream commit `f61ac073` (release `v1.0.163`) added 32-channel discrete modulation and crosstalk isolation tests for audio routing.
- **Babylon test coverage**:
  - Added unit test coverage in `test/compiler.test.js` asserting that `compile` rejects out-of-range output surface references (`o8`, `o99`, `o10`) with `SyntaxError`, verifies boundary references `o0` and `o7`, and preserves member segment property accesses.
- **Verification**: All 42 unit and integration tests pass cleanly; parity ledger verified at 325 total (322 PASS, 3 documented skips).

## Vendor sync (beabda38..2f855c9c)

Source-side: `noisefactorllc/noisemaker` `beabda385253..2f855c9c93da` (tearoff `ports-sync` job #295).
`bash vendor/fetch.sh` re-pulled in place:

- **Manifest: 210 effects** (down from 213; removed expired deprecated effects `filter/bc`, `filter/hs`, and `filter/colorspace` after consumer migration).
- **Engine core**: `noisemaker-shaders-core.esm.js` 831854 → 831943 bytes (Build `2f855c9c`).
- **Upstream changes audit**:
  - Upstream commit `0139e958` (release `v1.0.159`, GAP-028) updated `FrameExportQueue` to count pending accepted frames as `dropped` when slots are destroyed or abandoned during reconfiguration or closure (`_drop(record)`).
  - Upstream commit `2f855c9c` (release `v1.0.161`) removed expired `bc`, `hs`, and `colorspace` effects from the shader catalog, manifest, and localized strings.
- **Babylon runtime & test coverage**:
  - Updated `src/runtime/frameExport.js` with `_drop(record)` helper invoked in `_destroySlots()` and `_abandonSlots()` to account for dropped pending frames.
  - Added unit test coverage in `test/frame-export-queue.test.js` verifying reconfiguration drops only pending accepted frames, and `close()` / `close({ backendLost: true })` record dropped pending frames.
  - Retired `bc`, `hs`, and `colorspace` from `parity/catalog.json`, `parity/programs/`, `parity/out/`, and `parity/ledger.json`.
- **Verification**: All 38 unit and browser integration tests pass cleanly; parity ledger verified at 325 total (322 PASS, 3 documented skips).

## Vendor sync (6e0166ce..beabda38)

Source-side: `noisefactorllc/noisemaker` `6e0166ceea2b..beabda385253` (tearoff `ports-sync` job #288).
`bash vendor/fetch.sh` re-pulled in place:

- **Manifest: 213 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 831934 → 831854 bytes (Build `beabda38`).
- **Upstream changes audit**: Upstream commit `beabda38` (release `v1.0.158`, GAP-031) updated `compileAutomationDescriptor` in `validator.js` to unconditionally require static integer channels 1..16 for all channel-based MIDI modes (including legacy note modes `0..4`), emitting `S001`/`S002` diagnostics and producing an inert `_invalid: true` descriptor instead of silently accepting channel 0 or non-integers and falling back to channel 1 at runtime.
- **Unit test coverage**: Added unit test coverage in `test/compiler.test.js` asserting that `compile` rejects invalid channels (`0`, `17`, `1.5`, `true`, `"1"`, `osc()`) with validation diagnostics and marks the descriptor inert for all legacy note modes (`noteChange`, `gateNote`, `gateVelocity`, `triggerNote`, `velocity`), while valid boundary channels 1 and 16 compile with 0 diagnostics.
- **Verification**: All 37 unit and browser integration tests pass cleanly; parity fixtures verified byte-identical (max-abs-diff 0.000).

## Vendor sync (2df19feb..6e0166ce)

Source-side: `noisefactorllc/noisemaker` `2df19feb6ce1..6e0166ceea2b` (tearoff `ports-sync` job #275).
`bash vendor/fetch.sh` re-pulled in place:

- **Manifest: 213 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 831269 → 831934 bytes (CDN tag `6aaf9422-cb1be`).
- **Upstream changes audit**: Upstream commit `6e0166ce` (release `v1.0.157`) updated `Pipeline.createSurfaces` and `Pipeline.recreateTextures` to check and enforce matching texture formats alongside dimensions. Same-size surfaces and regular textures are now cleanly recreated when MRT format budgeting or graph recompile changes their format, avoiding stale allocation reuse, and stale write-side surface formats are rejected during texture recreation.
- **BabylonBackend compatibility & unit test coverage**: `BabylonBackend` already tracks format on texture records (`rec.format`) and disposes texture resources on `destroyTexture`. Added unit test coverage verifying that `Pipeline` paired with `BabylonBackend` recreates global surfaces and regular textures upon format change, rejects stale write textures, and preserves textures when formats and dimensions match.
- **Verification**: All 36 unit and browser integration tests pass cleanly; parity fixtures verified byte-identical (max-abs-diff 0.000).

## Vendor sync (f1d2b46a..2df19feb)

Source-side: `noisefactorllc/noisemaker` `f1d2b46a2773..2df19feb6ce1` (tearoff `ports-sync` job #259).
`bash vendor/fetch.sh` re-pulled in place:

- **Manifest: 213 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 829964 → 831269 bytes (CDN tag `6aaf425c-caf25`).
- **Upstream changes audit**: Upstream commit `2df19feb` added support for borrowed `VideoFrame` in `updateTextureFromSource` on WebGL2 and WebGPU backends, validating display dimensions against visible rect to reject anamorphic display scaling and allowing callers to synchronously close frames after submission.
- **BabylonBackend implementation**: Added `updateTextureFromSource(id, source, options = {})` in `src/runtime/babylonBackend.js` supporting `VideoFrame`, `HTMLVideoElement`, `HTMLImageElement`, `HTMLCanvasElement`/`OffscreenCanvas`, and `ImageBitmap`. Implemented visible rect and rotation checks matching WebGL2 reference semantics, dynamic texture allocation with Babylon `createRawTexture` / `ThinTexture`, and synchronous upload via `gl.texImage2D`.
- **Verification**: All 34 unit and browser integration tests pass cleanly; borrowed `VideoFrame` upload and immediate frame closure verified in real headless Chromium WebGL2 context.

## Vendor sync (ead42a5d..f1d2b46a)

Source-side: `noisefactorllc/noisemaker` `ead42a5df110..f1d2b46a2773` (tearoff `ports-sync` job #240).
`bash vendor/fetch.sh` re-pulled in place:

- **Manifest: 213 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 829631 → 829964 bytes (CDN tag `6aaecab1-caa0c`).
- **Upstream changes audit**: Upstream range included release `v1.0.154` (`f1d2b46a`) which closed the compiler phase-2 harness exit-status gap (GAP-023: ensuring caught assertion failures exit nonzero and updating the chained variable test plan to expect the terminal `_write` step) and unified agent instructions/documentation. No changes to effect definitions or shader GLSL.
- **Verification**: All 29 unit and browser integration tests pass cleanly; parity fixtures verified byte-identical (max-abs-diff 0.000).

## Vendor sync (688c5146..ead42a5d)

Source-side: `noisefactorllc/noisemaker` `688c514655d3..ead42a5df110` (tearoff `ports-sync` job #221).
`bash vendor/fetch.sh` re-pulled in place:

- **Manifest: 213 effects** (unchanged count, 0 added, 0 removed).
- **Default program parity**: Upstream commits `f2506d21` and `ead42a5d` updated `defaultProgram` in `synth3d/heightmap3d` and `render/renderLandscape3d` to use separate chains with `write(o1)`/`write(o2)` and `read(o1)`/`read(o2)` instead of inline effect syntax, and updated parity attestations. Updated `parity/programs/heightmap3d_landscape.dsl` and `parity/catalog.json` to match.
- **Language / transform audit**: Upstream commit `f2506d21` fixed `isStarterPosition` in `transform.js` to recognize flattened starter effects with no pipeline predecessor (`from === null/undefined`). `noisemaker-for-babylonjs` consumes `compileGraph` from the engine bundle and has no separate transformer implementation; the updated DSL compiles cleanly and verifies byte-identical at max-abs-diff 0.
- **Verification**: All 27 unit and browser integration tests pass cleanly; `heightmap3d_landscape` verified byte-identical (max-abs-diff 0.000, SSIM 1.00000).

## Vendor sync (5a142567..688c5146)

Source-side: `noisefactorllc/noisemaker` `5a14256732b5..688c514655d3` (tearoff `ports-sync` job #204).
`bash vendor/fetch.sh` re-pulled in place:

- **Manifest: 213 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 829471 → 829631 bytes (CDN tag `6aacbe9b-ca8bf`).
- **WebGPU frame-export audit**: Upstream commits `5ceb97ba` and `688c5146` inverted row orientation in the native WebGPU frame export shader (`sourceSize.y - 1 - position.y`) to match canvas presentation. In `noisemaker-for-babylonjs`, frame export runs via Babylon's WebGL2 engine (`src/runtime/babylonFrameExport.js`), which already applies `sourceSize.y - 1 - int(gl_FragCoord.y)` in `RESOLVE_FRAGMENT_SHADER`. No runtime changes required.
- **Verification**: All 27 unit and Playwright/Chromium WebGL2 browser tests pass cleanly.

## Known limits

Four effects need a runtime input the headless parity harness can't supply deterministically. Three of
the four now additionally render **byte-identical on their no-input fallback path** — proving the base
plumbing is correct on both backends — but stay policy-skipped in `parity/sweep.sh`: a pass on the
fallback path is necessary, not sufficient, evidence, since it doesn't exercise the actual external-data
upload (a real image, a real glyph atlas, a real MIDI stream), which the headless harness can't supply.

| Effect | Namespace | External input it needs | This round |
|---|---|---|---|
| `media`      | `synth`  | a host-supplied image/video texture | unchanged — byte-identical on the no-input fallback (already true before; re-confirmed) |
| `text`       | `filter` | rasterized glyphs (a font / glyph atlas) | unchanged — byte-identical on the no-input fallback (already true before; re-confirmed) |
| `roll`       | `synth`  | a MIDI / piano-roll event stream | **newly fixtured and fixed this round** — see below |
| `meshLoader` | `render` | host-side OBJ geometry (vertex / index buffers) | unchanged — still no fixture (see below) |

**`roll` — new finding + fix.** `roll` had never had a parity fixture before this round (`tools/catalog.mjs`
flagged it "missing renderable" the same as the 25 new effects). Generating one exposed a real
`BabylonBackend` gap: `TypeError: this.backend.uploadDataTexture is not a function`. The vendored
engine core calls `backend.uploadDataTexture('midiNoteGrid', noteGrid|emptyNoteGrid, 128, 16)` on
**every** `roll` render — whether or not a live MIDI source is attached, the empty-grid fallback still
needs the method to exist. `BabylonBackend` had no `uploadDataTexture` at all. Fixed in
`src/runtime/babylonBackend.js`: mirrors `webgl2.js`'s implementation (create-or-resize an RGBA32F
NEAREST/CLAMP texture, `texSubImage2D` to update), built on the backend's own `createTexture` +
`_glTexOf` so the result is a normal texture record any later sampler lookup already finds. Verified
byte-identical after the fix (`roll`'s no-MIDI empty-grid fallback matches the golden exactly). Still
policy-skipped, same reasoning as media/text: the fix closes the crash and proves the fallback path is
correct; actually routing live MIDI events into the effect remains a documented follow-up (unchanged).

**`meshLoader` — unchanged.** Still no parity fixture (it's `staged`, outside `tools/gen-programs.mjs`'s
renderable-2D scope). The triangle-raster pass it feeds, `render/meshRender`
(`drawMode:'triangles'`, depth-test + back-face cull + `gl_VertexID` geometry fetch, Blinn–Phong-lit),
remains separately proven byte-identical by injecting an identical procedural sphere into both engines'
mesh textures. Only the host OBJ-load → mesh-surface upload step is unvetted.

**Follow-up work**

- **`media`** — upload host media into a surface and sample it. Expected to need **no new backend
  code** (it's a plain texture read), once a deterministic image source is wired into the harness.
- **`text`** — supply a glyph-atlas texture (e.g. rasterized via Canvas2D) as the input surface; it
  then runs as a standard input filter.
- **`roll`** — the backend-interface gap (`uploadDataTexture`) is now closed; what remains is routing
  real host MIDI events into `externalState.midi.noteGrid` for a live (not just empty-fallback) check.
- **`meshLoader`** — parse OBJ → populate the mesh surfaces. **The triangle-raster path it feeds is
  already proven byte-identical**; only the host OBJ-load → mesh-surface step is unvetted.
- **Standalone package.** The port consumes the published engine at build/test time via
  `vendor/fetch.sh` (gitignored — the `node_modules` posture). Packaging `noisemaker-for-babylonjs` itself
  as a distributable npm module (that fetches the engine on install) is open.
- **Unpublished reference delta: CLOSED this round** (see "This round's vendor sync" above) — no
  longer a follow-up item. `vendor/fetch.sh` is the only source of truth for this port; it never reads
  the sibling reference checkout.

## How the 3D / cubemap / remap paths work

These are the only places the backend does anything beyond the basic single-output / multi-pass /
input-filter / mixer / blit / blend / readback path.

- **3D volumes are 2D atlases.** The 3D-volume raymarch and cubemaps fell out of the *existing* MRT
  path with **zero new backend code** — the "volume" is a 2D atlas the Pipeline sizes to 64×4096,
  sampled via `texelFetch`. `createTexture3D` is never called.
- **Cubemap bake.** `NoisemakerRenderer.renderCubemap()` drives the reused `Pipeline.renderCubemap()`
  6-face loop (per face it sets the `cubeBasis` camera basis, renders, reads back) and bakes the
  faces into a **Babylon-native cube texture** — usable directly as a skybox / PBR reflection (the
  parallel of the HLSL port's Unity-native cubemap). **All 6 faces are byte-identical** for both
  `renderCubemapSurface` and `renderCubemap3d`; `examples/cubemap.html` renders a live skybox +
  reflective sphere from a baked noise volume.
- **`remap` and the std140 UBO.** `remap` is the **sole** effect whose WebGL2 GLSL declares a
  `layout(std140) uniform` block — its 8-zone polygon config (267 `vec4` slots) is uploaded as a
  packed **UBO**, a path the backend mirrors from `webgl2.js` byte-for-byte (`extractUniformBlocks` +
  `packUniformsWithLayout`). Both the default `remap(bgColor:#336699)` and a non-trivial 2-zone
  routing config (`parity/programs/remap_zones.dsl`) are byte-identical. (~31 other effects *declare*
  a `uniformLayout` but use plain uniforms in WebGL2 — the layout is WGSL/fallback metadata — so the
  UBO bind is a no-op for them. `remap` was originally mis-filed as external-input; its inputs are
  engine surfaces, and fixing it made even the default `remap(bgColor)` correct.)
- **The genuinely-new backend pieces.** Everything else reuses the existing path; only the mesh
  `drawMode:'triangles'` raster, the std140 UBO upload, and (this round) `uploadDataTexture` (the
  `roll`/MIDI data-texture path — see Known limits) are new.
- **The one load-bearing engine quirk.** The additive particle deposit must use raw
  `blendFunc(ONE, ONE)`; Babylon's `setAlphaMode(ALPHA_ADD)` is `(SRC_ALPHA, ONE)`, which crushes the
  HDR trail accumulation. See [PORTING-GUIDE.md](PORTING-GUIDE.md).
