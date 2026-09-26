#!/usr/bin/env node
// coverage-map.mjs — build the GAP-004 coverage map: bind every catalogued effect branch and
// representative developer workflow to explicit, source-bound acceptance evidence or an explicit
// exclusion (GAP-004 acceptance: "every claimed branch has source-bound evidence or an explicit
// exclusion. Counts retain skipped and refused cases.").
//
//   node tools/coverage-map.mjs [parity/coverage-map.json]   # writes JSON, human summary on stderr
//
// Sources (all in-repo, re-derived on every run — nothing is trusted from prose):
//   - vendor/noisemaker/effects/manifest.json + per-effect mini-bundles (the vendored authority)
//   - parity/programs/*.dsl compiled via tools/export-fat-graph.mjs (effect → fixture programs)
//   - parity/ledger.json (graded fixture status incl. policy-skipped rows)
//   - parity/mode-coverage.json (the (effect, mode) matrix)
//   - parity/external-input-grades.json (real-input fixture grades recorded with full commands)
//   - parity/render-batch.mjs EVOLVE map (stateful-sequence programs, parsed from source)

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// The four external-input effects, classified from the vendored definitions' host-input
// contracts:
//   media  (synth)   externalTexture: 'imageTex'  — host image/video/canvas upload
//   text   (filter)  externalTexture: 'textTex'   — host glyph/overlay canvas upload
//   roll   (synth)   consumes the engine's MIDI note-grid data texture (uploadDataTexture
//                    'midiNoteGrid' every frame — the external MIDI event stream)
//   meshLoader (render) consumes the global mesh0 position/normal surfaces the host OBJ
//                    loader fills (engine's own parseOBJ/pack path via CanvasRenderer)
// test/coverage-map.test.js re-derives the declarative half (externalTexture) from the vendored
// definitions and asserts this table covers every such def; roll/meshLoader have no declarative
// external marker — they are pinned by their data-texture/mesh-surface consumption contract.
const EXTERNAL_INPUT = new Map([
  ['synth/media', 'media'],
  ['filter/text', 'text'],
  ['synth/roll', 'midi'],
  ['render/meshLoader', 'mesh']
])
const REAL_INPUT_FIXTURE = { media: 'media_image', text: 'text_glyphs', midi: 'roll_midi', mesh: 'mesh_obj' }

