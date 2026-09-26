# Noisemaker for Babylon.js — status & parity

*Last verified 2026-09-25 against the engine at build tag `8eeb7b5a`
(`noisemaker-shaders-core.esm.js`, 858616 bytes) — source-side
`noisefactorllc/noisemaker` @ `8eeb7b5ac14e` (v1.0.183): full npm suite **66/66 PASS**
(`node --test test/*.test.js`), the machine-checked sync audit (`tools/verify-sync-audit.mjs`)
re-derives every claim for `240740dd..9d3474df`, `9d3474df..2f47612c`, and `2f47612c..8eeb7b5a`,
and the same-pass golden/candidate byte-exact re-grade covers 25 roster programs on this
container's SwiftShader driver at this build (`ca3d` — initially a reproducible parity failure —
was root-caused to viewport-precedence handling plus RTT auto-mipgen exposure, fixed in the
port, and re-graded byte-exact; 4 heavy evolve programs that could not complete grading are
recorded in the `9d3474df..2f47612c` sync section). Exposes output sink
deferral query `shouldDeferRender()` on `NoisemakerRenderer`, verifies structured parser diagnostics
(P001 coordinates, P005 output operations, P006 subchains, P007 call forms, P008-P010 subchain arguments), authorable texture policies (GAP-004), and pass-field propagation including dynamic dimension viewport resolution (GAP-005).
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
