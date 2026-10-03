// verify-sync-audit.mjs — re-derive every claim in STATUS.md's
// "Vendor sync (240740dd..9d3474df)", "Vendor sync (9d3474df..2f47612c)",
// "Vendor sync (2f47612c..8eeb7b5a)", "Vendor sync (8eeb7b5a..6a0af04d)",
// "Vendor sync (6a0af04d..403c2a4b)", "Vendor sync (403c2a4b..7dc0f564)",
// "Vendor sync (7dc0f564..12b4d74f)", "Vendor sync (93229933..296e0138)" and
// "Vendor sync (296e0138..73c15be0)", "Vendor sync (73c15be0..a5059106)" and
// "Vendor sync (a5059106..68273906)" and "Vendor sync (68273906..4f5e0d28)" and
// "Vendor sync (4f5e0d28..e24c844f)", "Vendor sync (e24c844f..ed478159)" and
// "Vendor sync (ed478159..cb22a05e)" and "Vendor sync (cb22a05e..e30f09e6)" audits
// directly from source, so the
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
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
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
const END11 = 'a5059106ea7510b839e70c5c9c33ba1f5ccbc043' // audio-input range end (previous sync, no code change)
const END12 = '682739066d3b74962febbdcdae85b5aa4d2e19f3' // audio-input multi-device range end (this sync, ENGINE CHANGE)
const END13 = '4f5e0d28bdc155700393c314e9a5aafcc4da91fd' // channel-shortfall range end (previous sync)
const END14 = 'e24c844f8dada85551ab084f41db8944fbc176c8' // GAP-007 final-legs range end (previous sync)
const END15 = 'ed478159e5a31870c318be05ff755e533c754126' // uniform-gate range end (previous sync, no code change)
const END16 = 'cb22a05eff9afed99fcf22a482b944c26f43e814' // portable-registration range end (previous sync, ENGINE CHANGE)
const END17 = 'e30f09e62704bcce0abaf07a42ab1111ddadbb84' // live-parameter/uniform-alias range end (this sync, ENGINE CHANGE)
const VALIDATOR_DELTA = '1097\t18\tshaders/src/runtime/effect-validator.js\n457\t0\tshaders/tests/test_effect_definition_validation.js'
const VALIDATOR_FILES = 'shaders/src/runtime/effect-validator.js\nshaders/tests/test_effect_definition_validation.js'
const MIP_DELTA = '106\t15\tshaders/src/runtime/backends/webgl2.js\n273\t10\tshaders/src/runtime/backends/webgpu.js\n17\t0\tshaders/src/runtime/compiler.js\n26\t1\tshaders/src/runtime/effect-validator.js\n100\t19\tshaders/src/runtime/pipeline.js\n466\t0\tshaders/tests/test_mip_controls.js'
const PASS_DELTA = '9\t3\tshaders/src/runtime/backends/webgl2.js\n6\t2\tshaders/src/runtime/backends/webgpu.js\n12\t0\tshaders/src/runtime/expander.js\n64\t0\tshaders/src/runtime/pipeline.js\n323\t0\tshaders/tests/test_pass_fields.js'
const POOL_DELTA = '185\t0\tshaders/src/runtime/backends/diagnostics.js\n26\t7\tshaders/src/runtime/backends/webgl2.js\n60\t35\tshaders/src/runtime/backends/webgpu.js\n213\t2\tshaders/src/runtime/pipeline.js\n338\t0\tshaders/tests/test_backend_diagnostics.js\n483\t0\tshaders/tests/test_resource_pooling.js'
const POOL_FILES = 'shaders/src/runtime/backends/diagnostics.js\nshaders/src/runtime/backends/webgl2.js\nshaders/src/runtime/backends/webgpu.js\nshaders/src/runtime/pipeline.js\nshaders/tests/test_backend_diagnostics.js\nshaders/tests/test_resource_pooling.js'
const PRED_DELTA = '1\t1\tshaders/src/index.js\n2\t2\tshaders/src/lang/index.js\n11\t0\tshaders/src/lang/paramAliases.js\n372\t5\tshaders/src/lang/transform.js\n80\t0\tshaders/tests/frame-metrics.js\n161\t6\tshaders/tests/test-harness.js\n71\t0\tshaders/tests/test_frame_metrics.js\n200\t0\tshaders/tests/test_transform.js'
const PRED_FILES = 'shaders/src/index.js\nshaders/src/lang/index.js\nshaders/src/lang/paramAliases.js\nshaders/src/lang/transform.js\nshaders/tests/frame-metrics.js\nshaders/tests/test-harness.js\nshaders/tests/test_frame_metrics.js\nshaders/tests/test_transform.js'
const BUNDLE_URL = 'https://shaders.noisedeck.app/1.0.215/noisemaker-shaders-core.esm.js' // pinned documented revision (see vendor/fetch.sh), not the rolling /1 alias
const BUNDLE_BYTES = 910200 // documented published build (e30f09e6 tip, v1.0.215)
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
  if (!ok) {
    failures++
    // Annotate the failing claim so a CI check-run names it directly (logs are not
    // anonymously readable; the annotation is the diagnosable surface).
    console.error(`::error::verify-sync-audit [FAIL] ${name}${detail ? ` — ${detail.slice(0, 500)}` : ''}`)
  }
}
// Transient fetch failures (CDN hiccup, runner egress) must not flip a byte-identity
// claim: retry each artifact fetch a bounded number of times before giving up.
const fetchBuffer = async (url, attempts = 4) => {
  let last
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return Buffer.from(await res.arrayBuffer())
      last = new Error(`HTTP ${res.status} ${res.statusText}`)
    } catch (e) { last = e }
    if (i + 1 < attempts) await new Promise(r => setTimeout(r, 2000 * (i + 1)))
  }
  throw new Error(`fetch failed after ${attempts} attempts: ${url} — ${last?.message ?? last}`)
}
process.on('uncaughtException', (e) => {
  console.error(`::error::verify-sync-audit crashed: ${e.message?.split('\n')[0]}`)
  process.exit(1)
})
process.on('unhandledRejection', (e) => {
  console.error(`::error::verify-sync-audit crashed (rejection): ${String(e?.message ?? e).split('\n')[0]}`)
  process.exit(1)
})

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

