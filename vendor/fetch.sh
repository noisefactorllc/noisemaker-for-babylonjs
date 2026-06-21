#!/usr/bin/env bash
# vendor/fetch.sh — vendor the PUBLISHED Noisemaker shader engine from the production CDN.
#
# The port reuses the engine verbatim (it's the same JS/WebGL2 environment, so nothing is
# translated — only `BabylonBackend` is new). We vendor the published distribution
# (https://shaders.noisedeck.app/<VERSION>) so the repo is self-contained — NO sibling
# checkout, no reference to anything in `..`. This is the same artifact noisedeck.app ships:
# a core ESM engine bundle + per-effect "mini-bundles" (production pre-fetches these).
#
#   bash vendor/fetch.sh            # refresh from the pinned version
#   VERSION=2 bash vendor/fetch.sh  # bump the pinned engine version
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
VERSION="${VERSION:-1}"
BASE="https://shaders.noisedeck.app/${VERSION}"
OUT="$HERE/noisemaker"
EFFECTS="$OUT/effects"

mkdir -p "$EFFECTS"
echo "[vendor] engine $BASE -> $OUT"

# 1. Engine core (exports Pipeline, compileGraph, WebGL2Backend, Effect, registerEffect, …).
curl -fsSL --max-time 60 "$BASE/noisemaker-shaders-core.esm.js" -o "$OUT/noisemaker-shaders-core.esm.js"
echo "[vendor]   core: $(wc -c < "$OUT/noisemaker-shaders-core.esm.js") bytes"

# 2. Manifest (184 effect descriptors).
curl -fsSL --max-time 30 "$BASE/effects/manifest.json" -o "$EFFECTS/manifest.json"

# 3. Per-effect mini-bundles (definition + GLSL/WGSL inline; self-contained ESM, Node-loadable).
codes=$(node -e 'const m=require(process.argv[1]); console.log(Object.keys(m).join("\n"))' "$EFFECTS/manifest.json")
n=0; ok=0
for id in $codes; do
  n=$((n+1))
  ns="${id%%/*}"; eff="${id##*/}"
  mkdir -p "$EFFECTS/$ns"
  if curl -fsSL --max-time 30 "$BASE/effects/$ns/$eff.js" -o "$EFFECTS/$ns/$eff.js"; then ok=$((ok+1)); else echo "[vendor]   MISS $id"; fi
done
echo "$VERSION" > "$OUT/VERSION"
echo "[vendor] done: core + manifest + $ok/$n mini-bundles (version $VERSION)"