export async function buildCoverageMap ({ log = () => {} } = {}) {
  const meta = JSON.parse(readFileSync(join(ROOT, 'vendor', 'noisemaker', 'engine-meta.json'), 'utf8'))
  const manifest = JSON.parse(readFileSync(join(ROOT, 'vendor', 'noisemaker', 'effects', 'manifest.json'), 'utf8'))
  const ledger = JSON.parse(readFileSync(join(ROOT, 'parity', 'ledger.json'), 'utf8'))
  const modeCoverage = JSON.parse(readFileSync(join(ROOT, 'parity', 'mode-coverage.json'), 'utf8'))
  const { EXTERNAL_FIXTURES } = await import(pathToFileURL(join(ROOT, 'parity', 'render-candidate.mjs')).href)
  const extGrades = JSON.parse(readFileSync(join(ROOT, 'parity', 'external-input-grades.json'), 'utf8'))
  const { exportFatGraph } = await import(pathToFileURL(join(ROOT, 'tools', 'export-fat-graph.mjs')).href)

  const ledgerByProgram = new Map(ledger.map(r => [r.program, r]))

  // --- fixture programs: compile every committed DSL program and collect its effects --
  const PROGRAMS_DIR = join(ROOT, 'parity', 'programs')
  const dslNames = readdirSync(PROGRAMS_DIR).filter(f => f.endsWith('.dsl') && !f.startsWith('corpus_')).map(f => f.slice(0, -4)).sort()
  const effectsToPrograms = new Map() // effectId -> Set(programName)
  const programEffects = new Map() // programName -> [effectId]
  for (const name of dslNames) {
    const dsl = readFileSync(join(PROGRAMS_DIR, `${name}.dsl`), 'utf8')
    let fat
    try {
      fat = await exportFatGraph(dsl)
    } catch (e) {
      // retired fixtures (bc/hs/colorspace) no longer compile against the current catalog; they
      // are absent from the manifest too, so they cannot contribute evidence.
      log(`[coverage-map] WARN: cannot compile ${name}: ${String(e?.message || e).split('\n')[0]}`)
      continue
    }
    const ids = new Set()
    for (const pass of fat.passes) {
      if (pass.effectNamespace && pass.effectFunc) ids.add(`${pass.effectNamespace}/${pass.effectFunc}`)
    }
    programEffects.set(name, [...ids])
    for (const id of ids) {
      if (!effectsToPrograms.has(id)) effectsToPrograms.set(id, new Set())
      effectsToPrograms.get(id).add(name)
    }
  }

  // --- parameter-interaction surface (schema counts; explicitly not Cartesian) -------
  let params = 0; let choiceEffects = 0; let choices = 0
  const dirBase = join(ROOT, 'vendor', 'noisemaker', 'effects')
  for (const id of Object.keys(manifest)) {
    const [ns, dir] = id.split('/')
    const src = readFileSync(join(dirBase, ns, `${dir}.js`), 'utf8')
    // choice maps are emitted as `choices:{a:0,b:1,...}` in the bundled defs
    const matches = src.matchAll(/choices:\{([^{}]*)\}/g)
    let effectChoices = 0; let effectParams = 0
    for (const m of matches) {
      const n = (m[1].match(/[A-Za-z0-9_]+:/g) || []).length
      if (n > 0) { effectParams++; effectChoices += n }
    }
    if (effectParams > 0) {
      choiceEffects++; params += effectParams; choices += effectChoices
    }
  }

  // --- stateful-sequence programs (EVOLVE map in render-batch.mjs) -------------------
  const batchSrc = readFileSync(join(ROOT, 'parity', 'render-batch.mjs'), 'utf8')
  const evolveBlock = batchSrc.match(/const EVOLVE = \{([\s\S]*?)\n\}/)[1]
  const evolvePrograms = [...evolveBlock.matchAll(/([A-Za-z0-9_]+): _EVO/g)].map(m => m[1])

  // --- assemble ----------------------------------------------------------------------
  const modeByProgram = new Map(modeCoverage.map(r => [r.program, r]))

  const effects = []
  for (const id of Object.keys(manifest)) {
    const row = { id }
    const progs = [...(effectsToPrograms.get(id) || [])].sort()
    row.fixturePrograms = progs.map(name => {
      const l = ledgerByProgram.get(name)
      return {
        program: name,
        ledger: l ? { status: l.status, maxAbsDiff: l.max_abs_diff ?? null } : null
      }
    })
    row.modeFixtures = progs.filter(n => modeByProgram.has(n)).length
    const kind = EXTERNAL_INPUT.get(id) || null
    row.externalInput = kind
    if (kind) {
      const kindFixture = REAL_INPUT_FIXTURE[kind]
      const grade = extGrades.grades[kindFixture]
      if (!grade) throw new Error(`coverage-map: no recorded grade for real-input fixture ${kindFixture} (${id})`)
      if (!(programEffects.get(kindFixture) || []).includes(id)) {
        throw new Error(`coverage-map: real-input fixture ${kindFixture} does not exercise ${id}`)
      }
      row.realInputFixture = {
        program: kindFixture,
        recorded: { date: grade.date, maxAbsDiff: grade.maxAbsDiff, ssim: grade.ssim, command: grade.command }
      }
      row.fallbackPolicySkipped = progs.filter(n => !modeByProgram.has(n) && ledgerByProgram.get(n)?.status === 'SKIP')
    }
    const graded = row.fixturePrograms.filter(p => p.ledger && (p.ledger.status === 'PASS' || p.ledger.status === 'SKIP'))
    if (graded.length === 0 && !kind) {
      row.exclusion = {
        branch: 'default render',
        reason: 'no committed parity fixture exercises this effect; covered only inside uncommitted local compositions, if at all',
        requiredFixture: 'a DSL fixture program graded through parity/sweep.sh'
      }
    }
    effects.push(row)
  }

  const counts = {
    effects: Object.keys(manifest).length,
    effectsWithFixtureEvidence: effects.filter(e => e.fixturePrograms.length > 0 && !e.exclusion).length,
    effectsExplicitlyExcluded: effects.filter(e => e.exclusion).length,
    externalInput: {
      total: effects.filter(e => e.externalInput).length,
      realInputFixtured: effects.filter(e => e.externalInput && e.realInputFixture && e.realInputFixture.recorded).length,
      fallbackPolicySkippedRetained: ledger.filter(r => r.status === 'SKIP').length
    },
    ledger: {
      programs: ledger.length,
      PASS: ledger.filter(r => r.status === 'PASS').length,
      SKIP: ledger.filter(r => r.status === 'SKIP').length,
      FAIL: ledger.filter(r => r.status === 'FAIL').length
    },
    modeMatrix: { rows: modeCoverage.length, byteExact: modeCoverage.filter(r => r.passed).length },
    parameterInteractions: {
      choiceBearingParams: params,
      choiceBearingEffects: choiceEffects,
      namedChoices: choices,
      rule: 'representative (effect, mode) fixtures + default-program parity only; the full parameter-interaction Cartesian product is explicitly NOT tested (see the exclusion in docs/COMPLETION_GAPS.md GAP-004)'
    },
    statefulSequences: {
      evolvePrograms: [...new Set(evolvePrograms)].sort(),
      evolveFrames: 1800,
      corpus: extGrades.corpus
    },
    engine: { version: meta.version, build: meta.coreBuild, coreBytes: meta.coreBytes, effectCount: meta.effectCount },
    engineCaveat: 'ledger.json full-roster grades were recorded against the 1.0.181-era artifact; later sync sections (STATUS.md) carry the per-build re-verification status. The 1.0.181→1.0.185 ranges changed no effect definitions (0 added/0 removed; tools/verify-sync-audit.mjs re-derives).'
  }

  return {
    _comment: 'Generated by node tools/coverage-map.mjs — GAP-004 acceptance map: every catalogued effect branch bound to fixture evidence (parity/ledger.json, parity/mode-coverage.json, parity/external-input-grades.json) or an explicit exclusion. Counts retain skipped and refused cases. Re-derived by node tools/coverage-map.mjs (workflows copied verbatim from parity/external-input-grades.json). Record note: the 2026-09-26 GAP-007 reconciliation clarified one recorded-run evidence string identically in this file and in parity/external-input-grades.json, so this file remains byte-consistent with a fresh regeneration; no measured value, count, grade, or engine record was hand-altered.',
    engine: counts.engine,
    engineCaveat: counts.engineCaveat,
    effects,
    counts,
    workflows: extGrades.workflows
  }
}