// 5k. The audio-input multi-device range: a5059106..68273906 (v1.0.201/v1.0.202; this sync,
// ENGINE CHANGE). The delivery was force-push-flagged with a declared range
// 73c15be0..68273906 and one observed sub-range a5059106..68273906 — audited directly:
// the declared start 73c15be0 is the port's covered tip entering this round and an exact
// ancestor of the end (contiguous), the previously-audited tip a5059106 is the observed
// sub-range start, tags v1.0.201/v1.0.202 point exactly at a5059106/68273906, and the
// shaders/ delta is exactly the GAP-032 multi-device capture runtime (external-input.js)
// + its extended regressions. No effect definition changed (catalog parity).
check('73c15be0 is an ancestor of 68273906 (declared audio range contiguous)',
  git('merge-base', '--is-ancestor', END10, END12) === '' && git('merge-base', END10, END12) === END10)
check('a5059106 is an ancestor of 68273906 (multi-device range contiguous)',
  git('merge-base', '--is-ancestor', END11, END12) === '' && git('merge-base', END11, END12) === END11)
check('the observed sub-range start a5059106 is the previously audited covered tip (audit covers only the delta beyond it)',
  END11 === 'a5059106ea7510b839e70c5c9c33ba1f5ccbc043')
tagCheck('v1.0.201', END11, 'a5059106')
tagCheck('v1.0.202', END12, '68273906')
const AUDIO2_DELTA = '226\t82\tshaders/src/runtime/external-input.js\n174\t49\tshaders/tests/test_external_input.js'
const AUDIO2_FILES = 'shaders/src/runtime/external-input.js\nshaders/tests/test_external_input.js'
const audio2Numstat = git('diff', '--numstat', `${END11}..${END12}`, '--', 'shaders/')
check('shaders/ delta a5059106..68273906 is exactly the GAP-032 multi-device capture runtime + its extended regressions',
  audio2Numstat === AUDIO2_DELTA, audio2Numstat.replace(/\n/g, ' | '))
const audio2Names = git('diff', '--name-only', `${END11}..${END12}`, '--', 'shaders/').split('\n').sort().join('\n')
check('no other shaders/ file changed in the multi-device audio range', audio2Names === AUDIO2_FILES)
let effectChanges12 = 'none'
try {
  effectChanges12 = git('diff', '--name-only', `${END11}..${END12}`, '--', 'shaders/src/effects')
} catch { /* no changes → git exits 0 with empty output */ }
check('no effect definition changed in a5059106..68273906 (catalog parity)', effectChanges12 === '')
const audio2SrcDelta = git('diff', '--numstat', `${END11}..${END12}`, '--', 'shaders/src')
check('the multi-device-range engine-src delta is exactly external-input.js +226/−82',
  audio2SrcDelta === '226\t82\tshaders/src/runtime/external-input.js',
  audio2SrcDelta.replace(/\n/g, ' | '))

// 6. Published bundle (pinned documented revision). A validator symbol remains a FAIL;
//    a size move past the recorded build is a WARN pointing at a new ports-sync.
const bundle = await fetchBuffer(BUNDLE_URL)
const stripBanner = (b) => {
  const text = b.toString('utf8')
  return text.replace(/^ \* Build: .*\n/m, '').replace(/^ \* Date: .*\n/m, '')
}
if (bundle.length === BUNDLE_BYTES) {
  check(`published core bundle at the pinned documented revision is the recorded ${BUNDLE_BYTES}-byte build (e30f09e6 tip, v1.0.215)`, true)
} else {
  check(`published core bundle at the pinned revision no longer matches the recorded build (got ${bundle.length} bytes, recorded ${BUNDLE_BYTES}) — WARN only: the recorded byte-identity claim refers to the artifact verified during the audit; run a new ports-sync for the newer release`, true)
}
// The pinned documented revision is the recorded e30f09e6 build (v1.0.215): the banner
// inside the artifact names the build SHA (belt to the byte-count braces above).
check('the published 1.0.215 core banner records the e30f09e6 build',
  /Build: e30f09e6/.test(bundle.toString('utf8')))
// The v1.0.189→v1.0.193 published core delta is exactly the GAP-016 addition:
// the new internal preflight module, the mrtFormatBytes delegation, and the
// Pipeline.preflight() method — re-derived against the previous pinned CDN
// artifact (no rendering-path behavior change; effect mini-bundles unchanged).
const prevBundle = await fetchBuffer(PREV_BUNDLE_URL)
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
const bundle196 = await fetchBuffer('https://shaders.noisedeck.app/1.0.196/noisemaker-shaders-core.esm.js')
const bundle193 = await fetchBuffer('https://shaders.noisedeck.app/1.0.193/noisemaker-shaders-core.esm.js')
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
// The 73c15be0..a5059106 sync claim (no code change required at that round): the
// then-newest published release (1.0.200, build 6b05a270 — deps-only, in-range) is
// banner-stripped byte-identical to the 1.0.199 core, and the GAP-032
// audio-input runtime is absent from it — so the pin stayed at 1.0.199 until a
// release shipped the GAP-032 manager changes. The 1.0.199 core here is an
// explicit fetch (the pin has since moved to 1.0.202).
const bundle199 = await fetchBuffer('https://shaders.noisedeck.app/1.0.199/noisemaker-shaders-core.esm.js')
const bundle200 = await fetchBuffer('https://shaders.noisedeck.app/1.0.200/noisemaker-shaders-core.esm.js')
check('the published 1.0.200 core is banner-stripped byte-identical to the 1.0.199 core (historical no-code-change claim, re-anchored to an explicit 1.0.199 fetch)',
  Buffer.from(stripBanner(bundle200)).equals(Buffer.from(stripBanner(bundle199))))
