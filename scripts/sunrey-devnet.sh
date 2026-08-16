#!/usr/bin/env bash
# Start three isolated SunRey development nodes (A, B, C).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/packages/sunrey-chain/node/Cargo.toml"
BASE="${SUNREY_DEVNET_DIR:-/tmp/sunrey-devnet-abc}"
rm -rf "$BASE"
mkdir -p "$BASE/a" "$BASE/b" "$BASE/c"

cleanup() {
  if [[ -n "${PIDS:-}" ]]; then
    kill $PIDS 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

cargo build --manifest-path "$MANIFEST" --bin sunrey-node
BIN="$ROOT/packages/sunrey-chain/node/target/debug/sunrey-node"

SUNREY_NODE_NAME=A SUNREY_DATA_DIR="$BASE/a" SUNREY_P2P_ADDR=127.0.0.1:41001 \
  SUNREY_OPERATOR_ADDR=127.0.0.1:42001 SUNREY_PRODUCER=1 \
  "$BIN" >"$BASE/a.log" 2>&1 &
PIDS="$!"

wait_ready() {
  local port="$1"
  local i=0
  while ! curl -sf "http://127.0.0.1:${port}/ready" >/dev/null; do
    i=$((i + 1))
    if [[ "$i" -gt 100 ]]; then
      echo "readiness probe failed on port ${port}" >&2
      exit 1
    fi
    sleep 0.1
  done
}

wait_ready 42001

SUNREY_NODE_NAME=B SUNREY_DATA_DIR="$BASE/b" SUNREY_P2P_ADDR=127.0.0.1:41002 \
  SUNREY_OPERATOR_ADDR=127.0.0.1:42002 SUNREY_SEEDS=127.0.0.1:41001 \
  "$BIN" >"$BASE/b.log" 2>&1 &
PIDS="$PIDS $!"

SUNREY_NODE_NAME=C SUNREY_DATA_DIR="$BASE/c" SUNREY_P2P_ADDR=127.0.0.1:41003 \
  SUNREY_OPERATOR_ADDR=127.0.0.1:42003 SUNREY_SEEDS=127.0.0.1:41001 \
  "$BIN" >"$BASE/c.log" 2>&1 &
PIDS="$PIDS $!"

wait_ready 42002
wait_ready 42003

echo "SunRey development nodes A/B/C are ready."
echo "  A operator http://127.0.0.1:42001/status  p2p 41001  data $BASE/a"
echo "  B operator http://127.0.0.1:42002/status  p2p 41002  data $BASE/b"
echo "  C operator http://127.0.0.1:42003/status  p2p 41003  data $BASE/c"
echo "Press Ctrl-C to stop."
wait
