#!/usr/bin/env bash
# sweep.sh [names...] — render every Babylon candidate (one browser) + grade vs the reused
# reference WebGL2 goldens.
#
#   bash parity/sweep.sh            # all programs with goldens
#   bash parity/sweep.sh noise blur # just these
#
# Because the Babylon candidate renders on the SAME WebGL2 driver (ANGLE/Metal) as the golden,
# parity is byte-EXACT: every graded effect passes at max-abs-diff 0. There is no per-effect
# relaxed-tolerance map: a 2026-07 full re-grade (every catalogued effect, including the
# continuous solvers reactionDiffusion/navierStokes evolved ~30s via the EVOLVE path) confirmed
# 0 diff across the board, including the handful of effects (newton, shadow, uvRemap,
# distortion, edge, pinch, crt) that once carried a relaxed tolerance here as a safety net — that
# net is retired; any non-zero diff now means a real BabylonBackend bug, not a rounding quirk.
set -uo pipefail
cd "$(dirname "$0")/.."

tol_for() { echo "0 0.999"; }

PY="parity/.venv/bin/python"
if [[ -n "${LEDGER_PATH+x}" ]]; then LEDGER_EXPLICIT=1; else LEDGER_EXPLICIT=0; fi
LEDGER_PATH="${LEDGER_PATH:-parity/ledger.json}"
RESULTS="$(mktemp -t noisemaker-for-babylonjs-ledger.XXXXXX)"
trap 'rm -f "$RESULTS"' EXIT
record_result() {
  printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5" >> "$RESULTS"
}

# Names: args, or every required effect DSL. The live-corpus fixtures (corpus_*) are
# EXCLUDED here — they are stateful/emergent compositions that must be evolved ~30s (their goldens
# are minted at 1800 frames) and are graded by their own harness, parity/corpus/sweep.sh. Grading
# them here (un-evolved, frame 8) would falsely fail them on a frame-count mismatch.
if [[ $# -gt 0 ]]; then
  NAMES=("$@")
  if [[ "$LEDGER_EXPLICIT" = "1" ]]; then
    same_ledger=$(python3 -c 'import os, sys; a, b = map(os.path.realpath, sys.argv[1:]); print(int(a == b or (os.path.exists(a) and os.path.exists(b) and os.path.samefile(a, b))))' "parity/ledger.json" "$LEDGER_PATH")
    if [[ "$same_ledger" = "1" ]]; then
      echo "[FAIL] subset sweep cannot write the canonical ledger: $LEDGER_PATH"
      exit 2
    fi
  else
    LEDGER_PATH="parity/ledger.partial.json"
  fi
else
  NAMES=()
  if ! roster=$(node parity/current-programs.mjs); then
    echo "[FAIL] could not read the current engine fixture roster"
    exit 1
  fi
  while IFS= read -r n; do [[ -n "$n" ]] && NAMES+=("$n"); done <<< "$roster"
  if [[ ${#NAMES[@]} -eq 0 ]]; then
    echo "[FAIL] no current parity fixtures found"
    exit 1
  fi
fi

# Render all candidates in ONE browser session. NM_DUAL=1 refreshes both the
# reference and candidate in that same session, enforcing a current golden too.
if [[ "${NM_DUAL:-0}" = "1" ]]; then
  echo "=== rendering ${#NAMES[@]} candidates (one browser, dual golden/candidate) ==="
else
  echo "=== rendering ${#NAMES[@]} candidates (one browser) ==="
fi
# Hardening: clear any stale candidate PNGs first. If a candidate fails to render, the file must
# be ABSENT so the grader (below) reports "no candidate rendered" — otherwise an errored render
# would be silently graded against a leftover candidate from a previous run and falsely PASS.
for n in "${NAMES[@]}"; do
  rm -f "parity/out/$n.candidate.png"
  rm -f "parity/out/$n.report.json"
  [[ "${NM_DUAL:-0}" = "1" ]] && rm -f "parity/out/$n.golden.png"
done
if [[ "${NM_DUAL:-0}" = "1" ]]; then
  if render_log=$(node parity/render-batch.mjs "${NAMES[@]}" --dual 2>&1); then render_rc=0; else render_rc=$?; fi
else
  if render_log=$(node parity/render-batch.mjs "${NAMES[@]}" 2>&1); then render_rc=0; else render_rc=$?; fi
fi
printf '%s\n' "$render_log" | grep -E "ERR|rendered" | sed 's/^/  /' || true

# Grade.
pass=0; fail=0; failed=""
for n in "${NAMES[@]}"; do
  if [[ ! -f "parity/out/$n.candidate.png" ]]; then
    echo "[FAIL] $n — no candidate rendered"
    record_result "$n" FAIL 0 0.999 "candidate renderer produced no current output"
    fail=$((fail+1)); failed="$failed $n"; continue
  fi
  if [[ ! -f "parity/out/$n.golden.png" ]]; then
    echo "[FAIL] $n — no current golden rendered"
    record_result "$n" FAIL 0 0.999 "reference renderer produced no current output"
    fail=$((fail+1)); failed="$failed $n"; continue
  fi
  if [[ "$render_rc" -ne 0 ]]; then
    echo "[FAIL] $n — batch renderer exited $render_rc"
    record_result "$n" FAIL 0 0.999 "batch renderer exited nonzero"
    fail=$((fail+1)); failed="$failed $n"; continue
  fi
  read -r tol ssim <<<"$(tol_for "$n")"
  if r=$("$PY" parity/compare.py "parity/out/$n.golden.png" "parity/out/$n.candidate.png" --name "$n" --tolerance "$tol" --ssim-min "$ssim" --report "parity/out/$n.report.json" 2>&1); then compare_rc=0; else compare_rc=$?; fi
  echo "$r"
  if [[ "$compare_rc" -ne 0 ]] || ! echo "$r" | grep -q "\[PASS\]"; then
    record_result "$n" FAIL "$tol" "$ssim" "numeric comparison failed strict byte-exact policy"
    fail=$((fail+1)); failed="$failed $n"; continue
  fi
  record_result "$n" PASS "$tol" "$ssim" "strict byte-exact comparison passed"
  pass=$((pass+1))
done

if ! python3 parity/write-ledger.py --root "$PWD" --results "$RESULTS" --output "$LEDGER_PATH"; then
  echo "[FAIL] could not write sweep ledger: $LEDGER_PATH"
  fail=$((fail+1)); failed="$failed ledger"
fi

echo ""
echo "=== SWEEP: ${pass} / $((pass+fail)) PASS ==="
[[ -n "$failed" ]] && echo "    FAILED:$failed"
[[ "$fail" -eq 0 ]]
