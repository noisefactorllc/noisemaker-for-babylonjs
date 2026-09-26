// GAP-004 acceptance gate: the coverage map is re-derived from the vendored engine + committed
// fixtures and every acceptance rule is asserted, not trusted from prose.
//
// GAP-004 acceptance: "every claimed branch has source-bound evidence or an explicit exclusion.
// Counts retain skipped and refused cases."
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { buildCoverageMap } from '../tools/coverage-map.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('GAP-004 coverage map: every catalogued effect has fixture evidence or an explicit exclusion', async () => {
  const map = await buildCoverageMap()
  const manifest = JSON.parse(readFileSync(join(ROOT, 'vendor', 'noisemaker', 'effects', 'manifest.json'), 'utf8'))

  assert.equal(map.effects.length, Object.keys(manifest).length)
  assert.deepEqual(new Set(map.effects.map(e => e.id)), new Set(Object.keys(manifest)))
  for (const row of map.effects) {
    if (row.exclusion) {
      assert.ok(row.exclusion.reason && row.exclusion.requiredFixture, `${row.id}: exclusion must state reason + required fixture`)
    } else {
      assert.ok(row.fixturePrograms.length > 0, `${row.id}: no fixture programs and no exclusion`)
      assert.ok(row.fixturePrograms.some(p => p.ledger && (p.ledger.status === 'PASS' || p.ledger.status === 'SKIP')), `${row.id}: no graded fixture (PASS/SKIP) binds it to the ledger`)
    }
  }
  // the map's own counts must agree with its rows
  assert.equal(map.counts.effects, map.effects.length)
  assert.equal(map.counts.effectsExplicitlyExcluded, map.effects.filter(e => e.exclusion).length)
})

test('GAP-004 coverage map: external-input branches carry real-input fixtures, and skipped cases are retained', async () => {
  const map = await buildCoverageMap()
  const ledger = JSON.parse(readFileSync(join(ROOT, 'parity', 'ledger.json'), 'utf8'))
  const skips = ledger.filter(r => r.status === 'SKIP')

  // every external-input effect has a recorded real-input fixture grade
  const withInput = map.effects.filter(e => e.externalInput)
  assert.equal(withInput.length, 4)
  for (const row of withInput) {
    assert.ok(row.realInputFixture, `${row.id}: no real-input fixture`)
    assert.equal(row.realInputFixture.recorded.maxAbsDiff, 0, `${row.id}: real-input grade must be byte-exact`)
    assert.match(row.realInputFixture.recorded.command, /compare\.py/, `${row.id}: grade must record its grading command`)
  }

  // skipped cases retained: the ledger's policy skips (media/text/roll fallback programs) are
  // counted, never silently dropped
  assert.equal(map.counts.externalInput.fallbackPolicySkippedRetained, skips.length)
  assert.equal(map.counts.ledger.SKIP, skips.length)
  assert.equal(map.counts.ledger.FAIL, ledger.filter(r => r.status === 'FAIL').length)
  for (const row of withInput.filter(e => e.fallbackPolicySkipped)) {
    for (const prog of row.fallbackPolicySkipped) {
      assert.ok(skips.some(s => s.program === prog), `${row.id}: fallback skip ${prog} must exist in the ledger`)
    }
  }
})

test('GAP-004 coverage map: external-input classification is re-derived from the vendored definitions', async () => {
  // every vendored def with a declarative externalTexture must be classified in the map
  const map = await buildCoverageMap()
  const manifest = JSON.parse(readFileSync(join(ROOT, 'vendor', 'noisemaker', 'effects', 'manifest.json'), 'utf8'))
  const dirBase = join(ROOT, 'vendor', 'noisemaker', 'effects')
  const declarative = []
  for (const id of Object.keys(manifest)) {
    const [ns, dir] = id.split('/')
    const src = readFileSync(join(dirBase, ns, `${dir}.js`), 'utf8')
    const m = src.match(/t\(this,"externalTexture","([A-Za-z]+)"\)/)
    if (m) declarative.push(id)
  }
  for (const id of declarative) {
    const row = map.effects.find(e => e.id === id)
    assert.ok(row && row.externalInput, `${id}: declares externalTexture but is not classified as external-input`)
  }
})

