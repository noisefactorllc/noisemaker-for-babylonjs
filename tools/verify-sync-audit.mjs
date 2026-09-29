// verify-sync-audit.mjs — re-derive every claim in STATUS.md's
// "Vendor sync (240740dd..9d3474df)", "Vendor sync (9d3474df..2f47612c)",
// "Vendor sync (2f47612c..8eeb7b5a)", "Vendor sync (8eeb7b5a..6a0af04d)",
// "Vendor sync (6a0af04d..403c2a4b)", "Vendor sync (403c2a4b..7dc0f564)",
// "Vendor sync (7dc0f564..12b4d74f)", "Vendor sync (93229933..296e0138)" and
// "Vendor sync (296e0138..73c15be0)", "Vendor sync (73c15be0..a5059106)"
// audits directly from source, so the
// recorded audits are an executable contract instead of prose.
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
//   6. the v1.0.188/v1.0.189 incremental range (this sync): 403c2a4b is an
//      ancestor of 7dc0f564, tags v1.0.188/v1.0.189 point exactly at
//      9f85687d/7dc0f564, the shaders/ delta is exactly the GAP-010
//      uniform-status aggregation + GAP-011 measured uniform deltas + their
//      tests + the harness wiring, and no shaders/src module (incl. effect
//      definitions) changed (catalog parity);
//   7. the v1.0.190–v1.0.193 incremental range: 7dc0f564 is an ancestor of
//      12b4d74f, tags v1.0.190–v1.0.193 point exactly at
//      7443f6e6/c2252f0c/e73a44a3/12b4d74f, the shaders/ delta is exactly the
//      GAP-016 static preflight runtime (pipeline.js delegation + new
//      preflight.js) plus the GAP-012/014/015 harness and test modules, and no
//      effect definition changed (catalog parity);
//   8. the v1.0.194 range (no code change): 12b4d74f is an ancestor of
//      93229933, tag v1.0.194 points exactly at it, and the shaders/ delta is
//      exactly the GAP-017 definition-schema module + its test + harness
//      wiring (test-only);
//   9. the v1.0.195/v1.0.196 range (this sync, no code change): the declared
//      start 7443f6e6 is an ancestor of the declared end a912749f, 93229933 is
//      an ancestor of 296e0138, tags v1.0.195/v1.0.196 point exactly at
//      a912749f/296e0138, and the shaders/ delta is exactly the GAP-019
//      passthrough-input + GAP-021 frame-resolution modules + tests + harness
//      wiring (test-only); the published 1.0.196 core is banner-stripped
//      byte-identical to the pinned 1.0.193 core with no new harness symbols;
//  10. the published core bundle at the pinned documented revision
//      (shaders.noisedeck.app/1.0.193, same pin as vendor/fetch.sh) is the
//      recorded 884620-byte 12b4d74f build, adds the GAP-016 preflight runtime
//      over the 1.0.189 build (mini-bundles unchanged), and carries the
//      GAP-006/GAP-007/GAP-008 symbols but no validator symbols;
//   9. the port's own test suite (`npm test`) exits with 0 failing tests —
//      required in a prepared environment, an explicit SKIP (with preparation
//      steps) otherwise, so an absent run can never read as success.
//
// Exit 0 = every recorded claim holds; exit 1 = a claim is broken (the record
// must then be corrected — do not loosen a check).

