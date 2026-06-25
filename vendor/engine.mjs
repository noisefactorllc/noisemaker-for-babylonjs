// engine.mjs — load the FETCHED published Noisemaker engine in Node (build-time).
//
// The engine bundle + per-effect mini-bundles are fetched from shaders.noisedeck.app by
// vendor/fetch.sh into vendor/noisemaker/ (GITIGNORED — never committed, like node_modules).
// This loader + the fetch script are the only committed pieces. The bundle is browser-oriented
// (defines a custom element at module scope), so Node needs a tiny DOM shim before evaluating it.
// We then load the per-effect mini-bundles exactly as production does (pre-fetch each effect),
// registering every one — each carries its GLSL inline, so the compiled graph already has shader
// source attached (no separate GLSL files to read).
//
// Browser code (the parity harness, examples) imports `Pipeline` straight from the core ESM —
// the fat graph already embeds GLSL, so the browser never touches the mini-bundles.

import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const VENDOR = join(HERE, 'noisemaker')
const CORE = join(VENDOR, 'noisemaker-shaders-core.esm.js')
const EFFECTS = join(VENDOR, 'effects')

// Minimal DOM shim: the bundle declares `class EffectSelect extends HTMLElement` (a UI custom
// element) at top level. We never use it from Node; the stubs just let the module evaluate.
function installDomShim () {
  globalThis.HTMLElement = globalThis.HTMLElement || class {}
  globalThis.customElements = globalThis.customElements || { define () {}, get () {}, whenDefined () { return Promise.resolve() } }
  globalThis.window = globalThis.window || globalThis
  globalThis.document = globalThis.document || {
    createElement () { return { style: {}, getContext () { return null }, appendChild () {}, setAttribute () {} } },
    createElementNS () { return { style: {} } },
    head: { appendChild () {} }, body: { appendChild () {} }
  }
}

let _booted = null

// Boot the engine: evaluate the core bundle, register every fetched effect mini-bundle, and
// return the low-level API the build tools use. Cached (the registry is process-global).
export async function bootEngine () {
  if (_booted) return _booted
  if (!existsSync(CORE)) {
    throw new Error(`Vendored engine missing at ${CORE}.\nRun: bash vendor/fetch.sh   (fetches the published engine from shaders.noisedeck.app)`)
  }
  installDomShim()

  const core = await import(pathToFileURL(CORE).href)
  const {
    compileGraph, Pipeline, WebGL2Backend, Backend, Effect, getEffect,
    registerEffect, registerOp, registerStarterOps, mergeIntoEnums, stdEnums, sanitizeEnumName
  } = core

  if (mergeIntoEnums && stdEnums) await mergeIntoEnums(stdEnums)
  if (registerStarterOps) registerStarterOps()

  const manifest = JSON.parse(readFileSync(join(EFFECTS, 'manifest.json'), 'utf8'))
  const allChoices = {}

  for (const id of Object.keys(manifest)) {
    const [ns, eff] = id.split('/')
    let mod
    try {
      mod = await import(pathToFileURL(join(EFFECTS, ns, `${eff}.js`)).href)
    } catch (err) {
      process.stderr.write(`[engine] skip ${id}: ${err?.message || err}\n`)
      continue
    }
    let instance = mod.default
    if (!instance) continue
    // Some mini-bundles (classicNoisedeck/*, media, meshLoader) export a CLASS, not an instance.
    // Instantiate it and carry the STATIC shaders onto the instance — otherwise globals/passes/GLSL
    // are absent and the effect registers as an empty shell (→ S001 "unknown argument" / S005
    // "illegal chain" / empty graph). Plain-object bundles (e.g. synth/*) pass through unchanged.
    if (typeof instance === 'function') {
      const Cls = instance
      try {
        instance = new Cls()
        if (Cls.shaders && !instance.shaders) instance.shaders = Cls.shaders
      } catch (err) {
        process.stderr.write(`[engine] skip ${id}: class instantiation failed: ${err?.message || err}\n`)
        continue
      }
    }
    if (!instance.namespace) instance.namespace = ns
    const func = instance.func || eff

    // Same registration the reference's canvas.js does at load time (4 aliases + op + starter +
    // enums). The mini-bundle already carries GLSL in instance.shaders, so nothing else to attach.
    registerEffect(func, instance)
    registerEffect(`${ns}.${func}`, instance)
    registerEffect(`${ns}/${eff}`, instance)
    registerEffect(`${ns}.${eff}`, instance)

    const args = Object.entries(instance.globals || {}).map(([key, spec]) => {
      let enumPath = spec.enum || spec.enumPath
      if (spec.choices && !enumPath) {
        enumPath = `${ns}.${func}.${key}`
        allChoices[ns] = allChoices[ns] || {}
        allChoices[ns][func] = allChoices[ns][func] || {}
        allChoices[ns][func][key] = allChoices[ns][func][key] || {}
        for (const [nm, val] of Object.entries(spec.choices)) {
          if (typeof nm === 'string' && nm.endsWith(':')) continue
          allChoices[ns][func][key][nm] = { type: 'Number', value: val }
          const san = sanitizeEnumName ? sanitizeEnumName(nm) : nm
          if (san && san !== nm) allChoices[ns][func][key][san] = { type: 'Number', value: val }
        }
      }
      return {
        name: key, type: spec.type === 'vec4' ? 'color' : spec.type, default: spec.default,
        enum: enumPath, enumPath, min: spec.min, max: spec.max, uniform: spec.uniform, choices: spec.choices
      }
    })
    if (registerOp) registerOp(`${ns}.${func}`, { name: func, args })

    const isStarter = !((instance.passes || []).some(p =>
      p.inputs && Object.values(p.inputs).some(v =>
        ['inputTex', 'inputTex3d', 'src', 'o0', 'o1'].includes(v))))
    if (isStarter && registerStarterOps) registerStarterOps([`${ns}.${func}`])
    if (instance.enums && mergeIntoEnums) await mergeIntoEnums(instance.enums)
  }

  if (mergeIntoEnums && Object.keys(allChoices).length) await mergeIntoEnums(allChoices)

  _booted = { compileGraph, Pipeline, WebGL2Backend, Backend, Effect, getEffect }
  return _booted
}
