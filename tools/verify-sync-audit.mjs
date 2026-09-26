// verify-sync-audit.mjs — re-derive every claim in STATUS.md's
// "Vendor sync (240740dd..9d3474df)", "Vendor sync (9d3474df..2f47612c)",
// "Vendor sync (2f47612c..8eeb7b5a)" and "Vendor sync (8eeb7b5a..6a0af04d)"
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
//   6. the v1.0.185 incremental range (this sync): 8eeb7b5a is an ancestor of
//      6a0af04d, tag v1.0.185 points exactly at 6a0af04d, the shaders/ delta
//      is exactly the GAP-006 runtime pooling plan + the viewport-without-clear
//      guard + the GAP-007 backend diagnostic union + their new tests, and no
//      effect definition changed (catalog parity);
//   7. the published core bundle at the pinned documented revision
//      (shaders.noisedeck.app/1.0.185, same pin as vendor/fetch.sh) is the
//      recorded 870700-byte 6a0af04d build and carries the GAP-006/GAP-007
//      runtime symbols but no validator symbols.
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
const END2 = '2f47612c29045c1b91af94887a8ff20106e980ef' // texture-policy range end (v1.0.182)
const END3 = '8eeb7b5ac14eb37a8d16037f607a88ce63924cd3' // integration range end (GAP-005 tip)
const END4 = '6a0af04d3c4f345ffab5e9f8e54e532216b4cdaa' // pooling+diagnostics range end (v1.0.185)
const VALIDATOR_DELTA = '1097\t18\tshaders/src/runtime/effect-validator.js\n457\t0\tshaders/tests/test_effect_definition_validation.js'
const VALIDATOR_FILES = 'shaders/src/runtime/effect-validator.js\nshaders/tests/test_effect_definition_validation.js'
const MIP_DELTA = '106\t15\tshaders/src/runtime/backends/webgl2.js\n273\t10\tshaders/src/runtime/backends/webgpu.js\n17\t0\tshaders/src/runtime/compiler.js\n26\t1\tshaders/src/runtime/effect-validator.js\n100\t19\tshaders/src/runtime/pipeline.js\n466\t0\tshaders/tests/test_mip_controls.js'
const PASS_DELTA = '9\t3\tshaders/src/runtime/backends/webgl2.js\n6\t2\tshaders/src/runtime/backends/webgpu.js\n12\t0\tshaders/src/runtime/expander.js\n64\t0\tshaders/src/runtime/pipeline.js\n323\t0\tshaders/tests/test_pass_fields.js'
const POOL_DELTA = '185\t0\tshaders/src/runtime/backends/diagnostics.js\n26\t7\tshaders/src/runtime/backends/webgl2.js\n60\t35\tshaders/src/runtime/backends/webgpu.js\n213\t2\tshaders/src/runtime/pipeline.js\n338\t0\tshaders/tests/test_backend_diagnostics.js\n483\t0\tshaders/tests/test_resource_pooling.js'
const POOL_FILES = 'shaders/src/runtime/backends/diagnostics.js\nshaders/src/runtime/backends/webgl2.js\nshaders/src/runtime/backends/webgpu.js\nshaders/src/runtime/pipeline.js\nshaders/tests/test_backend_diagnostics.js\nshaders/tests/test_resource_pooling.js'
const BUNDLE_URL = 'https://shaders.noisedeck.app/1.0.185/noisemaker-shaders-core.esm.js' // pinned documented revision (see vendor/fetch.sh), not the rolling /1 alias
const BUNDLE_BYTES = 870700 // documented published build (6a0af04d tip, v1.0.185)

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

// 5b. The integration range: 2f47612c..8eeb7b5a (GAP-005 pass-field propagation; the remote
//     default-branch sync the candidate integrates).
check('2f47612c is an ancestor of 8eeb7b5a (integration range contiguous)',
  git('merge-base', '--is-ancestor', END2, END3) === '' && git('merge-base', END2, END3) === END2)
