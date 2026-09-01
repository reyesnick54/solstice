#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${SUNREY_TESTNET_NAMESPACE:-sunrey-testnet-1}"
STATEFULSET="sunrey-validator"
VALIDATORS=7
BASE_PORT="${SUNREY_TESTNET_OPERATOR_BASE_PORT:-27650}"
TIMEOUT_SECONDS="${SUNREY_TESTNET_VERIFY_TIMEOUT_SECONDS:-180}"

PIDS=()

cleanup() {
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT

operator_port() {
  echo $((BASE_PORT + $1))
}

start_forward() {
  local ordinal="$1"
  local port
  port="$(operator_port "$ordinal")"
  kubectl -n "$NAMESPACE" port-forward "pod/${STATEFULSET}-${ordinal}" "${port}:26657" \
    >"/tmp/sunrey-testnet-port-forward-${ordinal}.log" 2>&1 &
  PIDS[$ordinal]=$!
}

wait_http() {
  local ordinal="$1"
  local port
  port="$(operator_port "$ordinal")"
  local deadline=$((SECONDS + TIMEOUT_SECONDS))
  until curl --fail --silent --show-error "http://127.0.0.1:${port}/ready" >/dev/null 2>&1; do
    if (( SECONDS >= deadline )); then
      echo "validator ${ordinal} operator endpoint did not become ready" >&2
      cat "/tmp/sunrey-testnet-port-forward-${ordinal}.log" >&2 || true
      return 1
    fi
    sleep 1
  done
}

height_of() {
  local ordinal="$1"
  local port
  port="$(operator_port "$ordinal")"
  curl --fail --silent "http://127.0.0.1:${port}/finalized_height" | \
    node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>process.stdout.write(String(JSON.parse(s).finalized_height)))'
}

wait_height() {
  local target="$1"
  local count="$2"
  local deadline=$((SECONDS + TIMEOUT_SECONDS))
  while true; do
    local ok=1
    for ((i=0; i<count; i++)); do
      local h
      h="$(height_of "$i" 2>/dev/null || echo 0)"
      if (( h < target )); then
        ok=0
        break
      fi
    done
    if (( ok == 1 )); then
      return 0
    fi
    if (( SECONDS >= deadline )); then
      echo "validators did not reach finalized height ${target}" >&2
      for ((i=0; i<count; i++)); do
        echo "validator-${i} finalized_height=$(height_of "$i" 2>/dev/null || echo unavailable)" >&2
      done
      return 1
    fi
    sleep 1
  done
}

common_finalized_root() {
  local height="$1"
  local count="$2"
  local expected=""
  for ((i=0; i<count; i++)); do
    local port root
    port="$(operator_port "$i")"
    root="$(curl --fail --silent "http://127.0.0.1:${port}/finalized_block?height=${height}" | \
      node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>process.stdout.write(JSON.parse(s).state_root))')"
    if [[ -z "$expected" ]]; then
      expected="$root"
    elif [[ "$root" != "$expected" ]]; then
      echo "state-root mismatch at height ${height}: validator-${i}=${root}, expected=${expected}" >&2
      return 1
    fi
  done
  echo "$expected"
}

echo "Waiting for seven SunRey Testnet-1 validators..."
kubectl -n "$NAMESPACE" rollout status "statefulset/${STATEFULSET}" --timeout="${TIMEOUT_SECONDS}s"
echo "Allowing validator mesh to stabilize after rollout..."
sleep 15

for ((i=0; i<VALIDATORS; i++)); do
  start_forward "$i"
done
for ((i=0; i<VALIDATORS; i++)); do
  wait_http "$i"
done

wait_height 2 "$VALIDATORS"
INITIAL_ROOT="$(common_finalized_root 2 "$VALIDATORS")"
INITIAL_HEIGHT="$(height_of 0)"
echo "Seven-validator finality confirmed at height >= ${INITIAL_HEIGHT}; height-2 root=${INITIAL_ROOT}"

# With one validator offline, six of seven retain >2/3 voting power.
kill "${PIDS[6]}" >/dev/null 2>&1 || true
unset 'PIDS[6]'
kubectl -n "$NAMESPACE" scale "statefulset/${STATEFULSET}" --replicas=6
kubectl -n "$NAMESPACE" wait --for=delete "pod/${STATEFULSET}-6" --timeout="${TIMEOUT_SECONDS}s" || true
TARGET_AFTER_OUTAGE=$((INITIAL_HEIGHT + 1))
wait_height "$TARGET_AFTER_OUTAGE" 6
OUTAGE_ROOT="$(common_finalized_root "$TARGET_AFTER_OUTAGE" 6)"
echo "Six-of-seven liveness confirmed at height ${TARGET_AFTER_OUTAGE}; root=${OUTAGE_ROOT}"

# Restore the seventh validator. Its retained PVC/WAL must catch up to the
# canonical finalized chain without weakening consensus safety.
kubectl -n "$NAMESPACE" scale "statefulset/${STATEFULSET}" --replicas=7
kubectl -n "$NAMESPACE" rollout status "statefulset/${STATEFULSET}" --timeout="${TIMEOUT_SECONDS}s"
start_forward 6
wait_http 6
TARGET_AFTER_RECOVERY=$((TARGET_AFTER_OUTAGE + 1))
wait_height "$TARGET_AFTER_RECOVERY" "$VALIDATORS"
RECOVERY_ROOT="$(common_finalized_root "$TARGET_AFTER_RECOVERY" "$VALIDATORS")"

echo "Validator recovery confirmed at height ${TARGET_AFTER_RECOVERY}; root=${RECOVERY_ROOT}"

cat > /tmp/sunrey-prompt3-testnet-evidence.json <<JSON
{
  "networkId": "net_sunrey_testnet_1",
  "chainId": "chn_sunrey_testnet_1",
  "validatorCount": 7,
  "initialFinalizedHeight": ${INITIAL_HEIGHT},
  "singleValidatorOutageFinalizedHeight": ${TARGET_AFTER_OUTAGE},
  "recoveryFinalizedHeight": ${TARGET_AFTER_RECOVERY},
  "initialStateRootAtHeight2": "${INITIAL_ROOT}",
  "outageStateRoot": "${OUTAGE_ROOT}",
  "recoveryStateRoot": "${RECOVERY_ROOT}",
  "productionAuthorized": false,
  "mainnetActive": false
}
JSON

cat /tmp/sunrey-prompt3-testnet-evidence.json
