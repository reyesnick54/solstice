# Provider operations guide

Operations reference for the canonical external-provider control plane at
`packages/sunrey-chain/src/provider-runtime/universal`.

`PRODUCTION_READY=false` · `LIVE_CONNECTIVITY_ENABLED=false`

## Ownership

- **Runtime:** `packages/sunrey-chain/src/provider-runtime/universal`
- **Observability:** `packages/sunrey-chain/src/provider-runtime/universal/observability`
- **Internal HTTP:** `services/api/src/internal-provider-ops.ts` (`/internal/v1/providers/*`)

Do not create `packages/external-providers` or a second observability stack.

## Enable a provider

1. Register the adapter with `createUniversalProviderRuntime().register(...)`.
2. Bind credentials through `SecretReference` only (`secret://...`). Never store API keys on the registration record.
3. Promote lifecycle on the server (`DISABLED` → `SIMULATED` → `SANDBOX` → …). Frontend, Agent, and environment variables cannot promote to live tiers.
4. Confirm activation flags:
   - Global: `PROVIDERS_ENABLED=true`
   - Category: e.g. `MARKET_PROVIDERS_ENABLED=true`
   - Individual: e.g. `PROVIDER_COINGECKO_ENABLED=true`
5. Pass the contract harness: `runProviderContractHarness(...)`.

Preview/staging enablement does **not** inherit to production. Use tier activation policy for environment-specific blocks.

## Disable a provider

**Fastest (incident):** apply a kill switch on the runtime:

```ts
runtime.applyKillSwitch({
  switchId: 'ks-coingecko-1',
  providerId: 'coingecko',
  scope: 'PROVIDER',
  target: 'coingecko',
  actorId: 'operator-1',
  reason: 'vendor outage',
  nowUtc: new Date().toISOString(),
});
```

**Environment flag:** set `PROVIDER_COINGECKO_ENABLED=false` and redeploy.

**Category:** set `MARKET_PROVIDERS_ENABLED=false`.

**Global:** set `PROVIDERS_ENABLED=false` (disables all external providers).

**Lifecycle:** transition to `DISABLED` or `SUSPENDED` with a human operator actor.

## Inspect health

### Aggregate (internal)

```http
GET /internal/v1/providers/health
X-Sunrey-Operator-Role: GOVERNANCE_OPERATOR
X-Sunrey-Internal-Token: <configured-token>
```

Returns `externalProviders` counts and domain dependency rollups. Does not expose credential values.

### Individual provider (internal)

```http
GET /internal/v1/providers/status?providerId=sim-payments
```

Returns configuration/runtime/connectivity/freshness checks, circuit state, latency summary, cache freshness, and credential configured yes/no.

### CLI / code

```ts
import { createProviderObservabilityPlane } from '@solstice/sunrey-chain/src/provider-runtime/universal';

const plane = createProviderObservabilityPlane(runtime);
plane.status.listStatuses();
plane.aggregateHealth();
plane.dependencyStatus();
```

## Inspect rate-limit state

Check provider health record `rateLimited` and metrics:

- `provider_rate_limit_events_total{provider_id,category}`
- Health check `connectivity` with message `provider is rate limited`

Alerts fire on `rate_limit_exhausted` when sustained; single 429 events are marked transient.

## Inspect circuit breaker

- Health: `circuitState` (`CLOSED` | `OPEN` | `HALF_OPEN`)
- Metric: `provider_circuit_open{provider_id,category}`
- Counter: `provider_circuit_open_total`
- Runtime health check `runtime` fails when circuit is open

Circuit opens after configured consecutive failures (`healthPolicy.openAfterFailures`, default 3).

## Verify credential presence

Status response field:

```json
{
  "credential": {
    "credentialRequired": true,
    "credentialConfigured": false,
    "verificationStatus": "unverified"
  }
}
```

Configuration health check fails with `required credential is not configured`.

SunRey does **not** send external traffic during startup solely to validate credentials unless an explicit probe is configured. Missing optional credentials mark the provider `disabled`/`degraded`, not a global crash.

## Respond to provider outage

1. Confirm SunRey vs vendor: check internal status, metrics, and traces.
2. Disable provider (kill switch or env flag).
3. Invalidate cache if stale data must not be served: `POST /internal/v1/providers/cache/invalidate`.
4. Retain evidence via `runtime.recordEvidence(...)` (no secrets in evidence).
5. After vendor recovery, re-enable and verify health checks pass before removing kill switch.

See `docs/runbooks/EXTERNAL_PROVIDER_INCIDENT.md`.

## Disable a compromised provider

1. Apply kill switch immediately (`scope: PROVIDER`).
2. Set `PROVIDER_<ID>_ENABLED=false`.
3. Rotate credentials at the secret store (Chunk 149 credential plane).
4. Invalidate all provider cache entries.
5. Open incident; preserve audit logs and evidence vault entries.
6. Do not restore until security and legal/commercial verification completes.

## Distinguish provider failure from SunRey failure

| Signal | Provider issue | SunRey issue |
| --- | --- | --- |
| Single provider unhealthy | Yes | Unlikely |
| All providers in one category | Possible vendor/regional outage | Check category kill switch |
| All providers across categories | Unlikely external | Runtime, network policy, or deployment |
| `/health` ok, provider status degraded | Provider or credential | Normal degradation path |
| Ledger/Kernel errors | N/A | SunRey core — not a provider fix |

Traces should show latency at `provider.transport.request` vs upstream domain spans.

## Canonical health states

`healthy` · `degraded` · `unhealthy` · `disabled` · `blocked` · `unknown`

## Domain degradation contract

`NORMAL` · `DEGRADED` · `STALE_DATA` · `UNAVAILABLE`

Domains may serve degraded/stale responses without returning HTTP 500 when policy allows.

## Metrics

All provider metrics use bounded labels: `provider_id`, `category`, `capability`, `environment`, `result`, `error_class`.

Never use user IDs, full URLs, or secrets as metric labels.

## Logging

Structured logs include `providerId`, `capability`, `requestId`, `durationMs`, `circuitState`, `cacheState`, `result`.

Never log API keys, authorization headers, tokens, or large raw payloads by default.

## Alerting hooks

Evaluated via `plane.evaluateAlerts(providerId)`:

- Critical provider unavailable ≥ 5 minutes
- Circuit breaker continuously open (≥ 3 failures)
- Error rate above threshold (sustained)
- Scheduled refresh failing (≥ 3 consecutive)
- Cache expired with no fallback
- Rate-limit budget exhausted
- Unexpected authentication failures

Transient single failures do not page.