if (process.argv[1] && process.argv[1].endsWith('coverage-map.mjs')) {
  buildCoverageMap({ log: (m) => process.stderr.write(m + '\n') }).then(map => {
    const out = process.argv[2] && process.argv[2] !== '--stdout' ? process.argv[2] : join(ROOT, 'parity', 'coverage-map.json')
    writeFileSync(out, JSON.stringify(map, null, 2) + '\n')
    const c = map.counts
    process.stderr.write(`[coverage-map] effects: ${c.effects}, with fixture evidence: ${c.effectsWithFixtureEvidence}, explicitly excluded: ${c.effectsExplicitlyExcluded}\n`)
    process.stderr.write(`[coverage-map] external-input: ${JSON.stringify(c.externalInput)}\n`)
    process.stderr.write(`[coverage-map] ledger: ${JSON.stringify(c.ledger)}; mode matrix: ${c.modeMatrix.rows}\n`)
    process.stderr.write(`[coverage-map] choice surface: ${c.parameterInteractions.choiceBearingParams} params / ${c.parameterInteractions.choiceBearingEffects} effects / ${c.parameterInteractions.namedChoices} choices\n`)
    const missing = map.effects.filter(e => e.exclusion).map(e => e.id)
    process.stderr.write(`[coverage-map] excluded effect branches: ${missing.length ? missing.join(' ') : '(none)'}\n`)
  }).catch(e => { process.stderr.write(`[coverage-map] FAILED: ${e?.stack || e}\n`); process.exit(1) })
}
