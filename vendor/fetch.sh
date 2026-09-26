#!/usr/bin/env bash
# vendor/fetch.sh — vendor the PUBLISHED Noisemaker shader engine from the production CDN.
#
# The port reuses the engine verbatim (it's the same JS/WebGL2 environment, so nothing is
# translated — only `BabylonBackend` is new). We vendor the published distribution
# (https://shaders.noisedeck.app/<VERSION>) so the repo is self-contained — NO sibling
# checkout, no reference to anything in `..`. This is the same artifact noisedeck.app ships:
# a core ESM engine bundle + per-effect "mini-bundles" (production pre-fetches these).
#
# The default VERSION below is the DOCUMENTED engine revision this port is verified against
# (STATUS.md "Vendor sync" record: build `8eeb7b5a`, v1.0.183, 858616-byte core). Bumping it
# is an authority change: re-run the parity checks and update the STATUS.md record.
#
#   bash vendor/fetch.sh             # fetch the pinned, documented revision
#   VERSION=1.0.184 bash vendor/fetch.sh  # deliberate authority bump (requires re-verification)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
VERSION="${VERSION:-1.0.183}"
BASE="https://shaders.noisedeck.app/${VERSION}"
OUT="$HERE/noisemaker"
EFFECTS="$OUT/effects"

mkdir -p "$EFFECTS"
echo "[vendor] engine $BASE -> $OUT"

# 1. Engine core (exports Pipeline, compileGraph, WebGL2Backend, Effect, registerEffect, …).
curl -fsSL --max-time 60 "$BASE/noisemaker-shaders-core.esm.js" -o "$OUT/noisemaker-shaders-core.esm.js"
echo "[vendor]   core: $(wc -c < "$OUT/noisemaker-shaders-core.esm.js") bytes"

# 2. Manifest (210 effect descriptors).
curl -fsSL --max-time 30 "$BASE/effects/manifest.json" -o "$EFFECTS/manifest.json"

# 3. Per-effect mini-bundles (definition + GLSL/WGSL inline; self-contained ESM, Node-loadable).
codes=$(node -e 'const m=require(process.argv[1]); console.log(Object.keys(m).join("\n"))' "$EFFECTS/manifest.json")
n=0; ok=0; miss=0
for id in $codes; do
  n=$((n+1))
  ns="${id%%/*}"; eff="${id##*/}"
  mkdir -p "$EFFECTS/$ns"
  if curl -fsSL --max-time 30 "$BASE/effects/$ns/$eff.js" -o "$EFFECTS/$ns/$eff.js"; then ok=$((ok+1)); else echo "[vendor]   MISS $id"; miss=$((miss+1)); fi
done
if [[ $miss -ne 0 ]]; then
  echo "[vendor] FAILED: $miss/$n mini-bundle download(s) missing — refusing to write an integrity record for an incomplete fetch" >&2
  exit 1
fi

# 4. Integrity record: exact version metadata + sha256 of every fetched artifact, so any
#    installation can be compared byte-for-byte against the documented revision.
core_build=$(sed -n 's/^ \* Build: //p' "$OUT/noisemaker-shaders-core.esm.js" | head -1)
node - "$VERSION" "$OUT" "$core_build" <<'NODE'
const { createHash } = require('node:crypto')
const { readFileSync, writeFileSync, readdirSync, statSync } = require('node:fs')
const { join, relative } = require('node:path')
const [version, out, coreBuild] = process.argv.slice(2)
const sha256 = p => createHash('sha256').update(readFileSync(p)).digest('hex')
const hashes = { 'noisemaker-shaders-core.esm.js': sha256(join(out, 'noisemaker-shaders-core.esm.js')) }
const walk = d => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name.endsWith('.js')) hashes[relative(out, p)] = sha256(p)
    else if (e.name === 'manifest.json') hashes[relative(out, p)] = sha256(p)
  }
}
walk(join(out, 'effects'))
const sortedHashes = Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
writeFileSync(join(out, 'engine-meta.json'), JSON.stringify({
  version, coreBuild, coreBytes: statSync(join(out, 'noisemaker-shaders-core.esm.js')).size,
  effectCount: Object.keys(sortedHashes).length - 2, manifestBytes: statSync(join(out, 'effects/manifest.json')).size, fetchedFrom: `https://shaders.noisedeck.app/${version}`
}, null, 2) + '\n')
writeFileSync(join(out, 'engine-hashes.json'), JSON.stringify(sortedHashes, null, 2) + '\n')
NODE

echo "$VERSION" > "$OUT/VERSION"
echo "[vendor] done: core + manifest + $ok/$n mini-bundles (version $VERSION, build ${core_build:-unknown})"
