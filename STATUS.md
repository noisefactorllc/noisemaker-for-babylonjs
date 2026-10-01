# Noisemaker for Babylon.js — status & parity

*Last verified 2026-09-30 against the vendored engine **v1.0.206** (build `e24c844f`,
`noisemaker-shaders-core.esm.js`, 903581 bytes): the recorded suite run at this
sync is **111 tests, 111 pass / 0 fail** (`node --test test/*.test.js`;
107 at the v1.0.204 sync — the 94-test v1.0.193 recorded run + the 3 GAP-006
qualification cases of commit `c84adde` + the 10 `test/lifecycle-hooks.test.js` engine v1.0.199
production-lifecycle mirror tests — plus the 4 `test/backend-diagnostics.test.js` GAP-007
final-leg mirror tests of this sync; earlier recorded runs: 107/107 at the
v1.0.193/196 syncs' lineage, 94/94 at the v1.0.193 sync, 90/90 at the v1.0.189 sync, 89/89 at the GAP-004
implementation commit (`9ad880e`), 82/82 in the v1.0.185 sync section), the machine-checked sync audit
(`tools/verify-sync-audit.mjs`)
re-derives the `8eeb7b5a..6a0af04d`, `6a0af04d..403c2a4b`, `403c2a4b..7dc0f564`,
`7dc0f564..12b4d74f`, `93229933..296e0138`, `296e0138..73c15be0`,
`73c15be0..a5059106`, `a5059106..68273906`, `68273906..4f5e0d28`, `4f5e0d28..e24c844f`, and
`e24c844f..ed478159` claims and the four external-input real-input fixtures
grade byte-exact on both backends (see those sync sections and
[`parity/external-input-grades.json`](parity/external-input-grades.json)). Those ranges changed no
effect definitions (210 catalogued effects, 0 added / 0 removed), so the same-pass golden/candidate
byte-exact re-grade recorded below against the v1.0.183 build (build tag `8eeb7b5a`, 858616 bytes,
`noisefactorllc/noisemaker` @ `8eeb7b5ac14e`, 2026-09-25: **66/66 PASS** at that revision, sync
audit re-deriving `240740dd..9d3474df`, `9d3474df..2f47612c`, `2f47612c..8eeb7b5a`; 25 roster
programs byte-exact on this container's SwiftShader driver, `ca3d` root-caused and re-graded, 4
heavy evolve programs' grading limits recorded in the `9d3474df..2f47612c` sync section) is
carried by byte-identity, not re-run. The full-roster ledger grade in
[`parity/ledger.json`](parity/ledger.json) (322 PASS / 3 SKIP / 0 FAIL over 325 programs) is the
retained v1.0.181-era artifact. Exposes output sink
deferral query `shouldDeferRender()` on `NoisemakerRenderer`, verifies structured parser diagnostics
(P001 coordinates, P005 output operations, P006 subchains, P007 call forms, P008-P010 subchain arguments), authorable texture policies (GAP-004), and pass-field propagation including dynamic dimension viewport resolution (GAP-005).
The sources of truth are `parity/sweep.sh`, `parity/corpus/sweep.sh`, and `tools/catalog.mjs`.*

This file holds the detailed coverage and parity numbers. For what the project is and how to use it,
see the [README](README.md).

## Verification commands and their gates

Pick the command that matches the claim you are making — the gates differ:

| Command | Gate (tolerance / SSIM min) | Denominator | Use |
|---|---|---|---|
| `bash parity/sweep.sh` | **tolerance 0, SSIM 0.999** (flat byte-exact policy — the per-effect relaxed map was retired, see Parity below) | every current-roster program with a golden: **329 programs at this tree** (332 committed DSL fixtures minus the 3 retired `bc`/`hs`/`colorspace`, per `parity/current-programs.mjs`'s vendored-manifest roster) — the 325 committed-ledger programs (322 PASS / 3 policy skips retained: the `media`/`text`/`roll` no-input fallbacks) **plus the 4 GAP-004 real-input fixtures** (`media_image`, `text_glyphs`, `roll_midi`, `mesh_obj`), which are graded here, not skipped | the acceptance evidence for parity claims. Note the distinction: `parity/ledger.json` still records only its 325 v1.0.181-era rows (it was not rewritten with the 4 newer fixtures); 325 is the ledger artifact, 329 is what a fresh sweep grades |
| `bash parity/corpus/sweep.sh` | **tolerance 2.001, SSIM 0.98** (hardcoded in the script — the same relaxed spot-check gate as `run.sh`, absorbing cross-driver driver noise), 1800-frame (~30 s) evolution per composition | the live corpus (historical denominator 40 raw / 39 gradeable + 1 reference-rejected, retained) | corpus grading. The recorded corpus grades in STATUS report the measured max-abs-diff per composition (the corpus evidence above is recorded **byte-identical outcomes**), but this gate does not itself enforce tolerance 0 — treat byte-exact corpus claims as recorded measured outcomes, not as an enforcement guarantee of this script |
| `bash parity/run.sh <name>` | **defaults tolerance 2.001, SSIM 0.98** — a relaxed spot-check gate sized to cross-driver/cross-machine driver noise | one program | smoke check only. A PASS at these defaults is **not** byte-exact evidence (it can pass with a non-zero max-abs-diff). For the strict gate on one program: `bash parity/run.sh noise 0 0.999` |
| `node --test test/*.test.js` | suite pass | **111 tests** at this tree (107 at the v1.0.204 sync — the 94-test v1.0.193 recorded run + the 3 GAP-006 qualification cases of commit `c84adde` + the 10 `test/lifecycle-hooks.test.js` production-lifecycle mirror tests — plus the 4 GAP-007 final-leg mirror tests of this sync); the recorded GAP-004 run was **89 pass / 0 fail** at commit `9ad880e` (docs/COMPLETION_GAPS.md GAP-004); the current run is **111 pass / 0 fail** (see the `4f5e0d28..e24c844f` sync section) | unit/integration incl. `test/coverage-map.test.js`, which re-derives `parity/coverage-map.json` |
| `node tools/verify-sync-audit.mjs` | exit 0 = every recorded sync-audit claim re-derived | the pinned engine revision (`vendor/fetch.sh` default, currently 1.0.206 / `e24c844f`) | authority / sync-audit re-derivation |

Denominator and coverage authority: [`parity/coverage-map.json`](parity/coverage-map.json)
(210/210 catalogued effects bound to graded evidence at engine 1.0.206 / build `e24c844f`, 0
explicitly excluded; skipped and refused cases retained in the counts) and
[`parity/ledger.json`](parity/ledger.json) (325 programs: 322 PASS, 3 SKIP, 0 FAIL — the
v1.0.181-era full-roster artifact, retained verbatim; the fresh-sweep roster at this tree is
329 — the ledger plus the 4 GAP-004 real-input fixtures — see the sweep row above).

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

> **2026-09-26 correction (GAP-007):** the "209 byte-verifiable / 4 external-input" split above is a
> historical artifact of the **213-effect** roster this round was written against (209 + 4 = 213;
> meshLoader still had no fixture then). The current catalog is **210 effects** (engine v1.0.185,
> build `6a0af04d` — see the `8eeb7b5a..6a0af04d` sync below). The external-input state above is also
> superseded: all four real-input branches (media image upload, text overlay-canvas upload, roll's
> real MIDI note-grid path via the engine's `MidiState`, meshLoader via the engine's OBJ parser/packer
> plus `BabylonBackend.uploadMeshData`) now grade **byte-exact on both backends** with deterministic
> host fixtures ([`parity/external-input-grades.json`](parity/external-input-grades.json)); the three
> no-input fallback programs (`media`/`text`/`roll`) stay policy-skipped in `parity/sweep.sh` with the
> skips retained ([`parity/coverage-map.json`](parity/coverage-map.json): 210/210 effects bound, 0
> explicitly excluded). The paragraph and group table above are retained as the historical record.

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
[`parity/ledger.json`](parity/ledger.json) (at that historical round: 314 graded programs — the
current committed ledger denominator is 325, see "Verification commands" above).
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

- **Whole catalog + mode matrix, freshly paired (this round's crystallization — a historical
  round; the current committed denominator is 325 programs, see "Verification commands" above):**
  314/314 programs
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

## Vendor sync (ed478159..cb22a05e)

Source-side: `noisefactorllc/noisemaker` `e24c844f8dad..cb22a05eff9a` (tearoff `ports-sync`,
flagged for a force-push / non-contiguous delivery with one observed range
`f5ca07cd..cb22a05e` — audited directly in a local checkout: the previously synced tip
`ed478159` is an exact ancestor of the end `cb22a05e` and the observed start `f5ca07cd` is a
descendant of `ed478159` and an ancestor of the end, so the uncovered delta is exactly the
contiguous `ed478159..cb22a05e` — 9 commits: 8 docs-only (llms-full/ledger/gap-register
checkpointing through `f5ca07cd`) plus the engine commit `cb22a05e`). Release tag
**v1.0.209 points exactly at `cb22a05e`** and the CDN was re-published — the 1.0.209 core's
Build banner records the **`cb22a05e`** build.
**Engine change — re-vendored to v1.0.209 (build `cb22a05e`, 908465-byte core):**

- `git diff --numstat ed478159..cb22a05e -- shaders/`: `shaders/src/renderer/canvas.js`
  +92/−1, `shaders/tests/test_portable_registration.js` +146/−0. The engine delta is
  `CanvasRenderer.registerPortableEffect()` — validated registration of Portable user-effect
  definitions (pre-loaded `shaders[program].glsl/wgsl`, prototype-poisoning guards,
  namespace/starter/globals/paramAliases checks, registry aliasing that preserves a built-in's
  bare lookup) plus its upstream test. **No effect definition or lang module changed — catalog
  parity holds (210 catalogued effects, 0 added / 0 removed)**, and no new shader source is
  introduced, so there is no WGSL/GLSL/HLSL translation surface for this round.
- The published 1.0.209 core is banner-stripped **byte-identical to the previous 1.0.206
  pin plus exactly one contiguous 4884-byte insertion** (the `registerPortableEffect` method;
  measured prefix/suffix/residual decomposition), the 1.0.209 `effects/manifest.json` is
  byte-identical to the vendored manifest, and **every one of the 210 published 1.0.209 effect
  mini-bundles is sha256-identical to the vendored tree** — so the committed parity goldens
  carry by byte-identity and no re-grade is needed.
- **Backend impact: none.** The new API is engine-side registration plumbing; the port's
  `BabylonBackend` renders the same effect programs (the 210 mini-bundles are unchanged), and
  the port consumes `registerPortableEffect` users only through the same `registerEffect`
  registries it already mirrors. No port code change beyond the vendor pin bump.
- **Verification**: `NM_UPSTREAM=<checkout> node tools/verify-sync-audit.mjs` exit 0 —
  **156 re-derived claims, 0 fail**, including this range (ancestry of the covered tip and the
  observed start, v1.0.209 pointing exactly at `cb22a05e`, the exact shaders/ numstat, catalog
  parity, the 4884-byte banner-stripped core delta decomposition, manifest byte-identity, the
  per-bundle sha256 identity of all 210 published 1.0.209 mini-bundles against
  `engine-hashes.json`, and the `registerPortableEffect` symbol's presence with dev-only
  validator symbols' absence). `parity/coverage-map.json` regenerated — only its two recorded
  engine fields moved (1.0.206/`e24c844f`/903581 → 1.0.209/`cb22a05e`/908465; program roster
  unchanged, 325 programs / 322 PASS / 3 policy skips). All **111 unit/integration tests pass,
  0 fail** (`npm test`). Parity spot checks (`parity/run.sh`, tol 2.001): `bloom` and `adjust`
  byte-identical (max-abs-diff 0.000, ssim 1.0); `morphology_dilate_round` and `wind_wind`
  grade within 2 LSB; `edge_contour_upper` and `shadow` show high max-abs-diff against the
  macOS-Metal-minted goldens on this container's SwiftShader driver — **the candidates are
  byte-identical between 1.0.206- and 1.0.209-engine renders** (Worker Elves job 75b72440,
  evidence archive `parity-spot-cb22a05e.txt`: `cmp` of the 1.0.206-engine and 1.0.209-engine
  candidate PNGs identical for both programs), so they are
  pre-existing container driver noise, unchanged by this sync.

## Vendor sync (e24c844f..ed478159)

Source-side: `noisefactorllc/noisemaker` `e24c844f8dad..ed478159e5a3` (tearoff `ports-sync`,
flagged for a force-push / non-contiguous delivery with one observed range
`16c1997c..ed478159` — audited directly in a local checkout: the previously synced tip
`e24c844f` is an exact ancestor of the end `ed478159`, and the observed start `16c1997c` is a
descendant of `e24c844f` and an ancestor of the end, so the uncovered delta is exactly the
contiguous `e24c844f..ed478159` (3 commits: `e105344b` is the direct child of the previous
sync tip, followed by the `16c1997c`/`ed478159` pair whose `e105344b..16c1997c` side leg was
already audited in the `4f5e0d28..e24c844f` section). Release tags **v1.0.207 (`16c1997c`) and
v1.0.208 (`ed478159`)** point exactly at their recorded SHAs and the CDN was re-published —
the v1.0.208 artifact's Build banner records the **`ed478159`** build.
**No code change required; engine pin stays at v1.0.206 / build `e24c844f`:**

- The only `shaders/` change is the GAP-010 uniform-gate harness continuation
  (`git diff --numstat e24c844f..ed478159 -- shaders/`:
  `shaders/tests/test-harness.js` +2/−2, `shaders/tests/test_uniform_status.js` +71/−0,
  `shaders/tests/uniform-status.js` +24/−0); **no `shaders/src` module changed**
  (catalog parity, 210 catalogued effects, 0 added / 0 removed). The other commit
  `e105344b` is docs-only (`docs/shaders/pipeline.rst` +8/−1 and `llms-full.txt` — the
  GAP-007 row's consequence column and the resource-validation note aligned with the
  recorded non-throwing diagnostics).
- The three commits: `e105344b` is a **GAP-007 documentation-alignment commit** (a direct
  child of the previous sync tip `e24c844f` — docs-only, `docs/shaders/pipeline.rst` +8/−1
  and `llms-full.txt`: the GAP-007 row's consequence column and the resource-validation note
  aligned with the recorded non-throwing diagnostics), while the GAP-010 uniform-gate pair
  is dev-only: `16c1997c` pins the harness `--strict-uniforms` gate through a mirrored
  `resolveUniformGateStatus` (`uniform-status.js` +16, its test +57, harness wiring 4 lines);
  `ed478159` classifies unrecognized `testUniformResponsiveness` outer statuses as error
  (test +14, `uniform-status.js` +8). The GAP-010 pair lives in `shaders/tests/`, the docs
  commit in `docs/` + `llms-full.txt` — all outside the published bundle's import graph.
- **The published 1.0.208 core is banner-stripped byte-identical to the pinned 1.0.206
  core** (`cmp` after stripping the `* Build:` / `* Date:` banner lines — only those two
  lines differ: Build `e24c844f`→`ed478159`, Date), the 1.0.208 `effects/manifest.json` is
  byte-identical to the vendored 1.0.206 manifest, **every one of the 210 published 1.0.208
  effect mini-bundles is sha256-identical to the vendored tree** (per-bundle sha256
  comparison against `engine-hashes.json`, re-derived by `tools/verify-sync-audit.mjs`;
  the measured per-bundle record is the job's evidence artifact
  `noisemaker-1.0.208-mini-bundle-sha256.json` (210 bundles, 0 mismatches; the audit
  tool re-derives the comparison itself on every run, so the record is also an
  executable contract), and the new
  dev-only symbols
  (`resolveUniformGateStatus`, the `uniform-status` module name) are absent from the
  published bundle — so no re-vendor, no parity re-grade, and no generated-artifact
  refresh are needed. The port's own suite does not reference the upstream harness
  modules (`grep -rl 'uniform-status\|test-harness\|resolveUniformGateStatus' src test
  tools parity` matches only `tools/verify-sync-audit.mjs`'s recorded deltas).
- **Verification**: `NM_UPSTREAM=<checkout> node tools/verify-sync-audit.mjs` exit 0
  re-derives every recorded claim including this range (ancestry of the covered tip and
  the observed start, v1.0.207/v1.0.208 pointing exactly at `16c1997c`/`ed478159`, the
  exact shaders/ numstat, catalog parity, the banner-stripped 1.0.208-vs-1.0.206 core
  byte-identity, the manifest byte-identity, the per-bundle sha256 identity of all 210
  published mini-bundles against `engine-hashes.json`, and the dev-only symbols' absence
  from the
  bundle). All **111 unit/integration tests pass, 0 fail** (`npm test` =
  `node --test test/*.test.js`; the range introduces no new behavior to mirror). Committed
  goldens carry by byte-identity: the pinned core is byte-identical to the previously
  verified 1.0.206 artifact.

## Vendor sync (4f5e0d28..e24c844f)

Source-side: `noisefactorllc/noisemaker` `73c15be00d68..e24c844f8dad` (tearoff `ports-sync`,
flagged for a force-push / non-contiguous delivery with observed sub-ranges
`c2a19c70..dd4606ea`, `dd4606ea..a0e9bbffc038`, `a0e9bbffc038..e24c844f` and a side leg
`e105344b..16c1997c` — audited directly in a local checkout: the declared start `73c15be0` and
the previously synced tip `4f5e0d28` are each an exact ancestor of upstream main tip
`e24c844f`, and each observed sub-range start is an ancestor of its end within that delta, so
the uncovered delta is exactly the contiguous `4f5e0d28..e24c844f` (3 commits). Release tags
**v1.0.205 (`a0e9bbff`) and v1.0.206 (`e24c844f`)** point exactly at their recorded SHAs and the
CDN was re-published — the v1.0.206 artifact's Build banner records the **`e24c844f`** build.
The side leg `e105344b..16c1997c` (upstream tagged **v1.0.207** at `16c1997c`) touches ONLY
`shaders/tests/test-harness.js`, `shaders/tests/test_uniform_status.js`,
`shaders/tests/uniform-status.js` and `llms-full.txt` (the GAP-010 `--strict-uniforms` harness
gate, dev-only, outside the bundle's import graph) — `shaders/src` is untouched and the
published 1.0.207 core is banner-stripped byte-identical to the pinned 1.0.206 core, so it
needs no code change (recorded here and re-derived by `tools/verify-sync-audit.mjs`).
**Engine synced from the published 1.0.206 artifact — this round DOES change the engine, and
the vendoring pin moves (authority change, per fetch.sh's own rule):** `noisemaker-shaders-core.esm.js`
899674 → **903581 bytes** (Build `e24c844f`, v1.0.206). Vendored tree produced by the
documented script itself (`bash vendor/fetch.sh` at the bumped default → `vendor/noisemaker/engine-meta.json`:
version 1.0.206, coreBuild `e24c844f`, coreBytes 903581, effectCount 210; the vendored core is
byte-identical to a fresh CDN fetch).

- **Manifest + effect mini-bundles: 210 effects** (unchanged count, 0 added, 0 removed). The
  `shaders/` delta over the previous pin is exactly `shaders/src/runtime/backends/diagnostics.js`
  +32/−2, `shaders/src/runtime/backends/webgl2.js` +68/−5, `shaders/src/runtime/backends/webgpu.js`
  +13/−1, `shaders/src/runtime/pipeline.js` +38/−1 and `shaders/tests/test_backend_diagnostics.js`
  +279/−3 (`git diff --numstat 4f5e0d28..e24c844f -- shaders/`, re-derived by
  `node tools/verify-sync-audit.mjs`); no `shaders/src/effects` file changed (catalog parity).
- **The three commits — the GAP-007 final legs, all engine-runtime (no effect definition):**
  - `dd4606ea` closes GAP-007: the WebGL2 `ERR_UNIFORM_BLOCK_TOO_LARGE` throw now throws a
    `ShaderDiagnostic` (`stage: 'uniform-block'`, byte-identical legacy detail) instead of an
    ad-hoc plain object; the historically-silent WebGL unknown-format fallback (rgba8) and
    unknown-dimension-form fallback (screen size) keep their behavior but surface deduplicated
    structured records (`ERR_UNKNOWN_FORMAT_FALLBACK` in `backend.diagnostics`,
    `ERR_DIMENSION_FALLBACK` in `pipeline.diagnostics`) through the new capped (64) queryable
    `DiagnosticCollector`.
  - `a0e9bbff` recognizes the validator-accepted `input`/`resolution` dimension keywords in
    `Pipeline.resolveDimension` as recognized forms (historical screen-size resolution, no
    diagnostic) — filter/grade legitimately authors them.
  - `e24c844f` records runtime resource and device-validation failures in
    `backend.diagnostics` alongside the unchanged legacy console output: WebGL2
    missing-FBO/MRT render targets record deduplicated `ERR_MISSING_RENDER_TARGET` entries
    (per-occurrence warnings unchanged), post-draw drained `gl.getError()` failures record
    `ERR_GL_ERROR` entries with pass/effect/program/output context, and WebGPU
    `uncapturederror` device validation records `ERR_DEVICE_VALIDATION` entries.
- **Port change: authority bump + the BabylonBackend mirrors of the legs that apply to this
  port's backend** — `vendor/fetch.sh`'s documented default moves 1.0.204 → **1.0.206**:
  - `BabylonBackend` gains the ported `DiagnosticCollector` (capped 64, `add`/`clear`) exposed
    as `backend.diagnostics`; the historically-silent unknown-format rgba8 fallback in texture
    creation (via the new `_resolveFormat`) and the missing-render-target warning paths
    (single-output, points, triangles, per-missing-MRT-output) now surface deduplicated
    structured records (`ERR_UNKNOWN_FORMAT_FALLBACK` with `fallback: 'rgba8'`;
    `ERR_MISSING_RENDER_TARGET` with `kind`/`pass`/`output`, deduplicated per `kind|output|pass`)
    while the legacy silent fallback and per-occurrence console warnings are byte-unchanged
    (mirrors upstream dd4606ea/e24c844f's WebGL2 contract, `backend: 'babylon'`).
    Not mirrored, with reason: the uniform-block device-limit throw (upstream converts an
    EXISTING webgl2 throw; BabylonBackend has no max-block-size throw to convert) and the
    post-draw gl.getError()/WebGPU uncapturederror paths (webgl2/webgpu-bundle-internal, no
    Babylon analog). The Pipeline-side dimension fallback and `input`/`resolution` keywords
    carry with the re-vendored engine (the port's `createPipeline` passes options through).
  - `test/backend-diagnostics.test.js` (+4 tests): unknown-format fallback record shape/dedup
    with known formats and the absent default recording nothing; missing-render-target records
    across the single-output/points/triangles/MRT paths with legacy warnings unchanged and
    records deduplicated; `DiagnosticCollector` cap/clear; the vendored Pipeline's
    unknown-dimension fallback record (with `backend: 'Babylon'`) and the recognized
    `screen`/`auto`/`input`/`resolution`/numeric/param-object forms recording nothing.
- **Parity (strict gate — the round's parity evidence):** dual-minted golden + candidate in one
  browser session through the re-vendored engine (`NM_DUAL=1 LEDGER_PATH=<partial> bash
  parity/sweep.sh navierStokes target reactionDiffusion dither dither_bayer4x4 oilPaint noise
  blur watercolor texture billboard_flow`) — the stateful/evolve, agent-sim and sparse-dither
  cases a reuse spot-check cannot grade — graded at the flat max-abs-diff-0 gate: **11/11
  PASS, 0 skipped**, every graded program max-abs-diff 0.000 / ssim 1.00000 at tolerance 0 /
  ssim 0.999 (the golden/candidate pairs are minted in the same SwiftShader session here, so
  the match is byte-exact). The minted subset goldens were **not** committed — the retained
  `parity/out/*.golden.png` stays the macOS-Metal-minted set. A separate relaxed reuse smoke
  run against those retained goldens (`bash parity/run.sh`, tol 2.001) is smoke-only per
  run.sh's documented contract — a PASS there is explicitly not byte-exact evidence and is
  not counted as parity: noise, blur, watercolor, pondRipples max-abs-diff 0. The full-roster
  byte-exact re-grade is the repository's CI strict-parity job (8 shards, NM_DUAL, tolerance
  0 / SSIM 0.999) at this exact commit.
- **Generated artifact refresh:** `parity/coverage-map.json` regenerated via
  `node tools/coverage-map.mjs` — the only delta is the engine record
  (version/build/coreBytes 1.0.204/`4f5e0d28`/899674 → 1.0.206/`e24c844f`/903581); no count,
  grade, or coverage value changed.
- **Verification**: `NM_UPSTREAM=<checkout> node tools/verify-sync-audit.mjs` exit 0 re-derives
  every recorded claim including this range (ancestry of the declared start and the previous
  synced tip, the observed sub-range starts, v1.0.205 pointing exactly at `a0e9bbff` and
  v1.0.206 at `e24c844f`, the side leg's dev-only delta and the banner-stripped 1.0.207-core
  identity, the exact shaders/ numstat, catalog parity, the pinned 1.0.206 core carrying the
  GAP-007 final-leg symbols while 1.0.204 carries none). All **111 unit/integration tests
  pass, 0 fail** (`npm test` = `node --test test/*.test.js`).

## Vendor sync (68273906..4f5e0d28)

Source-side: `noisefactorllc/noisemaker` `682739066d3b..4f5e0d28bdc1` (tearoff `ports-sync`,
flagged for a force-push / non-contiguous delivery with one observed sub-range
`c4606d11..4d47b3fd` — audited directly in a local checkout: the declared start `73c15be0` and
the previously synced tip `68273906` are each an exact ancestor of upstream main tip
`4f5e0d28` (contiguous), so the uncovered delta is exactly `68273906..4f5e0d28` (6 commits:
4 ledger/i18n/contract commits plus two GAP-032 audio fixes). The delivery's tip moved under
this round: the audit commit recorded `4d47b3fd` as unpublished (`v1.0.202-5-g4d47b3fd`), then
upstream tagged **v1.0.203 (`4d47b3fd`) and v1.0.204 (`4f5e0d28`)** and re-published the CDN —
the v1.0.204 artifact's Build banner records the **`4f5e0d28`** build, so the tip shipped
inside the documented release.
**Engine synced from the published 1.0.204 artifact — this round DOES change the engine, and
the vendoring pin moves (authority change, per fetch.sh's own rule):** `noisemaker-shaders-core.esm.js`
898266 → **899674 bytes** (Build `4f5e0d28`, v1.0.204). Vendored tree produced by the
documented script itself (`bash vendor/fetch.sh` at the bumped default → `vendor/noisemaker/engine-meta.json`:
version 1.0.204, coreBuild `4f5e0d28`, coreBytes 899674, effectCount 210; the vendored core is
byte-identical to a fresh CDN fetch).

- **Manifest + effect mini-bundles: 210 effects** (unchanged count, 0 added, 0 removed). The
  `shaders/` source delta over the previous pin is exactly
  `shaders/src/runtime/external-input.js` +38/−0 and `shaders/tests/test_external_input.js`
  +82/−0 (`git diff --numstat 68273906..4f5e0d28 -- shaders/`; the 4d47b3fd..4f5e0d28
  follow-up is +1/−1 in the same file plus +39 test lines); no `shaders/src/effects` file
  changed (catalog parity). The published core delta is contained in one hunk region, entirely
  inside `AudioInputManager` (verified by prefix/suffix byte comparison of the banner-stripped
  1.0.202 vs 1.0.204 cores): the render path is untouched.
- **The two fixes, both inside `AudioInputManager`:** `_syncCaptures()` gains a post-open
  validation pass (`_channelShortfall()`) warning for every selected requirement —
  default-device, id-selected, and name-selected alike — whose captured device exposes fewer
  channels than the requirement selects (previously the channel lookup returned null and the
  binding silently evaluated to min with no diagnostic); `4f5e0d28` drops the default-device
  branch's `this._deviceId` guard so the deviceless capture (stored under the null key when
  the track reports no deviceId) is checked too. Requirements with no capture keep their
  existing specific warnings.
- **Port change: authority bump only** — `vendor/fetch.sh`'s documented default moves
  1.0.202 → **1.0.204**; no port code change (the port has no audio-input code or tests of
  its own, `grep -rl AudioInputManager test/ src/` is empty; the manager drives the host's
  getUserMedia path, not the render path). The four external-input real-input fixtures are
  unchanged.
- **Parity (strict gate — the round's parity evidence):** dual-minted golden + candidate in one
  browser session through the re-vendored engine (`NM_DUAL=1 LEDGER_PATH=<partial> bash
  parity/sweep.sh navierStokes target reactionDiffusion dither dither_bayer4x4 oilPaint noise
  blur watercolor texture billboard_flow`) — the stateful/evolve, agent-sim and sparse-dither
  cases a reuse spot-check cannot grade — graded at the flat max-abs-diff-0 gate: **11/11
  PASS, 0 skipped**, every graded program max-abs-diff 0.000 / ssim 1.00000 at tolerance 0 /
  ssim 0.999 (the golden/candidate pairs are minted in the same SwiftShader session here, so
  the match is byte-exact). The minted subset goldens were **not** committed — the retained
  `parity/out/*.golden.png` stays the macOS-Metal-minted set. A separate relaxed reuse smoke
  run against those retained goldens (`bash parity/run.sh`, tol 2.001) is smoke-only per
  run.sh's documented contract — a PASS there is explicitly not byte-exact evidence and is
  not counted as parity: noise, blur, watercolor, pondRipples max-abs-diff 0, texture
  max-abs-diff 1. The full-roster byte-exact re-grade is the repository's CI strict-parity
  job (8 shards, NM_DUAL, tolerance 0 / SSIM 0.999) at this exact commit.
- **Generated artifact refresh:** `parity/coverage-map.json` regenerated via
  `node tools/coverage-map.mjs` — the only delta is the engine record
  (version/build/coreBytes 1.0.202/`68273906`/898266 → 1.0.204/`4f5e0d28`/899674); no count,
  grade, or coverage value changed.
- **Verification**: `NM_UPSTREAM=<checkout> node tools/verify-sync-audit.mjs` exit 0 re-derives
  every recorded claim including this range (ancestry of the declared start and the previous
  synced tip, v1.0.203 pointing exactly at `4d47b3fd` and v1.0.204 at `4f5e0d28`, the
  exact shaders/ numstat including the 1/1 follow-up, catalog parity, the pinned 1.0.204 core
  carrying both fixes while 1.0.202 carries neither). All **107 unit/integration tests pass,
  0 fail** (`npm test` = `node --test test/*.test.js`).

## Vendor sync (a5059106..68273906)

Source-side: `noisefactorllc/noisemaker` `a5059106ea75..682739066d3b` (tearoff `ports-sync`,
flagged for a force-push / non-contiguous delivery with one observed sub-range
`a5059106..68273906` — audited directly in a local checkout: the declared start `73c15be0` is
the previously covered tip and an exact ancestor of the end `68273906`, the observed sub-range
start IS the previously audited tip `a5059106`, so the uncovered delta is exactly the contiguous
`a5059106..68273906` (2 commits), landing on upstream main tip `68273906`. Release tags
**v1.0.201** (`a5059106`) and **v1.0.202** (`68273906`) each point exactly at their recorded SHA.)
The only `shaders/` change is the GAP-032 continuation (`git diff --numstat a5059106..68273906
-- shaders/`: `shaders/src/runtime/external-input.js` +226/−82,
`shaders/tests/test_external_input.js` +174/−49).
**Engine synced from upstream commit `68273906` (v1.0.202) — this round DOES change the engine,
and the vendoring pin moves (authority change, per fetch.sh's own rule):** `noisemaker-shaders-core.esm.js`
888834 → **898266 bytes** (Build `68273906`, v1.0.202). Vendored tree produced by the documented
script itself (`bash vendor/fetch.sh` at the bumped default → `vendor/noisemaker/engine-meta.json`:
version 1.0.202, coreBuild `68273906`, coreBytes 898266, effectCount 210).

- **Manifest + effect mini-bundles: 210 effects** (unchanged count, 0 added, 0 removed). All
  210 mini-bundles and `manifest.json` are **byte-identical** to the previous 1.0.199 vendored
  tree (per-file sha256 comparison of each `effects/*/*.js` plus the manifest: 211/211 match)
  — no effect definition changed.
- **Engine core delta = the GAP-032 multi-device capture runtime, entirely inside
  `AudioInputManager`:** the 1.0.199→1.0.202 bundle diff's hunks all lie within the
  `AudioInputManager` class body (constructor capture fields, `_registerCapture` /
  `_openDeviceCapture` / `_stopCapture` / `_capturedDeviceIds` / `_enumerateInputDevices` /
  `_syncCaptures`, the per-tick per-channel analyser pass, and `disable()` teardown). It
  registers the browser-selected capture device (`AudioState.registerDevice`) and its default
  channels (`registerDefaultChannels`), opens one additional `getUserMedia` stream per
  selected-device requirement resolved against `enumerateDevices()` (exact id authoritative;
  name must match exactly one device; re-synced at enable and every 60 update ticks), analyzes
  each captured channel through a `ChannelSplitterNode` with one `AnalyserNode` per channel,
  marks the aggregate and every captured channel rawReady each tick from the bipolar time-domain
  mean, tears all captures down through the public reset paths on `disable()`, and warns about
  uncapturable requirements (unknown id, ambiguous name, open failure, no enumerable deviceId —
  they evaluate to min instead of failing silently). The render path is untouched.
- **No port change required:** the port has no audio-input code or tests of its own
  (`grep -rl AudioInputManager test/ src/` is empty; the manager drives the host's
  getUserMedia path, not the render path), so the GAP-032 runtime carries with the vendored
  engine. The four external-input real-input fixtures are unchanged.
- **Parity (strict gate — the round's parity evidence):** dual-minted golden + candidate in one
  browser session through the re-vendored engine (`NM_DUAL=1 LEDGER_PATH=<partial> bash
  parity/sweep.sh navierStokes target reactionDiffusion dither dither_bayer4x4 oilPaint noise
  blur watercolor texture billboard_flow`) — the stateful/evolve, agent-sim and sparse-dither
  cases that a reuse spot-check cannot grade — graded at the flat max-abs-diff-0 gate:
  **11/11 PASS, 0 skipped**, every graded program max-abs-diff 0.000 / ssim 1.00000 at
  tolerance 0 / ssim 0.999 (the golden/candidate pairs are minted in the same SwiftShader
  session here, so the match is byte-exact; `texture` is graded byte-exact in this subset).
  The minted subset goldens were **not** committed — the retained `parity/out/*.golden.png`
  stays the macOS-Metal-minted set. A separate relaxed reuse smoke run against those retained
  goldens (`bash parity/run.sh`, tol 2.001) is smoke-only per run.sh's documented contract —
  a PASS there is explicitly not byte-exact evidence and is not counted as parity:
  noise, blur, watercolor, pondRipples max-abs-diff 0, texture max-abs-diff 1.
- **Generated artifact refresh:** `parity/coverage-map.json` regenerated via
  `node tools/coverage-map.mjs` — the only delta is the engine record
  (version/build/coreBytes 1.0.199/`73c15be0`/888834 → 1.0.202/`68273906`/898266); no count,
  grade, or coverage value changed.
- **Verification**: `NM_UPSTREAM=<checkout> node tools/verify-sync-audit.mjs` exit 0 re-derives
  every recorded claim including this range (ancestry/contiguity, the v1.0.201/v1.0.202 tags,
  the exact shaders/ numstat, catalog parity, the pinned 1.0.202 core carrying the GAP-032
  multi-device symbols while 1.0.199/1.0.200 lack them, and 1.0.201 carrying the first
  GAP-032 commit's state half). All **107 unit/integration tests pass, 0 fail**
  (`npm test` = `node --test test/*.test.js`). The three browser-launching test files'
  `test/browser-launch.mjs` resolver gains a last-resort repair: when no known cache holds a
  chromium install (fresh container, no prepared `/state/cache` and empty `~/.cache`), it
  installs the chromium bundle ONCE into the repo-local `.cache/ms-playwright` (gitignored)
  under an exclusive lock with mtime-based steal, so a bare `npm test` is self-preparing
  instead of failing on the unprepared default registry. Readiness is detected by the
  browser directory's `INSTALLATION_COMPLETE` marker (Playwright creates the directory
  before extracting and writes the marker after), so a concurrent cold-cache install can
  never be mistaken for a finished one; re-verified cold in this container (cache hidden,
  bare suite self-installs and passes).

## Vendor sync (73c15be0..a5059106)

Source-side: `noisefactorllc/noisemaker` `73c15be00d68..a5059106ea75` (tearoff `ports-sync`,
flagged for a force-push / non-contiguous delivery with one observed sub-range `3e21906e..a5059106`
— audited directly in a local checkout: the declared start `73c15be0` is the port's covered tip
entering this round and an exact ancestor of the end `a5059106`, so the uncovered delta is exactly
the contiguous `73c15be0..a5059106` (7 commits), landing on upstream main tip `a5059106`.
The only `shaders/` change is GAP-032 (`git diff --stat 73c15be0..a5059106 -- shaders/`:
`shaders/src/runtime/external-input.js` +111/−7, `shaders/tests/test_external_input.js` +186/−1;
the other five commits are docs-only `d95d0c8c`/`3e21906e`/`53398923`/`cdb60cfc` and the two
dependabot bumps `a50c90bc`/`6b05a270`, none touching `shaders/`).
**No code change required; engine pin stays at v1.0.199 / build `73c15be0`:**

- Upstream commit `a5059106` (GAP-032): `AudioInputManager` now registers the browser-selected
  capture device via `AudioState.registerDevice()` and its channels via
  `registerDefaultChannels()`, analyzes each captured channel through a `ChannelSplitterNode`
  with one `AnalyserNode` per channel, marks aggregate and per-channel rawReady each tick from
  the bipolar time-domain mean, clears state through the public reset paths on `disable()`, and
  warns about selected-device bindings it does not capture
  (`Pipeline.getAudioInputRequirements()`, re-checked every 60 update ticks). Aggregate band,
  spectrum, and waveform behavior is unchanged.
- **Not in any published release**: upstream tag **v1.0.200** points at the in-range deps-only
  commit `6b05a270` (eslint bump; zero `shaders/` files changed), and the published
  `https://shaders.noisedeck.app/1.0.200/noisemaker-shaders-core.esm.js` core is **banner-stripped
  byte-identical to the pinned 1.0.199 core** (`cmp` after stripping the `* Build:` / `* Date:`
  banner lines — only those two lines differ) and does **not** contain the GAP-032 manager
  changes (string search for `_checkSelectedRequirements` / the warning text: no matches, same
  for the pinned 1.0.199 core). The GAP-032 runtime lives in `AudioInputManager`, which IS part
  of the published bundle's import graph — so when a future release ships it, the pin moves and
  that round re-verifies (the port has no audio-input code or tests of its own to mirror:
  `grep -rl AudioInputManager test/ src/` is empty; the manager drives the host's getUserMedia
  path, not the render path). Until then the vendored engine already matches upstream's published
  surface — no re-vendor, no parity re-grade, and no generated-artifact refresh are needed.
- **Verification**: `NM_UPSTREAM=<checkout> node tools/verify-sync-audit.mjs` exit 0 re-derives
  every recorded claim including this range (ancestry/contiguity, the v1.0.200 tag at the
  in-range deps-only commit, the exact shaders/ numstat, catalog parity, the banner-stripped
  1.0.200-vs-1.0.199 core byte-identity, and the GAP-032 symbols' absence from both cores).
  All **107 unit/integration tests pass, 0 fail** (`npm test` = `node --test test/*.test.js`;
  the range introduces no new behavior to mirror). Committed goldens carry by byte-identity:
  the pinned core is byte-identical to the previously verified 1.0.199 artifact.

## Vendor sync (296e0138..73c15be0)

Source-side: `noisefactorllc/noisemaker` `a912749fab5c..73c15be00d68` (tearoff `ports-sync`,
flagged for a force-push / non-contiguous delivery with three observed sub-range tips — audited
directly in a local checkout: the declared start `a912749f` (v1.0.195) is an ancestor of the
port's covered tip entering this round, `296e0138` (the previous section's end), so the uncovered
delta is exactly the contiguous `296e0138..73c15be0` (4 commits, including the docs-only
`04e8582c`), landing on upstream main tip `73c15be0`; release tags **v1.0.197** (`c28e8fdb`),
**v1.0.198** (`7aff843a`), and **v1.0.199** (`73c15be0`) each point exactly at their recorded SHA.
Upstream main has since advanced two docs-only commits (`53398923`, `cdb60cfc`) with an empty
`shaders/src` delta, so v1.0.199 IS upstream's current shaders/ tree).
**Engine synced from upstream commit `73c15be0` (v1.0.199) — this round DOES change the engine,
and the vendoring pin moves (authority change, per fetch.sh's own rule):**

- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed). **All 210 effect
  mini-bundles are byte-identical** between the v1.0.193 and v1.0.199 fetches (per-file sha256
  comparison of each `effects/*/*.js` against the fresh 1.0.193 CDN fetch, 210/210 match;
  `manifest.json` byte-identical) — no effect definition changed.
- **Engine core**: `noisemaker-shaders-core.esm.js` 884620 → **888834 bytes** (Build `73c15be0`,
  v1.0.199). Vendored tree produced by the documented script itself (`bash vendor/fetch.sh` at
  the bumped default → `vendor/noisemaker/engine-meta.json`: version 1.0.199, coreBuild
  `73c15be0`, coreBytes 888834, effectCount 210). The audit tool's pinned-bundle checks moved
  with the pin (its recorded `1.0.196 == 1.0.193` banner-stripped byte-identity claim is retained
  as historical, re-derived against the explicitly fetched 1.0.193 core).
- **Upstream changes audit** (re-derived by `node tools/verify-sync-audit.mjs`; range diffstat
  `296e0138..73c15be0` on `shaders/`: `backends/webgl2.js` +2/−0, `compiler.js` +3/−0,
  `pipeline.js` +128/−1, plus the four new/extended `tests/` modules + harness wiring — no
  effect definition changed):
  - Upstream commit `c28e8fdb` (v1.0.197): `WebGL2Backend` mesh-path fix — after
    `ensureDepthBuffer()` (whose initial depth allocation unbinds the framebuffer), the FBO is
    re-bound before the depth clear, so a first-frame mesh draw renders into the right target.
    Engine-internal backend module: the port's render path uses `BabylonBackend`, which always
    kept its render target bound, so no port change is needed — the mesh fixtures still grade
    byte-exact (spot checks below), and the engine's own `test_mesh_first_frame.mjs` covers the
    fixed behavior upstream.
  - Upstream commit `7aff843a` (v1.0.198, GAP-024): `shaders/tests/*` harness-only
    (session-identity bindings for the test harness) — outside the published bundle's import
    graph (symbol search: `session-identity` absent from the 1.0.199 core). Nothing for the port
    to mirror.
  - Upstream commit `73c15be0` (v1.0.199, GAP-026): production lifecycle hooks. The
    `Effect` wrapper had only ever *carried* onInit/onUpdate/onDestroy (config callbacks and
    subclass overrides); the production Pipeline now invokes them: `initLifecycleEffects()`
    rebuilds the managed-effect map at the same sites as `initAsyncEffects()` (init, resize, hot
    recompile) with onInit once per effect instance per pipeline lifetime; `_invokeUpdateHooks()`
    runs onUpdate once per frame with a `{ time, delta, uniforms }` context and binds returned
    uniforms under **fallback semantics** (a returned uniform binds only when the pass does not
    already resolve that key, so authored/step-provided values keep priority and the shared
    authored uniforms object is never mutated); onDestroy runs for every managed effect at
    dispose, joining the existing dispose error path; `recompile()` additionally calls
    `pipeline.initLifecycleEffects?.()`, tolerating stub pipelines. **No shipped effect in the
    210 mini-bundles defines a hook** (checked across all fetched bundles: no onInit/onUpdate/
    onDestroy config keys outside the minified `Effect` base class each bundle inlines), so for
    every real program the managed set is empty and the render path is bit-identical — committed
    goldens carry by byte-identity (the 1.0.196→1.0.199 core delta is exactly the GAP-026
    runtime + the mesh-target fix, both no-ops for the graded programs, verified by the spot
    checks below).
- **Babylon implementation & test coverage**: no `BabylonBackend`/runtime change is needed — the
  engine delta is internal to the engine's own backend and pipeline, and the port's public
  surface is untouched. `test/lifecycle-hooks.test.js` (new, 10 tests) mirrors the focused
  upstream `test_lifecycle_hooks.js` cases against the vendored published engine through public
  entry points (the engine's `compileGraph()` + `Pipeline` with a recording backend):
  config-authored, subclass, and plain-object hooks are all invoked by the production pipeline;
  the onUpdate context carries `{ time, delta, uniforms }` with the pipeline's global uniforms;
  returned uniforms are bound over the pass uniforms only under fallback semantics (the
  pass-resolved `level` keeps priority over a hook-returned default, mirroring the shipped
  synth/media shape) and the authored uniforms object is not mutated; onInit runs once per
  pipeline across resize and hot recompile; `recompile()` skips lifecycle init on stub pipelines
  without the method; and hook-less effects keep identical pass execution (the original pass
  object reaches the backend — the state of all 210 shipped effects this round).
- **`parity/coverage-map.json`** regenerated via `node tools/coverage-map.mjs` (engine metadata
  only — version 1.0.199 / build `73c15be0` / 888834 bytes; all counts, grades, and bindings
  unchanged; the gate test re-derives the committed JSON).
- **Suite environment repair (this commit)**: the headless browser tests resolved Playwright's
  registry from `~/.cache/ms-playwright`, which is unexecutable in this harness's containers
  (HOME sits on a noexec tmpfs). `test/browser-launch.mjs` (new; imported ahead of `playwright`
  by the three browser-launching tests) sets `PLAYWRIGHT_BROWSERS_PATH` at module-evaluation
  time to the repo-local exec-mounted `.cache/ms-playwright` (gitignored, produced by
  `npx playwright install` with that path) — but only when the caller left the variable unset
  AND the default registry holds no chromium; explicit settings and populated defaults are
  untouched, so no test, tolerance, or launch argument changed. `tools/verify-sync-audit.mjs`'s
  suite-readiness probe recognizes the same repo-local cache, so its REQUIRED suite check
  executes instead of skipping. Bare `npm test` (no environment setup) now passes 107/107.
- **Verification**: all **107 unit/integration tests pass, 0 fail** via the documented fetch
  path (`bash vendor/fetch.sh` at the pinned 1.0.199 revision + `npm test` = `node --test
  test/*.test.js`; 97 previous + the 10 new lifecycle mirror tests), and
  `node tools/verify-sync-audit.mjs` re-derives every recorded claim and exits 0, including the
  new range (ancestry/contiguity, the three release tags, the exact shaders/ and shaders/src
  numstats, catalog parity, the pinned-revision bundle identity + GAP-026/mesh-fix symbols, and
  the GAP-024 harness symbols' absence). Parity spot checks against the re-vendored engine, all
  at the strict byte-exact gate (`parity/run.sh <name> 0 0.999`, tol 0 / SSIM 0.999) on
  **freshly-paired mintings** (the documented discipline — golden and candidate rendered
  back-to-back): `noise`, `blur`, `adjust`, `remap`, `mesh_basic`, `heightmap3d_landscape`,
  `heightGrid`, `heightgrid_billboard_alpha`, `heightgrid_pointsrender_perspective`,
  `billboard_flow`, `reactionDiffusion`, `navierStokes`, `ca3d`, `watercolor`, `target` — **15/15
  byte-identical (max-abs-diff 0.000, ssim 1.0)**, including the mesh path (`c28e8fdb`'s
  surface) and the heavy evolve programs. One initial FAIL on `heightGrid` against the *reused*
  committed golden (max-abs-diff 123) is the documented stale-golden drift (see "A
  found-and-fixed false failure" above): the same reused-golden comparison fails identically on
  the previous engine, and the fresh-paired minting is byte-exact — not an engine-version
  regression, and no committed golden was rewritten. Full-sweep re-grading not rerun this round:
  the 210 mini-bundles are sha256-identical to the previous fetch and the runtime delta is a
  no-op for programs whose effects define no hooks (i.e. all graded programs), so the committed
  goldens carry by byte-identity; the 15 spot checks confirm the new tip renders identically.

## Vendor sync (6a0af04d..403c2a4b)

Source-side: `noisefactorllc/noisemaker` `6a0af04d3c4f..403c2a4bf2cb` (tearoff `ports-sync`,
flagged for a force-push / non-contiguous delivery — audited directly in a local checkout:
`6a0af04d` is the previous section's tip and an exact ancestor of `403c2a4b` (the observed
`66b8ce7d..19fdcb56` / `19fdcb56..403c2a4b` sub-ranges are contiguous), release tags **v1.0.186**
points at `19fdcb56` (docs-only) and **v1.0.187** points exactly at `403c2a4b` (both re-derived
by `node tools/verify-sync-audit.mjs`). The third observed sub-range `0ac52500..9f85687d` reaches
**beyond the declared end** (its tip `9f85687d` = v1.0.188, GAP-010, is not an ancestor of
`403c2a4b`): audited separately, `403c2a4b..9f85687d` changes only `shaders/tests/*` and
docs/LEDGER (the audit tool re-derives "no `shaders/src` module changes"), so the published
engine bundle is unaffected and this sync pins the declared end).
Engine synced from upstream `noisefactorllc/noisemaker` commit `403c2a4b` (v1.0.187):

- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 870700 → **879173 bytes** (Build `403c2a4b`,
  v1.0.187).
- **Upstream changes audit** (the `6a0af04d..403c2a4b` engine-src diff, per `--numstat`:
  `lang/transform.js` +372/−5, new `lang/paramAliases.js` +11 (read-only `getParamAliases()`
  alongside the existing internal alias registry), `lang/index.js` +2/−2, `src/index.js` +1/−1
  (new `predictReplacement` export), plus new/extended test files — **no runtime, backend,
  compiler, or effect-definition module changed**; re-derived by
  `node tools/verify-sync-audit.mjs`):
  - Upstream commit `403c2a4b` (GAP-008): `getCompatibleReplacements()`/`replaceEffect()`
    predict a candidate's compatibility dimensions before mutation — shader availability,
    arguments (unknown/missing with param-alias awareness), types, ranges, passes, outputs,
    sampler topology (with the replaced effect's topology as `changedFrom`), and backend support
    from an optional `options.manifest`; dimensions without data report unknown, never invented.
    Default classification is unchanged; `replaceEffect()` attaches the prediction to every
    success and refuses mutation on hard issues only behind the explicit `preflight: true`
    opt-in; listing-time predictions use empty arguments so requires-arguments never blocks.
    Engine-bundle-internal (the lang transform module ships in the core bundle; the port
    consumes the same exported `replaceEffect`/`getCompatibleReplacements` API —
    `test/compiler.test.js`'s existing mutation cases still pass unmodified), verified by symbol
    search in the re-vendored core bundle (`predictReplacement`, `getParamAliases`,
    `getCompatibleReplacements` all present). `getParamAliases`/`registerParamAliases` remain
    bundle-internal (not on the published export surface).
  - Upstream commit `b35361e0` (GAP-009, v1.0.186): temporal no-animation / low-variety frame
    metrics — `shaders/tests/*` harness modules only, outside the published bundle.
- **Engine unchanged-elsewhere**: every one of the 210 effect mini-bundles is **byte-identical**
  between the v1.0.185 and v1.0.187 fetches (per-file sha256 comparison, 210/210 match; manifest
  unchanged), and no runtime/backend module changed in the range — the render path is
  bit-identical, so committed goldens carry by byte-identity.
- **Vendoring pin bumped (authority change, per fetch.sh's own rule)**: `vendor/fetch.sh`'s
  default `VERSION` and `tools/verify-sync-audit.mjs`'s published-bundle check moved from
  `1.0.185` (build `6a0af04d`, 870700 bytes) to the pinned documented revision **1.0.187**
  (build `403c2a4b`, 879173-byte core). The vendored tree was produced by the documented script
  itself (`bash vendor/fetch.sh` → `vendor/noisemaker/engine-meta.json`: version 1.0.187,
  coreBuild 403c2a4b, coreBytes 879173, effectCount 210). The audit tool gained the 5d
  prediction-range checks (ancestry, v1.0.187 tag, exact numstat delta, catalog parity, bundler
  flag, beyond-range `9f85687d` audit, pinned-revision bundle identity + GAP-008 symbols); its
  historical `v1.0.181`/`v1.0.182` tag checks now record upstream tag deletion (both absent from
  origin `git ls-remote`, verified during this round — the tags themselves were verified against
  the recorded SHAs in their published sync rounds) instead of failing on a missing tag.
- **Babylon implementation & test coverage**: no `BabylonBackend`/runtime change is needed —
  this range's engine delta is an edit-time lang API; the port's render path and public surface
  are untouched. `test/transform-prediction.test.js` (new) mirrors the focused upstream
  `test_transform.js` GAP-008 prediction cases against the vendored published engine using real
  manifest effects (`filter.grain`/`filter.bloom`): listing-time prediction dimensions
  (available/arguments/types/ranges/passes/samplerTopology with bloom's `changedFrom` topology,
  backendSupport unknown without a manifest), manifest-derived backend support (GLSL-only entry
  → webgl2 true / webgpu false), unchanged default classification, prediction attached to
  default `replaceEffect` success with unknown arguments still accepted, `preflight: true`
  refusing unknown arguments / out-of-range values / type mismatches (and producing no program),
  and a valid preflight replacement passing through with the prediction. Plus the new
  `predictReplacement` export's presence on the published surface.
- **`parity/coverage-map.json`** regenerated via `node tools/coverage-map.mjs` (engine metadata
  only — version 1.0.187 / build `403c2a4b` / 879173 bytes; all counts, grades, and bindings
  unchanged; the gate test re-derives the committed JSON).
- **Verification**: all **90 unit/integration tests pass** (89 + the new prediction test) via the
  documented fetch path (`bash vendor/fetch.sh` at the pinned 1.0.187 revision + `npm test`),
  and `node tools/verify-sync-audit.mjs` re-derives every recorded claim and exits 0
  ("All recorded sync-audit claims re-derived from source: audit stands."; its in-suite check
  reports `90/90 tests, 0 fail`). Parity spot checks against the re-vendored engine
  (`parity/run.sh`, tol 2.001): `noise`, `blur`, `adjust` all byte-identical (max-abs-diff 0.000,
  ssim 1.0). Full-sweep re-grading not rerun this round: the range's engine-src diff is
  lang-only (edit-time replacement prediction; runtime, backend, compiler, and effect modules
  byte-unchanged — the 210 mini-bundles are sha256-identical to the previous fetch), so the
  committed goldens carry by byte-identity; the spot checks confirm the new tip renders
  identically.

## Vendor sync (93229933..296e0138)

Source-side: `noisefactorllc/noisemaker` `7443f6e6..a912749f` (tearoff `ports-sync`, flagged for a
force-push / non-contiguous delivery — audited directly in a local checkout: the declared start
`7443f6e6` (v1.0.190) lies inside the already-covered `7dc0f564..12b4d74f` range and is an exact
ancestor of the port's covered tip `12b4d74f`, while one observed trigger range tip, `296e0138`,
is a DESCENDANT of the declared end, so the
delivery was ordered, not rewritten). The port's covered tip entering this round is `93229933`
(the previous section), so the uncovered delta is exactly `93229933..296e0138` (4 commits,
contiguous), landing on upstream main tip `296e0138`; release tags **v1.0.194** (`93229933`),
**v1.0.195** (`a912749f`), and **v1.0.196** (`296e0138`) each point exactly at their recorded SHA.
All four commits are outside the published bundle's import graph — **no code change required;
engine pin stays at v1.0.193 / build `12b4d74f`**:

- `7c5f1765` (docs): `LEDGER.md` +75/−0, `llms-full.txt` +20/−3 — no `shaders/src` or effect changes.
- `a912749f` (GAP-019): adds `shaders/tests/passthrough-input.js` (+489) and
  `shaders/tests/test_passthrough_input.js` (+259), `shaders/tests/test-harness.js` +70/−0, and
  `scripts/run-js-tests.js` +1/−0 (`llms-full.txt` +9/−1) — a harness-only input-passthrough probe
  behind an explicit `--passthrough-input` opt-in; default gates unchanged.
- `11d7c699` (docs): `llms-full.txt` +1/−1 only (GAP-020 register narrowing; the MCP domain error
  envelope lives in the Shade repository, nothing vendored).
- `296e0138` (GAP-021): adds `shaders/tests/frame-resolution.js` (+95) and
  `shaders/tests/test_frame_resolution.js` (+189), `shaders/tests/test-harness.js` +34/−1, and
  `scripts/run-js-tests.js` +1/−0 (`llms-full.txt` +6/−1) — harness-only requested-vs-returned
  frame-resolution reporting. Range diffstat (`git diff --stat 93229933..296e0138`): 8 files,
  +1241/−9 (`LEDGER.md`, `llms-full.txt`, `scripts/run-js-tests.js`, the five `shaders/tests/`
  files) — no effect definitions, DSL, runtime, or renderer changes; the upstream `shaders/src`
  diff across the range is empty.
- **Engine unchanged, verified against the live CDN**: the published
  `https://shaders.noisedeck.app/1.0.196/noisemaker-shaders-core.esm.js` (884620 bytes, banner
  `Build: 296e0138`) is byte-identical to the vendored v1.0.193 core (884620 bytes, banner
  `Build: 12b4d74f`) once the two banner lines (`* Build:` / `* Date:`) are stripped (`cmp`
  empty). The new modules' symbols are absent from the published bundle (string search for
  `passthrough-input` / `frame-resolution` / `definition-schema` in the 1.0.196 core: no
  matches), so the vendored engine already matches upstream tip; no re-vendor, no parity
  re-grade, and no generated-artifact refresh are needed.
- **Verification**: `node tools/verify-sync-audit.mjs` exit 0 re-derives every recorded claim
  including this range (ancestry/contiguity, the three release tags, the exact shaders/ numstat,
  the empty upstream `shaders/src` diff, and the banner-stripped CDN core byte-identity). All
  **97 unit/integration tests pass, 0 fail** (`npm test` = `node --test
  test/*.test.js`; pass count is 94 + the 3 GAP-006 qualification cases added by the
  intervening local commit `c84adde`, not by this range — all 97 pass); the range introduces no new behavior to mirror — the only
  import-graph-adjacent upstream artifacts are dev-only harness tooling that this port's
  browser-bundled engine does not (and must not) consume.

## Vendor sync (12b4d74f..93229933)

Source-side: `noisefactorllc/noisemaker` `7443f6e6..93229933` (tearoff `ports-sync`, flagged for
a force-push / non-contiguous delivery — audited directly in a local checkout: the declared start
`7443f6e6` is the previous section's covered tip and an exact ancestor of `12b4d74f`, so the
uncovered delta is exactly `12b4d74f..93229933`, which is contiguous; upstream `main` tips at
`93229933` and release tag **v1.0.194** points exactly at it). Two commits, both outside the
published bundle's import graph — **no code change required; engine pin stays at v1.0.193 /
build `12b4d74f`**:

- `8fe3ccaf` (docs): `LEDGER.md` +14/−7, `llms-full.txt` +1/−1 — no `shaders/src` or `shaders/`
  effect changes.
- `93229933` (GAP-017): adds `shaders/tests/definition-schema.js` (+220),
  `shaders/tests/test_definition_schema.js` (+161), `shaders/tests/test-harness.js` +58/−2, and
  `scripts/run-js-tests.js` +1/−0 (`llms-full.txt` +8/−1) — test-harness-only wiring; no effect
  definitions, DSL, runtime, or renderer changes. Range diffstat (`git diff --stat 12b4d74f..93229933`): 6 files, +553/−10
  (`LEDGER.md`, `llms-full.txt`, `scripts/run-js-tests.js`, the three `shaders/tests/` files).
- **Engine unchanged, verified against the live CDN**: the published
  `https://shaders.noisedeck.app/1.0.194/noisemaker-shaders-core.esm.js` (884620 bytes, banner
  `Build: 93229933`) is byte-identical to the vendored v1.0.193 core (884620 bytes, banner
  `Build: 12b4d74f`) once the two banner lines (`* Build:` / `* Date:`) are stripped (`cmp`
  empty). The upstream `shaders/src` diff across the range is empty. The new module's symbol is
  absent from the published bundle (string search for `definition-schema` /
  `test_definition_schema` in the vendored core: no matches), so the vendored engine already
  matches upstream tip; no re-vendor, no parity re-grade, and no generated-artifact refresh are
  needed.
- **Verification**: all **94 unit/integration tests pass, 0 fail** (`npm test` =
  `node --test test/*.test.js`, pass count unchanged from the previous round); the range
  introduces no new behavior to mirror — the only import-graph-adjacent upstream artifact is
  dev-only harness tooling that this port's browser-bundled engine does not (and must not)
  consume.

## Vendor sync (7dc0f564..12b4d74f)

Source-side: `noisefactorllc/noisemaker` `7dc0f5640534..12b4d74fb4f2` (tearoff `ports-sync`,
flagged for a force-push / non-contiguous delivery with a declared end `7443f6e6` — audited
directly in a local checkout: the declared end is v1.0.190, while two observed trigger tips
(`e73a44a3` = v1.0.192, `12b4d74f` = v1.0.193) are exact DESCENDANTS of it, so the delivery was
ordered, not rewritten; the previous sync section's tip `7dc0f564` is an exact ancestor of
`12b4d74f` and the range `7dc0f564..12b4d74f` is contiguous). Release tags **v1.0.190**
(`7443f6e6`), **v1.0.191** (`c2252f0c`), **v1.0.192** (`e73a44a3`), and **v1.0.193**
(`12b4d74f`) each point exactly at their recorded SHA (all re-derived by
`node tools/verify-sync-audit.mjs`). The range is four commits, all touching `shaders/`:
`7443f6e6` (GAP-012 harness readback pin + tests), `c2252f0c` (GAP-015 metric mirror tests),
`e73a44a3` (GAP-014 harness frame warm-up + tests), `12b4d74f` (GAP-016 static effect
preflight). The declared range `403c2a4b..7443f6e6` was already fully covered by the two
preceding sections (`403c2a4b..7dc0f564` plus this one). Upstream main has since advanced one
docs-only commit (`ec457c2e`, empty `shaders/` delta — re-derived by the sync audit), so this
sync lands the port on upstream's current `shaders/` tree. Engine synced from upstream
`noisefactorllc/noisemaker` commit `12b4d74f` (v1.0.193):

- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed); all 210 effect mini-bundles
  are sha256-identical to the previous fetch.
- **Engine core**: `noisemaker-shaders-core.esm.js` 879173 → 884620 bytes (Build `12b4d74f`).
- **Upstream changes audit**:
  - Upstream commit `12b4d74f` (GAP-016) added `shaders/src/runtime/preflight.js` — a shared
    static preflight (`preflightEffect(definition, capabilities, shaders)`) that reports, before
    any program is compiled: per-backend authorability (WebGL2 needs a GLSL source, WebGPU needs
    WGSL), predicted MRT `rgba32f → rgba16f` demotions when attachments exceed
    `maxColorBytesPerSample` (exactly what `Pipeline.applyMrtFormatBudget()` does at runtime),
    predicted `maxTextureSize` clamps, and `maxDrawBuffers` overflows. `Pipeline.mrtFormatBytes()`
    now delegates to the shared `mrtFormatBytes()` (identical mapping), and a new read-only
    `Pipeline.preflight(capabilities?)` method exposes the report over the live graph.
  - Commits `7443f6e6`/`c2252f0c`/`e73a44a3` changed only `shaders/tests/` (frame-readback,
    frame-warm-up, image-metrics, uniform-deltas/status modules, their tests, and
    test-harness wiring) — dev-only, outside the published bundle's import graph.
  - The published bundle delta against v1.0.189 is exactly the preflight addition (new internal
    `preflightEffect`/`mrtFormatBytes` module + the `Pipeline.preflight()` method + the
    `mrtFormatBytes` delegation) — no rendering-path behavior change; `preflightEffect` is NOT on
    the published export surface (re-verified: the export list is byte-identical to v1.0.189's),
    so the analysis is reachable as `Pipeline.prototype.preflight`.
- **Babylon test coverage**:
  - Added `test/preflight.test.js` mirroring the upstream `Pipeline`-level preflight cases
    against the vendored engine: the predicted MRT demotion agrees with the runtime budget
    applied by `createSurfaces()`; without shader specs source availability is not judged;
    `maxDrawBuffers` overflows and `maxTextureSize` clamps are reported with reasons; and
    `preflight()` never mutates the graph.
- **Babylon-side generated artifact**: `parity/coverage-map.json` re-derived with
  `node tools/coverage-map.mjs` against the pinned v1.0.193 engine (engine block now records
  version 1.0.193 / build `12b4d74f` / 884620 bytes; all effect-evidence counts unchanged at
  210/210 with 0 exclusions).
- **Verification**: All 94 unit and integration tests pass cleanly (`node --test test/*.test.js`:
  90 + the 4 new preflight tests); `node tools/verify-sync-audit.mjs` exit 0 re-derives every
  recorded claim including this range. Parity spot checks (`parity/run.sh`, tol 2.001): `noise`,
  `bloom`, `blur`, `adjust` all byte-identical (max-abs-diff 0.000, ssim 1.0); `highPass` and
  `extrude` grade within 1 LSB (max-abs-diff 1.000, ssim ≥ 0.99993). Four further programs
  (`cnd_kaleido`, `tetraColorArray`, `dither_bayer4x4`, `directionalBlur`) show high
  max-abs-diff against the macOS-Metal-minted goldens on this container's SwiftShader driver —
  **byte-for-byte identical measurements at the previous pinned v1.0.189 build**, so they are
  pre-existing container driver noise, unchanged by this sync (the range's engine-src diff is
  additive-only preflight code; the 210 mini-bundles are sha256-identical to the previous
  fetch). Full-sweep re-grading not rerun this round for the same reason; the committed goldens
  carry by the unchanged rendering path.

## Vendor sync (403c2a4b..7dc0f564)

Source-side: `noisefactorllc/noisemaker` `403c2a4bf2cb..7dc0f5640534` (tearoff `ports-sync`,
flagged for a force-push / non-contiguous delivery — audited directly in a local checkout:
`403c2a4b` is the previous section's tip and an exact ancestor of `7dc0f564` (the range is
contiguous; the observed `407eb7a7..7dc0f564` sub-range is a strict suffix of it — the two
commits before `407eb7a7`, `0ac52500` and `9f85687d`, sit between `403c2a4b` and `407eb7a7`)),
release tags **v1.0.188** points exactly at `9f85687d` and **v1.0.189** points exactly at
`7dc0f564` (both re-derived by `node tools/verify-sync-audit.mjs`). The range is five commits:
`0ac52500` (docs: AI contract checkpoint through GAP-008/009), `9f85687d` (GAP-010), `7730ea4a`
(docs), `407eb7a7` (docs), `7dc0f564` (GAP-011). Engine synced from upstream
`noisefactorllc/noisemaker` commit `7dc0f564` (v1.0.189):

- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 879173 bytes (Build `7dc0f564`, v1.0.189) —
  **the same 879173 bytes as the v1.0.187 build except its Build/Date banner lines**: the two
  pinned CDN artifacts (`1.0.187` vs `1.0.189`) are byte-identical once the banner lines are
  stripped (re-derived by `node tools/verify-sync-audit.mjs`).
- **Upstream changes audit** (the `403c2a4b..7dc0f564` shaders/ diff, per `--numstat`:
  `tests/test-harness.js` +64/−4, new `tests/test_uniform_status.js` +116, new
  `tests/uniform-status.js` +78, new `tests/test_uniform_deltas.js` +122, new
  `tests/uniform-deltas.js` +282 — plus `llms-full.txt` and `scripts/run-js-tests.js` outside
  `shaders/`; **no `shaders/src` module — runtime, backend, compiler, lang, or effect
  definition — changed** (catalog parity); re-derived by
  `node tools/verify-sync-audit.mjs`):
  - Upstream commit `9f85687d` (GAP-010, v1.0.188): truthful uniform-responsiveness
    aggregation behind the harness `--strict-uniforms` flag — `shaders/tests/*` harness
    modules only, outside the published bundle.
  - Upstream commit `7dc0f564` (GAP-011, v1.0.189): auditable measured uniform deltas in the
    harness uniforms report — `shaders/tests/*` harness modules only, outside the published
    bundle.
- **Engine unchanged-elsewhere**: no runtime/backend/compiler/lang/effect module changed in the
  range, so the published core bundle's only delta is its banner and every one of the 210 effect
  mini-bundles is byte-identical between the v1.0.187 and v1.0.189 fetches (fresh CDN fetch of
  all 210 mini-bundles at both revisions compared directly, `diff -rq` clean; manifest
  byte-identical) — the render path is bit-identical, so committed goldens carry by
  byte-identity.
- **Vendoring pin bumped (authority change, per fetch.sh's own rule)**: `vendor/fetch.sh`'s
  default `VERSION` and `tools/verify-sync-audit.mjs`'s published-bundle check moved from
  `1.0.187` (build `403c2a4b`, 879173 bytes) to the pinned documented revision **1.0.189**
  (build `7dc0f564`, 879173-byte core, banner-only delta). The vendored tree was produced by the
  documented script itself (`bash vendor/fetch.sh` → `vendor/noisemaker/engine-meta.json`:
  version 1.0.189, coreBuild 7dc0f564, coreBytes 879173, effectCount 210). The audit tool gained
  the 5e uniforms-range checks (contiguity ancestry, `v1.0.188`/`v1.0.189` tag identity, exact
  numstat delta, catalog parity, bundler flag) and the banner-only bundle-diff check; its
  historical `v1.0.185` tag check now records upstream tag deletion (absent from origin
  `git ls-remote`, verified during this round — the tag itself was verified against the recorded
  SHA in its published sync round) instead of failing on a missing tag.
- **Babylon implementation & test coverage**: no port change is needed — this range's engine
  delta is `shaders/tests/*` harness tooling only (test-uniform responsiveness/delta reporting),
  outside the published bundle; the port's render path, public surface, and effect catalog are
  untouched, and no WGSL/GLSL/HLSL translation is affected.
- **`parity/coverage-map.json`** regenerated via `node tools/coverage-map.mjs` (engine metadata
  only — version 1.0.189 / build `7dc0f564` / 879173 bytes; all counts, grades, and bindings
  unchanged: 210/210 effects with fixture evidence, ledger 322 PASS / 3 SKIP / 0 FAIL over 325
  programs, choice surface 257 params / 132 effects / 1460 choices; the gate test re-derives the
  committed JSON).
- **Verification**: all **90 unit/integration tests pass** via the documented fetch path
  (`bash vendor/fetch.sh` at the pinned 1.0.189 revision + `npm test`), and
  `node tools/verify-sync-audit.mjs` re-derives every recorded claim and exits 0 ("All recorded
  sync-audit claims re-derived from source: audit stands."; its in-suite check reports `90/90
  tests, 0 fail`). Parity spot checks against the re-vendored engine (`parity/run.sh`, tol
  2.001): `noise`, `blur`, `adjust` all byte-identical (max-abs-diff 0.000, ssim 1.0).
  Full-sweep re-grading not rerun this round: the range's engine-src diff is empty (the 210
  mini-bundles are byte-identical to the previous fetch and the core differs only in its
  banner), so the committed goldens carry by byte-identity; the spot checks confirm the new tip
  renders identically.

## Vendor sync (8eeb7b5a..6a0af04d)

Source-side: `noisefactorllc/noisemaker` `8eeb7b5ac14e..6a0af04d3c4f` (tearoff `ports-sync`
job #577, flagged for a force-push / non-contiguous delivery — audited directly in a local
checkout: `fca611fd` (the reported range start) is already covered by the `4891b995..240740dd`
sync below, the observed `428ea29b..95743621` / `95743621..6a0af04d` sub-ranges are contiguous
ancestors of `6a0af04d` (v1.0.185), and the sync's true start is `8eeb7b5a` = v1.0.183, the
previous section's tip; the range's remaining commits (`0b2866dd`, `ad17fd02`, `93608f10`,
`6a0af04d`, and post-range tip `a651c075`) are docs/register-only).
Engine synced from upstream `noisefactorllc/noisemaker` commit `6a0af04d` (v1.0.185):

- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 870700 bytes (Build `6a0af04d`, v1.0.185).
- **Upstream changes audit** (the `8eeb7b5a..6a0af04d` engine-src diff, per `--numstat`:
  new `backends/diagnostics.js` +185, `backends/webgl2.js` +26/−7, `backends/webgpu.js` +60/−35,
  `pipeline.js` +213/−2, plus the two new test files; re-derived by `node tools/verify-sync-audit.mjs`):
  - Upstream commit `6113da00` (v1.0.184, GAP-006): the runtime now consumes the analyzer's
    physical allocation plan (graph.allocations) behind an opt-in `texturePooling: true` —
    `Pipeline.buildTexturePoolingPlan()`/`applyTextureAliases()` alias poolable group members
    onto one backend texture under the group's primary id (persistent/mipmapped/3D, first-read,
    self-sampled, and partially-written textures are never pooled), and
    `Pipeline.getResourcePlan()` reports the materialized sharing.
  - Upstream commit `95743621` (v1.0.184): a `viewport` pass without `clear: true` marks its
    outputs partially written for pooling (sub-region writes expose a group-mate's previous
    content; full clears stay poolable).
  - Upstream commit `f83a427e` (v1.0.185, GAP-007): every WebGL2/WebGPU backend compile, link,
    and missing-source failure throws a structured `ShaderDiagnostic` union
    (`code`/`backend`/`stage`/`program`/`detail`/`messages`/`source`) built via
    `parseGLSLInfoLog`/`parseWebGPUCompilationMessages`/`toDiagnostic`; the WebGPU bind-group
    retry consumes the parsed `bindingIndex` instead of re-matching browser error strings.
    Engine-bundle-internal (WebGL2/WebGPU backends and `Pipeline` live in the bundle; the
    port's createPipeline passes options through), verified by symbol search in the re-vendored
    core bundle (all of `ShaderDiagnostic`/`parseGLSLInfoLog`/`parseWebGPUCompilationMessages`/
    `buildTexturePoolingPlan`/`getResourcePlan` present).
- **Engine unchanged-elsewhere**: `cmp` of the vendored core bundle against a fresh
  `shaders.noisedeck.app/1` fetch is byte-identical; manifest stays 210 effects (0 added, 0
  removed — no effect catalog delta in this range).
- **Vendoring pin bumped (authority change, per fetch.sh's own rule)**: `vendor/fetch.sh`'s
  default `VERSION` and `tools/verify-sync-audit.mjs`'s published-bundle check moved from the
  rolling `/1` alias to the pinned documented revision `1.0.185` (build `6a0af04d`, 870700-byte
  core). The vendored tree was produced by the documented script itself
  (`bash vendor/fetch.sh` → `vendor/noisemaker/engine-meta.json`: version 1.0.185, coreBuild
  6a0af04d, coreBytes 870700, effectCount 210, manifestBytes 39906) with `engine-hashes.json`
  covering the core, manifest, and every mini-bundle; `node tools/verify-sync-audit.mjs` re-derives
  the full range audit (ancestry, v1.0.185 tag at `6a0af04d`, exact numstat delta, catalog parity,
  bundler validation disabled, pinned-revision bundle identity and GAP-006/GAP-007 symbols) and
  exits 0 ("All recorded sync-audit claims re-derived from source: audit stands.").
- **Babylon implementation & test coverage**:
  - `BabylonBackend` (the port-side analog of the reference backends' compile paths): ported
    the GAP-007 diagnostic union — `compileProgram()`'s missing-source throw and the
    `_whenReady()` Babylon compilation-error/`init()` copy-wrapper paths now surface one
    structured `ShaderDiagnostic` (real `Error` with `code: 'ERR_SHADER_MISSING'` /
    `'ERR_SHADER_COMPILE'`, `backend: 'babylon'`, `stage`, `program`, `detail`, parsed
    compiler `messages`, offending `source`), with a port of
    `parseGLSLInfoLog()` for the `ERROR: 0:LINE:` info-log shape. Detail fidelity differs by
    stage, mirroring upstream f83a427e: missing-source keeps its previous message
    byte-identical, while a Babylon compile failure previously threw
    `Shader compile failed (${name}): ${log}` and now carries the RAW compiler info-log as
    `detail`/`message` (prefix dropped, matching the reference backends' compile diagnostics —
    an intentional observable change; no repo consumer matched on the prefixed text, and
    `err.detail || err.message` fallbacks still yield the full failure text). Compile
    **timeouts** intentionally stay plain `Error`s (upstream has no timeout surface).
  - `NoisemakerRenderer.loadGraph()`: forwards load options into the `Pipeline` constructor
    (minus the renderer's own `Pipeline` key), enabling host-side `texturePooling: true` —
    the engine Pipeline consumes the plan through `backend.textures`, which the Babylon
    backend already exposes.
  - `test/backend-diagnostics.test.js` (new): missing-source and Babylon compilation-error
    failures surface a structured `ShaderDiagnostic` (missing-source detail byte-identical;
    compile detail = the raw info-log), `parseGLSLInfoLog()` ERROR/WARNING/prose parsing,
    legacy-field serialization, and plain Error compile timeouts.
  - `test/resource-pooling.test.js` (new): mirrors the upstream `test_resource_pooling.js`
    Pipeline cases against the vendored v1.0.185 Pipeline + recording backend — default no
    pooling (each virtual id owns its record, `getResourcePlan()` reports pooling:false),
    opt-in pooling shares records and never allocates pooled-member storage, the
    95743621 viewport-without-clear guard blocks (and a full clear restores) pooling,
    persistent members and mismatched dimensions fall back to standalone textures, and
    first-read textures are never pooled.
  - `test/renderer-sinks.test.js`: load options (e.g. `texturePooling`) forward into the
    `Pipeline` constructor.
- **Verification**: all 82 unit/integration tests pass cleanly via the documented fetch path
  (`bash vendor/fetch.sh && npm test` on the pinned 1.0.185 revision; was 70 before this sync;
  +11 new, +1 renderer forwarding case) — the claim is machine-re-derivable: in a prepared
  environment (`bash vendor/fetch.sh && npm install && PLAYWRIGHT_BROWSERS_PATH=<dir>
  npx playwright install chromium`) `node tools/verify-sync-audit.mjs` runs the full suite as
  its final check and requires 0 failing tests to exit 0 (verified here: "port test suite
  passes (82/82 tests, 0 fail)"). Note the repo ships no test-running CI workflow
  (`.github/workflows/export-kit.yml` only dispatches a scaffold kit build), so this local
  re-derivation is the suite's verification record. Parity spot checks against the re-vendored
  engine (`parity/run.sh`, tol 2.001): `adjust`, `noise`, `blur` all byte-identical
  (max-abs-diff 0.000). Full-sweep re-grading not rerun this round: the range's engine-src diff
  is pooling opt-in (default off, so default renders are bit-path-identical) and backend
  failure diagnostics, with no shader or effect-definition changes (goldens themselves were
  minted against the previous v1.0.183 tip; the spot checks confirm the new tip renders
  identically).

## Vendor sync (240740dd..8eeb7b5a)

Source-side: `noisefactorllc/noisemaker` `240740dd2d30..8eeb7b5ac14e` (tearoff `ports-sync` job #558).
Engine synced from upstream `noisefactorllc/noisemaker` commit `8eeb7b5a` (v1.0.183):

- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 858616 bytes (Build `8eeb7b5a`, v1.0.183).
- **Upstream changes audit**:
  - Upstream commit `9d3474df` (v1.0.181): implemented GAP-003 effect definition validation against spec contracts at authoring/registration time (`validateEffectDefinition`).
  - Upstream commit `2f47612c` (v1.0.182): implemented GAP-004 authorable texture policies (`mipmaps`, `persistent` on 2D specs, `filter` on 3D specs) in `extractTextureSpecs()` and validator; opt-in mip chain regeneration via `backend.generateMipmaps()` and size-changing texture content preservation via `recreateTexturePreserving()`.
  - Upstream commit `8eeb7b5a` (v1.0.183): implemented GAP-005 pass-field propagation, copying `name`, `type`, `clear`, `samplerTypes`, `viewport`, and dynamic pass-skipping `conditions` onto expanded pass objects; `Pipeline.resolvePassViewport()` evaluates authored viewport specs into `viewportResolved` {x, y, w, h} coordinates.
- **Babylon implementation & test coverage**:
  - `BabylonBackend`: updated `createTexture()` to record `mipmaps` and `persistent` policy flags on texture records, and configure `samplingMode: Constants.TEXTURE_LINEAR_LINEAR_MIPLINEAR` and `generateMipMaps: true` when `spec.mipmaps` is true so fragment shaders can sample mip levels.
  - `BabylonBackend`: implemented `generateMipmaps(ids)` hook calling `engine.generateMipmaps()` with defensive fallback to `gl.generateMipmap()` and engine cache resynchronization.
  - `BabylonBackend`: updated `copyTexture()` to resample via `uScale` and normalized UV sampling across dimension changes, preserving persistent texture contents while maintaining byte-exact `texelFetch` for same-size copies and blits.
  - `BabylonBackend`: implemented `_resolvePassViewportBox()` to normalize `viewportResolved` / `viewport` objects across single-output fullscreen passes (`onApplyObservable` with cache invalidation), MRT (`_executeMRT()`), point deposits (`_executePoints()`), and mesh renders (`_executeTriangles()`).
  - `test/compiler.test.js`: added unit test verifying that `exportFatGraph()` propagates all GAP-005 pass fields onto expanded passes across multi-pass graphs, and unit test verifying `Pipeline.resolvePassViewport()` evaluation of authored dimension specs and passthrough of numeric boxes.
  - `test/backend-capabilities.test.js`: added unit tests verifying that `BabylonBackend.createTexture()` correctly sets `mipmaps` and `persistent` flags, passes mipmap sampling mode constants, executes `generateMipmaps()` with internal texture handles, scales persistent texture copies across dimension changes, and verifies `_resolvePassViewportBox()` across diverse viewport representations.
- **Verification**: All 59 unit tests pass cleanly.
- **Integration note (next sync)**: the texture-policy Babylon implementation was subsequently
  aligned to upstream `webgl2.js` semantics (up-front mip-chain allocation, mag NEAREST /
  min LINEAR_MIPMAP_LINEAR sampler, NEAREST blit-chain `generateMipmaps` — `gl.generateMipmap()`
  is invalid for the default non-filterable float formats) and the engine re-vendored to this
  range's tip; see the `9d3474df..2f47612c` sync section below for the faithful implementation,
  its real-GL verification, and the supersession rationale.

## Vendor sync (4891b995..240740dd)

Source-side: `noisefactorllc/noisemaker` `4891b9953f9f..240740dd2d30` (tearoff `ports-sync` job #503).
Engine synced from upstream `noisefactorllc/noisemaker` commit `240740dd` (v1.0.180):

- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 841350 bytes (Build `240740dd`).
- **Upstream changes audit**:
  - Upstream commit `9fa1a221`: derived parser diagnostic coordinates and spans from source token positions across P001, P002, P003, P004, P005, P006, and P007 diagnostics on thrown `SyntaxError`s.
  - Upstream commit `fca611fd`: derived numeric-coercion diagnostic coordinates and spans from array literal positions (e.g., `let y = [1] + 1`).
  - Upstream commit `66b2c721`: implemented GAP-027 subchain argument validation contract, exposing diagnostics P008 (unknown/discarded subchain arguments), P009 (duplicate subchain arguments), and P010 (missing argument separator) in permissive compile diagnostics and strict parse/compile validation (`subchainArguments: 'strict'`).
  - Upstream commit `240740dd`: registered committed subchain differential gate vs recorded baseline.
- **Babylon test coverage**:
  - Updated unit test coverage in `test/compiler.test.js` verifying that parser diagnostics derive token positions and spans `sourcePosition(source, line, column)` across all 37 parser diagnostic error cases, while preserving null spans for caller-supplied tokens lacking source coordinates.
  - Added unit test coverage for array literal numeric coercion diagnostics retaining source coordinates and spans.
  - Added unit test coverage for subchain argument validation reporting P008, P009, and P010 diagnostics in standard compilation and throwing `SyntaxError` with diagnostic metadata under `subchainArguments: 'strict'`.
- **Verification**: All 55 unit and integration tests pass cleanly; parity verified against golden standard.

## Vendor sync (240740dd..9d3474df)

Source-side: `noisefactorllc/noisemaker` `fca611fd8f91..9d3474dfdc6c` (tearoff `ports-sync` job #523,
flagged for a force-push / non-contiguous delivery — audited directly in a local checkout:
`fca611fd` is a direct ancestor of `9d3474df` (contiguous), the observed `0bd09d00..9d3474df` range is
a sub-range of it, and `fca611fd` itself was already consumed by the `4891b995..240740dd` sync above).
`bash vendor/fetch.sh` re-pulled `/1` in place after the last upstream commit in this range:

- **Engine core**: `noisemaker-shaders-core.esm.js` 841350 bytes (ETag `6ab694c0-cd686`,
  Last-Modified Fri, 25 Sep 2026 15:35:28 GMT), verified **byte-identical (`cmp`) to the live CDN
  artifact re-fetched after the last upstream commit in this range**.
- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed).
- **Range verification** (force-push flag resolved with direct evidence in a local upstream
  checkout, current `HEAD` `fa4b2f02`): `git merge-base --is-ancestor` confirms `fca611fd` is a
  direct ancestor of `9d3474df` (the flagged range is contiguous), the observed `0bd09d00..9d3474df`
  is a sub-range of `fca611fd..9d3474df`, and `fca611fd` is an ancestor of the already-synced
  `240740dd` (single-child first-parent chain: `fca611fd` → `8a21c9ca` → … → `66b2c721` → … →
  `240740dd`) — so the incremental, not-yet-synced shader-tree delta is exactly `240740dd..9d3474df`.
  The release tag `v1.0.181` points exactly at `9d3474df` (tagged
  2026-09-25T15:35:36Z — the CDN artifact's Last-Modified 15:35:28Z, seconds earlier, is consistent
  with that release publish), so
  the re-pull above picked up this range's release build.
- **Upstream changes audit** (`240740dd..9d3474df -- shaders/`, exactly two commits, exact
  per-file delta): `ba87ffae` + `9d3474df` →
  `shaders/src/runtime/effect-validator.js` (+1097/−18) and
  `shaders/tests/test_effect_definition_validation.js` (+457, new file).
  - `ba87ffae` (GAP-003) implemented the runtime effect-definition validator — a deterministic,
    side-effect-free structure check of the definition grammar consumed by
    `effect.js`/`expander.js`/`compiler.js`/uniform packing/the UI layer (returns error strings,
    `[]` for valid) — plus its contract suite (upstream corpus gate: 210/210 effect definitions
    valid).
  - `9d3474df` completed the validator contract (semantic xyzw component ordering, vector min/max
    form agreement and default containment, byte-layout duplicate/overlap conflict detection;
    accepts `string` globals with string choices, `ui.multiline`, `enabledBy` `gte`/`lte`,
    dimension `inputOverride`) and wired the suite into `scripts/run-js-tests.js` /
    `test:shaders:runtime`.
  - No other file changed under `shaders/` in the range; the only non-shader files in
    `fca611fd..9d3474df` are docs/ledger text (`LEDGER.md`, `llms-full.txt`,
    `docs/plans/active-framework-gap.md`, `docs/shaders/language.rst`) and the test wiring
    (`package.json`, `scripts/run-js-tests.js`). **No effect definition, GLSL/WGSL source, manifest
    entry, or parameter contract changed.**
- **Port impact: none.** The validator is a dev/test-only module that is not part of the published
  engine surface this port consumes — verified three ways: (1) at `v1.0.181` no module under
  `shaders/src` imports `effect-validator.js` (`git grep`), so it is outside the browser bundle's
  import graph; (2) the vendored core ESM contains neither `validateEffectDefinition` nor the
  module's header text (string search); (3) upstream's own bundler defines
  `__NOISEMAKER_DISABLE_EFFECT_VALIDATION__: 'true'` for the browser bundle
  (`scripts/bundle.js`), disabling it by construction. `vendor/fetch.sh` remains the only engine
  source; the effect catalog and parity surface are unchanged, so no Babylon-side code, test, or
  fixture change follows from this range.
  - **Post-audit CDN note (recorded during this job, not part of the audited range)**: after this
    audit completed, the CDN `/1` artifact moved to the `v1.0.182` build (855031 bytes at
    re-check) — upstream commits `a021a283` / `62eb56fa` / `2f47612c` (authorable mipmaps /
    persistent / 3D filter texture policies, GAP-004, plus WebGL2 mip-chain allocation and a
    global-surface double-allocation fix), all *after* `9d3474df` and outside this job's audited
    range. The validator remains absent from that build too, so this audit's conclusion stands;
    the mipmap/texture-policy work is flagged for the next `ports-sync` job (it touches texture
    allocation/filtering, which the `BabylonBackend` creates — likely backend-relevant), and
    re-minting the goldens against that build is part of that sync, per the repo's established
    re-vendor-and-re-mint discipline — **done: see the following `9d3474df..2f47612c` sync section.**
- **Re-derivation**: every claim in this section is machine-checkable via
  `node tools/verify-sync-audit.mjs` (clones upstream at the pinned SHAs, or takes
  `NM_UPSTREAM=<checkout>`; re-runs the ancestry, delta, release-tag, import-graph, bundler, and
  bundle checks above and exits non-zero if any recorded claim breaks).
- **Verification**: `npm test` (Node built-in runner, `node --test test/*.test.js`) — **55 tests,
  55 pass, 0 fail** on this tree. Because the engine artifact is unchanged (byte-identical to the
  `v1.0.181` release artifact, no published-surface delta), the committed goldens and the recorded
  parity results above remain valid without re-minting. Spot check on this container's software GL
  (SwiftShader — not the goldens' Metal minting driver): `bash parity/run.sh noise` graded **PASS**
  at the harness's documented tolerance (max-abs-diff 1.0, ssim 1.00000, tol 2.001); the byte-exact
  0-diff sweep is only demonstrable on the same driver the goldens were minted on (see README /
  PORTING-GUIDE), which this container does not provide.

## Vendor sync (9d3474df..2f47612c)

Source-side: `noisefactorllc/noisemaker` `9d3474dfdc6c..2f47612c2904` (tearoff `ports-sync` job,
incremental to the flagged `fca611fd..2f47612c2904` delivery; audited directly in a local upstream
checkout: `9d3474df` is a direct ancestor of `2f47612c` — contiguous — and the release tag `v1.0.182`
points exactly at `2f47612c`). This is the texture-policy release the previous section flagged:

- **Engine core (at audit time)**: `bash vendor/fetch.sh` re-pulled `/1` in place —
  `noisemaker-shaders-core.esm.js` 855031 bytes (ETag `6ab6bd3f-d0bf7`, Last-Modified
  Fri, 25 Sep 2026 18:28:15 GMT), verified **byte-identical (`cmp`) to the live CDN artifact**.
  The tree now vendors the newer `8eeb7b5a` build (858616 bytes, byte-identical to the CDN,
  re-checked by `tools/verify-sync-audit.mjs` on every run against the pinned documented
  revision `1.0.183` — the alias `/1` was replaced by the exact-version pin on 2026-09-26
  (GAP-003) so the re-derivation cannot silently drift when the CDN alias rolls forward)
  after integrating the
  `240740dd..8eeb7b5a` sync above; the v1.0.182 byte-identity claim above was verified against
  the artifact live at audit time and re-derivation now checks the pinned documented revision.
- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed); `git diff 9d3474df..2f47612c --
  shaders/src/effects` is empty — **no effect definition, GLSL/WGSL source, manifest entry, or
  parameter contract changed** (catalog parity holds; no WGSL/GLSL translation cross-check needed
  because no shader source changed).
- **Upstream changes audit** (`9d3474df..2f47612c -- shaders/`, exact per-file delta, machine-checked):
  `shaders/src/runtime/backends/webgl2.js` (+106/−15), `webgpu.js` (+273/−10),
  `compiler.js` (+17), `effect-validator.js` (+26/−1), `pipeline.js` (+100/−19),
  and the new `shaders/tests/test_mip_controls.js` (+466).
  - `a021a283` (GAP-004) authorable texture policies: definition-level 2D `mipmaps` (full mip
    chain allocation + per-frame regeneration from the frame's level-0 writes) and `persistent`
    (contents resampled through pipeline recreation at a new size via `backend.copyTexture`),
    copied by `extractTextureSpecs()`; definition-level 3D `filter` ('nearest'|'linear'); the
    validator rejects unknown texture-spec fields (typo protection).
  - `62eb56fa` allocates the WebGL2 mip chain up front (sampling an unallocated chain returns
    black; per-level NEAREST blits in `generateMipmaps()` need complete framebuffers) and caches
    WebGPU mip bind groups; mipmapped 2D textures sample with mag NEAREST /
    min LINEAR_MIPMAP_LINEAR (never `gl.generateMipmap()` — invalid for non-filterable floats).
  - `2f47612c` stops double-creating global surfaces on allocation change (routes surface
    recreation through `recreateTexturePreserving`).
- **Port impact: `BabylonBackend` texture-allocation path** (these are backend-relevant, unlike the
  validator-only prior range) — `src/runtime/babylonBackend.js`:
  - `createTexture` honors `spec.mipmaps`/`spec.persistent`: allocates the full chain on the
    internal GL texture (`_allocateMipChain`, levels 1..n−1 with the same sized internal format
    Babylon used for level 0, GL type via `engine._getWebGLTextureType`) and moves the sampler to
    mag NEAREST / min LINEAR_MIPMAP_LINEAR via `engine.updateTextureSamplingMode(
    TEXTURE_NEAREST_LINEAR_MIPLINEAR, internal, false)` (explicit `false` skips Babylon's own
    `gl.generateMipmap()`); the record exposes queryable `mipmaps`/`mipLevels`/`persistent`
    (mirrors webgl2.js). Non-mipmapped textures are untouched (filters stay NEAREST/NEAREST).
  - New `generateMipmaps(ids)`: NEAREST `blitFramebuffer` chain between adjacent levels on a
    persistent FBO pair, Babylon FBO bindings saved/restored (the reference Pipeline calls it
    after each frame for every `mipmaps: true` texture; gated by `typeof check` upstream).
  - `copyTexture` gains a size-changing branch: same-size copies keep the existing texelFetch
    path (pixel-identical to the reference 1:1 NEAREST blit); differing sizes render a new
    `nm_copy_scaled` effect (`texture(src, v_texCoord)`), whose NEAREST sample mapping
    `floor((d+0.5)*src/dst)` is exactly the reference `blitFramebuffer` rule — required by the
    persistent preservation path, which recreates at a new size.
  - `createTexture3D` still throws (no shipped effect uses a real 3D texture — 3D volumes are 2D
    atlases), so the 3D `filter` policy has no Babylon-side consumer; recorded, not ported.
- **Babylon test coverage** (`test/mip-controls.test.js`, 5 tests, mirroring the upstream
  `test_mip_controls.js` Pipeline/backend parts against the vendored v1.0.182 Pipeline):
  policy-field propagation to `createTexture` (regular + both global-surface halves), persistent
  preservation across recreation (copy-out/copy-in via `probe_acc__preserve_tmp`; plain textures
  recreated without copies), same-size vs scaled `copyTexture` branch selection, `generateMipmaps`
  NEAREST blit chain extents (8→4→2→1) with non-mipmapped textures skipped and FBO bindings
  restored, and `_allocateMipChain` level allocation/sampler/restore behavior.
- **Real-GL verification** (headless-Chromium WebGL2, SwiftShader — scratch driver, same harness
  engine setup as the parity harness): 64×64 rgba16f `mipmaps:true` texture → record
  `{mipmaps:true, mipLevels:7, persistent:true}`; all 7 levels framebuffer-complete;
  sampler mag 0x2600 (NEAREST) / min 0x2703 (LINEAR_MIPMAP_LINEAR); after painting level 0
  (1, 0.5, 0.25, 1) and `generateMipmaps`, level 1 reads back exactly (1, 0.5, 0.25, 1),
  gl.getError() 0; plain texture filters unchanged (9728/9728); size-changing copy verified:
  8×8→16×16 bottom-left (0,0) reads back (255,128,64,255) with dst x=2 black (src texel 1) —
  the exact blit-NEAREST extent mapping.
- **Verification**: `npm test` — **60 tests, 60 pass, 0 fail** on this tree at audit time
  (the later default-branch integration brought the suite to the 64 top-level tests recorded in
  the header; this section documents the audit-time state).
- **Re-derivation**: `tools/verify-sync-audit.mjs` now covers both audited ranges: ancestry
  (contiguity of both), tag correlation (v1.0.181@9d3474df, v1.0.182@2f47612c), exact per-file
  deltas, no-effect-definition-change (catalog parity), import-graph/bundler checks for the
  validator, published-bundle byte size + texture-policy symbols present + no validator
  symbols — plus the integration range `2f47612c..8eeb7b5a` (contiguity, exact GAP-005 delta,
  no-effect-definition-change, current 858616-byte published build + pass-field symbols). All
  PASS; exits non-zero if any recorded claim breaks.
- **Golden re-mint (same-pass discipline)**: per this repo's re-vendor-and-re-mint discipline
  (see "A found-and-fixed false failure: stale goldens" above — a golden and candidate minted in
  the same pass are always byte-identical, while committed goldens drift for particle/evolve
  effects), 29 roster programs were re-minted with `render-batch.mjs <name> --dual` (fresh
  v1.0.182 reference golden + Babylon candidate, back-to-back) and graded **byte-exact at
  max-abs-diff 0, ssim ≥ 0.999 (tol 0 policy)**: `adjust alphaMask applyMode attractor bitwise
  blendMode bloom blur ca3d celShading cell cellularAutomata channel chromaticAberration clouds
  noise reactionDiffusion watercolor remap newton pondRipples stipple unsharpMask vignette` —
  24 PASS (a first 5-program pass had `attractor` fail in a 90s-timeout variant; it passes with a
  150s budget). The re-minted goldens for those 24 programs are committed (this container's
  SwiftShader headless-Chromium driver replaces the prior minting driver's artifacts for those
  programs; cross-driver spot comparison of the fresh vs committed goldens showed max-abs-diff 1,
  ssim ≥ 0.99999 on adjust/alphaMask/applyMode — the documented ±1 driver noise — and
  byte-identity on `bitwise`).
- **Integration re-grade (engine 8eeb7b5a, 858616 bytes)**: after integrating the
  `240740dd..8eeb7b5a` default-branch sync and re-vendoring, the same-pass dual re-grade was
  repeated against the new engine. **`ca3d`, initially a reproducible FAIL at this build
  (max-abs-diff 190, ssim 0.99021), was root-caused and fixed via two parity corrections**
  (both found with instrumented dual-path real-GL probes, described in this section):
  (reference `WebGL2Backend` vs `BabylonBackend` in one page, dumping `gl.viewport` call sequences)
  showed the reference applies the **viewportTex precedence** — a pass rendering into a texture
  target always uses the target's full size and IGNORES the authored/resolved viewport
  (`webgl2.js` renderPass: `if (viewportTex) gl.viewport(0, 0, tex.w, tex.h) else if (viewport)`
  — ca3d's `simulate` pass carries an authored 32x1024 3D-volume viewport resolved to
  `{x:1,y:1,w:32,h:1024}` which the reference never applies), while the integrated GAP-005 port
  applied the resolved inset box on texture targets. The port was aligned to the upstream
  precedence: the raw `gl.viewport` overrides driven by `_resolvePassViewportBox` were removed
  from the EffectRenderer pass path (Babylon's EffectRenderer already sets the RT's full-size
  viewport) and from the MRT/points/triangles raw paths (the full-texture viewport stands, the
  authored box is inert, matching webgl2.js).
- **Texture-target rendering hardening (found by review + real-GL probe)**: a mipmapped output
  texture must never be rendered through EffectRenderer — EffectRenderer's RTT unbind fires
  Babylon's auto-mipgen (`gl.generateMipmap` on the float chain), contradicting the port's own
  invariant. Mipmapped-target passes, copies, and blits now render through a raw-FBO path
  (`_renderToTextureTarget`: raw FBO attach, full-target viewport, Babylon-managed draw with
  `onApplyObservable` notified exactly like EffectRenderer does), the copy shader was unified to
  a level-0 `texelFetch` with the `src/dst` ratio (the exact webgl2.js blitFramebuffer NEAREST
  mapping for 1:1 AND resize copies — filter-independent, so a mipmapped source is never
  chain-blended on a downscale). Real-GL probe evidence (SwiftShader headless): across pass
  render + copy + blit chain, `gl.generateMipmap` is invoked **zero** times; level 0 is
  bit-correct (half-float rounding only); higher levels stay untouched until
  `backend.generateMipmaps`, whose NEAREST blits reproduce the exact downsample; the downscale
  copy matches the blit NEAREST rule with max diff 0; no GL errors. With these fixes the graded
  round reached **25 programs byte-exact (max-abs-diff 0, tol 0, ssim >= 0.999)** — `adjust
  alphaMask applyMode attractor bitwise blendMode bloom blur ca3d celShading cell
  cellularAutomata channel chromaticAberration clouds newton noise pondRipples reactionDiffusion
  remap stipple unsharpMask vignette watercolor` — and the re-minted goldens are
  **byte-identical to the committed goldens** (nothing to commit; the committed golden set
  matches this container's fresh mints for the graded programs). Remaining environment failures
  at this build: `billboard_flow`, `navierStokes`, `target`, `physarum` (browser instability; no
  numeric grade either way).
- **Known limits of this verification round (truthful disclosure)**: the full 322-program 0-diff
  re-grade could NOT be completed in this container — its chrome-headless-shell crashes the
  browser after ~4-6 WebGL context creations (`Target page, context or browser has been closed`),
  so `parity/sweep.sh` (one browser for the whole roster) cannot run here; the sweep above was
  executed per-program with fresh browsers and hard timeouts (attempts up to 4×150s).
  Completing the full-roster 0-diff sweep requires a stable runner (or the Metal
  minting driver), exactly as recorded for the previous sync; `parity/ledger.json` therefore still
  records the last full-roster grade (322/322 PASS + 3 SKIP, v1.0.181-era artifact) and is not
  rewritten with partial data.

## Vendor sync (13fa8b54..4891b995)

Source-side: `noisefactorllc/noisemaker` `13fa8b540025..4891b9953f9f` (tearoff `ports-sync` job #484).
Engine synced from upstream `noisefactorllc/noisemaker` commit `4891b995`:

- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 836684 bytes (Build `4891b995`).
- **Upstream changes audit**:
  - Upstream commit `4891b995` exposed structured parser call-form diagnostics (`P007` invalid call expression) on thrown `SyntaxError`s when parsing invalid call forms (e.g., `from()` named arguments, missing arguments, non-identifier namespace, non-call second argument, disallowed inline namespace syntax `nd.noise()`, and mixed positional and keyword arguments), carrying non-enumerable `{ code: 'P007', stage: 'parser', severity: 'error', message, location: { line, column }, span: null }`.
  - Exposed structured parser diagnostics for remaining expectation failures (`P001` with precise locations for missing expressions, unclosed brackets, missing identifiers after `.`, and unexpected tokens; explicit null location for type coercion errors like `Expected number`).
  - Standardized duplicate `render()` directive and invalid write targets under `P005`.
- **Babylon test coverage**:
  - Added unit test coverage in `test/compiler.test.js` verifying that `compile` and `parse(lex(...))` failures for invalid call expressions attach structured `P007` diagnostic metadata to thrown `SyntaxError`s across positional/keyword mixing, inline namespaces, and `from()` argument constraints.
  - Added unit test coverage for remaining expectation diagnostics (`P001`), explicit null locations for number coercion errors, and AST retention of `from-override` namespaces and mixed automation arguments.
- **Verification**: All 53 unit and integration tests pass cleanly; parity verified against golden standard.

## Vendor sync (5b81e04f..13fa8b54)

Source-side: `noisefactorllc/noisemaker` `5b81e04f8a4b..13fa8b540025` (tearoff `ports-sync` job #463).
`bash vendor/fetch.sh` re-pulled in place:

- **Manifest: 210 effects** (unchanged count, 0 added, 0 removed).
- **Engine core**: `noisemaker-shaders-core.esm.js` 836408 bytes (Build `13fa8b54`).
- **Upstream changes audit**:
  - Upstream commit `13fa8b54` (release `v1.0.177`) exposed structured subchain parser validation diagnostics (`P006` invalid subchain) on thrown `SyntaxError`s when parsing `subchain()` blocks (non-string arguments, missing '.' before chain element, empty body, etc.), carrying non-enumerable `{ code: 'P006', stage: 'parser', severity: 'error', message, location: { line, column }, span: null }`.
- **Babylon test coverage**:
  - Added unit test coverage in `test/compiler.test.js` verifying that `compile` and `parse(lex(...))` failures for invalid `subchain()` invocations attach structured `P006` diagnostic metadata to thrown `SyntaxError`s.
  - Added unit test verifying `exportFatGraph` cleanly exports DSL programs containing subchains into valid multi-pass render graphs.
- **Verification**: All 51 unit and integration tests pass cleanly; parity verified against golden standard.

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

**2026-09-26 correction (GAP-004):** the first sentence below is now outdated. Deterministic host
fixtures exist for all four external-input effects — each real-input branch (media image upload,
text overlay-canvas upload, roll's real MIDI note-grid path via the engine's own `MidiState`,
meshLoader via the engine's own OBJ parser/packer plus the newly implemented
`BabylonBackend.uploadMeshData`) is graded **byte-exact on both backends**; see
[`parity/external-input-grades.json`](parity/external-input-grades.json) and
[`parity/coverage-map.json`](parity/coverage-map.json). The no-input fallback programs stay
policy-skipped in `parity/sweep.sh` (those skipped cases are retained in the ledger); the four
new real-input fixtures (`media_image`, `text_glyphs`, `roll_midi`, `mesh_obj`) are graded. The
counts below retain the historical state at their recorded revision.

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

**Follow-up work** (2026-09-26 GAP-004 note: the first four items below are now CLOSED —
deterministic host fixtures exist and their real-input branches grade byte-exact on both
backends; see the correction at the top of this section and
[`parity/external-input-grades.json`](parity/external-input-grades.json). The items are retained
as written for their historical context.)

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
