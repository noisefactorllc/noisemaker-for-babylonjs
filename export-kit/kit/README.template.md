# {{NM_PROGRAM_NAME}}

Your program as a Babylon.js render graph, exported from Noisedeck. It runs on **Noisemaker for
Babylon.js** — a `BabylonBackend` that satisfies the Noisemaker engine's `Backend` interface, so the
unchanged engine pipeline draws through `@babylonjs/core`. It fetches nothing at runtime.

## Run it

Serve the folder with any static server. From this directory:

```
python3 -m http.server 8000
```

Open <http://localhost:8000/>. No backend, no build step, no npm.

Chrome and Firefox refuse ES modules over `file://`, so double-clicking `index.html` will not work
there. Safari does load them, and that case is why the compiled graph is inlined in the page: Safari
would still block a `fetch()` of the sidecar file, so a page that only read `program.fatgraph.json`
would come up empty. Serve the folder. The inline copy is what makes the double-click work where the
browser allows it.

## What's inside

| Path | What it is |
| --- | --- |
| `index.html` | The page. Your compiled graph is inlined at the top of its module script. |
| `program.fatgraph.json` | The same compiled graph as a standalone file, for your own host page. |
| `adapter/src/` | Noisemaker for Babylon.js — `NoisemakerRenderer` and `BabylonBackend`. |
| `vendor/noisemaker/` | The Noisemaker engine `{{NM_ENGINE_VERSION}}`. Present if you kept **include engine code** checked. |
| `hostlib/babylon/` | `@babylonjs/core` 9.13.0, bundled to one ESM file. Same checkbox. |
| `program.dsl` | Your program's source, exactly as Noisedeck had it. |
| `noisedeck-export.json` | What was exported, when, against which engine build. |
| `shaders/` | The GLSL behind each effect you used. Present if you kept **include shader code** checked. |
| `LICENSES/` | Licenses for everything shipped here. |

## The compiled graph

Babylon.js exports work differently from the other web kits. Instead of shipping the DSL and
compiling it in the browser, Noisedeck compiles your program up front and ships the result: a **fat
graph** — the pass list, the textures, and every program with its GLSL source inline.

That is what keeps this export small. The page needs the engine's `Pipeline` class and nothing else:
no effect manifest, no per-effect bundles, no compiler.

The graph rides two ways, and they are the same bytes:

- inlined in `index.html` as `const FAT = …`, so the page is self-contained;
- as `program.fatgraph.json`, which is what to load from your own host page. `index.html` falls back
  to it if the inline copy is ever absent.

`program.dsl` still ships alongside, because that is the thing you edit — see below.

## Dropping it into your own scene

```js
import { Pipeline } from './vendor/noisemaker/noisemaker-shaders-core.esm.min.js'
import { NoisemakerRenderer } from './adapter/src/runtime/renderer.js'

const nm = new NoisemakerRenderer(engine, { Pipeline, size: 512 })
await nm.loadGraph(await (await fetch('./program.fatgraph.json')).json())

engine.runRenderLoop(() => {
  nm.renderFrame(t)          // t is normalized 0..1 over the loop
  scene.render()
})
```

`nm.outputTexture` is a stable `ThinTexture` of the latest frame, and `nm.outputInternalTexture` the
raw `InternalTexture` to hang on a `StandardMaterial`:

```js
const tex = new Texture(null, scene)
tex._texture = nm.outputInternalTexture
material.emissiveTexture = tex
```

`index.html` takes the simplest route: it draws `nm.outputTexture` to the canvas with a Babylon
`EffectRenderer` fullscreen quad, with no scene and no camera.

The renderer is **square** — `size` is a single number — so the page keeps a 1:1 canvas rather than
stretching the render across a wide window.

## The engine

Left **include engine code** checked? Everything's here: the engine at `vendor/noisemaker/`,
`@babylonjs/core` at `hostlib/babylon/`. Open the page and it runs offline.

Unchecked? Copy your engine to `vendor/noisemaker/` and `@babylonjs/core` to `hostlib/babylon/`, or
point the page at your copies. The page reads one engine path, near the top of the
`<script type="module">` block:

```js
const ENGINE_URL = './vendor/noisemaker/noisemaker-shaders-core.esm.min.js';
```

Unlike the other adapters, this one never imports the engine itself. The host passes the reference
`Pipeline` class in (`new NoisemakerRenderer(engine, { Pipeline, size })`), which is the seam that
lets one adapter run against any pinned engine build.

`@babylonjs/core` is pinned to **9.13.0**, the version the adapter is parity-tested against. It is
bundled into a single ESM file, and the page's import map points the six deep specifiers the adapter
uses at that one file. Two of the six:

```html
<script type="importmap">
{
  "imports": {
    "@babylonjs/core/Engines/engine.js": "./hostlib/babylon/babylon.esm.js",
    "@babylonjs/core/Maths/math.color.js": "./hostlib/babylon/babylon.esm.js"
  }
}
</script>
```

The adapter's peer range is `^9.13.0`, so a newer 9.x will very likely work; rebundle
`hostlib/babylon/babylon.esm.js` from it and leave the map alone.

`adapter/src/compiler/index.js` is deliberately a stub that throws. Upstream it re-exports a Node
tool that reads effect sources off the filesystem, which cannot run in a browser — and this export
does not need it, because the graph is already compiled.

This export is pinned to Noisemaker `{{NM_ENGINE_VERSION}}`. Pinning is deliberate: the page keeps
rendering the same way after the engine moves on.

## Editing it

The fat graph is compiled output, so editing it by hand is not the path. To change the program, edit
`program.dsl`, paste it back into Noisedeck, and export again. Noisedeck recompiles the graph.

Playback loops every 15 seconds (`LOOP_SECONDS`). The canvas resizes with the window, capped at
`MAX_SIZE` (1024) and at 2x device pixel ratio.

If the program fails to start the page says so on screen and puts the full error in the console.

## Effects used by this program

{{NM_EFFECT_LIST}}

## Browser support

WebGL2 runs in every current desktop and mobile browser. Heavy programs, and anything using 3D or
particles, want a discrete GPU for a smooth frame rate.

## License

The Noisemaker engine and the Babylon.js adapter are both MIT licensed; see `LICENSES/`. Babylon.js
itself is Apache-2.0 and ships in `hostlib/babylon/`. Your program and the imagery it renders are
yours.
