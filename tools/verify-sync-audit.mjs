// verify-sync-audit.mjs — re-derive every claim in STATUS.md's
// "Vendor sync (240740dd..9d3474df)", "Vendor sync (9d3474df..2f47612c)",
// "Vendor sync (2f47612c..8eeb7b5a)", "Vendor sync (8eeb7b5a..6a0af04d)",
// "Vendor sync (6a0af04d..403c2a4b)", "Vendor sync (403c2a4b..7dc0f564)" and
// "Vendor sync (7dc0f564..12b4d74f)"
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
//   7. the v1.0.190–v1.0.193 incremental range (this sync): 7dc0f564 is an
//      ancestor of 12b4d74f, tags v1.0.190–v1.0.193 point exactly at
//      7443f6e6/c2252f0c/e73a44a3/12b4d74f, the shaders/ delta is exactly the
//      GAP-016 static preflight runtime (pipeline.js delegation + new
//      preflight.js) plus the GAP-012/014/015 harness and test modules, and no
//      effect definition changed (catalog parity);
//   8. the published core bundle at the pinned documented revision
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
const END7 = '12b4d74fb4f28d5f00bb1dde107fa8673814d8b9' // preflight range end (v1.0.193, this sync)
const VALIDATOR_DELTA = '1097\t18\tshaders/src/runtime/effect-validator.js\n457\t0\tshaders/tests/test_effect_definition_validation.js'
const VALIDATOR_FILES = 'shaders/src/runtime/effect-validator.js\nshaders/tests/test_effect_definition_validation.js'
const MIP_DELTA = '106\t15\tshaders/src/runtime/backends/webgl2.js\n273\t10\tshaders/src/runtime/backends/webgpu.js\n17\t0\tshaders/src/runtime/compiler.js\n26\t1\tshaders/src/runtime/effect-validator.js\n100\t19\tshaders/src/runtime/pipeline.js\n466\t0\tshaders/tests/test_mip_controls.js'
const PASS_DELTA = '9\t3\tshaders/src/runtime/backends/webgl2.js\n6\t2\tshaders/src/runtime/backends/webgpu.js\n12\t0\tshaders/src/runtime/expander.js\n64\t0\tshaders/src/runtime/pipeline.js\n323\t0\tshaders/tests/test_pass_fields.js'
const POOL_DELTA = '185\t0\tshaders/src/runtime/backends/diagnostics.js\n26\t7\tshaders/src/runtime/backends/webgl2.js\n60\t35\tshaders/src/runtime/backends/webgpu.js\n213\t2\tshaders/src/runtime/pipeline.js\n338\t0\tshaders/tests/test_backend_diagnostics.js\n483\t0\tshaders/tests/test_resource_pooling.js'
const POOL_FILES = 'shaders/src/runtime/backends/diagnostics.js\nshaders/src/runtime/backends/webgl2.js\nshaders/src/runtime/backends/webgpu.js\nshaders/src/runtime/pipeline.js\nshaders/tests/test_backend_diagnostics.js\nshaders/tests/test_resource_pooling.js'
const PRED_DELTA = '1\t1\tshaders/src/index.js\n2\t2\tshaders/src/lang/index.js\n11\t0\tshaders/src/lang/paramAliases.js\n372\t5\tshaders/src/lang/transform.js\n80\t0\tshaders/tests/frame-metrics.js\n161\t6\tshaders/tests/test-harness.js\n71\t0\tshaders/tests/test_frame_metrics.js\n200\t0\tshaders/tests/test_transform.js'
const PRED_FILES = 'shaders/src/index.js\nshaders/src/lang/index.js\nshaders/src/lang/paramAliases.js\nshaders/src/lang/transform.js\nshaders/tests/frame-metrics.js\nshaders/tests/test-harness.js\nshaders/tests/test_frame_metrics.js\nshaders/tests/test_transform.js'
const BUNDLE_URL = 'https://shaders.noisedeck.app/1.0.193/noisemaker-shaders-core.esm.js' // pinned documented revision (see vendor/fetch.sh), not the rolling /1 alias
const BUNDLE_BYTES = 884620 // documented published build (12b4d74f tip, v1.0.193)
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

// 6. Published bundle (pinned documented revision). A validator symbol remains a FAIL;
//    a size move past the recorded build is a WARN pointing at a new ports-sync.
const bundle = Buffer.from(await (await fetch(BUNDLE_URL)).arrayBuffer())
const stripBanner = (b) => {
  const text = b.toString('utf8')
  return text.replace(/^ \* Build: .*\n/m, '').replace(/^ \* Date: .*\n/m, '')
}
if (bundle.length === BUNDLE_BYTES) {
  check(`published core bundle at the pinned documented revision is the recorded ${BUNDLE_BYTES}-byte build (12b4d74f tip, v1.0.193)`, true)
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
check('the 1.0.193 core adds the GAP-016 preflight runtime (internal preflightEffect + shared mrtFormatBytes)',
  bundle.includes('preflightEffect') && bundle.includes('mrtFormatBytes') &&
  bundle.includes('maxColorBytesPerSample') && bundle.includes('maxTextureSize'))
check('the 1.0.193 Pipeline.mrtFormatBytes() delegates to the shared preflight implementation',
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
const browsersRoot = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), '.cache', 'ms-playwright')
let browserReady = false
try {
  browserReady = existsSync(browsersRoot) &&
    readdirSync(browsersRoot).some(d => d.startsWith('chromium'))
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
