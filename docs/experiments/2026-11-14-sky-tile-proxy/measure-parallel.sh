#!/usr/bin/env bash
# Downloads 12 order-8 tiles of the IRSA 2MASS color HiPS over 1, 6 and 12 parallel connections and prints the time.
# Each run uses a different tile set, so no run benefits from tiles another run already pulled into a cache.
# Change BASE_* when re-running, or the server may already have these tiles cached.
set -euo pipefail

HIPS="https://irsa.ipac.caltech.edu/data/hips/CDS/2MASS/Color/Norder8"
BASE_1=530100
BASE_6=430100
BASE_12=330100

run() {
  local parallel=$1 base=$2 config
  config=$(mktemp)
  for n in $(seq "$base" $((base + 11))); do
    printf 'url = "%s/Dir%s/Npix%s.jpg"\n' "$HIPS" $((n / 10000 * 10000)) "$n" >> "$config"
  done
  local start end
  start=$(date +%s%N)
  # Tiles are saved under their own names in a temporary directory (relative paths also work with native Windows curl).
  local dir
  dir=$(mktemp -d)
  if [ "$parallel" = 1 ]; then
    (cd "$dir" && curl -sf --remote-name-all -K "$config")
  else
    (cd "$dir" && curl -sf --remote-name-all -Z --parallel-max "$parallel" -K "$config")
  fi
  rm -rf "$dir"
  end=$(date +%s%N)
  echo "connections=$parallel: $(((end - start) / 1000000)) ms for 12 tiles"
  rm -f "$config"
}

run 12 "$BASE_12"
run 6 "$BASE_6"
run 1 "$BASE_1"
