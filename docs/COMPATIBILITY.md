# noisemaker-for-babylonjs: compatibility report

## 1. Source and authority revisions

Daily review: 2026-09-25. Current inspected source: [`8a39787a7c3564c4a331047e727a7b372d68c16b`](https://github.com/noisefactorllc/noisemaker-for-babylonjs/commit/8a39787a7c3564c4a331047e727a7b372d68c16b).
Full rendered parity remains **unverified**. No release approval or new closure follows from this review.
Current upstream discovery: `bbdeb56c4b75cf33379766c3e87b0f5a18bcbba8`. Published Noisemaker authority: `1.0.179`, source `fca611fd8f91424661d4e531d39313d24ea21134`, 210 effect IDs.
The observations below retain their original source and authority identities. They do not qualify later updates.
Current served kit: `0.1.11`, source `9ad880e779c361fc6846399520e244d74ba2a935` (all 15 served files sha256-verified against `kits.noisedeck.app/babylonjs/0/kit.json`, 2026-09-27; adapter and page template byte-identical to the current tree — see [GAP-006](COMPLETION_GAPS.md)). [Earlier inventory](https://kits.noisedeck.app/babylonjs/0/deployment-meta.json). Artifact identity does not establish host qualification by itself; the qualified matrix is in [section 2](#2-host-and-distribution-matrix).

### Earlier source observations

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
| Export integration: published kit `0.1.11` (source `9ad880e7`) | qualified | All 15 served files sha256-verified against `kits.noisedeck.app/babylonjs/0/kit.json`; the adapter and page template are byte-identical to the current tree; the assembled user artifact (kit bytes + pinned CDN engine min bundle `dc417b14…`, 418861 bytes + a freshly compiled README-program fatgraph) reaches status `running`, renders a non-uniform canvas, zero page errors; a boot failure (engine import 404) un-hides the `role="alert"` error region with status `failed`; the page's interactive surface is empty (view-only, no keyboard traps). |

## 3. Parity coverage

### Daily review, 2026-09-25

53 unit tests pass, but importing the compiler from the packed distribution still fails with ERR_MODULE_NOT_FOUND for tools/export-fat-graph.mjs. The package contains 12 files. GAP-001 remains open. Current full rendered parity is stale and unverified. [Raw evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/babylon-installed-compiler.json).

The current full case denominator remains incomplete. Missing parameters, hosts, external inputs, and stateful sequences remain qualification gaps. No skip or tolerated difference counts as exact parity.

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

| Effect ID | Served declaration | Current full parity |
|---|---|---|
| `classicNoisedeck/bitEffects` | all | unverified |
| `classicNoisedeck/caustic` | all | unverified |
| `classicNoisedeck/cellNoise` | all | unverified |
| `classicNoisedeck/cellRefract` | all | unverified |
| `classicNoisedeck/coalesce` | all | unverified |
| `classicNoisedeck/colorLab` | all | unverified |
| `classicNoisedeck/composite` | all | unverified |
| `classicNoisedeck/effects` | all | unverified |
| `classicNoisedeck/fractal` | all | unverified |
| `classicNoisedeck/glitch` | all | unverified |
| `classicNoisedeck/kaleido` | all | unverified |
| `classicNoisedeck/lensDistortion` | all | unverified |
| `classicNoisedeck/moodscape` | all | unverified |
| `classicNoisedeck/noise` | all | unverified |
| `classicNoisedeck/noise3d` | all | unverified |
| `classicNoisedeck/refract` | all | unverified |
| `classicNoisedeck/shapeMixer` | all | unverified |
| `classicNoisedeck/shapes` | all | unverified |
| `classicNoisedeck/shapes3d` | all | unverified |
| `classicNoisedeck/splat` | all | unverified |
| `filter/adjust` | all | unverified |
| `filter/bloom` | all | unverified |
| `filter/blur` | all | unverified |
| `filter/bulge` | all | unverified |
| `filter/celShading` | all | unverified |
| `filter/channel` | all | unverified |
| `filter/chroma` | all | unverified |
| `filter/chromaticAberration` | all | unverified |
| `filter/chrome` | all | unverified |
| `filter/clouds` | all | unverified |
| `filter/colorReplace` | all | unverified |
| `filter/convolutionFeedback` | all | unverified |
| `filter/corrupt` | all | unverified |
| `filter/craquelure` | all | unverified |
| `filter/crt` | all | unverified |
| `filter/degauss` | all | unverified |
| `filter/deriv` | all | unverified |
| `filter/directionalBlur` | all | unverified |
| `filter/dither` | all | unverified |
| `filter/edge` | all | unverified |
| `filter/emboss` | all | unverified |
| `filter/extrude` | all | unverified |
| `filter/feedback` | all | unverified |
| `filter/fibers` | all | unverified |
| `filter/flipMirror` | all | unverified |
| `filter/fxaa` | all | unverified |
| `filter/glowingEdge` | all | unverified |
| `filter/glyphMap` | all | unverified |
| `filter/grade` | all | unverified |
| `filter/grain` | all | unverified |
| `filter/grime` | all | unverified |
| `filter/halftone` | all | unverified |
| `filter/hatch` | all | unverified |
| `filter/highPass` | all | unverified |
| `filter/historicPalette` | all | unverified |
| `filter/invert` | all | unverified |
| `filter/lens` | all | unverified |
| `filter/lensFlare` | all | unverified |
| `filter/lensWarp` | all | unverified |
| `filter/lightLeak` | all | unverified |
| `filter/lighting` | all | unverified |
| `filter/lowPoly` | all | unverified |
| `filter/median` | all | unverified |
| `filter/morphology` | all | unverified |
| `filter/mosaicTiles` | all | unverified |
| `filter/motionBlur` | all | unverified |
| `filter/normalMap` | all | unverified |
| `filter/normalize` | all | unverified |
| `filter/octaveWarp` | all | unverified |
| `filter/oilPaint` | all | unverified |
| `filter/osd` | all | unverified |
| `filter/outline` | all | unverified |
| `filter/palette` | all | unverified |
| `filter/parallax` | all | unverified |
| `filter/patchwork` | all | unverified |
| `filter/photocopy` | all | unverified |
| `filter/pinch` | all | unverified |
| `filter/pixelSort` | all | unverified |
| `filter/pixels` | all | unverified |
| `filter/plasticWrap` | all | unverified |
| `filter/polar` | all | unverified |
| `filter/pondRipples` | all | unverified |
| `filter/posterize` | all | unverified |
| `filter/prismaticAberration` | all | unverified |
| `filter/reindex` | all | unverified |
| `filter/relief` | all | unverified |
| `filter/repeat` | all | unverified |
| `filter/reverb` | all | unverified |
| `filter/ridge` | all | unverified |
| `filter/rotate` | all | unverified |
| `filter/scale` | all | unverified |
| `filter/scanlineError` | all | unverified |
| `filter/scatter` | all | unverified |
| `filter/scratches` | all | unverified |
| `filter/scroll` | all | unverified |
| `filter/seamless` | all | unverified |
| `filter/sharpen` | all | unverified |
| `filter/simpleAberration` | all | unverified |
| `filter/sine` | all | unverified |
| `filter/skew` | all | unverified |
| `filter/smooth` | all | unverified |
| `filter/smoothstep` | all | unverified |
| `filter/snow` | all | unverified |
| `filter/sobel` | all | unverified |
| `filter/spatter` | all | unverified |
| `filter/spinBlur` | all | unverified |
| `filter/spiral` | all | unverified |
| `filter/spookyTicker` | all | unverified |
| `filter/stamp` | all | unverified |
| `filter/step` | all | unverified |
| `filter/stipple` | all | unverified |
| `filter/strayHair` | all | unverified |
| `filter/strokes` | all | unverified |
| `filter/temporalAberration` | all | unverified |
| `filter/tetraColorArray` | all | unverified |
| `filter/tetraCosine` | all | unverified |
| `filter/text` | all | unverified |
| `filter/texture` | all | unverified |
| `filter/threshold` | all | unverified |
| `filter/tile` | all | unverified |
| `filter/tint` | all | unverified |
| `filter/translate` | all | unverified |
| `filter/tunnel` | all | unverified |
| `filter/unsharpMask` | all | unverified |
| `filter/vaseline` | all | unverified |
| `filter/vignette` | all | unverified |
| `filter/warp` | all | unverified |
| `filter/watercolor` | all | unverified |
| `filter/waves` | all | unverified |
| `filter/wind` | all | unverified |
| `filter/wobble` | all | unverified |
| `filter/wormhole` | all | unverified |
| `filter/zoomBlur` | all | unverified |
| `filter3d/flow3d` | all | unverified |
| `filter3d/palette3d` | all | unverified |
| `mixer/alphaMask` | all | unverified |
| `mixer/applyMode` | all | unverified |
| `mixer/blendMode` | all | unverified |
| `mixer/cellSplit` | all | unverified |
| `mixer/centerMask` | all | unverified |
| `mixer/channelCombine` | all | unverified |
| `mixer/distortion` | all | unverified |
| `mixer/focusBlur` | all | unverified |
| `mixer/mashup` | all | unverified |
| `mixer/patternMix` | all | unverified |
| `mixer/shadow` | all | unverified |
| `mixer/shapeMask` | all | unverified |
| `mixer/split` | all | unverified |
| `mixer/thresholdMix` | all | unverified |
| `mixer/uvRemap` | all | unverified |
| `points/attractor` | all | unverified |
| `points/buddhabrot` | all | unverified |
| `points/dla` | all | unverified |
| `points/flock` | all | unverified |
| `points/flow` | all | unverified |
| `points/heightGrid` | all | unverified |
| `points/hydraulic` | all | unverified |
| `points/lenia` | all | unverified |
| `points/life` | all | unverified |
| `points/physarum` | all | unverified |
| `points/physical` | all | unverified |
| `render/loopBegin` | all | unverified |
| `render/loopEnd` | all | unverified |
| `render/meshLoader` | all | unverified |
| `render/meshRender` | all | unverified |
| `render/pointsBillboardRender` | all | unverified |
| `render/pointsEmit` | all | unverified |
| `render/pointsRender` | all | unverified |
| `render/render3d` | all | unverified |
| `render/renderCubemap3d` | all | unverified |
| `render/renderCubemapSurface` | all | unverified |
| `render/renderLandscape3d` | all | unverified |
| `render/renderLit3d` | all | unverified |
| `synth/bitwise` | all | unverified |
| `synth/cell` | all | unverified |
| `synth/cellularAutomata` | all | unverified |
| `synth/curl` | all | unverified |
| `synth/gabor` | all | unverified |
| `synth/gradient` | all | unverified |
| `synth/julia` | all | unverified |
| `synth/mandala` | all | unverified |
| `synth/mandelbrot` | all | unverified |
| `synth/media` | all | unverified |
| `synth/mnca` | all | unverified |
| `synth/modPattern` | all | unverified |
| `synth/navierStokes` | all | unverified |
| `synth/newton` | all | unverified |
| `synth/noise` | all | unverified |
| `synth/osc2d` | all | unverified |
| `synth/pattern` | all | unverified |
| `synth/perlin` | all | unverified |
| `synth/polygon` | all | unverified |
| `synth/reactionDiffusion` | all | unverified |
| `synth/remap` | all | unverified |
| `synth/roll` | all | unverified |
| `synth/sacredGeometry` | all | unverified |
| `synth/scope` | all | unverified |
| `synth/shape` | all | unverified |
| `synth/solid` | all | unverified |
| `synth/spectrum` | all | unverified |
| `synth/subdivide` | all | unverified |
| `synth/testPattern` | all | unverified |
| `synth3d/cell3d` | all | unverified |
| `synth3d/cellularAutomata3d` | all | unverified |
| `synth3d/flythrough3d` | all | unverified |
| `synth3d/fractal3d` | all | unverified |
| `synth3d/heightmap3d` | all | unverified |
| `synth3d/noise3d` | all | unverified |
| `synth3d/reactionDiffusion3d` | all | unverified |
| `synth3d/shape3d` | all | unverified |

## 4. Evidence

Review CI boundary: No workflow run exists at the inspected source SHA. A passing export dispatch does not qualify rendered parity. Current complete-render enforcement remains an open verification requirement. [Exact-source responses and workflows](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/noisemaker-for-babylonjs-remote-evidence.json).

[Earlier audit and review evidence](COMPLETION_GAPS.md#3-methods-and-evidence). [Exact-source Actions](https://github.com/noisefactorllc/noisemaker-for-babylonjs/actions?query=head_sha%3Ae6aa0732ff7962f4a3ce044384581dbc75b632a1).
[This run evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/evidence-20260924-remaining-gap-documents) retains commands, exit codes, source identities, and distribution metadata.
Official host references and historical environment limits remain in the linked gap register.
Source CI, export dispatch, artifact delivery, and rendered parity are separate evidence dimensions.
A successful dispatch or unit-test summary does not establish a full rendered gate.

## 5. Open compatibility limits

The GAP-006 bounded check below is now executed: `npm pack` → empty-consumer install →
compiler import → Babylon render → kit notices (`GAP-002`) → supported Babylon range
(`GAP-006`, closed 2026-09-27 with the matrix in [section 2](#2-host-and-distribution-matrix)).

See the stable entries in [completion gaps](COMPLETION_GAPS.md).

See [GAP-001 and the complete gap register](COMPLETION_GAPS.md#4-known-gaps) for evidence, dependencies, and acceptance criteria.

1. Reconcile the current authority and complete case inventory, including parameters, inputs, stateful frames, and host versions.
2. Run the existing actual-renderer suite without skip options. Record every missing, failed, refused, or timed-out case.
3. Verify installation, useful output, errors, recovery, upgrades, and removal with the actual distribution.
4. Inspect exact-source CI and retain artifact hashes. Keep unresolved qualification failed or unverified.

All eligible ports have equal priority. Full parity and zero skipped cases remain the goal.
Implementation corrections remain with the separate job. This report does not advance the parity checkpoint.

## 6. History

2026-09-25 daily review at `8a39787a7c3564c4a331047e727a7b372d68c16b`: source freshness and bounded evidence reviewed. Open qualification limits retained. [Retained review evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/babylon-installed-compiler.json). No new closure claimed.

| Date | Source | Result | Change |
|---|---|---|---|
| 2026-09-24 | `e6aa0732ff7962f4a3ce044384581dbc75b632a1` | Full qualification unverified | Created the requested maintained compatibility report. Preserved historical evidence and open gaps. |

Run: `20260924-remaining-gap-documents`. Later audits and reviews update this report with source-bound results.
