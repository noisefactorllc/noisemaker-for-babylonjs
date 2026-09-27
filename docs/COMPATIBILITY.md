# noisemaker-for-babylonjs: compatibility report

## 1. Source and authority revisions

Audit date: 2026-09-27. Run: `audit-20260927-182000`.
Current inspected source: [`b44f41eb9d12621d31906698e9984bb5e623518d`](https://github.com/noisefactorllc/noisemaker-for-babylonjs/commit/b44f41eb9d12621d31906698e9984bb5e623518d).
At audit time, before this documentation commit, local and remote `main` both equaled this SHA. The checkout was clean.
Roster parity is verified at this source within its measured scope. Full parity stays open: the `media`, `roll`, and `text` fallback programs remain policy-skipped. See [section 3](#3-parity-coverage). This is not a release approval.
Upstream authority: `noisefactorllc/noisemaker` at `296e0138c4744ed485b2e95de3eeb466c17629ee`, release `v1.0.196`. The manifest holds 210 effect IDs.
Vendored engine pin: `1.0.193`, build `12b4d74f`, 884620-byte core. The published `1.0.196` core equals the vendored core after stripping the two banner lines.
CPU authority: `noisefactorllc/noisemaker-for-cpu` at `b61b658399f18b5a93abd0020c02fff3be9630f5`.
Current served kit: `0.1.11`, source `9ad880e779c361fc6846399520e244d74ba2a935`.
All 15 served files matched their published sha256 values and byte counts on 2026-09-27.
The adapter, template, and license files are byte-identical to the current tree. One exception: the kit's `adapter/src/compiler/index.js` overlay differs from the tree's `src/compiler/index.js` by design (A6).
Artifact identity alone does not establish host qualification. The qualified matrix is in [section 2](#2-host-and-distribution-matrix).

### Daily review, 2026-09-27

Review run: `review-20260927-210000`. The reviewed source is `8cca4bf`, a document-only delta over `b44f41eb`.
The review re-verified the audit evidence. Section 4 records the review commands and results.
Upstream advanced to `04e8582c` after the audit. That commit changes `LEDGER.md` and `llms-full.txt` only.
Release `v1.0.196` stays current. The engine bytes are unchanged.
The CPU authority head advanced to `f0ccebef`. The audit-time record above stays `b61b6583`. That update belongs to the CPU review.

### Earlier source observations

Daily review: 2026-09-25. Inspected source: [`8a39787a7c3564c4a331047e727a7b372d68c16b`](https://github.com/noisefactorllc/noisemaker-for-babylonjs/commit/8a39787a7c3564c4a331047e727a7b372d68c16b).
Full rendered parity was unverified at that revision. The upstream discovery then was `bbdeb56c4b75cf33379766c3e87b0f5a18bcbba8`, authority `1.0.179` at `fca611fd8f91424661d4e531d39313d24ea21134`.

Report date: 2026-09-24. Source inspected: [`e6aa0732ff7962f4a3ce044384581dbc75b632a1`](https://github.com/noisefactorllc/noisemaker-for-babylonjs/commit/e6aa0732ff7962f4a3ce044384581dbc75b632a1).
Full rendered parity at this SHA: **unverified**. This is not a release approval.
A later documentation-only commit does not change this tested source identity.
Any runtime, package, or authority update requires fresh evidence before this report can qualify it.

Babylon.js WebGL2 adapter for textures and export kits. [Source contract](https://github.com/noisefactorllc/noisemaker-for-babylonjs/blob/e6aa0732ff7962f4a3ce044384581dbc75b632a1/README.md).

Historical tested authority revisions remain in the linked gap register. They are not relabeled as current qualification.
Current upstream discovery SHA: `c9ee8a049b2b63cd300da67c01ee40baf29dc288`.
Published authority: `1.0.176`, source `c9ee8a049b2b63cd300da67c01ee40baf29dc288`.
[Immutable published manifest](https://shaders.noisedeck.app/1.0.176/effects/manifest.json) contains 210 effect IDs.
Its SHA-256 is `05c4d7b7744837ae90a3bb4c89e5403ff09448a74d9d7e824abb3d719ad3314e`.
These IDs do not define complete parameter, state, input, or platform coverage.

Served kit `0.1.5` records `e6aa0732ff7962f4a3ce044384581dbc75b632a1`. [Source metadata](https://kits.noisedeck.app/babylonjs/0/deployment-meta.json).
Historical measurements remain bound to their original revisions in [completion gaps](COMPLETION_GAPS.md).

## 2. Host and distribution matrix

The supported matrix below is defined and qualified by the recorded GAP-006 run
(2026-09-27, `test/qualification.test.js` + the recorded exported-artifact check in the
[gap register](COMPLETION_GAPS.md)). Each qualified cell passed installation, first output,
host integration, lifecycle teardown/rebuild, and removal, against the packed tarball
installed into an empty consumer. A cell not listed as qualified is unqualified — it is
neither supported nor tested.

| Cell | Status | Evidence |
|---|---|---|
| Babylon.js floor `9.13.0` (peer range `^9.13.0`) | qualified | Install from the packed tarball into an empty consumer, all three advertised entry points import, the documented program compiles through the installed compiler, renders a visibly non-uniform Babylon texture in headless Chromium, `dispose()` releases the stable output texture (GL-level deletion verified), teardown + rebuild renders again, uninstall clean. |
| Babylon.js current 9.x (`9.28.0`, latest published at run time; the peer range admits `9.13.0`–`9.28.0`) | qualified | Same cell checks after an in-place peer upgrade (`npm install @babylonjs/core@^9.13.0`) with the port kept installed — first output, resource cleanup, teardown + rebuild. A new Babylon major fails this check by design (a `major === 9` assertion) and needs fresh qualification. |
| Browser: desktop Chromium 149.0.7827.55, Linux, headless, WebGL2 over SwiftShader/ANGLE | qualified | The driver for every recorded cell above. |
| Browser: real-GPU Chromium, Firefox, Safari; macOS/Windows/mobile platforms | unqualified | Not executable in the automation harness; no claim is made. |
| Lifecycle: WebGL context loss + restoration in a real browser | unqualified in-browser, qualified by unit suite | `WEBGL_lose_context` restore events are not delivered by this headless SwiftShader driver (recorded: `webglcontextlost` fires, `webglcontextrestored` never does, across repeated runs). The renderer's loss/restore lifecycle is qualified by the deterministic unit suite (`test/renderer-sinks.test.js`: context loss tears down, restoration rebuilds, resize survives restore, stale initializations are abandoned), which runs in CI. |
| Export integration: published kit `0.1.11` (source `9ad880e7`) | qualified | All 15 served files sha256-verified on 2026-09-27 against `kits.noisedeck.app/babylonjs/0/kit.json`. Adapter, template, and license files are byte-identical to the current tree. One exception: the kit's compiler overlay `adapter/src/compiler/index.js` differs by design (A6). The assembled user artifact used the kit bytes plus the pinned engine min bundle `dc417b14…` (418861 bytes) and a fresh README fatgraph. It reached status `running` with zero page errors. The canvas crop held 88,647 distinct colors. The error region stayed hidden with `role="alert"` while running. A boot failure (engine import 404) un-hides it with status `failed`. See GAP-006. The interactive surface is empty. The page is view-only. No keyboard traps exist. |
| Distribution: npm registry | verified (absent) | `npm view noisemaker-for-babylonjs` returns E404 (2026-09-27). No npm release exists. The README documents install from git until publication. Git-based installation is untested in this harness. |

## 3. Parity coverage

### Current measurement, 2026-09-27

The roster render suite ran at the exact source through CI run `36337051664`. All eleven jobs finished success.
The gate mints each golden and its candidate in the same browser session. The rule is tolerance 0 and SSIM at least 0.999.

| Gate | Expected cases | Executed | Strict passes | Failures | Skips | Status |
|---|---|---|---|---|---|---|
| Roster render suite at `b44f41e` | 329 | 329 | 326 | 0 | 3 | verified |

Roster parity is verified. Full parity stays open because the three fallback programs are policy-skipped.
Scope of the verified status:
- Every roster program graded in one exact-SHA run. The roster is 332 committed DSL fixtures minus the 3 retired `bc`/`hs`/`colorspace` programs.
- The 3 skips are the documented `media`, `roll`, `text` no-input fallback programs. Their real-input fixture programs are separate roster entries and passed.
- The 101-row mode matrix is part of the roster. The four real-input fixtures are part of the roster.
- Parameter coverage is representative, not Cartesian. 257 choice-bearing parameters across 132 effects define the schema surface.
- The corpus is not part of this gate. Its fresh re-grade stays open. See GAP-008 in the [gap register](COMPLETION_GAPS.md#4-known-gaps).
Local probes `noise`, `blur`, `bloom` also passed at max-abs-diff 0 against committed goldens.
The retained `parity/ledger.json` artifact still records the 325-program v1.0.181-era grade: 322 PASS, 3 SKIP, 0 FAIL.

### Historical review, 2026-09-25

53 unit tests passed, but importing the compiler from the packed distribution still failed then. GAP-001 was open at that revision. Current full rendered parity was stale and unverified. [Raw evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/babylon-installed-compiler.json).

### Earlier measurements

Full parity requires complete applicable coverage with no skips or missing cases.
Historical NEAR, CHAOS, and tolerated differences do not count as strict equality.
The existing numerical contracts remain separate from exact comparison. This report does not change tolerances or goldens.
Unknown values mean `not measured`, never zero.

| Gate | Expected cases | Executed | Strict passes | Failures | Skips | Status |
|---|---|---|---|---|---|---|
| Current full render suite | not measured | not measured | not measured | not measured | not measured | unverified |

The served compatibility manifest declares mode `all`. That declaration covers the authority catalog but does not prove behavior.
No missing ID conclusion follows without reconciling fixture behavior and the source contract.
Missing effects remain visible toward the full-parity goal. Contract exclusions do not become successful tests.

### Effect inventory

Each `verified` row means: the effect has graded fixture evidence at the current source, inside the exact-SHA sweep.
It does not mean every parameter value is tested. Parameter coverage is representative, not Cartesian.

| Effect ID | Served declaration | Graded fixture evidence |
|---|---|---|
| `classicNoisedeck/bitEffects` | all | verified |
| `classicNoisedeck/caustic` | all | verified |
| `classicNoisedeck/cellNoise` | all | verified |
| `classicNoisedeck/cellRefract` | all | verified |
| `classicNoisedeck/coalesce` | all | verified |
| `classicNoisedeck/colorLab` | all | verified |
| `classicNoisedeck/composite` | all | verified |
| `classicNoisedeck/effects` | all | verified |
| `classicNoisedeck/fractal` | all | verified |
| `classicNoisedeck/glitch` | all | verified |
| `classicNoisedeck/kaleido` | all | verified |
| `classicNoisedeck/lensDistortion` | all | verified |
| `classicNoisedeck/moodscape` | all | verified |
| `classicNoisedeck/noise` | all | verified |
| `classicNoisedeck/noise3d` | all | verified |
| `classicNoisedeck/refract` | all | verified |
| `classicNoisedeck/shapeMixer` | all | verified |
| `classicNoisedeck/shapes` | all | verified |
| `classicNoisedeck/shapes3d` | all | verified |
| `classicNoisedeck/splat` | all | verified |
| `filter/adjust` | all | verified |
| `filter/bloom` | all | verified |
| `filter/blur` | all | verified |
| `filter/bulge` | all | verified |
| `filter/celShading` | all | verified |
| `filter/channel` | all | verified |
| `filter/chroma` | all | verified |
| `filter/chromaticAberration` | all | verified |
| `filter/chrome` | all | verified |
| `filter/clouds` | all | verified |
| `filter/colorReplace` | all | verified |
| `filter/convolutionFeedback` | all | verified |
| `filter/corrupt` | all | verified |
| `filter/craquelure` | all | verified |
| `filter/crt` | all | verified |
| `filter/degauss` | all | verified |
| `filter/deriv` | all | verified |
| `filter/directionalBlur` | all | verified |
| `filter/dither` | all | verified |
| `filter/edge` | all | verified |
| `filter/emboss` | all | verified |
| `filter/extrude` | all | verified |
| `filter/feedback` | all | verified |
| `filter/fibers` | all | verified |
| `filter/flipMirror` | all | verified |
| `filter/fxaa` | all | verified |
| `filter/glowingEdge` | all | verified |
| `filter/glyphMap` | all | verified |
| `filter/grade` | all | verified |
| `filter/grain` | all | verified |
| `filter/grime` | all | verified |
| `filter/halftone` | all | verified |
| `filter/hatch` | all | verified |
| `filter/highPass` | all | verified |
| `filter/historicPalette` | all | verified |
| `filter/invert` | all | verified |
| `filter/lens` | all | verified |
| `filter/lensFlare` | all | verified |
| `filter/lensWarp` | all | verified |
| `filter/lightLeak` | all | verified |
| `filter/lighting` | all | verified |
| `filter/lowPoly` | all | verified |
| `filter/median` | all | verified |
| `filter/morphology` | all | verified |
| `filter/mosaicTiles` | all | verified |
| `filter/motionBlur` | all | verified |
| `filter/normalMap` | all | verified |
| `filter/normalize` | all | verified |
| `filter/octaveWarp` | all | verified |
| `filter/oilPaint` | all | verified |
| `filter/osd` | all | verified |
| `filter/outline` | all | verified |
| `filter/palette` | all | verified |
| `filter/parallax` | all | verified |
| `filter/patchwork` | all | verified |
| `filter/photocopy` | all | verified |
| `filter/pinch` | all | verified |
| `filter/pixelSort` | all | verified |
| `filter/pixels` | all | verified |
| `filter/plasticWrap` | all | verified |
| `filter/polar` | all | verified |
| `filter/pondRipples` | all | verified |
| `filter/posterize` | all | verified |
| `filter/prismaticAberration` | all | verified |
| `filter/reindex` | all | verified |
| `filter/relief` | all | verified |
| `filter/repeat` | all | verified |
| `filter/reverb` | all | verified |
| `filter/ridge` | all | verified |
| `filter/rotate` | all | verified |
| `filter/scale` | all | verified |
| `filter/scanlineError` | all | verified |
| `filter/scatter` | all | verified |
| `filter/scratches` | all | verified |
| `filter/scroll` | all | verified |
| `filter/seamless` | all | verified |
| `filter/sharpen` | all | verified |
| `filter/simpleAberration` | all | verified |
| `filter/sine` | all | verified |
| `filter/skew` | all | verified |
| `filter/smooth` | all | verified |
| `filter/smoothstep` | all | verified |
| `filter/snow` | all | verified |
| `filter/sobel` | all | verified |
| `filter/spatter` | all | verified |
| `filter/spinBlur` | all | verified |
| `filter/spiral` | all | verified |
| `filter/spookyTicker` | all | verified |
| `filter/stamp` | all | verified |
| `filter/step` | all | verified |
| `filter/stipple` | all | verified |
| `filter/strayHair` | all | verified |
| `filter/strokes` | all | verified |
| `filter/temporalAberration` | all | verified |
| `filter/tetraColorArray` | all | verified |
| `filter/tetraCosine` | all | verified |
| `filter/text` | all | verified |
| `filter/texture` | all | verified |
| `filter/threshold` | all | verified |
| `filter/tile` | all | verified |
| `filter/tint` | all | verified |
| `filter/translate` | all | verified |
| `filter/tunnel` | all | verified |
| `filter/unsharpMask` | all | verified |
| `filter/vaseline` | all | verified |
| `filter/vignette` | all | verified |
| `filter/warp` | all | verified |
| `filter/watercolor` | all | verified |
| `filter/waves` | all | verified |
| `filter/wind` | all | verified |
| `filter/wobble` | all | verified |
| `filter/wormhole` | all | verified |
| `filter/zoomBlur` | all | verified |
| `filter3d/flow3d` | all | verified |
| `filter3d/palette3d` | all | verified |
| `mixer/alphaMask` | all | verified |
| `mixer/applyMode` | all | verified |
| `mixer/blendMode` | all | verified |
| `mixer/cellSplit` | all | verified |
| `mixer/centerMask` | all | verified |
| `mixer/channelCombine` | all | verified |
| `mixer/distortion` | all | verified |
| `mixer/focusBlur` | all | verified |
| `mixer/mashup` | all | verified |
| `mixer/patternMix` | all | verified |
| `mixer/shadow` | all | verified |
| `mixer/shapeMask` | all | verified |
| `mixer/split` | all | verified |
| `mixer/thresholdMix` | all | verified |
| `mixer/uvRemap` | all | verified |
| `points/attractor` | all | verified |
| `points/buddhabrot` | all | verified |
| `points/dla` | all | verified |
| `points/flock` | all | verified |
| `points/flow` | all | verified |
| `points/heightGrid` | all | verified |
| `points/hydraulic` | all | verified |
| `points/lenia` | all | verified |
| `points/life` | all | verified |
| `points/physarum` | all | verified |
| `points/physical` | all | verified |
| `render/loopBegin` | all | verified |
| `render/loopEnd` | all | verified |
| `render/meshLoader` | all | verified |
| `render/meshRender` | all | verified |
| `render/pointsBillboardRender` | all | verified |
| `render/pointsEmit` | all | verified |
| `render/pointsRender` | all | verified |
| `render/render3d` | all | verified |
| `render/renderCubemap3d` | all | verified |
| `render/renderCubemapSurface` | all | verified |
| `render/renderLandscape3d` | all | verified |
| `render/renderLit3d` | all | verified |
| `synth/bitwise` | all | verified |
| `synth/cell` | all | verified |
| `synth/cellularAutomata` | all | verified |
| `synth/curl` | all | verified |
| `synth/gabor` | all | verified |
| `synth/gradient` | all | verified |
| `synth/julia` | all | verified |
| `synth/mandala` | all | verified |
| `synth/mandelbrot` | all | verified |
| `synth/media` | all | verified |
| `synth/mnca` | all | verified |
| `synth/modPattern` | all | verified |
| `synth/navierStokes` | all | verified |
| `synth/newton` | all | verified |
| `synth/noise` | all | verified |
| `synth/osc2d` | all | verified |
| `synth/pattern` | all | verified |
| `synth/perlin` | all | verified |
| `synth/polygon` | all | verified |
| `synth/reactionDiffusion` | all | verified |
| `synth/remap` | all | verified |
| `synth/roll` | all | verified |
| `synth/sacredGeometry` | all | verified |
| `synth/scope` | all | verified |
| `synth/shape` | all | verified |
| `synth/solid` | all | verified |
| `synth/spectrum` | all | verified |
| `synth/subdivide` | all | verified |
| `synth/testPattern` | all | verified |
| `synth3d/cell3d` | all | verified |
| `synth3d/cellularAutomata3d` | all | verified |
| `synth3d/flythrough3d` | all | verified |
| `synth3d/fractal3d` | all | verified |
| `synth3d/heightmap3d` | all | verified |
| `synth3d/noise3d` | all | verified |
| `synth3d/reactionDiffusion3d` | all | verified |
| `synth3d/shape3d` | all | verified |

## 4. Evidence

### Current evidence, 2026-09-27

Exact-SHA CI: run `36337051664` at `b44f41e`, all eleven jobs success.
The jobs cover the installed package and distribution contents, the public host workflow, eight strict-parity shards, and the merged coverage gate. The suite job recorded 97/97 tests and re-derived the sync audit.
Downloaded artifacts: suite log, host logs, and the merged ledger (329 programs, 326 PASS, 3 SKIP, 0 FAIL).
Provenance records bind each artifact to the SHA and the run id.
Local commands and exits A1 to A10 are in the [gap register](COMPLETION_GAPS.md#3-methods-and-evidence).
Evidence directory: `/series/evidence-audit-20260927-182000`.

### Review verification, 2026-09-27

Run `36337051664` at `b44f41eb` and run `36341707000` at `8cca4bf` both finished success.
The merged ledger artifact holds 329 rows: 326 PASS, 3 SKIP, 0 FAIL. The skip programs are `media`, `roll`, and `text`. Worst max-abs-diff is 0.
All 15 served kit files re-verified byte for byte. The adapter, template, license, and overlay files equal the tree bytes.
The suite re-ran in a fresh container: 97 tests, 97 pass, 0 fail.
Two fetches of the pin resolved identical core and engine hashes.
The review commands and results are rows R1 to R9 in the [gap register](COMPLETION_GAPS.md#3-methods-and-evidence).

### Historical CI boundary, 2026-09-25

No workflow run existed at the then-inspected source SHA. [Exact-source responses and workflows](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/noisemaker-for-babylonjs-remote-evidence.json). Superseded by the current evidence above.

[Earlier audit and review evidence](COMPLETION_GAPS.md#3-methods-and-evidence). [Exact-source Actions](https://github.com/noisefactorllc/noisemaker-for-babylonjs/actions?query=head_sha%3Ae6aa0732ff7962f4a3ce044384581dbc75b632a1).
[This run evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/evidence-20260924-remaining-gap-documents) retains commands, exit codes, source identities, and distribution metadata.
Official host references and historical environment limits remain in the linked gap register.
Source CI, export dispatch, artifact delivery, and rendered parity are separate evidence dimensions.
A successful dispatch or unit-test summary does not establish a full rendered gate.

## 5. Open compatibility limits

Stable entries with evidence, dependencies, and acceptance criteria live in the [gap register](COMPLETION_GAPS.md#4-known-gaps).

1. Fresh corpus re-grade: open. See GAP-008. The historical 40-composition grade stays retained. A 2026-09-26 refetch found 20/20 compositions compileable. No fresh grade ran.
2. Real-GPU Chromium, Firefox, Safari, macOS, Windows, mobile: unqualified. This harness has no such hosts.
3. In-browser context restoration: unqualified on the headless SwiftShader driver. The unit suite covers the loss and restore lifecycle.
4. npm publication: no release exists. Registry E404. Git-based installation is untested.
5. Cross-driver byte equality: same-pass minting is the enforced gate. Committed goldens can drift by 1 LSB across drivers.

All eligible ports have equal priority. Full parity and zero skipped cases remain the goal.
Implementation corrections remain with the separate job. This report does not advance the parity checkpoint.

## 6. History

2026-09-25 daily review at `8a39787a7c3564c4a331047e727a7b372d68c16b`: source freshness and bounded evidence reviewed. Open qualification limits retained. [Retained review evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/babylon-installed-compiler.json). No new closure claimed.

| Date | Source | Result | Change |
|---|---|---|---|
| 2026-09-24 | `e6aa0732ff7962f4a3ce044384581dbc75b632a1` | Full qualification unverified | Created the requested maintained compatibility report. Preserved historical evidence and open gaps. |
| 2026-09-27 | `b44f41eb9d12621d31906698e9984bb5e623518d` | Roster parity verified in measured scope. 329 graded, 326 strict passes, 3 policy skips, 0 failures. Full parity stays open until the skips close. Exact-SHA CI run `36337051664`. | Updated sections 1, 3, 4, and 5 to the current source. Effect rows now carry fixture-bound verified status with a scope note. Kit `0.1.11` re-verified byte for byte. GAP-008 opened in the gap register. |
| 2026-09-27 | `8cca4bfbbab64cb4bf537b5dc9478587129ca885` | Review verified the audit evidence. Roster parity stands: 329 graded, 326 strict passes, 3 policy skips, 0 failures. | Added the review verification block and the upstream advance record. No matrix cell changed. |

Run: `20260924-remaining-gap-documents`. Later audits and reviews update this report with source-bound results.