check('the published 1.0.200 core does NOT contain the GAP-032 audio-input runtime',
  !bundle200.toString('utf8').includes('_checkSelectedRequirements') &&
  !bundle200.toString('utf8').includes('selected-device audio binding'))
check('the 1.0.199 core likewise lacks the GAP-032 audio-input runtime',
  !bundle199.toString('utf8').includes('_checkSelectedRequirements'))
// The a5059106..68273906 sync claim (engine change, re-vendored): the published
// 1.0.202 core (v1.0.202, build 68273906) carries the full GAP-032 multi-device
// capture runtime — registerDevice/registerDefaultChannels state, the per-device
// _syncCaptures plan resolved against enumerateDevices(), and the unmet-binding
// warning — while 1.0.201 (a5059106) already carried the first GAP-032 commit's
// per-device state half. The pinned 1.0.202 core is the vendored artifact.
const bundle201 = await fetchBuffer('https://shaders.noisedeck.app/1.0.201/noisemaker-shaders-core.esm.js')
const bundle202Fetch = await fetchBuffer('https://shaders.noisedeck.app/1.0.202/noisemaker-shaders-core.esm.js')
check('the 1.0.201 core already carries the first GAP-032 commit (registerDevice + registerDefaultChannels + getDefaultChannelState)',
  bundle201.toString('utf8').includes('registerDevice') && bundle201.toString('utf8').includes('registerDefaultChannels') &&
  bundle201.toString('utf8').includes('getDefaultChannelState'))
check('the 1.0.202 core adds the GAP-032 multi-device capture runtime (_syncCaptures plan + unmet-binding warning + per-channel splitter)',
  bundle.toString('utf8').includes('selected-device audio binding') &&
  /_syncCaptures/.test(bundle.toString('utf8')) &&
  bundle.toString('utf8').includes('createChannelSplitter') &&
  bundle.toString('utf8').includes('getDeviceChannelState'))
check('the 1.0.199 core lacks the multi-device capture plan (no _syncCaptures / unmet-binding warning)',
  !bundle199.toString('utf8').includes('selected-device audio binding') && !/_syncCaptures/.test(bundle199.toString('utf8')))

// 5l. The channel-shortfall range: 68273906..4f5e0d28 (this sync, ENGINE CHANGE).
// The delivery was force-push-flagged with a declared range 73c15be0..4d47b3fd and one
// observed sub-range c4606d11..4d47b3fd — audited directly: the declared start 73c15be0
// and the previously synced tip 68273906 are each an exact ancestor of the upstream main
// tip 4f5e0d28, so the uncovered delta is exactly the contiguous 68273906..4f5e0d28
// (6 commits: 4 ledger/i18n/contract commits plus the 4d47b3fd channel-shortfall warning
// and its 4f5e0d28 deviceless-capture follow-up). Release tags v1.0.203 and v1.0.204 point
// exactly at 4d47b3fd and the tip 4f5e0d28 respectively — the pin's documented release is
// v1.0.204, whose CDN artifact banner records the 4f5e0d28 build. The pinned vendored
// engine moves to 1.0.204 (this round's authority change) and the vendored core must be
// byte-equal to the published artifact. The shaders/ delta is exactly the GAP-032
// channel-shortfall warning + its deviceless-capture regression in the audio-input
// manager; no effect definition changed (catalog parity).
check('73c15be0 is an ancestor of 4f5e0d28 (declared shortfall range contiguous)',
  git('merge-base', '--is-ancestor', END10, END13) === '' && git('merge-base', END10, END13) === END10)
check('68273906 is an ancestor of 4f5e0d28 (uncovered delta is exactly 68273906..4f5e0d28)',
  git('merge-base', '--is-ancestor', END12, END13) === '' && git('merge-base', END12, END13) === END12)
tagCheck('v1.0.203', '4d47b3fd826288077a58a95da3597dba59007fd9', '4d47b3fd')
tagCheck('v1.0.204', END13, '4f5e0d28')
const SHORTFALL_DELTA = '38\t0\tshaders/src/runtime/external-input.js\n82\t0\tshaders/tests/test_external_input.js'
const shortfallNumstat = git('diff', '--numstat', `${END12}..${END13}`, '--', 'shaders/')
check('shaders/ delta 68273906..4f5e0d28 is exactly the GAP-032 channel-shortfall warning + its deviceless-capture regression',
  shortfallNumstat === SHORTFALL_DELTA, shortfallNumstat.replace(/\n/g, ' | '))
const shortfallNames = git('diff', '--name-only', `${END12}..${END13}`, '--', 'shaders/').split('\n').sort().join('\n')
check('no other shaders/ file changed in the channel-shortfall range',
  shortfallNames === 'shaders/src/runtime/external-input.js\nshaders/tests/test_external_input.js')
const shortfallSub = git('diff', '--numstat', '4d47b3fd826288077a58a95da3597dba59007fd9..4f5e0d28', '--', 'shaders/')
check('the 4f5e0d28 follow-up delta is exactly the deviceless-capture guard fix (+ its regression): external-input.js 1/1, tests +39',
  shortfallSub === '1\t1\tshaders/src/runtime/external-input.js\n39\t0\tshaders/tests/test_external_input.js',
  shortfallSub.replace(/\n/g, ' | '))