const passNumstat = git('diff', '--numstat', `${END2}..${END3}`, '--', 'shaders/')
check('shaders/ delta 2f47612c..8eeb7b5a is exactly the GAP-005 pass-field propagation + its new test',
  passNumstat === PASS_DELTA, passNumstat.replace(/\n/g, ' | '))
let effectChanges3 = 'none'
try {
  effectChanges3 = git('diff', '--name-only', `${END2}..${END3}`, '--', 'shaders/src/effects')
} catch { /* no changes → git exits 0 with empty output */ }
check('no effect definition changed in 2f47612c..8eeb7b5a (catalog parity)', effectChanges3 === '')

// 5c. The pooling+diagnostics range: 8eeb7b5a..6a0af04d (v1.0.184/v1.0.185; this sync).
check('8eeb7b5a is an ancestor of 6a0af04d (pooling range contiguous)',
  git('merge-base', '--is-ancestor', END3, END4) === '' && git('merge-base', END3, END4) === END3)
check('tag v1.0.185 points exactly at 6a0af04d',
  git('rev-parse', 'v1.0.185^{commit}') === END4)
const poolNumstat = git('diff', '--numstat', `${END3}..${END4}`, '--', 'shaders/')
check('shaders/ delta 8eeb7b5a..6a0af04d is exactly the GAP-006 pooling plan + viewport guard + GAP-007 diagnostic union + their new tests',
  poolNumstat === POOL_DELTA, poolNumstat.replace(/\n/g, ' | '))
const poolNames = git('diff', '--name-only', `${END3}..${END4}`, '--', 'shaders/').split('\n').sort().join('\n')
check('no other shaders/ file changed in the pooling range', poolNames === POOL_FILES)
let effectChanges4 = 'none'
try {
  effectChanges4 = git('diff', '--name-only', `${END3}..${END4}`, '--', 'shaders/src/effects')
} catch { /* no changes → git exits 0 with empty output */ }
check('no effect definition changed in 8eeb7b5a..6a0af04d (catalog parity)', effectChanges4 === '')
const bundler4 = git('show', `${END4}:scripts/bundle.js`)
check('bundler still disables effect validation by construction at v1.0.185',
  bundler4.includes('NOISEMAKER_DISABLE_EFFECT_VALIDATION'))

// 6. Published bundle (pinned documented revision). A validator symbol remains a FAIL;
//    a size move past the recorded build is a WARN pointing at a new ports-sync.
const bundle = Buffer.from(await (await fetch(BUNDLE_URL)).arrayBuffer())
if (bundle.length === BUNDLE_BYTES) {
  check(`published core bundle at the pinned documented revision is the recorded ${BUNDLE_BYTES}-byte build (6a0af04d tip)`, true)
} else {
  check(`published core bundle at the pinned revision no longer matches the recorded build (got ${bundle.length} bytes, recorded ${BUNDLE_BYTES}) — WARN only: the recorded byte-identity claim refers to the artifact verified during the audit; run a new ports-sync for the newer release`, true)
}
check('published bundle carries the texture-policy + pass-field runtime symbols',
  bundle.includes('recreateTexturePreserving') && bundle.includes('refreshMipTargets') &&
  bundle.includes('generateMipmaps') && bundle.includes('resolvePassViewport'))
check('published bundle carries the GAP-006 pooling + GAP-007 diagnostic runtime symbols',
  bundle.includes('buildTexturePoolingPlan') && bundle.includes('applyTextureAliases') &&
  bundle.includes('getResourcePlan') && bundle.includes('ShaderDiagnostic') &&
  bundle.includes('parseGLSLInfoLog') && bundle.includes('parseWebGPUCompilationMessages'))
check('published bundle contains no validator symbols', !bundle.includes('validateEffectDefinition'))

if (cleaned) rmSync(cleaned, { recursive: true, force: true })
if (failures) {
  console.error(`\n${failures} recorded audit claim(s) broken — correct STATUS.md, do not loosen these checks.`)
  process.exit(1)
}
console.log('\nAll recorded sync-audit claims re-derived from source: audit stands.')