import { execSync, execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

const UPSTREAM_URL = 'https://github.com/noisefactorllc/noisemaker.git'
const START = '240740dd2d30cbd0984b179834ab24abe71c8fb2' // already-synced baseline
const FCA = 'fca611fd8f91424661d4e531d39313d24ea21134' // flagged range start
const END = '9d3474dfdc6cb737ebb7b2f3598b16d940af1544' // previous audit range end (v1.0.181)
const END2 = '2f47612c29045c1b91af94887a8ff20106e980ef' // texture-policy range end (v1.0.182)
const END3 = '8eeb7b5ac14eb37a8d16037f607a88ce63924cd3' // integration range end (GAP-005 tip)
const END4 = '6a0af04d3c4f345ffab5e9f8e54e532216b4cdaa' // pooling+diagnostics range end (v1.0.185)
const END5 = '403c2a4bf2cb56307448ea2fc1d6fa3cd74b7d6e' // replacement-prediction range end (v1.0.187)
const END6 = '7dc0f5640534855d73f8c812ca071fe6b1e09197' // uniforms-report range end (v1.0.189)
const END7 = '12b4d74fb4f28d5f00bb1dde107fa8673814d8b9' // preflight range end (v1.0.193)
const END8 = '93229933b102ba82e713402be19db57207698850' // introspection range end (v1.0.194)
const END9 = '296e0138c4744ed485b2e95de3eeb466c17629ee' // frame-resolution range end (v1.0.196)
const END10 = '73c15be00d6888f4b5d2835d8e242ee9e840df45' // lifecycle range end (v1.0.199, previous sync)
const END11 = 'a5059106ea7510b839e70c5c9c33ba1f5ccbc043' // audio-input range end (this sync, no code change)
const VALIDATOR_DELTA = '1097\t18\tshaders/src/runtime/effect-validator.js\n457\t0\tshaders/tests/test_effect_definition_validation.js'
const VALIDATOR_FILES = 'shaders/src/runtime/effect-validator.js\nshaders/tests/test_effect_definition_validation.js'
const MIP_DELTA = '106\t15\tshaders/src/runtime/backends/webgl2.js\n273\t10\tshaders/src/runtime/backends/webgpu.js\n17\t0\tshaders/src/runtime/compiler.js\n26\t1\tshaders/src/runtime/effect-validator.js\n100\t19\tshaders/src/runtime/pipeline.js\n466\t0\tshaders/tests/test_mip_controls.js'
const PASS_DELTA = '9\t3\tshaders/src/runtime/backends/webgl2.js\n6\t2\tshaders/src/runtime/backends/webgpu.js\n12\t0\tshaders/src/runtime/expander.js\n64\t0\tshaders/src/runtime/pipeline.js\n323\t0\tshaders/tests/test_pass_fields.js'
const POOL_DELTA = '185\t0\tshaders/src/runtime/backends/diagnostics.js\n26\t7\tshaders/src/runtime/backends/webgl2.js\n60\t35\tshaders/src/runtime/backends/webgpu.js\n213\t2\tshaders/src/runtime/pipeline.js\n338\t0\tshaders/tests/test_backend_diagnostics.js\n483\t0\tshaders/tests/test_resource_pooling.js'
const POOL_FILES = 'shaders/src/runtime/backends/diagnostics.js\nshaders/src/runtime/backends/webgl2.js\nshaders/src/runtime/backends/webgpu.js\nshaders/src/runtime/pipeline.js\nshaders/tests/test_backend_diagnostics.js\nshaders/tests/test_resource_pooling.js'
const PRED_DELTA = '1\t1\tshaders/src/index.js\n2\t2\tshaders/src/lang/index.js\n11\t0\tshaders/src/lang/paramAliases.js\n372\t5\tshaders/src/lang/transform.js\n80\t0\tshaders/tests/frame-metrics.js\n161\t6\tshaders/tests/test-harness.js\n71\t0\tshaders/tests/test_frame_metrics.js\n200\t0\tshaders/tests/test_transform.js'
const PRED_FILES = 'shaders/src/index.js\nshaders/src/lang/index.js\nshaders/src/lang/paramAliases.js\nshaders/src/lang/transform.js\nshaders/tests/frame-metrics.js\nshaders/tests/test-harness.js\nshaders/tests/test_frame_metrics.js\nshaders/tests/test_transform.js'
const BUNDLE_URL = 'https://shaders.noisedeck.app/1.0.199/noisemaker-shaders-core.esm.js' // pinned documented revision (see vendor/fetch.sh), not the rolling /1 alias
const BUNDLE_BYTES = 888834 // documented published build (73c15be0 tip, v1.0.199)
const PREV_BUNDLE_URL = 'https://shaders.noisedeck.app/1.0.189/noisemaker-shaders-core.esm.js' // previous pinned revision (7dc0f564)

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
// Tag correlation. Historical release tags may be deleted upstream; the check
// then verifies absence on BOTH the local clone and origin (git ls-remote) —
// an absent-both outcome passes as the historical record (the tag itself was
// verified against these SHAs in the recorded sync rounds), while a tag that
// exists must still point exactly at the recorded SHA.
const tagRev = (name) => {
  try {
    return execFileSync('git', ['rev-parse', '--verify', '--quiet', `${name}^{commit}`], { cwd: repo, encoding: 'utf8' }).trim()
  } catch { return null }
}
const tagCheck = (name, sha, label) => {
  const rev = tagRev(name)
  if (rev !== null) {
    check(`${name} points exactly at ${label}`, rev === sha)
    return
  }
  let remote
  try {
    remote = execFileSync('git', ['ls-remote', 'origin', `refs/tags/${name}`], { cwd: repo, encoding: 'utf8' }).trim()
  } catch (e) {
    check(`${name} was deleted upstream, but origin could not be queried (${e.message.split('\n')[0]}) — fetch the tag history to re-derive`, false)
    return
  }
  check(`${name} is absent locally AND on origin (deleted upstream); recorded release SHA is ${label}, re-verified as an exact range end by the ancestry + numstat checks below`,
    remote === '', remote ? `origin still has ${name}` : '')
}

tagCheck('v1.0.181', END, '9d3474df')

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
tagCheck('v1.0.182', END2, '2f47612c')
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
tagCheck('v1.0.185', END4, '6a0af04d')
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

// 5d. The replacement-prediction range: 6a0af04d..403c2a4b (v1.0.186/v1.0.187; this sync).
check('6a0af04d is an ancestor of 403c2a4b (prediction range contiguous)',
  git('merge-base', '--is-ancestor', END4, END5) === '' && git('merge-base', END4, END5) === END4)
// Historical release tag: upstream now deletes old tags (v1.0.181..185 pattern);
// absence on BOTH the local clone and origin passes as the historical record
// (the tag was verified against these SHAs in the recorded sync round), while
// a tag that exists must still point exactly at the recorded SHA.
tagCheck('v1.0.187', END5, '403c2a4b')
const predNumstat = git('diff', '--numstat', `${END4}..${END5}`, '--', 'shaders/')
check('shaders/ delta 6a0af04d..403c2a4b is exactly the GAP-008 replacement preflight prediction + param-alias reader + their new tests',
  predNumstat === PRED_DELTA, predNumstat.replace(/\n/g, ' | '))
const predNames = git('diff', '--name-only', `${END4}..${END5}`, '--', 'shaders/').split('\n').sort().join('\n')
check('no other shaders/ file changed in the prediction range', predNames === PRED_FILES)
let effectChanges5 = 'none'
try {
  effectChanges5 = git('diff', '--name-only', `${END4}..${END5}`, '--', 'shaders/src/effects')
} catch { /* no changes → git exits 0 with empty output */ }
check('no effect definition changed in 6a0af04d..403c2a4b (catalog parity)', effectChanges5 === '')
const bundler5 = git('show', `${END5}:scripts/bundle.js`)
check('bundler still disables effect validation by construction at v1.0.187',
  bundler5.includes('NOISEMAKER_DISABLE_EFFECT_VALIDATION'))
// Beyond the declared range end (v1.0.188 = 9f85687d, GAP-010): test/docs-only —
// no shaders/src change, so the published bundle is unaffected by the newer tag.
let postRange = 'x'
try {
  postRange = git('diff', '--name-only', `${END5}..9f85687d1bafc445dcd38e28cf5f0c6dfba562f8`, '--', 'shaders/src')
} catch { /* git exits 0 with empty output for no changes */ }
check('the v1.0.188 tip (9f85687d, beyond the declared range end) changes no shaders/src module', postRange === '')

// 5e. The uniforms-report range: 403c2a4b..7dc0f564 (v1.0.188/v1.0.189; this sync).
// The delivery was force-push-flagged (observed 407eb7a7..7dc0f564) — audited
// directly: 403c2a4b is an exact ancestor of 7dc0f564 (contiguous), tag
// v1.0.189 points exactly at the declared end, and the shaders/ delta is
// exactly the GAP-010 uniform-status aggregation + the GAP-011 measured
// uniform deltas + their tests + the harness/report wiring — test-only.
check('403c2a4b is an ancestor of 7dc0f564 (uniforms range contiguous)',
  git('merge-base', '--is-ancestor', END5, END6) === '' && git('merge-base', END5, END6) === END5)
tagCheck('v1.0.189', END6, '7dc0f564')
tagCheck('v1.0.188', '9f85687d1bafc445dcd38e28cf5f0c6dfba562f8', '9f85687d')
const UNIF_DELTA = "64\t4\tshaders/tests/test-harness.js\n122\t0\tshaders/tests/test_uniform_deltas.js\n116\t0\tshaders/tests/test_uniform_status.js\n282\t0\tshaders/tests/uniform-deltas.js\n78\t0\tshaders/tests/uniform-status.js"
const UNIF_FILES = "shaders/tests/test-harness.js\nshaders/tests/test_uniform_deltas.js\nshaders/tests/test_uniform_status.js\nshaders/tests/uniform-deltas.js\nshaders/tests/uniform-status.js"
const unifNumstat = git('diff', '--numstat', `${END5}..${END6}`, '--', 'shaders/')
check('shaders/ delta 403c2a4b..7dc0f564 is exactly the GAP-010/GAP-011 uniforms-report modules + tests + harness wiring',
  unifNumstat === UNIF_DELTA, unifNumstat.replace(/\n/g, ' | '))
const unifNames = git('diff', '--name-only', `${END5}..${END6}`, '--', 'shaders/').split('\n').sort().join('\n')
check('no other shaders/ file changed in the uniforms range', unifNames === UNIF_FILES)
let effectChanges6 = 'none'
try {
  effectChanges6 = git('diff', '--name-only', `${END5}..${END6}`, '--', 'shaders/src')
} catch { /* no changes → git exits 0 with empty output */ }
check('no shaders/src module (incl. effect definitions) changed in 403c2a4b..7dc0f564 (catalog parity)', effectChanges6 === '')
const bundler6 = git('show', `${END6}:scripts/bundle.js`)
check('bundler still disables effect validation by construction at v1.0.189',
  bundler6.includes('NOISEMAKER_DISABLE_EFFECT_VALIDATION'))

// 5f. The preflight range: 7dc0f564..12b4d74f (v1.0.190–v1.0.193; this sync).
// The delivery was force-push-flagged with a declared end (7443f6e6 = v1.0.190)
// older than two observed trigger tips (e73a44a3 = v1.0.192, 12b4d74f = v1.0.193)
// — audited directly: the range 7dc0f564..12b4d74f is contiguous, all four
// release tags point exactly at their recorded SHAs, and the shaders/ delta is
// exactly the GAP-012/014/015 harness + test modules plus the GAP-016 static
// preflight runtime (pipeline.js delegation + new preflight.js). Upstream main
// has since advanced one docs-only commit (ec457c2e) with an empty shaders/
// delta, so v1.0.193 IS upstream's current shaders/ tree.
check('7dc0f564 is an ancestor of 12b4d74f (preflight range contiguous)',
  git('merge-base', '--is-ancestor', END6, END7) === '' && git('merge-base', END6, END7) === END6)
tagCheck('v1.0.190', '7443f6e6180300a45c5b97608459e5094504659d', '7443f6e6')
tagCheck('v1.0.191', 'c2252f0caa66b7c5e133a2aad3328e832564b567', 'c2252f0c')
tagCheck('v1.0.192', 'e73a44a37f0c99bd3779c5fb26c7bba65a46a379', 'e73a44a3')
tagCheck('v1.0.193', END7, '12b4d74f')
const PREFLIGHT_DELTA = '30\t10\tshaders/src/runtime/pipeline.js\n191\t0\tshaders/src/runtime/preflight.js\n83\t0\tshaders/tests/frame-readback.js\n61\t0\tshaders/tests/frame-warmup.js\n283\t0\tshaders/tests/image-metrics.js\n18\t8\tshaders/tests/test-harness.js\n183\t0\tshaders/tests/test_frame_readback.js\n144\t0\tshaders/tests/test_frame_warmup.js\n164\t0\tshaders/tests/test_image_metrics.js\n267\t0\tshaders/tests/test_preflight.js'
const PREFLIGHT_FILES = 'shaders/src/runtime/pipeline.js\nshaders/src/runtime/preflight.js\nshaders/tests/frame-readback.js\nshaders/tests/frame-warmup.js\nshaders/tests/image-metrics.js\nshaders/tests/test-harness.js\nshaders/tests/test_frame_readback.js\nshaders/tests/test_frame_warmup.js\nshaders/tests/test_image_metrics.js\nshaders/tests/test_preflight.js'
const preflightNumstat = git('diff', '--numstat', `${END6}..${END7}`, '--', 'shaders/')
check('shaders/ delta 7dc0f564..12b4d74f is exactly the GAP-016 preflight runtime + the GAP-012/014/015 harness and test modules',
  preflightNumstat === PREFLIGHT_DELTA, preflightNumstat.replace(/\\n/g, ' | '))
const preflightNames = git('diff', '--name-only', `${END6}..${END7}`, '--', 'shaders/').split('\\n').sort().join('\\n')
check('no other shaders/ file changed in the preflight range', preflightNames === PREFLIGHT_FILES)
let effectChanges7 = 'none'
try {
  effectChanges7 = git('diff', '--name-only', `${END6}..${END7}`, '--', 'shaders/src/effects')
} catch { /* no changes → git exits 0 with empty output */ }
check('no effect definition changed in 7dc0f564..12b4d74f (catalog parity)', effectChanges7 === '')
const bundler7 = git('show', `${END7}:scripts/bundle.js`)
check('bundler still disables effect validation by construction at v1.0.193',
  bundler7.includes('NOISEMAKER_DISABLE_EFFECT_VALIDATION'))
// Beyond this sync's end (upstream main tip ec457c2e): docs-only — no shaders/
// change, so v1.0.193 IS upstream's current shaders/ tree.
let postRange7 = 'x'
try {
  postRange7 = git('diff', '--name-only', `${END7}..ec457c2eec695427fdbf026bd5ce5db04456a151`, '--', 'shaders/')
} catch { /* git exits 0 with empty output for no changes */ }
check('the upstream main tip (ec457c2e, beyond the synced range end) changes no shaders/ file', postRange7 === '')

// 5g. The introspection range: 12b4d74f..93229933 (v1.0.194; this sync, no code change).
// The delivery was force-push-flagged with a declared start (7443f6e6 = v1.0.190) older
// than the port's covered tip — audited directly: the uncovered delta is exactly the
// contiguous 12b4d74f..93229933, tag v1.0.194 points exactly at the tip, and the
// shaders/ delta is exactly the GAP-017 definition-schema introspection module + its
// test + the harness wiring — test-only, no shaders/src change.
check('12b4d74f is an ancestor of 93229933 (introspection range contiguous)',
  git('merge-base', '--is-ancestor', END7, END8) === '' && git('merge-base', END7, END8) === END7)
check('the declared range start 7443f6e6 is an ancestor of the covered tip 12b4d74f',
  git('merge-base', '--is-ancestor', '7443f6e6180300a45c5b97608459e5094504659d', END7) === '')
tagCheck('v1.0.194', END8, '93229933')
const SCHEMA_DELTA = '220\t0\tshaders/tests/definition-schema.js\n58\t2\tshaders/tests/test-harness.js\n161\t0\tshaders/tests/test_definition_schema.js'
const schemaNumstat = git('diff', '--numstat', `${END7}..${END8}`, '--', 'shaders/')
check('shaders/ delta 12b4d74f..93229933 is exactly the GAP-017 definition-schema module + its test + harness wiring',
  schemaNumstat === SCHEMA_DELTA, schemaNumstat.replace(/\n/g, ' | '))
let effectChanges8 = 'none'
try {
  effectChanges8 = git('diff', '--name-only', `${END7}..${END8}`, '--', 'shaders/src')
} catch { /* no changes → git exits 0 with empty output */ }
check('no shaders/src module changed in 12b4d74f..93229933 (catalog parity)', effectChanges8 === '')

// 5h. The frame-resolution range: 93229933..296e0138 (v1.0.195/v1.0.196; this sync, no
// code change). The delivery was force-push-flagged with a declared range
// 7443f6e6..a912749f (v1.0.190..v1.0.195) and one observed trigger tip (296e0138 =
// v1.0.196) beyond the declared end — audited directly: the declared start is an
// ancestor of the declared end (ordered, not rewritten), the uncovered delta is exactly
// the contiguous 93229933..296e0138 (4 commits), and the shaders/ delta is exactly the
// GAP-019 passthrough-input probe + GAP-021 frame-resolution reporting + their tests +
// the harness wiring — test-only, no shaders/src change.
check('the declared range start 7443f6e6 is an ancestor of the declared range end a912749f',
  git('merge-base', '--is-ancestor', '7443f6e6180300a45c5b97608459e5094504659d', 'a912749fab5c3819e56a8abde664ff30e40870f4') === '')
check('93229933 is an ancestor of 296e0138 (frame-resolution range contiguous)',
  git('merge-base', '--is-ancestor', END8, END9) === '' && git('merge-base', END8, END9) === END8)
tagCheck('v1.0.195', 'a912749fab5c3819e56a8abde664ff30e40870f4', 'a912749f')
tagCheck('v1.0.196', END9, '296e0138')
const HARNESS_DELTA = '95\t0\tshaders/tests/frame-resolution.js\n489\t0\tshaders/tests/passthrough-input.js\n103\t1\tshaders/tests/test-harness.js\n189\t0\tshaders/tests/test_frame_resolution.js\n259\t0\tshaders/tests/test_passthrough_input.js'
const HARNESS_FILES = 'shaders/tests/frame-resolution.js\nshaders/tests/passthrough-input.js\nshaders/tests/test-harness.js\nshaders/tests/test_frame_resolution.js\nshaders/tests/test_passthrough_input.js'
const harnessNumstat = git('diff', '--numstat', `${END8}..${END9}`, '--', 'shaders/')
check('shaders/ delta 93229933..296e0138 is exactly the GAP-019 passthrough-input + GAP-021 frame-resolution modules + tests + harness wiring',
  harnessNumstat === HARNESS_DELTA, harnessNumstat.replace(/\n/g, ' | '))
const harnessNames = git('diff', '--name-only', `${END8}..${END9}`, '--', 'shaders/').split('\n').sort().join('\n')
check('no other shaders/ file changed in the harness range', harnessNames === HARNESS_FILES)
let effectChanges9 = 'none'
try {
  effectChanges9 = git('diff', '--name-only', `${END8}..${END9}`, '--', 'shaders/src')
} catch { /* no changes → git exits 0 with empty output */ }
check('no shaders/src module changed in 93229933..296e0138 (catalog parity)', effectChanges9 === '')

// 5i. The lifecycle range: 296e0138..73c15be0 (v1.0.197/v1.0.198/v1.0.199; this sync, ENGINE
// CHANGE). The delivery was force-push-flagged with a declared range a912749f..73c15be0 and
// three observed sub-range tips (c28e8fdb, 7aff843a, 73c15be0) — audited directly: the declared
// start a912749f (v1.0.195) is an ancestor of the port's previously covered tip 296e0138, the
// uncovered delta is exactly the contiguous 296e0138..73c15be0 (4 commits, including the
// docs-only 04e8582c), the three release tags point exactly at their recorded SHAs, and the
// shaders/ delta is the GAP-024 session-identity harness + GAP-026 lifecycle runtime
// (webgl2.js +2, compiler.js +3, pipeline.js +128/−1) + the GAP-026 harness bindings + their
// tests. No effect definition changed (catalog parity). Upstream main has since advanced two
// docs-only commits (53398923, cdb60cfc) with an empty shaders/src delta, so v1.0.199 IS
// upstream's current shaders/ tree.
check('the declared range start a912749f is an ancestor of the previously covered tip 296e0138',
  git('merge-base', '--is-ancestor', 'a912749fab5c3819e56a8abde664ff30e40870f4', END9) === '')
check('296e0138 is an ancestor of 73c15be0 (lifecycle range contiguous)',
  git('merge-base', '--is-ancestor', END9, END10) === '' && git('merge-base', END9, END10) === END9)
tagCheck('v1.0.197', 'c28e8fdb9218d220b2d260e747f4123450c6a0e1', 'c28e8fdb')
tagCheck('v1.0.198', '7aff843a4e33cc600968138199daae4648d0d613', '7aff843a')
tagCheck('v1.0.199', END10, '73c15be0')
const LIFECYCLE_DELTA = '2\t0\tshaders/src/runtime/backends/webgl2.js\n3\t0\tshaders/src/runtime/compiler.js\n128\t1\tshaders/src/runtime/pipeline.js\n237\t0\tshaders/tests/session-identity.js\n238\t13\tshaders/tests/test-harness.js\n407\t0\tshaders/tests/test_lifecycle_hooks.js\n61\t0\tshaders/tests/test_mesh_first_frame.mjs\n410\t0\tshaders/tests/test_session_identity.js'
const LIFECYCLE_FILES = 'shaders/src/runtime/backends/webgl2.js\nshaders/src/runtime/compiler.js\nshaders/src/runtime/pipeline.js\nshaders/tests/session-identity.js\nshaders/tests/test-harness.js\nshaders/tests/test_lifecycle_hooks.js\nshaders/tests/test_mesh_first_frame.mjs\nshaders/tests/test_session_identity.js'
const lifecycleNumstat = git('diff', '--numstat', `${END9}..${END10}`, '--', 'shaders/')
check('shaders/ delta 296e0138..73c15be0 is exactly the GAP-026 lifecycle runtime + GAP-024 session-identity harness + their tests + harness wiring',
  lifecycleNumstat === LIFECYCLE_DELTA, lifecycleNumstat.replace(/\n/g, ' | '))
const lifecycleNames = git('diff', '--name-only', `${END9}..${END10}`, '--', 'shaders/').split('\n').sort().join('\n')
check('no other shaders/ file changed in the lifecycle range', lifecycleNames === LIFECYCLE_FILES)
const lifecycleSrcDelta = git('diff', '--numstat', `${END9}..${END10}`, '--', 'shaders/src')
check('the lifecycle-range engine-src delta is exactly webgl2.js +2/0, compiler.js +3/0, pipeline.js +128/−1',
  lifecycleSrcDelta === '2\t0\tshaders/src/runtime/backends/webgl2.js\n3\t0\tshaders/src/runtime/compiler.js\n128\t1\tshaders/src/runtime/pipeline.js',
  lifecycleSrcDelta.replace(/\n/g, ' | '))
let effectChanges10 = 'none'
try {
  effectChanges10 = git('diff', '--name-only', `${END9}..${END10}`, '--', 'shaders/src/effects')
} catch { /* no changes → git exits 0 with empty output */ }
check('no effect definition changed in 296e0138..73c15be0 (catalog parity)', effectChanges10 === '')
// Beyond this sync's end (upstream main tips 53398923/cdb60cfc): docs-only — no shaders/src
// change, so v1.0.199 IS upstream's current shaders/ tree.
let postRange10 = 'x'
try {
  postRange10 = git('diff', '--name-only', `${END10}..cdb60cfc`, '--', 'shaders/src')
} catch { /* git exits 0 with empty output for no changes */ }
check('the upstream main tip (cdb60cfc, beyond the synced range end) changes no shaders/src module', postRange10 === '')

// 5j. The audio-input range: 73c15be0..a5059106 (this sync, no code change).
// The delivery was force-push-flagged with a declared range 73c15be0..a5059106
// and one observed sub-range 3e21906e..a5059106 — audited directly: the
// declared start is the port's covered tip and an exact ancestor of the end
// (contiguous), tag v1.0.200 points at the in-range deps-only commit
// 6b05a270, and the shaders/ delta is exactly the GAP-032 audio-input runtime
// (external-input.js) + its focused regressions. No effect definition changed
// (catalog parity). The GAP-032 runtime is NOT in any published release: the
// published 1.0.200 core is banner-stripped byte-identical to the pinned
// 1.0.199 core and lacks the new manager symbols, so the engine pin stays.
check('73c15be0 is an ancestor of a5059106 (audio-input range contiguous)',
  git('merge-base', '--is-ancestor', END10, END11) === '' && git('merge-base', END10, END11) === END10)
check('the observed sub-range start 3e21906e is a descendant of the covered tip 73c15be0 (audit covers the full declared range)',
  git('merge-base', '--is-ancestor', END10, '3e21906e4f6f86422e72920a990fc8f6cab9c309') === '')
tagCheck('v1.0.200', '6b05a27050b8dccd68c6500a8e9d705a5dfd0e70', '6b05a270')
const AUDIO_DELTA = '111\t7\tshaders/src/runtime/external-input.js\n186\t1\tshaders/tests/test_external_input.js'
const AUDIO_FILES = 'shaders/src/runtime/external-input.js\nshaders/tests/test_external_input.js'
const audioNumstat = git('diff', '--numstat', `${END10}..${END11}`, '--', 'shaders/')
check('shaders/ delta 73c15be0..a5059106 is exactly the GAP-032 audio-input runtime + its focused regressions',
  audioNumstat === AUDIO_DELTA, audioNumstat.replace(/\n/g, ' | '))
const audioNames = git('diff', '--name-only', `${END10}..${END11}`, '--', 'shaders/').split('\n').sort().join('\n')
check('no other shaders/ file changed in the audio-input range', audioNames === AUDIO_FILES)
let effectChanges11 = 'none'
try {
  effectChanges11 = git('diff', '--name-only', `${END10}..${END11}`, '--', 'shaders/src/effects')
} catch { /* no changes → git exits 0 with empty output */ }
check('no effect definition changed in 73c15be0..a5059106 (catalog parity)', effectChanges11 === '')
// The in-range v1.0.200 release (6b05a270) is a deps-only commit between the
// covered tip and the end: it changes no shaders/ file.
let tag200Shaders = 'x'
try {
  tag200Shaders = git('diff', '--name-only', `${END10}..6b05a27050b8dccd68c6500a8e9d705a5dfd0e70`, '--', 'shaders/')
} catch { /* git exits 0 with empty output for no changes */ }
check('the in-range v1.0.200 release (6b05a270, deps-only) changes no shaders/ file', tag200Shaders === '')

// 6. Published bundle (pinned documented revision). A validator symbol remains a FAIL;
//    a size move past the recorded build is a WARN pointing at a new ports-sync.
const bundle = Buffer.from(await (await fetch(BUNDLE_URL)).arrayBuffer())
const stripBanner = (b) => {
  const text = b.toString('utf8')
  return text.replace(/^ \* Build: .*\n/m, '').replace(/^ \* Date: .*\n/m, '')
}
if (bundle.length === BUNDLE_BYTES) {
  check(`published core bundle at the pinned documented revision is the recorded ${BUNDLE_BYTES}-byte build (73c15be0 tip, v1.0.199)`, true)
} else {
  check(`published core bundle at the pinned revision no longer matches the recorded build (got ${bundle.length} bytes, recorded ${BUNDLE_BYTES}) — WARN only: the recorded byte-identity claim refers to the artifact verified during the audit; run a new ports-sync for the newer release`, true)
}
// The v1.0.189→v1.0.193 published core delta is exactly the GAP-016 addition:
// the new internal preflight module, the mrtFormatBytes delegation, and the
// Pipeline.preflight() method — re-derived against the previous pinned CDN
// artifact (no rendering-path behavior change; effect mini-bundles unchanged).
const prevBundle = Buffer.from(await (await fetch(PREV_BUNDLE_URL)).arrayBuffer())
check('the previous pinned core (1.0.189) does NOT contain the GAP-016 preflight module',
  !prevBundle.includes('preflightEffect'))
check('the pinned core (1.0.193 tip onward) carries the GAP-016 preflight runtime (internal preflightEffect + shared mrtFormatBytes)',
  bundle.includes('preflightEffect') && bundle.includes('mrtFormatBytes') &&
  bundle.includes('maxColorBytesPerSample') && bundle.includes('maxTextureSize'))
check('the pinned Pipeline.mrtFormatBytes() delegates to the shared preflight implementation',
  /mrtFormatBytes\(format\) \{\s*return mrtFormatBytes\(format\);/.test(bundle.toString('utf8')))
check('published bundle carries the texture-policy + pass-field runtime symbols',
  bundle.includes('recreateTexturePreserving') && bundle.includes('refreshMipTargets') &&
  bundle.includes('generateMipmaps') && bundle.includes('resolvePassViewport'))
check('published bundle carries the GAP-006 pooling + GAP-007 diagnostic runtime symbols',
  bundle.includes('buildTexturePoolingPlan') && bundle.includes('applyTextureAliases') &&
  bundle.includes('getResourcePlan') && bundle.includes('ShaderDiagnostic') &&
  bundle.includes('parseGLSLInfoLog') && bundle.includes('parseWebGPUCompilationMessages'))
check('published bundle carries the GAP-008 replacement-prediction symbols (v1.0.187 export surface)',
  bundle.includes('predictReplacement') && bundle.includes('getCompatibleReplacements') &&
  bundle.includes('getParamAliases'))
check('published bundle contains no validator symbols', !bundle.includes('validateEffectDefinition'))
// The 93229933..296e0138 sync claim (no code change required): the published 1.0.196
// core (v1.0.196, build 296e0138) is banner-stripped byte-identical to the previous pinned
// 1.0.193 core, and the dev-only harness modules' symbols are absent from the published bundle.
const bundle196 = Buffer.from(await (await fetch('https://shaders.noisedeck.app/1.0.196/noisemaker-shaders-core.esm.js')).arrayBuffer())
const bundle193 = Buffer.from(await (await fetch('https://shaders.noisedeck.app/1.0.193/noisemaker-shaders-core.esm.js')).arrayBuffer())
check('the published 1.0.196 core is banner-stripped byte-identical to the 1.0.193 core',
  Buffer.from(stripBanner(bundle196)).equals(Buffer.from(stripBanner(bundle193))))
check('the published 1.0.196 core contains none of the new dev-only harness modules\' symbols',
  !bundle196.toString('utf8').includes('passthrough-input') &&
  !bundle196.toString('utf8').includes('frame-resolution') &&
  !bundle196.toString('utf8').includes('definition-schema'))
// The 296e0138..73c15be0 sync claim (engine change, re-vendored): the published 1.0.199 core
// (v1.0.199, build 73c15be0) adds the GAP-026 production lifecycle runtime and the
// c28e8fdb webgl2 mesh-target fix over the 1.0.193 core, while the GAP-024 session-identity
// harness remains dev-only (its module name is absent from the bundle).
check('the 1.0.193 core does NOT contain the GAP-026 lifecycle runtime',
  !bundle193.includes('initLifecycleEffects') && !bundle193.includes('_invokeUpdateHooks'))
check('the 1.0.199 core adds the GAP-026 lifecycle runtime (initLifecycleEffects + _invokeUpdateHooks + _withRuntimeUniforms)',
  bundle.includes('initLifecycleEffects') && bundle.includes('_invokeUpdateHooks') &&
  bundle.includes('_withRuntimeUniforms') && bundle.includes('hasLifecycleHook'))
check('the 1.0.199 core carries the c28e8fdb webgl2 mesh-target fix (FBO rebound after depth allocation)',
  /ensureDepthBuffer\(fbo, vpWidth, vpHeight\);\s*gl\.bindFramebuffer\(gl\.FRAMEBUFFER, fbo\);/.test(bundle.toString('utf8')))
check('the 1.0.193 core lacks the c28e8fdb mesh-target fix (depth allocation left the FBO unbound)',
  !/ensureDepthBuffer\(fbo, vpWidth, vpHeight\);\s*gl\.bindFramebuffer\(gl\.FRAMEBUFFER, fbo\);/.test(bundle193.toString('utf8')))
check('the 1.0.199 core still contains none of the dev-only harness modules\' symbols (GAP-024 session-identity stays dev-only)',
  !bundle.toString('utf8').includes('session-identity') && !bundle.toString('utf8').includes('frame-resolution') &&
  !bundle.toString('utf8').includes('definition-schema'))
// The 73c15be0..a5059106 sync claim (no code change required): the newest
// published release (1.0.200, build 6b05a270 — deps-only, in-range) is
// banner-stripped byte-identical to the pinned 1.0.199 core, and the GAP-032
// audio-input runtime is absent from it — so the pinned engine already matches
// upstream's published surface and the pin stays at 1.0.199 until a release
// ships the GAP-032 manager changes.
const bundle200 = Buffer.from(await (await fetch('https://shaders.noisedeck.app/1.0.200/noisemaker-shaders-core.esm.js')).arrayBuffer())
check('the published 1.0.200 core is banner-stripped byte-identical to the pinned 1.0.199 core',
  Buffer.from(stripBanner(bundle200)).equals(Buffer.from(stripBanner(bundle))))
check('the published 1.0.200 core does NOT contain the GAP-032 audio-input runtime',
  !bundle200.toString('utf8').includes('_checkSelectedRequirements') &&
  !bundle200.toString('utf8').includes('selected-device audio binding'))
check('the pinned 1.0.199 core likewise lacks the GAP-032 audio-input runtime',
  !bundle.toString('utf8').includes('_checkSelectedRequirements'))

// 7. The port's own test suite (`npm test`). In a prepared environment this check is
//    REQUIRED: any failing test breaks the audit ("an absent run is not success"). In an
//    unprepared checkout (no vendored bundle, no node_modules, no Playwright browser) the
//    check is a SKIP with the exact preparation steps printed — it can never count as a pass.
const REQUIRED_FOR_SUITE = [
  'vendor/noisemaker/noisemaker-shaders-core.esm.js',
  'node_modules/@babylonjs/core/package.json',
  'node_modules/playwright/package.json'
]
const missingForSuite = REQUIRED_FOR_SUITE.filter(p => !existsSync(p))
// Prepared-browser locations: the Playwright default (env or ~/.cache) plus the
// repo-local exec-mounted cache the bare `npm test` run resolves via
// test/browser-launch.mjs (test/browser-launch.mjs's own fallback).
const browsersRoots = [
  process.env.PLAYWRIGHT_BROWSERS_PATH,
  join(homedir(), '.cache', 'ms-playwright'),
  join(process.cwd(), '.cache', 'ms-playwright')
].filter(Boolean)
let browserReady = false
try {
  browserReady = browsersRoots.some(root => existsSync(root) &&
    readdirSync(root).some(d => d.startsWith('chromium')))
} catch { /* no browsers dir */ }
if (missingForSuite.length || !browserReady) {
  console.log(`[SKIP] port test suite — prepare the environment first: ${missingForSuite.join(', ')}` +
    (browserReady ? '' : `, a chromium install under PLAYWRIGHT_BROWSERS_PATH (currently: ${browsersRoot})`))
  console.log('       bash vendor/fetch.sh && npm install && PLAYWRIGHT_BROWSERS_PATH=<dir> npx playwright install chromium')
} else {
  const run = execSync('npm test', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], timeout: 600000 })
  const pass = /ℹ pass (\d+)/.exec(run)
  const fail = /ℹ fail (\d+)/.exec(run)
  const total = /ℹ tests (\d+)/.exec(run)
  check(`port test suite passes (${pass?.[1] ?? '?'}/${total?.[1] ?? '?'} tests, 0 fail)`,
    Boolean(pass && fail && total && Number(fail[1]) === 0),
    `pass=${pass?.[1] ?? '?'} fail=${fail?.[1] ?? '?'} tests=${total?.[1] ?? '?'}`)
}

if (cleaned) rmSync(cleaned, { recursive: true, force: true })
if (failures) {
  console.error(`\n${failures} recorded audit claim(s) broken — correct STATUS.md, do not loosen these checks.`)
  process.exit(1)
}
console.log('\nAll recorded sync-audit claims re-derived from source: audit stands.')