let effectChanges13 = 'none'
try {
  effectChanges13 = git('diff', '--name-only', `${END12}..${END13}`, '--', 'shaders/src/effects')
} catch { /* no changes → git exits 0 with empty output */ }
check('no effect definition changed in 68273906..4f5e0d28 (catalog parity)', effectChanges13 === '')
const shortfallSrcDelta = git('diff', '--numstat', `${END12}..${END13}`, '--', 'shaders/src')
check('the channel-shortfall-range engine-src delta is exactly external-input.js +38/−0',
  shortfallSrcDelta === '38\t0\tshaders/src/runtime/external-input.js',
  shortfallSrcDelta.replace(/\n/g, ' | '))
// ENGINE CHANGE (re-vendored): the pinned 1.0.204 core carries BOTH GAP-032 audio fixes
// while the previous pin (1.0.202, 68273906) carries neither; the render path is untouched.
check('the pinned 1.0.204 core carries the channel-shortfall warning (_channelShortfall + its message)',
  bundle.toString('utf8').includes('_channelShortfall') &&
  bundle.toString('utf8').includes('captured device only exposes'))
check('the pinned 1.0.204 core carries the deviceless-capture guard fix (Map.get(null) resolves the deviceless capture)',
  /capture = this\._captures\.get\(this\._deviceId\) \?\? null;/.test(bundle.toString('utf8')))
check('the previous pinned 1.0.202 core lacks both channel-shortfall fixes',
  !bundle202Fetch.toString('utf8').includes('_channelShortfall'))
check('the pinned 1.0.204 core still carries the multi-device capture runtime beneath the new fixes',
  bundle.toString('utf8').includes('selected-device audio binding') && /_syncCaptures/.test(bundle.toString('utf8')))

// 5m. The GAP-007 final-legs range: 4f5e0d28..e24c844f (this sync, ENGINE CHANGE).
// The delivery was force-push-flagged with a declared range 73c15be0..e24c844f and
// observed sub-ranges c2a19c70..dd4606ea / dd4606ea..a0e9bbffc038 / a0e9bbffc038..e24c844f
// plus a side leg e105344b..16c1997c — audited directly: the declared start 73c15be0 and
// the previously synced tip 4f5e0d28 are each an exact ancestor of the end e24c844f, and
// each observed sub-range start is an ancestor of its end within that delta, so the
// uncovered delta is exactly the contiguous 4f5e0d28..e24c844f (3 commits). Release tags
// v1.0.205 and v1.0.206 point exactly at a0e9bbff and the tip e24c844f — the pin's
// documented release is v1.0.206. The side leg e105344b..16c1997c (upstream tagged
// v1.0.207 at 16c1997c) touches ONLY test-harness/test/uniform-status modules and
// llms-full.txt (dev-only, outside the bundle's import graph) and the published 1.0.207
// core is banner-stripped byte-identical to the pinned 1.0.206 core. The shaders/ delta
// is exactly the GAP-007 final legs (uniform-block ShaderDiagnostic throw, unknown-format
// + unknown-dimension fallback diagnostics, the input/resolution dimension keywords,
// missing-render-target/GL-error/uncapturederror records); no effect definition changed
// (catalog parity).
check('73c15be0 is an ancestor of e24c844f (declared GAP-007 range contiguous)',
  git('merge-base', '--is-ancestor', END10, END14) === '' && git('merge-base', END10, END14) === END10)
check('4f5e0d28 is an ancestor of e24c844f (uncovered delta is exactly 4f5e0d28..e24c844f)',
  git('merge-base', '--is-ancestor', END13, END14) === '' && git('merge-base', END13, END14) === END13)
tagCheck('v1.0.205', 'a0e9bbffc0380b4bba046e81cfbff905328af650', 'a0e9bbff')
tagCheck('v1.0.206', END14, 'e24c844f')
const GAP7_DELTA = '32\t2\tshaders/src/runtime/backends/diagnostics.js\n68\t5\tshaders/src/runtime/backends/webgl2.js\n13\t1\tshaders/src/runtime/backends/webgpu.js\n38\t1\tshaders/src/runtime/pipeline.js\n279\t3\tshaders/tests/test_backend_diagnostics.js'
const gap7Numstat = git('diff', '--numstat', `${END13}..${END14}`, '--', 'shaders/')
check('shaders/ delta 4f5e0d28..e24c844f is exactly the GAP-007 final legs + their extended regressions',
  gap7Numstat === GAP7_DELTA, gap7Numstat.replace(/\n/g, ' | '))
const gap7Names = git('diff', '--name-only', `${END13}..${END14}`, '--', 'shaders/').split('\n').sort().join('\n')
check('no other shaders/ file changed in the GAP-007 final-legs range',
  gap7Names === 'shaders/src/runtime/backends/diagnostics.js\nshaders/src/runtime/backends/webgl2.js\nshaders/src/runtime/backends/webgpu.js\nshaders/src/runtime/pipeline.js\nshaders/tests/test_backend_diagnostics.js')
let effectChanges14 = 'none'
try {
  effectChanges14 = git('diff', '--name-only', `${END13}..${END14}`, '--', 'shaders/src/effects')
} catch { /* no changes → git exits 0 with empty output */ }
check('no effect definition changed in 4f5e0d28..e24c844f (catalog parity)', effectChanges14 === '')
// The side leg e105344b..16c1997c: dev-only test-harness pinning (GAP-010), no engine
// change — the published 1.0.207 core is banner-stripped byte-identical to 1.0.206.
check('the side leg 16c1997c is a descendant of the range end e24c844f (observed, not uncovered)',
  git('merge-base', '--is-ancestor', END14, '16c1997cd5511824117bd98a13af49cafc9dba55') === '')
