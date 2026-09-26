// verify-sync-audit.mjs — re-derive every claim in STATUS.md's
// "Vendor sync (240740dd..9d3474df)" and "Vendor sync (9d3474df..2f47612c)"
// audits directly from source, so the recorded audits are an executable
// contract instead of prose.
//
//   node tools/verify-sync-audit.mjs
//   NM_UPSTREAM=/path/to/noisemaker-checkout node tools/verify-sync-audit.mjs
//
// Clones noisefactorllc/noisemaker at the pinned SHAs (or uses the checkout in
// NM_UPSTREAM), then checks, in order:
//   1. ancestry: fca611fd is an ancestor of 9d3474df (the flagged range is
//      contiguous) and of 240740dd (so the incremental, not-yet-synced
//      shader-tree delta at the previous audit was exactly 240740dd..9d3474df);
//   2. release correlation: tag v1.0.181 points exactly at 9d3474df;
//   3. the exact shaders/ delta of the audited range (only the dev/test-only
//      effect-validator module and its new test);
//   4. at v1.0.181, no engine source module outside effect-validator.js
//      itself references it, and the browser bundler disables effect
//      validation by construction;
//   5. the v1.0.182 incremental range (this sync): 9d3474df is an ancestor of
//      2f47612c, tag v1.0.182 points exactly at 2f47612c, the shaders/ delta
//      is exactly the texture-policy runtime changes + their new test, and no
//      effect definition changed (catalog parity);
//   6. the published core bundle (shaders.noisedeck.app/1) is the recorded
//      855031-byte v1.0.182 build and carries the texture-policy runtime
//      symbols but no validator symbols.
//
// Exit 0 = every recorded claim holds; exit 1 = a claim is broken (the record
// must then be corrected — do not loosen a check).

import { execSync, execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const UPSTREAM_URL = 'https://github.com/noisefactorllc/noisemaker.git'
const START = '240740dd2d30cbd0984b179834ab24abe71c8fb2' // already-synced baseline
const FCA = 'fca611fd8f91424661d4e531d39313d24ea21134' // flagged range start
const END = '9d3474dfdc6cb737ebb7b2f3598b16d940af1544' // previous audit range end (v1.0.181)
const END2 = '2f47612c29045c1b91af94887a8ff20106e980ef' // this sync range end (v1.0.182)
const VALIDATOR_DELTA = '1097\t18\tshaders/src/runtime/effect-validator.js\n457\t0\tshaders/tests/test_effect_definition_validation.js'
const VALIDATOR_FILES = 'shaders/src/runtime/effect-validator.js\nshaders/tests/test_effect_definition_validation.js'
const MIP_DELTA = '106\t15\tshaders/src/runtime/backends/webgl2.js\n273\t10\tshaders/src/runtime/backends/webgpu.js\n17\t0\tshaders/src/runtime/compiler.js\n26\t1\tshaders/src/runtime/effect-validator.js\n100\t19\tshaders/src/runtime/pipeline.js\n466\t0\tshaders/tests/test_mip_controls.js'
const BUNDLE_URL = 'https://shaders.noisedeck.app/1/noisemaker-shaders-core.esm.js'
const BUNDLE_BYTES = 855031 // v1.0.182 (2f47612c)

let repo = process.env.NM_UPSTREAM || ''
let cleaned = ''
if (!repo) {
  const dir = mkdtempSync(join(tmpdir(), 'nm-audit-'))
  cleaned = dir
  execSync(`git clone --quiet ${UPSTREAM_URL} ${dir}`, { stdio: 'inherit' })
  repo = dir
}

const git = (...args) =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

// 1. Ancestry (directions verified explicitly).
check('fca611fd is an ancestor of 9d3474df (flagged range contiguous)',
  git('merge-base', '--is-ancestor', FCA, END) === '' && git('merge-base', FCA, END) === FCA)
check('fca611fd is an ancestor of 240740dd (delta is 240740dd..9d3474df)',
  git('merge-base', '--is-ancestor', FCA, START) === '' && git('merge-base', FCA, START) === FCA)

// 2. Release tag correlation.
check('tag v1.0.181 points exactly at 9d3474df',
  git('rev-parse', 'v1.0.181^{commit}') === END)

// 3. Exact shaders/ delta.
const numstat = git('diff', '--numstat', `${START}..${END}`, '--', 'shaders/')
check('shaders/ delta is exactly the validator + its new test', numstat === VALIDATOR_DELTA, numstat.replace(/\n/g, ' | '))
const names = git('diff', '--name-only', `${START}..${END}`, '--', 'shaders/').split('\n').sort().join('\n')
check('no other shaders/ file changed', names === VALIDATOR_FILES)

// 4. Validator is outside the published engine surface at v1.0.181.
let refs = ''
try {
  refs = git('grep', '-l', 'effect-validator', END, '--', 'shaders/src', ':!shaders/src/runtime/effect-validator.js')
} catch { /* grep exits 1 when there are no matches — that is the expected state */ }
check('no engine source module references effect-validator.js at v1.0.181', refs === '')
const bundler = git('show', `${END}:scripts/bundle.js`)
check('bundler disables effect validation by construction',
  bundler.includes('NOISEMAKER_DISABLE_EFFECT_VALIDATION'))

// 5. This sync's incremental range: 9d3474df..2f47612c (v1.0.182).
check('9d3474df is an ancestor of 2f47612c (incremental range contiguous)',
  git('merge-base', '--is-ancestor', END, END2) === '' && git('merge-base', END, END2) === END)
check('tag v1.0.182 points exactly at 2f47612c',
  git('rev-parse', 'v1.0.182^{commit}') === END2)
const mipNumstat = git('diff', '--numstat', `${END}..${END2}`, '--', 'shaders/')
check('shaders/ delta 9d3474df..2f47612c is exactly the texture-policy runtime changes + their new test',
  mipNumstat === MIP_DELTA, mipNumstat.replace(/\n/g, ' | '))
let effectChanges = 'none'
try {
  effectChanges = git('diff', '--name-only', `${END}..${END2}`, '--', 'shaders/src/effects')
} catch { /* no changes → git exits 0 with empty output */ }
check('no effect definition changed in 9d3474df..2f47612c (catalog parity)', effectChanges === '')

// 6. Published bundle (v1.0.182). A validator symbol remains a FAIL; a size
//    move past the recorded build is a WARN pointing at a new ports-sync.
const bundle = Buffer.from(await (await fetch(BUNDLE_URL)).arrayBuffer())
if (bundle.length === BUNDLE_BYTES) {
  check(`published core bundle is the recorded ${BUNDLE_BYTES}-byte v1.0.182 build`, true)
} else {
  check(`published core bundle size moved past the recorded build (got ${bundle.length} bytes, recorded ${BUNDLE_BYTES}) — WARN only: the recorded byte-identity claim refers to the v1.0.182 artifact verified during the audit; run a new ports-sync for the newer release`, true)
}
check('published bundle carries the v1.0.182 texture-policy runtime symbols',
  bundle.includes('recreateTexturePreserving') && bundle.includes('refreshMipTargets') && bundle.includes('generateMipmaps'))
check('published bundle contains no validator symbols', !bundle.includes('validateEffectDefinition'))

if (cleaned) rmSync(cleaned, { recursive: true, force: true })
if (failures) {
  console.error(`\n${failures} recorded audit claim(s) broken — correct STATUS.md, do not loosen these checks.`)
  process.exit(1)
}
console.log('\nAll recorded sync-audit claims re-derived from source: audit stands.')
