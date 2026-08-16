#!/usr/bin/env bash
# Start four isolated SunRey development validators (A, B, C, D).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/packages/sunrey-chain/node/Cargo.toml"
BASE="${SUNREY_VALIDATOR_DEVNET_DIR:-/tmp/sunrey-validator-devnet-abcd}"
rm -rf "$BASE"
mkdir -p "$BASE/a" "$BASE/b" "$BASE/c" "$BASE/d"

cleanup() {
  if [[ -n "${PIDS:-}" ]]; then
    kill $PIDS 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

cargo build --manifest-path "$MANIFEST" --bin sunrey-validator-node
BIN="$ROOT/packages/sunrey-chain/node/target/debug/sunrey-validator-node"

SUNREY_VALIDATOR_NAME=A SUNREY_DATA_DIR="$BASE/a" SUNREY_P2P_ADDR=127.0.0.1:26670 \
  SUNREY_OPERATOR_ADDR=127.0.0.1:26680 \
  "$BIN" >"$BASE/a.log" 2>&1 &
PIDS="$!"

wait_ready() {
  local port="$1"
  local i=0
  while ! curl -sf "http://127.0.0.1:${port}/ready" >/dev/null; do
    i=$((i + 1))
    if [[ "$i" -gt 150 ]]; then
      echo "readiness probe failed on port ${port}" >&2
      exit 1
    fi
    sleep 0.1
  done
}

wait_ready 26680

for pair in "B:26671:26681" "C:26672:26682" "D:26673:26683"; do
  name="${pair%%:*}"
  rest="${pair#*:}"
  p2p="${rest%%:*}"
  op="${rest##*:}"
  dir="$BASE/$(echo "$name" | tr '[:upper:]' '[:lower:]')"
  SUNREY_VALIDATOR_NAME="$name" SUNREY_DATA_DIR="$dir" \
    SUNREY_P2P_ADDR="127.0.0.1:${p2p}" SUNREY_OPERATOR_ADDR="127.0.0.1:${op}" \
    SUNREY_SEEDS=127.0.0.1:26670 \
    "$BIN" >"$dir.log" 2>&1 &
  PIDS="$PIDS $!"
  wait_ready "$op"
done

echo "SunRey development validators A/B/C/D are ready."
echo "  A operator http://127.0.0.1:26680/status  p2p 26670  data $BASE/a"
echo "  B operator http://127.0.0.1:26681/status  p2p 26671  data $BASE/b"
echo "  C operator http://127.0.0.1:26682/status  p2p 26672  data $BASE/c"
echo "  D operator http://127.0.0.1:26683/status  p2p 26673  data $BASE/d"
echo "Press Ctrl-C to stop."
wait