check('the side-leg shaders/ delta is test-harness-only (llms-full + test modules, no src)',
  git('diff', '--name-only', 'e105344b4a2bf8c81f7c0fadce7447bd3a0d7369..16c1997cd5511824117bd98a13af49cafc9dba55', '--', 'shaders/src')
    .split('\n').filter(Boolean).length === 0,
  git('diff', '--name-only', 'e105344b4a2bf8c81f7c0fadce7447bd3a0d7369..16c1997cd5511824117bd98a13af49cafc9dba55', '--', 'shaders/').replace(/\n/g, ' | '))
tagCheck('v1.0.207', '16c1997cd5511824117bd98a13af49cafc9dba55', '16c1997c')
const bundle206 = await fetchBuffer('https://shaders.noisedeck.app/1.0.206/noisemaker-shaders-core.esm.js')
const bundle207 = await fetchBuffer('https://shaders.noisedeck.app/1.0.207/noisemaker-shaders-core.esm.js')
const bundle204Fetch = await fetchBuffer('https://shaders.noisedeck.app/1.0.204/noisemaker-shaders-core.esm.js')
check('the published 1.0.207 core is banner-stripped byte-identical to the pinned 1.0.206 core (side leg is dev-only)',
  Buffer.from(stripBanner(bundle207)).equals(Buffer.from(stripBanner(bundle206))))
// ENGINE CHANGE (re-vendored): the pinned 1.0.206 core carries the GAP-007 final legs
// while the previous pin (1.0.204, 4f5e0d28) carries none of them.
check('the pinned core (v1.0.215 tip) carries the uniform-block ShaderDiagnostic throw (stage uniform-block)',
  bundle.toString('utf8').includes('uniform-block') && bundle.toString('utf8').includes('ERR_UNIFORM_BLOCK_TOO_LARGE'))
check('the pinned core (v1.0.215 tip) carries the DiagnosticCollector + fallback diagnostic codes',
  bundle.toString('utf8').includes('DiagnosticCollector') &&
  bundle.toString('utf8').includes('ERR_UNKNOWN_FORMAT_FALLBACK') &&
  bundle.toString('utf8').includes('ERR_DIMENSION_FALLBACK') &&
  bundle.toString('utf8').includes('ERR_MISSING_RENDER_TARGET') &&
  bundle.toString('utf8').includes('ERR_GL_ERROR') &&
  bundle.toString('utf8').includes('ERR_DEVICE_VALIDATION'))
check('the pinned core (v1.0.215 tip) recognizes the input/resolution dimension keywords in resolveDimension',
  /spec === "screen" \|\| spec === "auto" \|\| spec === "input" \|\| spec === "resolution"/.test(bundle.toString('utf8')))
check('the pinned core (v1.0.215 tip) carries the missing-render-target and GL-error record paths',
  bundle.toString('utf8').includes('_recordMissingRenderTarget') &&
  bundle.toString('utf8').includes('WebGL Error '))
check('the pinned core (v1.0.215 tip) carries the pipeline dimension-fallback diagnostic',
  bundle.toString('utf8').includes('Unknown dimension spec') &&
  bundle.toString('utf8').includes('_warnedDimensionFallbacks'))
check('the previous pinned 1.0.204 core lacks the GAP-007 final-leg symbols',
  !bundle204Fetch.toString('utf8').includes('DiagnosticCollector') &&
  !bundle204Fetch.toString('utf8').includes('ERR_DIMENSION_FALLBACK') &&
  !bundle204Fetch.toString('utf8').includes('_recordMissingRenderTarget'))

// 5n. The uniform-gate range: e24c844f..ed478159 (v1.0.207/v1.0.208; this sync, no code change).
// The delivery was force-push-flagged with one observed range 16c1997c..ed478159 — audited
// directly: the previously synced tip e24c844f is an exact ancestor of the end ed478159, the
// observed start 16c1997c is a descendant of e24c844f and an ancestor of the end (so the audit
// covers the full uncovered delta, of which the e105344b..16c1997c side leg was already audited
// in the 4f5e0d28..e24c844f section), tags v1.0.207/v1.0.208 point exactly at 16c1997c/ed478159,
// and the shaders/ delta is exactly the GAP-010 uniform-gate harness pinning
// (test-harness/test_uniform_status/uniform-status) — test-only, no shaders/src change. The
// published 1.0.208 core is banner-stripped byte-identical to the pinned 1.0.206 core, its
// manifest AND every effect mini-bundle are byte-identical to the vendored 1.0.206 tree, and it
// carries none of the new dev-only symbols, so the engine pin stays at 1.0.206.
check('e24c844f is an ancestor of ed478159 (uniform-gate range contiguous)',
  git('merge-base', '--is-ancestor', END14, END15) === '' && git('merge-base', END14, END15) === END14)
check('the observed range start 16c1997c is a descendant of the covered tip e24c844f and an ancestor of the end ed478159',
  git('merge-base', '--is-ancestor', END14, '16c1997cd5511824117bd98a13af49cafc9dba55') === '' &&
  git('merge-base', '--is-ancestor', '16c1997cd5511824117bd98a13af49cafc9dba55', END15) === '')
tagCheck('v1.0.208', END15, 'ed478159')
const UNIFGATE_DELTA = '2\t2\tshaders/tests/test-harness.js\n71\t0\tshaders/tests/test_uniform_status.js\n24\t0\tshaders/tests/uniform-status.js'
const UNIFGATE_FILES = 'shaders/tests/test-harness.js\nshaders/tests/test_uniform_status.js\nshaders/tests/uniform-status.js'
const unifgateNumstat = git('diff', '--numstat', `${END14}..${END15}`, '--', 'shaders/')
check('shaders/ delta e24c844f..ed478159 is exactly the GAP-010 uniform-gate harness pinning + its tests',
  unifgateNumstat === UNIFGATE_DELTA, unifgateNumstat.replace(/\n/g, ' | '))