test('GAP-004 coverage map: mode matrix and parameter-interaction surface are re-derived, not asserted', async () => {
  const map = await buildCoverageMap()
  const modeCoverage = JSON.parse(readFileSync(join(ROOT, 'parity', 'mode-coverage.json'), 'utf8'))
  assert.equal(map.counts.modeMatrix.rows, modeCoverage.length)
  assert.equal(map.counts.modeMatrix.byteExact, modeCoverage.filter(r => r.passed).length)
  for (const row of modeCoverage) {
    const effect = map.effects.find(e => e.id === `filter/${row.effect}`) || map.effects.find(e => e.id.endsWith('/' + row.effect))
    assert.ok(effect, `mode-coverage effect ${row.effect} missing from the map`)
    assert.ok(effect.fixturePrograms.some(p => p.program === row.program), `mode fixture ${row.program} not bound to ${effect.id}`)
  }

  // choice surface re-counted from the vendored defs
  const manifest = JSON.parse(readFileSync(join(ROOT, 'vendor', 'noisemaker', 'effects', 'manifest.json'), 'utf8'))
  const dirBase = join(ROOT, 'vendor', 'noisemaker', 'effects')
  let params = 0; let effects = 0; let choices = 0
  for (const id of Object.keys(manifest)) {
    const [ns, dir] = id.split('/')
    const src = readFileSync(join(dirBase, ns, `${dir}.js`), 'utf8')
    let ep = 0; let ec = 0
    for (const m of src.matchAll(/choices:\{([^{}]*)\}/g)) {
      const n = (m[1].match(/[A-Za-z0-9_]+:/g) || []).length
      if (n > 0) { ep++; ec += n }
    }
    if (ep > 0) { effects++; params += ep; choices += ec }
  }
  assert.equal(map.counts.parameterInteractions.choiceBearingParams, params)
  assert.equal(map.counts.parameterInteractions.choiceBearingEffects, effects)
  assert.equal(map.counts.parameterInteractions.namedChoices, choices)
  assert.match(map.counts.parameterInteractions.rule, /Cartesian product is explicitly NOT tested/)
})

test('GAP-004 coverage map: corpus denominator retains skipped and refused counts, and its exclusion states the blocker', async () => {
  const map = await buildCoverageMap()
  const corpus = map.counts.statefulSequences.corpus
  assert.equal(corpus.historicalDenominator.raw, 40)
  assert.equal(corpus.historicalDenominator.gradeable, 39)
  assert.equal(corpus.historicalDenominator.referenceRejected, 1)
  assert.ok(corpus.reGradeExclusion && corpus.reGradeExclusion.reason, 'the corpus re-grade exclusion must state its reason')
  assert.equal(corpus.freshLiveFeed.referenceRejected, corpus.freshLiveFeed.compositions - corpus.freshLiveFeed.gradeableByReferenceCompiler)
})

test('GAP-004 coverage map: stateful sequences match the harness EVOLVE map', async () => {
  const map = await buildCoverageMap()
  const batchSrc = readFileSync(join(ROOT, 'parity', 'render-batch.mjs'), 'utf8')
  const block = batchSrc.match(/const EVOLVE = \{([\s\S]*?)\n\}/)[1]
  const names = [...new Set([...block.matchAll(/([A-Za-z0-9_]+): _EVO/g)].map(m => m[1]))].sort()
  assert.deepEqual(map.counts.statefulSequences.evolvePrograms, names)
  assert.equal(map.counts.statefulSequences.evolvePrograms.length >= 10, true)
})

test('GAP-004 coverage map: committed JSON is the fresh re-derivation', async () => {
  const fresh = await buildCoverageMap()
  const committed = JSON.parse(readFileSync(join(ROOT, 'parity', 'coverage-map.json'), 'utf8'))
  assert.deepEqual(committed, fresh, 'parity/coverage-map.json is stale — re-run: node tools/coverage-map.mjs')
})
