# noisemaker-for-babylonjs: completion gaps

Current compatibility matrix: [compatibility report](COMPATIBILITY.md).

## 1. Scope and source revisions

Daily review: 2026-09-25. Current inspected source: [`8a39787a7c3564c4a331047e727a7b372d68c16b`](https://github.com/noisefactorllc/noisemaker-for-babylonjs/commit/8a39787a7c3564c4a331047e727a7b372d68c16b).
Full rendered parity remains **unverified**. No release approval or new closure follows from this review.
Current upstream discovery: `bbdeb56c4b75cf33379766c3e87b0f5a18bcbba8`. Published Noisemaker authority: `1.0.179`, source `fca611fd8f91424661d4e531d39313d24ea21134`, 210 effect IDs.
The observations below retain their original source and authority identities. They do not qualify later updates.
Current served kit: `0.1.5`, source `e6aa0732ff7962f4a3ce044384581dbc75b632a1`. [Retrieved inventory and hashes](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/current-served-inventories.json). Artifact identity does not establish host qualification.

### Earlier source observations

Audit date: 2026-09-22 UTC. Run: `20260922-babylonjs-01`.
The audit reached its checkpoint. Implementation belongs to a separate job.
The audit documents publish under standing authority. Operational state records the publication commit.

| Source | Revision |
| --- | --- |
| Reviewed remote source | `d3446072d4c75f4d7e087ad48dfa06de5ec5dec9` |
| Existing local checkout | `d40a0a5c3aba359192d99bd6d8bea7c474ab9d28` |
| Authority recorded by remote STATUS.md | `643b2be1e28b62e3282a4009c2ea65c583ed6ccc`, engine 1.0.167 |
| Current upstream and tested CDN authority | `ae4e3302e2d379450ad56745da5be506b329f84d`, engine 1.0.168 |
| Published Babylon kit 0.1.4 | `13efbfdc8e2cca7c96d1d320d4b271bf0f3eada2` |

The contract is a Babylon.js WebGL2 adapter for the published Noisemaker Pipeline.
Useful tasks include animated material textures, cubemap baking, and compiled Noisedeck exports.
This audit does not apply a CPU renderer contract or claim native WebGPU support.

The current upstream tree and CDN manifest each contain 210 effects with matching IDs.
The fixture sweep contains 325 programs. Program counts are not effect counts.
The audited source differs from the local checkout in seven files.
An isolated API archive supplied the tested source. No Git command ran.
Direct index inspection found no local tracked changes or Git lock files.
Source identities remained unchanged at the final check.

[Historical status](../STATUS.md) retains previous evidence.
Its local revision predates the reviewed remote revision.
This register records the current audit without replacing that history.

Review date: 2026-09-23. Reviewed current source: `ca518c2b884dfa0706716aba6d9ef3c6397032c1`.
The tables below preserve audit-time evidence unless a dated review correction states otherwise.
Current STATUS records authority `44bc4ed4ac729bddaa95b083d64bee942ade35da`.
The published Babylon kit remains `0.1.4` at its older source.

Live upstream at review: `532ed64775000635e43caac085e4451c06e71afc`. Published runtime: `1.0.169` at `44bc4ed4ac729bddaa95b083d64bee942ade35da`.
The review does not qualify every upstream change after the recorded port authority.

## 2. Completion claims

| Claim ID | Claim source | Claimed scope | Finding | Evidence |
| --- | --- | --- | --- | --- |
| CLAIM-001 | Remote STATUS.md introduction | 322 graded fixtures pass exactly | supported | E3: 322 PASS, 3 SKIP, 0 FAIL across 325 programs. Existing goldens remained unchanged. |
| CLAIM-002 | README, What works today | Whole catalog works, with only four gaps | contradicted | Other gaps remain. These include packaging, notices, CI, and qualification. The sweep does not prove all parameters or external inputs. |
| CLAIM-003 | README and STATUS.md mode coverage | Every artistic-filter mode | partial | The 101-row mode ledger and 24 contract tests pass. They do not define complete current parameter interactions. |
| CLAIM-004 | README, first render and scene examples | Useful Babylon texture and cubemap workflows | supported | E4 and E5 pass. Evidence includes visible scenes, five exact differential probes, and a ready cube texture. |
| CLAIM-005 | README, own project installation | Installable package with usable compiler | contradicted | E2: root/runtime imports succeed. Compiler import fails because the packed tool is absent. |
| CLAIM-006 | Runtime API and export template | Errors and recovery support real use | partial | E4–E6 pass bounded checks. These include compiler recovery, context restoration, missing-engine alerts, and reload recovery. Broader recovery remains unverified. |
| CLAIM-007 | package.json and kit metadata | Ecosystem fit | partial | ES modules and Babylon 9.13.0 integration work. Package setup, version range, and lifecycle guidance need qualification. |
| CLAIM-008 | Actual distribution and workflow | Release readiness | unverified | Kit files match hashes, but its source is older. No checks exist for the reviewed SHA. Distribution gaps remain. |
| CLAIM-009 | STATUS.md corpus section | 39 gradeable compositions match, one excluded | unverified | The isolated source lacks the local-only raw corpus. No corpus test ran. The excluded composition remains in the historical denominator. |

## 3. Methods and evidence

Review CI boundary: No workflow run exists at the inspected source SHA. A passing export dispatch does not qualify rendered parity. Current complete-render enforcement remains an open verification requirement. [Exact-source responses and workflows](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/noisemaker-for-babylonjs-remote-evidence.json).

### Daily review, 2026-09-25

53 unit tests pass, but importing the compiler from the packed distribution still fails with ERR_MODULE_NOT_FOUND for tools/export-fat-graph.mjs. The package contains 12 files. GAP-001 remains open. Current full rendered parity is stale and unverified. [Raw evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/babylon-installed-compiler.json).
The review checked source changes, worker evidence, source-bound CI where present, and current served inventories. Full installed-host and platform qualification remains incomplete.

Environment: Darwin arm64, Node 24.7.0, npm 11.5.1, Babylon 9.13.0, Chromium 149.0.7827.55, ANGLE Metal.
The registry reports Babylon 9.27.1 as current. Browser qualification here covers 9.13.0 only.

Operational evidence resides in automation run `20260922-babylonjs-01`, directory `evidence-20260922-babylonjs-01`.
`checks.json` records commands, exit codes, output names, and output hashes.
`source-tree.json`, `source-verification.json`, and `engine-hashes.json` bind source and engine bytes.
`final-source-check.json` records the final identities.
`final-snapshot-differences.json` is empty. All archived tracked files, including goldens, still match the reviewed SHA.
No baseline, fixture, tolerance, or implementation changed.

| Evidence | Method and command | Exit | Result and limits |
| --- | --- | --- | --- |
| E1 | Paginated `gh api` organization inventory and revision queries | 0 | 16 live ports, 15 eligible, C++ excluded by name and ID. No archived or disabled ports appeared. |
| E2 | `npm ci --ignore-scripts`, `npm pack --ignore-scripts`, isolated tarball installation | 0 | Candidate installs. Root and runtime imports succeed. Compiler import exits 1 with `ERR_MODULE_NOT_FOUND`. |
| E2 | Registry query and isolated removal | 1 / 0 | Registry returns E404, consistent with README. Removal succeeds. Git-based installation was not executed under the Git ban. |
| E3 | `VERSION=1.0.168 bash vendor/fetch.sh` | 0 | Core, manifest, and 210/210 bundles downloaded from the exact release. |
| E3 | `npm test` | 0 | 45 pass, 0 fail, 0 skip. Includes real WebGL2 frame export, alpha, VideoFrame upload, and context restoration. |
| E3 | `python3 -m unittest parity/test_artistic_matrix.py parity/test_sweep_contract.py` | 0 | 24 tests pass. These check fixture and harness contracts, not complete runtime coverage. |
| E3 | `bash parity/sweep.sh` | 0 | 322 PASS, 3 SKIP, 0 FAIL. Maximum absolute difference is 0. SSIM gate is 0.999. |
| E4 | Public `exportFatGraph` valid, invalid, and corrected programs | 0 | Valid programs produce two passes. Invalid effect returns S001/S005 diagnostics. Corrected input succeeds. |
| E4 | Public renderer versus reference, in memory | 0 | Three noise/blur probes pass exactly. Cases vary size, time, seed, and scale. Sizes are 17 and 63. Times are 0 and 0.5. |
| E4 | Current isosurface mode, orthographic and perspective | 0 | Two 64×64 probes pass exactly. Both produce nonconstant output. These supplement the unchanged golden sweep. |
| E5 | `node examples/build.mjs`, browser execution, drag, ArrowLeft, resize | 0 | Box and cubemap scenes render without page errors. Screenshots record output. No keyboard-only acceptance claim follows. |
| E5 | Public `renderCubemap` at size 32 | 0 | Six nonconstant faces and a ready Babylon cube texture. This check does not measure face-edge continuity. |
| E6 | Download published kit inventory and all listed files | 0 | 13/13 SHA-256 hashes match. Metadata identifies kit 0.1.4 and its older source. |
| E6 | Published template with audit graph and engine 1.0.168 | 0 | Page runs and resizes. A missing engine produces an alert. Restoration and reload recover playback. |
| E7 | Exact-SHA Actions, checks, statuses, and releases queries | 0 | Zero workflow runs, zero check runs, zero statuses, and no GitHub releases. |

E2 outputs: `npm-pack.json`, `consumer-probe.log`, `consumer-install.log`, and `consumer-removal.log`.
E3 outputs: `npm-test.log`, `parity-contract-tests.log`, `sweep.log`, and per-program reports under the isolated source.
E4 outputs: `quick-start.log`, `public-renderer-probe.log`, and `landscape-probe.log`.
E5 outputs: `host-examples.log`, `index-before.png`, and `cubemap-before.png`.
E6 outputs: `kit.json`, `kit-meta.json`, `kit-verification.json`, and `kit-browser.log`.

The kit probe assembled published components with an audit graph. It did not exercise Noisedeck's export dialog.
The package probe used a packed candidate because no npm release exists.
The default vendor script uses rolling `/1`, despite its pinning comment.
The audit used an exact version to prevent authority drift.

Current choice extraction finds 264 choice-bearing parameters across 132 effects, totaling 1,816 named choices.
These counts describe the schema. They are not a required Cartesian test count or proof of uncovered defects.
`coverage-analysis.json` preserves the extracted values.

External media, glyph, MIDI, and OBJ workflows remain unqualified end to end.
The VideoFrame test proves borrowed-frame upload only. It does not close all media-effect workflows.
Safari, Firefox, mobile browsers, Windows, Linux, and other GPU drivers remain unverified.
Native signing, notarization, and binary ABI checks do not apply to this JavaScript distribution.
The renderer provides no editor controls. Export-page alerts apply, but screen-reader and keyboard qualification remain incomplete.
No removal test touched user projects. No global package installation occurred.

Official references checked on 2026-09-22:

- [Babylon ES module documentation](https://doc.babylonjs.com/setup/frameworkPackages/es6Support/) and [official package metadata](https://www.npmjs.com/package/@babylonjs/core).
- [npm package metadata documentation, v11](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/), including package contents and exports.
- [Apache License 2.0, section 4](https://www.apache.org/licenses/LICENSE-2.0), for bundled dependency notices and license copies.

### Daily review evidence, 2026-09-23

Review evidence resides in shared run `review-20260923-01/noisemaker-for-babylonjs`.
The reviewer checked the original raw logs, source differences, distribution inventory, and all recorded log hashes.
All 16 recorded log hashes match. The original 322-pass sweep remains historical evidence.
The current source adds compiler tests and STATUS claims. It does not change package contents or runtime code.

- `npm pack --ignore-scripts --json` and isolated installation exit 0.
- Importing `noisemaker-for-babylonjs/compiler` exits 1 with `ERR_MODULE_NOT_FOUND` for the excluded compiler tool.
- Isolated removal exits 0. `compiler-import.log` retains the reproduction.
- The current kit inventory retains all 13 original hashes. A fresh compatibility-file download matches its hash.
- Exact-source Actions and check queries return zero results for both audited and current source revisions.

The review reconfirmed npm CLI 11 package-content rules from the official reference above.
The Babylon documentation page returned no readable content. No new host-version qualification follows from that request.
The reviewer did not repeat GPU sweeps, scene interaction, corpus tests, or cross-platform qualification.
The original installation, scene, recovery, and kit evidence supports only its recorded versions and source boundaries.

## 4. Known gaps

P1 means false completion, major correctness failure, unusable primary workflow, or invalid artifact.
P2 means coverage or integration gaps. P3 means documentation inconsistency.
Original verification dates are 2026-09-22. Dated review notes identify subsequent checks.

### GAP-001: Compiler missing from packed distribution

- Status: closed, pending publication of this record. Priority: P1. Category: release.
- Scope: `package.json`, `src/compiler/index.js`, compiler tools, and vendor setup.
- Expected: every advertised package entry point loads after normal installation.
- Observed: the compiler imports excluded `tools/export-fat-graph.mjs`. The package also omits `vendor/fetch.sh` and engine setup files.
- Evidence: E2, `npm-pack.json`, `consumer-probe.log`. Root and runtime imports pass.
- Implementation evidence: `352c329e` (fix commit — package `files` gains `tools/export-fat-graph.mjs`, `vendor/engine.mjs`, `vendor/fetch.sh`; the missing-engine recovery error names the fetch script by its own absolute path so it is valid from any consumer cwd). Verified by the committed end-to-end check `test/installed-package.test.js` at `fae8a26f`, which packs the real tarball, installs it into an empty consumer with the Babylon peer, imports all three advertised entry points, reproduces and then recovers the missing-engine error by running the named fetch script (CDN fetch, no repository-relative shortcut), compiles the program documented in README verbatim (`search synth, filter` / `noise(scaleX: 60).bloom().write(o0)` / `render(o0)`) through the installed compiler, renders it to a visibly non-uniform Babylon texture in headless Chromium with zero page errors, and uninstalls. `test/packaging.test.js` guards the tarball against future import-closure omissions.
- Recorded run: 2026-09-26 05:22 UTC, Linux 6.8.0-134-generic x64, Node 26.5.1, Chromium headless-shell 149 (SwiftShader WebGL), candidate `fae8a26f4d88422452aa9844e46e98edbbcf8d29`: `node --test test/*.test.js` — 68 tests, 68 pass, 0 fail, 0 skipped. The browser binary is loaded from a `PLAYWRIGHT_BROWSERS_PATH` volume because this host mounts `/tmp` `noexec`; the tests' launch arguments themselves are unchanged.
- Exact-source CI: the published candidate `7ed3435ef39bc85ed2a17814f7ff40819dc95fef` (docs-only delta over `fae8a26f`) touches none of `.github/workflows/export-kit.yml`'s push-trigger paths (`export-kit/**`, the workflow file, `LICENSE`, `src/**`, `package-lock.json`). Zero should-run workflows is therefore the correct exact-source state; the machine-verification receipt's `ci: observed, runs: []` matches it and is not a failure. GAP-005 (defining required checks for every source through existing CI) remains the open register item that owns any future exact-source check requirement; workflow edits are outside this job's authority.
- Next action: complete. Publication of the record needs the standing publication authority.
- Review evidence: the installed compiler still fails at `ca518c2b884dfa0706716aba6d9ef3c6397032c1` (historical, superseded by the recorded run above).
- Dependencies: publishing needs separate publication authority.
- Acceptance: a clean installed artifact compiles the documented program and produces a visible Babylon texture without repository-relative patches. Satisfied by the recorded run.
- Required checks: pack, install, import all exports, first render, error recovery, and uninstall. All executed in `test/installed-package.test.js` (recorded above).
- Last verification: 2026-09-26 for the installed-artifact checks at `fae8a26`. Historical package and CI checks remain dated 2026-09-23; other runtime evidence remains dated 2026-09-22.

### GAP-002: Published kit lacks Babylon license text

- Status: closed, pending publication of this record. Priority: P1. Category: release.
- Scope: `export-kit/kit.config.json` and published kit inventory.
- Expected: the distribution includes applicable licenses and dependency attribution.
- Observed: the kit bundles Babylon but lists only two MIT license files. Its bundle lacks the Apache license text.
- Evidence: E6. Installed Babylon 9.13.0 supplies `license.md` and `NOTICE.md`. The kit inventory supplies neither.
- Implementation evidence: `ba8bc862` (fix commit — `export-kit/kit.config.json`'s `licenses` list gains two entries copying the committed byte-identical copies under `export-kit/licenses/` — Babylon 9.13.0's own `license.md` (Apache-2.0 text, sha256 `9362ea9e…`) and `NOTICE.md` (attribution notices, sha256 `7f85d099…` — into `LICENSES/`; the suite's `test/kit-licenses.test.js` guards the entries and verifies the committed copies stay byte-identical to the exact dependency distribution, which has no transitive dependencies to attribute). An earlier candidate (`d6c43df`) referenced the files directly from `node_modules`; scaffold's export-kit-release never published a kit for that SHA, so the committed-copy form replaced it.
- Published-artifact check, 2026-09-26 07:11 UTC: downloaded kit 0.1.8 inventory from kits.noisedeck.app — its `source.sha` is exactly `ba8bc86246f26ad8e098efdee297ffc353a0b61a`, its `files` list carries all four `LICENSES/` entries with declared bytes and sha256, and both `LICENSES/babylonjs-core-license.txt` and `LICENSES/babylonjs-core-NOTICE.txt` downloaded with hashes matching the installed `@babylonjs/core` 9.13.0 files byte for byte. Every bundled dependency (the engine, the adapter, `@babylonjs/core`) now has its required license and applicable notices in the actual downloadable artifact.
- Next action: complete. Publication of the record needs the standing publication authority.
- Acceptance: every bundled dependency has its required license and applicable notices in the actual downloadable artifact. Satisfied by the published-artifact check above.
- Required checks: inspect the final inventory, check hashes, and compare notices with the exact dependency distribution. All executed and recorded above.
- Last verification: 2026-09-26.

### GAP-003: Authority selection is not reproducible by default

- Status: closed, pending publication of this record. Priority: P2. Category: authority.
- Scope: `vendor/fetch.sh`, parity evidence, and STATUS.md authority records.
- Expected: a documented source revision selects reproducible engine bytes.
- Observed: the script defaults to rolling `/1`. STATUS.md records 1.0.167, while current upstream and CDN provide 1.0.168.
- Evidence: E3, `authority-delta.json`, `engine-meta.json`, and `engine-hashes.json`.
- Implementation evidence: `9f42b6f`, hardened by `52809b9` (fix commits — `vendor/fetch.sh` no longer defaults to rolling `/1`; its default is the documented revision `1.0.183` (the STATUS.md "Vendor sync" record: upstream commit `8eeb7b5a`, 858616-byte core), overridable only as a deliberate authority bump that requires re-verification, and after each fetch it writes a per-install integrity record into the gitignored `vendor/noisemaker/` directory: `engine-meta.json` (exact version, core build tag, core bytes, effect count, manifest bytes, fetch URL) and `engine-hashes.json` (sha256 of the core bundle, the manifest, and every per-effect mini-bundle, keys sorted so the record file itself is byte-stable across platforms). The existing `.gitignore` policy commits the fetch script and loader, not the downloaded bytes or the per-install records — the pin lives in the committed script, and the records are reproducible artifacts any install regenerates. `52809b9` also fails the fetch outright when any mini-bundle download is missing (no integrity record is written for an incomplete fetch) and pins `tools/verify-sync-audit.mjs`'s published-bundle check to the same documented revision instead of the rolling `/1` alias, so the machine re-derivation of the authority record survives the CDN alias rolling past 1.0.183.)
- Reproducibility check, 2026-09-26: two isolated installations fetched the pinned revision independently from the CDN and produced byte-identical `engine-meta.json`, `engine-hashes.json`, and `effects/` trees (`diff -r` empty between the two installs and against the workspace's vendored tree); all 212 recorded hashes re-verified against the on-disk tree with 0 mismatches; version metadata is exact — v1.0.183, build `8eeb7b5a`, 858616-byte core, 210 effects, 39906-byte manifest — matching the STATUS.md vendor-sync record. The machine sync-audit re-run (`node tools/verify-sync-audit.mjs`) exits 0 with the pinned-revision bundle check PASS: "published core bundle at the pinned documented revision is the recorded 858616-byte build (8eeb7b5a tip)".
- Parity against preserved baselines: this change alters no vendored bytes — the re-fetch reproduced the existing vendored tree byte for byte — so the preserved-baseline parity evidence in STATUS.md for this exact build (last verified 2026-09-25, same-pass golden/candidate byte-exact re-grade) applies unchanged. The port's own npm suite re-run in this container (65 pass / 5 fail) shows the same pre-existing host-environment failures with and without this change (4 real-WebGL2 browser tests and the packed-artifact test fail identically at the unmodified HEAD).
- Next action: complete. Publication of the record needs the standing publication authority.
- Acceptance: two isolated installations resolve identical engine and effect hashes for the documented revision. Satisfied by the reproducibility check above.
- Required checks: exact version metadata checked (`engine-meta.json` matches the vendor-sync record), all bundle hashes checked (212/212), parity against preserved baselines carried by byte-identity to the verified revision. All executed and recorded above.
- Last verification: 2026-09-26.
- Follow-up authority note: the 2026-09-26 vendor sync `8eeb7b5a..6a0af04d` (STATUS.md "Vendor
  sync (8eeb7b5a..6a0af04d)") deliberately bumped the documented pin from `1.0.183` to `1.0.185`
  as its authority change, re-deriving the full range audit with `node tools/verify-sync-audit.mjs`
  (exit 0, pinned-revision bundle check PASS for the 870700-byte `6a0af04d` build). The claims
  above describe the pin state as verified for GAP-003 at `52809b9`; the pin mechanism and the
  integrity-record behavior they document are unchanged.

### GAP-004: Completion wording exceeds verified coverage

- Status: open. Priority: P1. Category: verification.
- Scope: README completion claims, mode coverage, corpus, and external inputs.
- Expected: each claim states its measured scope, exclusions, and acceptance rules.
- Observed: four external-input gaps are not the only gaps. The sweep covers 325 fixtures, not every runtime combination.
- Evidence: E3–E5, `coverage-analysis.json`, and the historical 101-row mode ledger.
- Next action: map current effect branches and representative developer workflows to explicit acceptance cases.
- Dependencies: stable authority from GAP-003. External inputs need deterministic host fixtures. Corpus qualification needs its missing raw inputs.
- Acceptance: every claimed branch has source-bound evidence or an explicit exclusion. Counts retain skipped and refused cases.
- Required checks: media, text, MIDI, OBJ, parameter interactions, stateful sequences, and the historical 40-item corpus denominator.
- Last verification: 2026-09-22.

### GAP-005: No CI evidence for the reviewed source

- Status: blocked. Priority: P2. Category: verification.
- Scope: exact source SHA and `.github/workflows/export-kit.yml`.
- Expected: required checks qualify the exact source before a release-readiness claim.
- Observed: zero runs, checks, or statuses exist for the reviewed SHA. The existing workflow dispatches export-kit publication.
- Evidence: E7. The latest successful dispatch belongs to kit source `13efbfdc8e2cca7c96d1d320d4b271bf0f3eada2`.
- Next action: define required checks through the existing CI system in the separately authorized job.
- Dependencies: workflow changes and dispatches lack authority in this audit.
- Acceptance: exact-SHA checks retain raw test output, exclusions, authority hashes, and artifact provenance.
- Required checks: installed package, public host workflow, strict parity, and distribution contents.
- Last verification: 2026-09-22.

### GAP-006: Host and release qualification remain incomplete

- Status: blocked. Priority: P2. Category: ecosystem.
- Scope: supported Babylon versions, browsers, platforms, lifecycle behavior, and export integration.
- Expected: release claims identify qualified versions and useful supported workflows.
- Observed: real runtime evidence covers Chromium/Metal with Babylon 9.13.0. The peer range admits later 9.x versions.
- Evidence: E4–E6. The published kit uses an older source than the reviewed adapter.
- Next action: define the supported matrix, then qualify installed artifacts in those hosts.
- Dependencies: GAP-001 and GAP-002. Qualification needs additional host environments and separate work.
- Acceptance: each supported cell passes installation, first output, host integration, lifecycle recovery, and removal.
- Required checks: current Babylon compatibility, exported user artifact, resource cleanup, keyboard access, alerts, and upgrade behavior.
- Last verification: 2026-09-22.

### GAP-007: Current documentation contains stale counts and gates

- Status: open. Priority: P3. Category: usability.
- Scope: README, STATUS.md, and documented parity commands.
- Expected: developers can distinguish current evidence from historical results and select the correct verification command.
- Observed: STATUS.md retains 209 byte-verifiable effects beside a current 210-effect total and four external-input exclusions.
- Observed: `parity/run.sh` defaults to tolerance 2.001 and SSIM 0.98. The sweep uses tolerance 0 and SSIM 0.999.
- Evidence: remote STATUS.md coverage section, `parity/run.sh`, and `parity/sweep.sh`.
- Next action: reconcile current counts and explain command gates without deleting historical evidence.
- Dependencies: acceptance scope from GAP-004. This checkpoint preserves existing documentation except the requested register link.
- Acceptance: current claims name exact denominators, tolerances, exclusions, and source revisions consistently.
- Required checks: compare prose with manifests, ledgers, command defaults, and installed-package instructions.
- Last verification: 2026-09-22.

## 5. Ordered next actions

Current first action: After the implementation job repairs GAP-001, run npm pack. Install the tarball in an empty consumer. Import the compiler. Render its compiled graph in Babylon. Require a successful import and a measured reference comparison before broader parity. Then check kit notices and the supported Babylon version range.
Subsequent historical actions remain dependent on that evidence. No implementation is authorized by this audit.

These actions belong to the separate authorized job. This audit does not implement or publish them.

1. Address GAP-001 in `package.json` and `src/compiler/index.js`. Run `npm pack --ignore-scripts --json` after the authorized correction.
   Install the tarball in an empty project. Import every exported entry point. Require successful compilation and a visible material texture.
2. Resolve GAP-002 through the existing kit configuration. Require complete dependency notices in the downloadable artifact.
3. Resolve GAP-003 through existing authority configuration. Require repeated installations with identical engine hashes.
4. Address GAP-004 with current manifests and existing harnesses. Require explicit coverage and retained exclusions for every completion claim.
5. Address GAP-005 through existing CI. Require exact-source evidence before release qualification.
6. Address GAP-006 through existing host qualification. Require successful developer workflows for every supported release target.
7. Address GAP-007 in existing documentation. Require counts and command gates to match accepted evidence.

Do not infer implementation, publication, or workflow authority from this list.

## 6. Pass history

2026-09-25 daily review at `8a39787a7c3564c4a331047e727a7b372d68c16b`: source freshness and bounded evidence reviewed. Open qualification limits retained. [Retained review evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/babylon-installed-compiler.json). No new closure claimed.

| Date | Run and source | Document changes | Tested scope | Remaining limits |
| --- | --- | --- | --- | --- |
| 2026-09-22 | `20260922-babylonjs-01`, `d3446072d4c75f4d7e087ad48dfa06de5ec5dec9` | Created this register and added its README link. Publication uses standing authority. | 45 Node tests, 24 contract tests, 322 strict fixture passes, five differential probes, scene examples, package and kit checks. | Three sweep skips, external inputs, corpus, other hosts, packaging, dependency notices, and exact-SHA CI. |
| 2026-09-23 | `review-20260923-01`, `ca518c2b884dfa0706716aba6d9ef3c6397032c1` | Corrected publication wording and bounded the package action. | Reproduced installed compiler failure. Checked raw evidence, source changes, current kit inventory, and exact-source CI absence. | Seven gaps remain. No closures or new host qualification. |
| 2026-09-26 | `gap-001-implementation`, `fae8a26f4d88422452aa9844e46e98edbbcf8d29` | GAP-001 record updated with implementation and run evidence (this row). | `node --test test/*.test.js`: 68 pass, 0 fail, 0 skipped. The packed tarball installs in an empty consumer, all advertised imports load, the missing-engine error recovers via the installed fetch script (CDN), the README program compiles through the installed compiler, renders a visibly non-uniform Babylon texture in Chromium with no page errors, and uninstall is clean. | Publication of this record and the fix commits, and exact-source CI, remain supervisor actions. Other gaps unchanged. |
| 2026-09-26 | `gap-001-ci-analysis`, `7a75a48` (tree identical to published `7ed3435`) | Added the exact-source CI path analysis to GAP-001. | Candidate `7ed3435` touches no export-kit push-trigger path, so zero should-run workflows at that exact source and the `runs: []` verification receipt is the correct state. | GAP-005 remains open for defining required checks; workflow changes lack job authority. |

No gap closed during this first audit. Successful checks do not establish whole-port completion or release approval.
The worker stopped at the requested audit checkpoint. Publication of audit documents does not authorize implementation.
The operator subsequently granted standing publication authority. The documents publish without another approval request.
