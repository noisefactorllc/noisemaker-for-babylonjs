#!/usr/bin/env bash
# run.sh <name> [tol] [ssim] [size] — render ONE Babylon candidate and grade it
# against the reused reference WebGL2 golden.
#
#   bash parity/run.sh noise
#   bash parity/run.sh blur 2.001 0.98 256
#
# Goldens are byte-identical reference WebGL2 renders (reused from ../noisemaker-godot).
# The candidate is rendered by render-candidate.mjs (Babylon, headless via Playwright),
# read back as linear 8-bit top-down to match the golden exactly.
set -euo pipefail

cd "$(dirname "$0")/.."
NAME="${1:?usage: run.sh <name> [tol] [ssim] [size]}"
TOL="${2:-2.001}"
SSIM="${3:-0.98}"
SIZE="${4:-256}"
TIME="${PARITY_TIME:-0.25}"

PY="parity/.venv/bin/python"
GOLD="parity/out/${NAME}.golden.png"
CAND="parity/out/${NAME}.candidate.png"
DSL="parity/programs/${NAME}.dsl"
REPORT="parity/out/${NAME}.report.json"

if [[ ! -f "$GOLD" ]]; then
  echo "[SKIP] $NAME — no golden at $GOLD"
  echo "       regen: NM_REFERENCE_ROOT=../noisemaker node tools/export-graph.mjs --file $DSL parity/out/${NAME}.graph.json"
  echo "       then the reference export-and-render.mjs (see parity/README.md)"
  exit 2
fi
if [[ ! -f "$DSL" ]]; then
  echo "[SKIP] $NAME — no DSL program at $DSL"; exit 2
fi

# Render the Babylon candidate (WebGL2, headless). Same size/time/frames as the golden.
node parity/render-candidate.mjs "$NAME" --size "$SIZE" --time "$TIME" --out "$CAND"

# Grade.
"$PY" parity/compare.py "$GOLD" "$CAND" --name "$NAME" \
  --tolerance "$TOL" --ssim-min "$SSIM" --report "$REPORT"