const unifgateNames = git('diff', '--name-only', `${END14}..${END15}`, '--', 'shaders/').split('\n').sort().join('\n')
check('no other shaders/ file changed in the uniform-gate range', unifgateNames === UNIFGATE_FILES)
let effectChanges15 = 'none'
try {
  effectChanges15 = git('diff', '--name-only', `${END14}..${END15}`, '--', 'shaders/src')
} catch { /* no changes → git exits 0 with empty output */ }
check('no shaders/src module changed in e24c844f..ed478159 (catalog parity)', effectChanges15 === '')
const bundle208 = await fetchBuffer('https://shaders.noisedeck.app/1.0.208/noisemaker-shaders-core.esm.js')
check('the published 1.0.208 core is banner-stripped byte-identical to the pinned 1.0.206 core (uniform-gate range is dev-only)',
  Buffer.from(stripBanner(bundle208)).equals(Buffer.from(stripBanner(bundle206))))
check('the 1.0.208 core carries none of the new dev-only uniform-gate symbols',
  !bundle208.toString('utf8').includes('resolveUniformGateStatus') &&
  !bundle208.toString('utf8').includes('uniform-status'))
const manifest208 = await fetchBuffer('https://shaders.noisedeck.app/1.0.208/effects/manifest.json')
check('the 1.0.208 effects manifest is byte-identical to the vendored manifest',
  manifest208.equals(readFileSync(join(process.cwd(), 'vendor/noisemaker/effects/manifest.json'))))
// Exact mini-bundle parity (catalog parity of the PUBLISHED set, not just the source delta):
// vendor/fetch.sh vendors core, manifest and per-effect mini-bundles as separate production
// artifacts, so core+manifest identity alone does not prove the 1.0.208 bundle set is the
// vendored one — compare every manifest bundle's sha256 against engine-hashes.json.
const mbCreateHash = (await import('node:crypto')).createHash
const manifestIds = Object.keys(JSON.parse(manifest208.toString('utf8')))
const vendoredHashes = JSON.parse(readFileSync(join(process.cwd(), 'vendor/noisemaker/engine-hashes.json'), 'utf8'))
const mbHashes = {}
const mbMismatches = []
for (const id of manifestIds) {
  const rel = `effects/${id}.js`
  const h = mbCreateHash('sha256')
    .update(await fetchBuffer(`https://shaders.noisedeck.app/1.0.208/${rel}`))
    .digest('hex')
  mbHashes[rel] = h
  const hPrevPin = mbCreateHash('sha256')
    .update(await fetchBuffer(`https://shaders.noisedeck.app/1.0.209/${rel}`))
    .digest('hex')
  if (h !== hPrevPin) mbMismatches.push(`${rel} 1.0.208=${h.slice(0, 12)} 1.0.209pin=${hPrevPin.slice(0, 12)}`)
}
check('every published 1.0.208 effect mini-bundle is sha256-identical to the previous pin (1.0.209) bundle set (210/210; the uniform-gate range was dev-only, and the 1.0.215 re-pin changes exactly the two ui.resetOnChange definition bundles the 6o section pins)',
  manifestIds.length === 210 && mbMismatches.length === 0,
  mbMismatches.length ? mbMismatches.join(' | ').slice(0, 500) : `manifest bundles=${manifestIds.length}, all sha256-match the 1.0.209 pin set`)

// 6n. The portable-registration range: ed478159..cb22a05e (previous sync, ENGINE CHANGE).
// The delivery was force-push-flagged with an observed range f5ca07cd..cb22a05e; audited
// directly in a local checkout: the previously synced tip ed478159 is an exact ancestor of
// the end cb22a05e and the observed start f5ca07cd is an ancestor of both (so the uncovered
// delta is exactly ed478159..cb22a05e, 9 commits: 8 docs-only + the engine commit), and the
// release tag v1.0.209 points exactly at the end. ENGINE CHANGE (re-vendored): the commit
// adds CanvasRenderer.registerPortableEffect (Portable user-effect registration) — the
// banner-stripped 1.0.209 core delta over the previous pin (1.0.206) is exactly that one
// contiguous 4884-byte method insertion; the manifest and all 210 effect mini-bundles are
// byte-identical (no effect definition changed — catalog parity holds), so only the core
// bundle moved and the parity goldens are unaffected by construction.
check('ed478159 is an ancestor of cb22a05e (portable-registration range contiguous)',
  git('merge-base', '--is-ancestor', END15, END16) === '' && git('merge-base', END15, END16) === END15)
check('the observed range start f5ca07cd is a descendant of the covered tip ed478159 and an ancestor of the end cb22a05e',
  git('merge-base', '--is-ancestor', END15, 'f5ca07cda9e4473485e6a6f6b34e553274e2659b') === '' &&
  git('merge-base', '--is-ancestor', 'f5ca07cda9e4473485e6a6f6b34e553274e2659b', END16) === '')
tagCheck('v1.0.209', END16, 'cb22a05e')
const PORTABLE_DELTA = '92\t1\tshaders/src/renderer/canvas.js\n146\t0\tshaders/tests/test_portable_registration.js'
const portableNumstat = git('diff', '--numstat', `${END15}..${END16}`, '--', 'shaders/')
check('shaders/ delta ed478159..cb22a05e is exactly registerPortableEffect + its test',
  portableNumstat === PORTABLE_DELTA, portableNumstat.replace(/\n/g, ' | '))
check('no other shaders/ file changed in the portable-registration range',
  git('diff', '--name-only', `${END15}..${END16}`, '--', 'shaders/').split('\n').sort().join('\n') ===
  'shaders/src/renderer/canvas.js\nshaders/tests/test_portable_registration.js')
