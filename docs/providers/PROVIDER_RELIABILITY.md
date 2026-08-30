# Provider Reliability Control Plane

Wave 1 — shared reliability infrastructure for external API providers.

`@solstice/provider-sdk` wraps every outbound provider call with policy-driven
timeouts, retries, rate limits, bulkheads, and circuit breakers. No individual
provider APIs are integrated in this layer.

```
Provider Adapter
      ↓
Provider Reliability Policy
      ↓
Rate Limiter
      ↓
Concurrency / Bulkhead Guard
      ↓
Circuit Breaker
      ↓
ProviderTransport
      ↓
Retry Evaluation
      ↓
Response / Error
```

## Policy

`ProviderReliabilityPolicy` is the normalized per-provider configuration:

| Field | Purpose | Default |
|-------|---------|---------|
| `timeoutMs` | Total request timeout | 5,000 |
| `maxRetries` | Maximum retry attempts after first try | 3 |
| `retryBaseDelayMs` | Exponential backoff base | 250 |
| `retryMaxDelayMs` | Backoff ceiling | 8,000 |
| `rateLimit` | Per-second/minute/hour/day limits | 10/s, 300/min |
| `concurrencyLimit` | Per-provider in-flight cap | 10 |
| `circuitBreakerThreshold` | Failures before open | 5 |
| `circuitBreakerWindow` | Rolling sample window | 10 |
| `circuitBreakerCooldown` | Open-state duration | 30,000 ms |
| `respectRetryAfter` | Honor `Retry-After` headers | true |
| `staleFallbackAllowed` | Permit stale-cache fallback hook | false |

Provider-specific values will later derive from catalog/runtime configuration.
Defaults are conservative.

## Timeouts

Every outbound provider request has a bounded timeout (100 ms – 30 s).
`ProviderReliabilityControlPlane` enforces timeouts via `AbortSignal` and
rejects calls whose upstream deadline budget is already exhausted.

## Retries

Retries use exponential backoff with jitter. `Retry-After` (seconds or HTTP
date) is respected when `respectRetryAfter` is true.

| Method | Default retry |
|--------|---------------|
| `GET`, `HEAD` | Retryable on transient failures |
| `POST`, `PATCH`, `DELETE` | Not retryable unless `idempotent: true` |

Retryable HTTP statuses: 408, 429, 502, 503, 504, plus network/timeout errors.
Non-retryable: 400, 401, 403, 404, validation failures.

Financial mutations elsewhere in SunRey keep separate idempotency rules; this
SDK does not weaken those.

## Rate limiting

`ProviderRateLimiter` enforces independent token buckets per provider for:

- requests per second
- requests per minute
- requests per hour
- requests per day

When a provider returns 429, the limiter records a cooldown timestamp so SunRey
does not create a retry storm against a quota-exhausted provider.

## Bulkheads / concurrency

`ProviderBulkheadGuard` caps in-flight requests per provider and optionally
enforces a global provider concurrency ceiling. One saturated provider (e.g.
CoinGecko) cannot exhaust all outbound sockets for unrelated providers (e.g.
OpenSky).

## Circuit breakers

Per-provider circuits use three states:

| State | Behavior |
|-------|----------|
| `CLOSED` | Normal traffic |
| `OPEN` | Requests rejected; provider not hammered |
| `HALF_OPEN` | Single probe after cooldown |

Circuits trip on consecutive failures and failure ratio within the sample window.
State is exposed to health/observability via metrics hooks.

## Error classification

Failures normalize into:

- `retryable`
- `non_retryable`
- `rate_limited`
- `authentication_failure`
- `provider_unavailable`
- `invalid_payload`
- `security_failure`

## Deadline propagation

Pass `deadline: { deadlineMs }` to `execute()`. The control plane computes the
remaining budget and will not launch a workflow that exceeds upstream time left.

## Fallback hooks

Generic hooks allow future domain services to choose alternate providers or stale
cache without hard-coded provider relationships:

```typescript
const plane = new ProviderReliabilityControlPlane({
  fallbackHook: chainFallbackHooks(staleCacheFallback()),
});
```

`ReliabilityOutcome.fallbackEligible` signals whether a fallback decision is
appropriate.

## Global safety limits

`GlobalSafetyLimits` caps:

- maximum retries (across policy)
- maximum total time per operation
- maximum concurrency per provider
- optional global provider concurrency ceiling

## Metrics (Prompt 7)

`ProviderMetricsRecorder` hooks record:

- `provider_requests_total`
- `provider_request_duration`
- `provider_errors_total`
- `provider_retries_total`
- `provider_rate_limited_total`
- `provider_circuit_state`
- `provider_circuit_open_total`

Use `InMemoryProviderMetrics` in tests; wire to the SRE telemetry framework in
production.

## Usage

```typescript
import {
  ProviderReliabilityControlPlane,
  SimulatedProviderTransport,
  successResponse,
} from '@solstice/provider-sdk';

const plane = new ProviderReliabilityControlPlane({
  policy: { timeoutMs: 3_000, concurrencyLimit: 5 },
});

const transport = new SimulatedProviderTransport('example', [successResponse()]);
const result = await plane.execute(transport, { method: 'GET', path: '/v1/data' });

if (result.ok) {
  console.log(result.value);
} else {
  console.error(result.error.classification, result.fallbackEligible);
}
```

## Provider isolation

Reliability state (rate buckets, circuits, bulkhead counters) is keyed by
`providerId`. Providers are fully isolated — saturation or outage of one does not
block others sharing the same process.

## Simulation only

This package performs no live network I/O. Tests use `SimulatedProviderTransport`.
`ENVIRONMENT` remains `simulation`; no `LIVE_*` flags are changed.

## Owner

`packages/provider-sdk` — Wave 1 shared provider SDK. Extends patterns from
`packages/sunrey-chain/src/provider-runtime/universal` and
`packages/sunrey-chain/src/oracle/production` without duplicating domain owners.
