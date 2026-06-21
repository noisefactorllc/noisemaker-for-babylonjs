#!/usr/bin/env bash
# parity/corpus/fetch.sh — pull the live NoiseBLASTER! corpus (real shared
# compositions) into parity/corpus/raw/<code>.json. The RSS feed lists the 20
# most-recent shares; each /api/composition/<code> carries the full DSL source.
# Local-only test fixtures (do NOT push / vendor): the report + harness are what
# we commit, not third-party art. Re-run any time to refresh the corpus.
#
#   bash parity/corpus/fetch.sh
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
RAW="$HERE/raw"
mkdir -p "$RAW"

RSS="https://blaster.noisedeck.app/feed.rss"
API="https://sharing.noisedeck.app/api/composition"

echo "[fetch] RSS $RSS"
codes=$(curl -sS --max-time 30 "$RSS" \
  | grep -oE 'https://sharing\.noisedeck\.app/s/[A-Za-z0-9_-]+' \
  | sed -E 's#.*/s/##' | sort -u)

n=$(printf '%s\n' "$codes" | grep -c . || true)
echo "[fetch] $n distinct codes"

ok=0
for code in $codes; do
  out="$RAW/$code.json"
  http=$(curl -sS --max-time 25 -o "$out" -w "%{http_code}" "$API/$code" 2>/dev/null)
  if [ "$http" = "200" ]; then
    title=$(node -e 'try{console.log(require(process.argv[1]).title||"")}catch(e){console.log("?")}' "$out")
    echo "  [$http] $code  $title"
    ok=$((ok + 1))
  else
    echo "  [$http] $code  (failed)"
    rm -f "$out"
  fi
done
echo "[fetch] $ok/$n saved -> $RAW"