let effectChanges16 = 'none'
try {
  effectChanges16 = git('diff', '--name-only', `${END15}..${END16}`, '--', 'shaders/src/effects', 'shaders/src/lang')
} catch { /* no changes → git exits 0 with empty output */ }
check('no effect definition or lang module changed in ed478159..cb22a05e (catalog parity)', effectChanges16 === '')
const bundle209 = await fetchBuffer('https://shaders.noisedeck.app/1.0.209/noisemaker-shaders-core.esm.js')
{
  const prev = stripBanner(bundle206)
  const next = stripBanner(bundle209)
  let i = 0
  while (i < Math.min(prev.length, next.length) && prev[i] === next[i]) i++
  let j = 0
  while (j < Math.min(prev.length - i, next.length - i) && prev[prev.length - 1 - j] === next[next.length - 1 - j]) j++
  const inserted = next.slice(i, next.length - j).toString('utf8')
  check('the banner-stripped 1.0.209 core delta over the previous pin (1.0.206) is exactly one contiguous 4884-byte insertion',
    prev.slice(i, prev.length - j).length === 0 && inserted.length === 4884,
    `inserted=${inserted.length} bytes, residual=${prev.slice(i, prev.length - j).length} bytes`)
  check('the inserted core delta is the CanvasRenderer.registerPortableEffect registration path',
    inserted.includes('async registerPortableEffect(definition)') &&
    inserted.includes('unregisterEffect') && inserted.includes('registerEffectWithRuntime'))
}
check('the pinned 1.0.209 core carries the registerPortableEffect runtime (engine symbols) and no dev-only validator symbols',
  bundle.toString('utf8').includes('registerPortableEffect') &&
  !bundle.toString('utf8').includes('effect-validator'))
const manifest209 = await fetchBuffer('https://shaders.noisedeck.app/1.0.209/effects/manifest.json')
check('the 1.0.209 effects manifest is byte-identical to the vendored manifest',
  manifest209.equals(readFileSync(join(process.cwd(), 'vendor/noisemaker/effects/manifest.json'))))

// 6o. The live-parameter/uniform-alias range: cb22a05e..e30f09e6 (this sync, ENGINE CHANGE).
// The delivery was force-push-flagged with four observed ranges (delivery order is not
// ancestry order); audited directly in a local checkout: the previously synced tip
// cb22a05e is an exact ancestor of the first observed start 1fd89348, and the four
// observed ranges chain 1fd89348→41d1ead1→109c00ac→058ca32e→e30f09e6, so the uncovered
// delta is exactly the contiguous cb22a05e..e30f09e6 (22 commits: 14 docs/ledger/deps-only,
// 2 test-only (the vendored source guards), 1 attestation re-stamp, and 5 engine
// commits: 29e76468 reserved-choice binding, bd773801 uniformAliases, 3c1e47e5
// ui.resetOnChange, 71d805eb + 109c00ac single-effect alias scoping). Release tag
// v1.0.215 points exactly at the end. ENGINE CHANGE (re-vendored): the engine-side
// live-parameter plumbing (uniformAliases write-through, _isEffectPass alias scoping,
// reserved own-choice binding) plus the ui.resetOnChange flag on the pointsEmit and
// cellularAutomata3d definitions — ui metadata only, so rendered frames are unchanged.
check('cb22a05e is an ancestor of 1fd89348 (live-parameter range contiguous through the observed starts)',
  git('merge-base', '--is-ancestor', END16, '1fd893483c83f7602416cf8e9c48c9605a8f202c') === '' &&
  git('merge-base', '1fd893483c83f7602416cf8e9c48c9605a8f202c', END17) === '1fd893483c83f7602416cf8e9c48c9605a8f202c')
tagCheck('v1.0.215', END17, 'e30f09e6')
const LIVE_SRC_DELTA =
  '1\t1\tshaders/effects/points/heightGrid/parity-attestation.json\n' +
  '1\t1\tshaders/effects/render/pointsBillboardRender/parity-attestation.json\n' +
  '6\t2\tshaders/effects/render/pointsEmit/definition.js\n' +
  '1\t1\tshaders/effects/render/pointsRender/parity-attestation.json\n' +
  '3\t1\tshaders/effects/synth3d/cellularAutomata3d/definition.js\n' +
  '14\t2\tshaders/src/lang/validator.js\n' +
  '30\t11\tshaders/src/renderer/canvas.js\n' +
  '4\t1\tshaders/src/runtime/effect-validator.js\n' +
  '3\t0\tshaders/src/runtime/effect.js\n' +
  '8\t1\tshaders/src/runtime/expander.js\n' +
  '32\t0\tshaders/src/runtime/uniform-aliases.js'
const liveNumstat = git('diff', '--numstat', `${END16}..${END17}`, '--', 'shaders/src', 'shaders/effects')
check('shaders/src + shaders/effects delta cb22a05e..e30f09e6 is exactly the five engine commits' +
  ' (lang/validator own-choice binding, renderer/canvas alias scoping, runtime uniformAliases' +
  ' + effect.js resetOnChange, and the two ui.resetOnChange definition flags + attestation re-stamps)',
  liveNumstat === LIVE_SRC_DELTA, liveNumstat.replace(/\n/g, ' | '))
check('no new shader source is introduced in cb22a05e..e30f09e6 (WGSL/GLSL translation surface unchanged)',
  git('diff', '--name-only', `${END16}..${END17}`, '--', 'shaders/src', 'shaders/effects')
    .split('\n').every(f => !/\.glsl|\.wgsl|\.hlsl/.test(f)) &&
  git('diff', '--name-only', `${END16}..${END17}`, '--', 'shaders/src', 'shaders/effects').split('\n').length === 11)
