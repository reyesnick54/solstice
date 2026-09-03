#!/usr/bin/env bash
# Verify a deployed SunRey sandbox Consumer BFF (simulation only).
# Never prints secrets. Exit 0 when all checks pass.
set -euo pipefail

API_BASE="${SUNREY_VERIFY_API_BASE:-https://api.sunrey.xyz}"
PREVIEW_EMAIL="${SUNREY_VERIFY_PREVIEW_EMAIL:-${SUNREY_PREVIEW_AUTH_EMAIL:-}}"
PREVIEW_PASSWORD="${SUNREY_VERIFY_PREVIEW_PASSWORD:-${SUNREY_PREVIEW_AUTH_PASSWORD:-}}"
ORIGIN="${SUNREY_VERIFY_APP_ORIGIN:-https://app.sunrey.xyz}"
PERSONA_ID="${SUNREY_VERIFY_PERSONA_ID:-basic_verified}"

pass=0
fail=0

check() {
  local name="$1"
  shift
  if "$@"; then
    printf 'PASS  %s\n' "$name"
    pass=$((pass + 1))
  else
    printf 'FAIL  %s\n' "$name" >&2
    fail=$((fail + 1))
  fi
}

json_get() {
  local payload="$1"
  local field="$2"
  node -e "const v=JSON.parse(process.argv[1]); const p=process.argv[2].split('.'); let c=v; for (const k of p) c=c?.[k]; process.stdout.write(String(c ?? ''));" "$payload" "$field"
}

request() {
  local method="$1"
  local path="$2"
  shift 2
  curl -fsS -X "$method" \
    -H "Origin: ${ORIGIN}" \
    -H "Accept: application/json" \
    "$@" \
    "${API_BASE}${path}"
}

check_api_reachable() {
  curl -fsS -o /dev/null "${API_BASE}/health"
}

check_health() {
  local body
  body="$(request GET /health)"
  [[ "$(json_get "$body" ok)" == "true" ]] \
    && [[ "$(json_get "$body" environment)" == "simulation" ]] \
    && [[ "$(json_get "$body" productionActive)" == "false" ]] \
    && [[ "$(json_get "$body" liveConnectivityEnabled)" == "false" ]]
}

check_ready() {
  local body status
  status="$(curl -sS -o /tmp/sunrey-ready.json -w '%{http_code}' -H "Origin: ${ORIGIN}" "${API_BASE}/ready")"
  body="$(cat /tmp/sunrey-ready.json)"
  [[ "$status" == "200" ]] \
    && [[ "$(json_get "$body" ready)" == "true" ]] \
    && [[ "$(json_get "$body" environment)" == "simulation" ]] \
    && [[ "$(json_get "$body" productionActive)" == "false" ]]
}

check_db_ready() {
  local body
  body="$(request GET /ready)"
  local persistence_ok
  persistence_ok="$(node -e "
    const report = JSON.parse(process.argv[1]);
    const row = report.checks?.find((c) => c.name === 'persistence');
    process.stdout.write(row && row.ok ? 'true' : 'false');
  " "$body")"
  [[ "$persistence_ok" == "true" ]]
}

check_simulation_mode() {
  local body
  body="$(request GET /api/v1/version 2>/dev/null || request GET /health)"
  [[ "$(json_get "$body" environment)" == "simulation" ]]
}

check_production_false() {
  local body
  body="$(request GET /health)"
  [[ "$(json_get "$body" productionReady)" == "false" ]] \
    && [[ "$(json_get "$body" productionActive)" == "false" ]]
}

check_auth_session() {
  if [[ -z "$PREVIEW_EMAIL" || -z "$PREVIEW_PASSWORD" ]]; then
    echo "preview auth credentials not configured (set SUNREY_VERIFY_PREVIEW_EMAIL/PASSWORD)" >&2
    return 1
  fi
  local login
  login="$(curl -fsS -X POST \
    -H "Origin: ${ORIGIN}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${PREVIEW_EMAIL}\",\"password\":\"${PREVIEW_PASSWORD}\",\"personaId\":\"${PERSONA_ID}\"}" \
    "${API_BASE}/api/v1/auth/preview/session")"
  SESSION_TOKEN="$(json_get "$login" token)"
  [[ -n "$SESSION_TOKEN" ]]
}

check_authenticated_home() {
  local body
  body="$(request GET /api/v1/me/home -H "Authorization: Bearer ${SESSION_TOKEN}")"
  [[ "$(json_get "$body" schema)" == "sunrey.consumer.home.v1" ]]
}

check_wallet_endpoint() {
  local body
  body="$(request GET /api/v1/wallets -H "Authorization: Bearer ${SESSION_TOKEN}")"
  [[ -n "$(json_get "$body" schema)" ]]
}

check_market_endpoint() {
  local body
  body="$(request GET /api/v1/markets/reference -H "Authorization: Bearer ${SESSION_TOKEN}")"
  [[ -n "$(json_get "$body" schema)" || -n "$(json_get "$body" items)" ]]
}

check_vault_endpoint() {
  local body
  body="$(request GET /api/v1/data/vault -H "Authorization: Bearer sandbox.vault_financial")"
  [[ "$(json_get "$body" schema)" == "sunrey.consumer.vault.home.v1" ]]
}

check_grow_endpoint() {
  local body
  body="$(request GET /api/v1/grow -H "Authorization: Bearer sandbox.grow_multi_currency")"
  [[ -n "$(json_get "$body" schema)" ]]
}

printf 'Verifying SunRey sandbox at %s (origin %s)\n' "$API_BASE" "$ORIGIN"

check "API reachable" check_api_reachable
check "/health" check_health
check "/ready" check_ready
check "simulation mode" check_simulation_mode
check "production flags false" check_production_false
check "database ready" check_db_ready
check "preview auth session" check_auth_session
check "authenticated /api/v1/me/home" check_authenticated_home
check "wallet endpoint" check_wallet_endpoint
check "market endpoint" check_market_endpoint
check "vault endpoint" check_vault_endpoint
check "grow endpoint" check_grow_endpoint

printf '\nSummary: %s passed, %s failed\n' "$pass" "$fail"
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
