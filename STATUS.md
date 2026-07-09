# noisemaker-babylon — status & parity

*Last verified 2026-07-09. The sources of truth are `parity/sweep.sh`, `parity/corpus/sweep.sh`, and
`tools/catalog.mjs`.*

This file holds the detailed coverage and parity numbers. For what the project is and how to use it,
see the [README](README.md).

## Coverage

**185 catalogued effects** (`tools/catalog.mjs`); **181 are byte-identical** to the reference, and 4
are not byte-verified because they need a live external input.

| Group | What's in it | State |
|---|---|---|
| 2D effects | noise, filters, mixers, classic generators (150) | byte-identical |
| Agent / points sims | physarum, life, flock, dla, lenia, … (10) | byte-identical |
| Continuous solvers | `reactionDiffusion`, `navierStokes` | byte-identical (evolved) |
| 3D-volume raymarch | 7 `synth3d` generators × `render3d` / `renderLit3d` (isosurface + voxel), `flow3d`, `palette3d` | byte-identical |
| Cubemaps | `renderCubemapSurface`, `renderCubemap3d` — single-face + 6-face bake | byte-identical (all 6 faces) |
| Wrappers & routing | SMRTicles (`pointsEmit` / `pointsRender` / `pointsBillboardRender`), `loopBegin` / `loopEnd`, `wormhole`, `remap` (std140 UBO) | byte-identical |
| External-input | `media`, `text`, `roll`, `meshLoader` | not byte-verified (see Known limits) |

## Parity

- **Whole catalog (single-frame, `parity/sweep.sh`):** 181/185 byte-identical (max-abs-diff 0).
  Because the candidate renders on the **same WebGL2 / ANGLE / Metal driver** as the golden, the
  match is exact — **no effect needs the relaxed tolerances** the Metal-backed Unity / Godot / TD
  ports required.
- **Stateful / continuous / agent effects** converge to a **bit-identical steady state** when
  evolved ~30 s. (The single-frame sweep defers the continuous Gray–Scott solver
  `reactionDiffusion`, which amplifies sub-ULP differences over its iteration loop; it is verified
  via the evolved path, not the single frame.)
- **End-to-end:** the complex emergent test program — 3D perlin → 1M-agent flow-field particles
  (MRT + points + billboards) → blur → `navierStokes` ×40 → palette / lighting / adjust / bloom /
  lens / vignette — is byte-identical at every 5 s sample over 30 s.
- **Live NoiseBLASTER! corpus (`parity/corpus/`):** 19 real shared compositions fetched from
  `blaster.noisedeck.app` — **19/19 byte-identical**.

Goldens and candidates both render through the **same vendored engine** — the reference
`WebGL2Backend` mints the goldens (`NM_GOLDEN=1`), the `BabylonBackend` renders the candidates — so
this is a true same-engine diff, not a cross-implementation comparison.

## Known limits

Four of the 185 catalogued effects are **not** byte-verified. Each needs a runtime input the headless
parity harness can't supply deterministically — these are the only gaps in the catalog.

| Effect | Namespace | External input it needs |
|---|---|---|
| `media`      | `synth`  | a host-supplied image/video texture |
| `text`       | `filter` | rasterized glyphs (a font / glyph atlas) |
| `roll`       | `synth`  | a MIDI / piano-roll event stream |
| `meshLoader` | `render` | host-side OBJ geometry (vertex / index buffers) |

**Follow-up work**

- **`media`** — upload host media into a surface and sample it. Expected to need **no new backend
  code** (it's a plain texture read), once a deterministic image source is wired into the harness.
- **`text`** — supply a glyph-atlas texture (e.g. rasterized via Canvas2D) as the input surface; it
  then runs as a standard input filter.
- **`roll`** — route host MIDI events into the effect's uniforms / input surface.
- **`meshLoader`** — parse OBJ → populate the mesh surfaces. **The triangle-raster path it feeds is
  already proven byte-identical**: `render/meshRender` (`drawMode:'triangles'`, depth-test +
  back-face cull + `gl_VertexID` geometry fetch, Blinn–Phong-lit) renders at max-abs-diff 0 when
  identical geometry (a sphere) is *injected* into both engines. Only the host OBJ-load →
  mesh-surface step is unvetted, and it needs no new raster work — just verification of the
  parse/upload against the reference.
- **Standalone package.** The port consumes the published engine at build/test time via
  `vendor/fetch.sh` (gitignored — the `node_modules` posture). Packaging `noisemaker-babylon` itself
  as a distributable npm module (that fetches the engine on install) is open.
- **Large unpublished reference delta.** The reference source tree (sibling `noisemaker` checkout)
  is ~63 shader commits ahead of what's published to `shaders.noisedeck.app/1` (through reference
  commit `b7c1bc36`, vs. the currently vendored core build `29725b18`) — roughly 21 new filters
  (`parallax` is the only one of these published so far; `unsharpMask`, `highPass`, `median`,
  `morphology`, `directionalBlur`, `spinBlur`, `scatter`, `wind`, `pondRipples`, `extrude`,
  `halftone`, `stipple`, `oilPaint`, `watercolor`, `plasticWrap`, `relief`, `photocopy`, `stamp`,
  `chrome`, `hatch` are not) plus assorted effect extensions and engine fixes. This port is
  **published-CDN-only by design** (`vendor/fetch.sh` never reads the sibling checkout — see
  ARCHITECTURE.md), so this gap can't be bridged from here; it closes automatically the next time
  those commits are published to `/1` and `vendor/fetch.sh` is re-run.

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
- **The two genuinely-new backend pieces.** Everything else reuses the existing path; only the mesh
  `drawMode:'triangles'` raster (depth buffer + back-face cull + `gl_VertexID` geometry fetch) and
  the std140 UBO upload above are new.
- **The one load-bearing engine quirk.** The additive particle deposit must use raw
  `blendFunc(ONE, ONE)`; Babylon's `setAlphaMode(ALPHA_ADD)` is `(SRC_ALPHA, ONE)`, which crushes the
  HDR trail accumulation. See [PORTING-GUIDE.md](PORTING-GUIDE.md).
