# noisemaker-for-babylonjs: completion gaps

## 1. Scope and source revisions

Audit date: 2026-09-22 UTC. Run: `20260922-babylonjs-01`.
The audit reached its checkpoint. Implementation and publication belong to a separate job.
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

## 4. Known gaps

P1 means false completion, major correctness failure, unusable primary workflow, or invalid artifact.
P2 means coverage or integration gaps. P3 means documentation inconsistency.
All verification dates below are 2026-09-22.

### GAP-001: Compiler missing from packed distribution

- Status: open. Priority: P1. Category: release.
- Scope: `package.json`, `src/compiler/index.js`, compiler tools, and vendor setup.
- Expected: every advertised package entry point loads after normal installation.
- Observed: the compiler imports excluded `tools/export-fat-graph.mjs`. The package also omits `vendor/fetch.sh` and engine setup files.
- Evidence: E2, `npm-pack.json`, `consumer-probe.log`. Root and runtime imports pass.
- Next action: define the supported package installation path and include its required compiler dependencies.
- Dependencies: separate implementation authority. Publishing needs separate publication authority.
- Acceptance: a clean installed artifact compiles the documented program and produces a visible Babylon texture without repository-relative patches.
- Required checks: pack, install, import all exports, first render, error recovery, and uninstall.
- Last verification: 2026-09-22.

### GAP-002: Published kit lacks Babylon license text

- Status: open. Priority: P1. Category: release.
- Scope: `export-kit/kit.config.json` and published kit inventory.
- Expected: the distribution includes applicable licenses and dependency attribution.
- Observed: the kit bundles Babylon but lists only two MIT license files. Its bundle lacks the Apache license text.
- Evidence: E6. Installed Babylon 9.13.0 supplies `license.md` and `NOTICE.md`. The kit inventory supplies neither.
- Next action: include Babylon's license and applicable notices through the existing kit system.
- Dependencies: identify notices applicable to bundled code. Obtain separate implementation and publication authority.
- Acceptance: every bundled dependency has its required license and applicable notices in the actual downloadable artifact.
- Required checks: inspect the final inventory, check hashes, and compare notices with the exact dependency distribution.
- Last verification: 2026-09-22.

### GAP-003: Authority selection is not reproducible by default

- Status: open. Priority: P2. Category: authority.
- Scope: `vendor/fetch.sh`, parity evidence, and STATUS.md authority records.
- Expected: a documented source revision selects reproducible engine bytes.
- Observed: the script defaults to rolling `/1`. STATUS.md records 1.0.167, while current upstream and CDN provide 1.0.168.
- Evidence: E3, `authority-delta.json`, `engine-meta.json`, and `engine-hashes.json`.
- Next action: define an explicit engine version and integrity record through existing configuration.
- Dependencies: separate implementation authority.
- Acceptance: two isolated installations resolve identical engine and effect hashes for the documented revision.
- Required checks: check exact version metadata, all bundle hashes, and parity against preserved baselines.
- Last verification: 2026-09-22.

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

These actions belong to the separate authorized job. This audit does not implement or publish them.

1. Resolve GAP-001 through the existing package files. Require a clean installed compiler and first visible result.
2. Resolve GAP-002 through the existing kit configuration. Require complete dependency notices in the downloadable artifact.
3. Resolve GAP-003 through existing authority configuration. Require repeated installations with identical engine hashes.
4. Address GAP-004 with current manifests and existing harnesses. Require explicit coverage and retained exclusions for every completion claim.
5. Address GAP-005 through existing CI. Require exact-source evidence before release qualification.
6. Address GAP-006 through existing host qualification. Require successful developer workflows for every supported release target.
7. Address GAP-007 in existing documentation. Require counts and command gates to match accepted evidence.

Do not infer implementation, publication, or workflow authority from this list.

## 6. Pass history

| Date | Run and source | Document changes | Tested scope | Remaining limits |
| --- | --- | --- | --- | --- |
| 2026-09-22 | `20260922-babylonjs-01`, `d3446072d4c75f4d7e087ad48dfa06de5ec5dec9` | Created this register and added its README link. Publication uses standing authority. | 45 Node tests, 24 contract tests, 322 strict fixture passes, five differential probes, scene examples, package and kit checks. | Three sweep skips, external inputs, corpus, other hosts, packaging, dependency notices, and exact-SHA CI. |

No gap closed during this first audit. Successful checks do not establish whole-port completion or release approval.
The worker stopped at the requested audit checkpoint. Publication of audit documents does not authorize implementation.
The operator subsequently granted standing publication authority. The documents publish without another approval request.
