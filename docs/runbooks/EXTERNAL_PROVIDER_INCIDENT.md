# External provider incident runbook

Operator runbook for Wave 1 external-provider failures. Simulation only —
no live vendor connectivity on `main`.

**Control plane:** `packages/sunrey-chain/src/provider-runtime/universal/observability`  
**Ops guide:** `docs/providers/PROVIDER_OPERATIONS.md`

## Required operator capabilities

- Disable provider (kill switch, env flag, lifecycle)
- Invalidate provider cache
- Retain evidence (`recordEvidence`, audit logs)
- Switch to fallback later (routing priority / failover policy)
- Restore after verification

## Scenario A — Provider API returns 500s

**Symptoms:** `runtime` health check fail, `provider_errors_total` rising, `circuitState` may move to `OPEN`.

**Actions:**

1. Confirm via `/internal/v1/providers/status?providerId=<id>`.
2. Apply provider kill switch if consumer impact is material.
3. Check whether cache can serve stale data (`STALE_DATA` degradation) per domain policy.
4. Record evidence with correlation ID; do not store response bodies with secrets.
5. Monitor `provider_circuit_open` — breaker should protect SunRey from retry storms.
6. After vendor confirms recovery, observe successful health observations before re-enabling.

## Scenario B — Provider starts timing out

**Symptoms:** `provider_timeout_total` increases, latency p95 elevated, health `degraded` → `unhealthy`.

**Actions:**

1. Verify SunRey egress and timeout policy (`healthPolicy.timeoutMs`, max 30s).
2. Disable provider if timeouts persist beyond SLO.
3. Invalidate cache if timed-out partial writes occurred.
4. Use traces to confirm latency is at `provider.transport.request`, not domain logic.

## Scenario C — Provider changes schema

**Symptoms:** `provider_data_invalid_total`, normalization failures, `SCHEMA_INCOMPATIBLE` class errors.

**Actions:**

1. Disable provider immediately — do not silently coerce unknown fields.
2. Retain evidence digest and schema version in incident ticket.
3. Engineering deploys adapter normalization fix in sandbox first.
4. Re-certify with `runProviderContractHarness` before re-enable.

## Scenario D — API credential revoked

**Symptoms:** Configuration or runtime auth failures, `credentialConfigured` may still be true but requests fail.

**Actions:**

1. Disable provider.
2. Rotate secret at credential plane (`secret://` reference only).
3. Re-bind credential on registration.
4. Verify `configuration` health check passes before traffic.

## Scenario E — Provider quota exhausted

**Symptoms:** `provider_rate_limit_events_total`, health `rate_limited`, HTTP 429 class.

**Actions:**

1. Reduce refresh scheduler frequency if applicable.
2. Serve from cache (`provider_cache_stale_served_total`) if domain allows `STALE_DATA`.
3. Disable non-critical providers in the same category temporarily.
4. Escalate commercially for quota increase; do not bypass rate limits in code.

## Scenario F — Provider compromised / data suspected incorrect

**Symptoms:** Security alert, anomalous values, external disclosure.

**Actions:**

1. Kill switch + `PROVIDER_<ID>_ENABLED=false` immediately.
2. Invalidate all cache keys for the provider.
3. Preserve evidence vault entries and structured logs (no secret material).
4. Block production activation (`PRODUCTION_BLOCKED` tier) until legal/security sign-off.
5. Do not merge compromised observations into authoritative economic state.

## Scenario G — Commercial / license approval revoked

**Symptoms:** Governance flag, legal notice, `launchTier: PRODUCTION_BLOCKED`.

**Actions:**

1. Transition lifecycle to `SUSPENDED`.
2. Disable in production tier via activation policy.
3. Sandbox/preview may remain for engineering only if counsel approves.
4. Update provider catalog metadata and acceptance evidence.

## Recovery checklist

- [ ] Vendor/root cause documented
- [ ] Credential rotation complete (if applicable)
- [ ] Contract harness passes
- [ ] Health checks: configuration, runtime, connectivity, freshness all pass
- [ ] Cache refreshed
- [ ] Kill switch released
- [ ] Alerts cleared (no transient-only pages)
- [ ] Evidence sealed

## Escalation

- **SunRey platform:** on-call SRE, `#sunrey-ops`
- **Security:** credential compromise, suspected data tampering
- **Legal/commercial:** license revocation, production activation

## Related documents

- `docs/providers/provider-failure-handling.md`
- `docs/runbooks/provider-runtime-incident.md`
- `docs/operations/chunk-156-sunrey-control-room.md`