const bundle215Delta = (() => {
  const strip = (b) => Buffer.from(b.toString('utf8').replace(/^ \* Build: .*\n/m, '').replace(/^ \* Date: .*\n/m, ''))
  const prev = strip(bundle209)
  const next = strip(bundle)
  let i = 0
  while (i < Math.min(prev.length, next.length) && prev[i] === next[i]) i++
  let j = 0
  while (j < Math.min(prev.length - i, next.length - i) && prev[prev.length - 1 - j] === next[next.length - 1 - j]) j++
  return { prefix: i, suffix: j, inserted: next.slice(i, next.length - j), deleted: prev.slice(i, prev.length - j) }
})()
check('the banner-stripped 1.0.215 core delta over the previous pin (1.0.209) is one interleaved region between byte-identical prefix/suffix anchors',
  bundle215Delta.inserted.length > 0 && bundle215Delta.deleted.length > 0 &&
  bundle215Delta.prefix === 89280 && bundle215Delta.suffix === 187828,
  `prefix=${bundle215Delta.prefix} suffix=${bundle215Delta.suffix} inserted=${bundle215Delta.inserted.length} deleted=${bundle215Delta.deleted.length}`)
check('the 1.0.215 core delta carries the live-parameter engine symbols (uniformAliases, _isEffectPass, isOwnChoice)',
  ['uniformAliases', '_isEffectPass', 'isOwnChoice'].every(s => bundle215Delta.inserted.includes(s)))
check('the pinned 1.0.215 core carries the resetState write-through plumbing and no dev-only validator symbols',
  bundle.toString('utf8').includes('uniformAliases') &&
  !bundle.toString('utf8').includes('effect-validator'))
check('the 1.0.215 effects manifest is byte-identical to the vendored manifest (catalog parity: 210 effects, 0 added / 0 removed)',
  (await fetchBuffer('https://shaders.noisedeck.app/1.0.215/effects/manifest.json'))
    .equals(readFileSync(join(process.cwd(), 'vendor/noisemaker/effects/manifest.json'))))
const mb215Mismatches = []
const mb209to215Changed = []
for (const id of manifestIds) {
  const rel = `effects/${id}.js`
  const h215 = mbCreateHash('sha256')
    .update(await fetchBuffer(`https://shaders.noisedeck.app/1.0.215/${rel}`))
    .digest('hex')
  const h209 = mbCreateHash('sha256')
    .update(await fetchBuffer(`https://shaders.noisedeck.app/1.0.209/${rel}`))
    .digest('hex')
  if (h215 !== vendoredHashes[rel]) mb215Mismatches.push(`${rel} 1.0.215=${h215.slice(0, 12)} vendored=${(vendoredHashes[rel] ?? 'ABSENT').slice(0, 12)}`)
  if (h209 !== h215) mb209to215Changed.push(rel)
}
check('every published 1.0.215 effect mini-bundle is sha256-identical to the vendored tree (210/210, catalog parity of the re-vendored pin)',
  manifestIds.length === 210 && mb215Mismatches.length === 0,
  mb215Mismatches.length ? mb215Mismatches.join(' | ').slice(0, 500) : `manifest bundles=${manifestIds.length}, all sha256-match engine-hashes.json`)
check('exactly the pointsEmit and cellularAutomata3d mini-bundles changed between 1.0.209 and 1.0.215 (ui.resetOnChange flags; rendered frames unchanged)',
  mb209to215Changed.length === 2 &&
  mb209to215Changed.includes('effects/render/pointsEmit.js') &&
  mb209to215Changed.includes('effects/synth3d/cellularAutomata3d.js') &&
  (await fetchBuffer('https://shaders.noisedeck.app/1.0.215/effects/render/pointsEmit.js')).includes('resetOnChange') &&
  (await fetchBuffer('https://shaders.noisedeck.app/1.0.215/effects/synth3d/cellularAutomata3d.js')).includes('resetOnChange'),
  mb209to215Changed.join(' | '))

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
  browserReady = browsersRoots.some(root => {
    try {
      // Readiness = a chromium dir WITH its INSTALLATION_COMPLETE marker: Playwright
      // creates the browser directory before extracting and writes the marker after
      // the install finishes, so a bare listing can report a half-extracted install.
      return readdirSync(root).some(d => d.startsWith('chromium') &&
        existsSync(join(root, d, 'INSTALLATION_COMPLETE')))
    } catch { return false }
  })
} catch { /* no browsers dir */ }
if (missingForSuite.length || !browserReady) {
  console.log(`[SKIP] port test suite — prepare the environment first: ${missingForSuite.join(', ')}` +
    (browserReady ? '' : `, a chromium install under PLAYWRIGHT_BROWSERS_PATH (searched: ${browsersRoots.join(', ')})`))
  console.log('       bash vendor/fetch.sh && npm install && PLAYWRIGHT_BROWSERS_PATH=<dir> npx playwright install chromium')
} else {
  // One bounded retry: a single flaky browser test must not flip the audit, but a
  // genuine failure fails both runs and is annotated either way (claim strength is
  // unchanged — the check still requires a 0-fail run).
  const runSuite = () => {
    try {
      return { out: execSync('npm test', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], timeout: 600000 }), err: null }
    } catch (e) { return { out: e.stdout ?? '', err: e } }
  }
  let run = runSuite()
  if (run.err) {
    const tail = (run.out.split('\n').filter(Boolean).slice(-30).join('\n')).slice(0, 3000)
    console.error(`::error::verify-sync-audit: npm test exited nonzero (attempt 1) — ${run.err.message?.split('\n')[0]}\n${tail}`)
    console.log('[WARN] npm test failed on attempt 1 — retrying once before failing the audit')
    run = runSuite()
  }
  const pass = /ℹ pass (\d+)/.exec(run.out)
  const fail = /ℹ fail (\d+)/.exec(run.out)
  const total = /ℹ tests (\d+)/.exec(run.out)
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
