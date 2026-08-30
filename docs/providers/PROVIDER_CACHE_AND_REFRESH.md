# SunRey Provider Cache and Refresh

Wave 1 Prompt 6 — shared data-delivery layer for the external free/public API
plane. Prevents uncontrolled repeated calls to external providers through
caching, stale-while-revalidate (SWR), optional persistence, scheduled refresh,
deduplication, quota protection (via single-flight), and graceful outage
behavior.

**Canonical owner:** `packages/sunrey-chain/src/provider-runtime/data-delivery`

Simulation-only. No live 126-provider integration in this prompt.

## Architecture

```
Request (providerId, capability, resourceId)
    ↓
ProviderDataDeliveryService
    ↓
InMemoryProviderDataCache (ProviderDataCache port)
    ↓ optional
InMemoryObservationPersistence
    ↓ scheduled
ProviderRefreshScheduler → PersistentJobQueue (packages/events)
```

Reused infrastructure:

| Component | Location | Role |
| --- | --- | --- |
| Job queue | `packages/events/src/jobs.ts` | `PersistentJobQueue`, `InMemoryJobStore` |
| Observation dedupe pattern | `packages/events/src/operation/domains.ts` | Idempotency model |
| Connector rate limit / circuit breaker | `packages/sunrey-chain/src/oracle/production/` | Provider call protection at fetch layer |
| OAuth token cache | `oracle/production/auth-runtime.ts` | Credential cache (separate from observation cache) |
| Free API catalog | `config/providers/free-api-catalog.yaml` | Future provider registry |

No Redis application client exists today. Cache and persistence use in-memory
implementations behind ports so a Postgres adapter can be added under
`packages/persistence` without changing domain services.

## Cache hierarchy

1. **Hot cache** — `ProviderDataCache` / `InMemoryProviderDataCache`
   - Key: `pdc:{providerId}:{capability}:{sha256(resourceId)[:16]}`
   - Never embeds secrets, tokens, or full account numbers in keys
2. **Optional persistence** — `ObservationPersistenceStore` for historical
   normalized observations (macro, FX reference, energy, audit evidence)
3. **Scheduled refresh** — enqueues `PROVIDER_DATA_REFRESH` jobs, not direct HTTP

## TTL and policies

Policies are **per capability**, not global. See `resolveCachePolicy()` in
`policies.ts`.

| Capability pattern | Fresh TTL | SWR window | Hard expire | Persist |
| --- | --- | --- | --- | --- |
| `fx.reference` | 30s | 60s | 5m | yes |
| `weather.current` | 5m | 15m | 1h | no |
| `aviation.position` | 15s | 45s | 5m | no |
| `macro.gdp` | 24h | 48h | 7d | yes (audit raw) |
| `macro.indicator.monthly` | 30d | 60d | 120d | yes (audit raw) |
| `energy.price` | 5m | 10m | 1h | yes |

Metadata on each entry: `providerId`, `createdAtUtc`, `staleAtUtc`,
`expiresAtUtc`, `hardExpireAtUtc`, `schemaVersion`, `observationId`,
`contentHash`.

## Stale-while-revalidate

```
Fresh?           → return immediately (source: cache_fresh)
Within SWR?      → return stale + background refresh (cache_stale)
Past SWR, pre-hard → sync fetch; retain on failure (cache_retained_on_failure)
Past hard expire → fetch required; no stale fallback
```

Freshness is **never hidden**. Stale responses set `stale: true` and
`freshness: STALE_USABLE`.

## Stampede prevention

`SingleFlightCoordinator` coalesces concurrent fetches for the same cache key.
Five thousand simultaneous FX requests result in one provider fetch; others
await the same promise.

## Persistence

Not all observations are persisted. `CachePolicy.persistNormalized` controls
whether normalized observations are written to `ObservationPersistenceStore`.

Persisted records retain:

- Canonical `ExternalDataObservation`
- Provenance and `contentHash`
- Optional raw payload (policy-controlled)

## Raw payload retention

| Policy | Meaning |
| --- | --- |
| `none` | Never store raw provider payload |
| `short_term` | ~24h retention |
| `audit_required` | ~30d retention |
| `long_term` | Retained until explicit cleanup policy |

Raw payloads are size-limited (`maxRawPayloadBytes`). Cleanup runs on persist
and via `cleanup()` using history caps and retention TTL.

## Scheduled refresh

`ProviderRefreshScheduler` reads `RefreshScheduleEntry` configurations (mock
schedules in `fixtures.ts`). Each tick:

1. Computes interval bucket for idempotency
2. Applies random jitter in `[0, jitterMs)`
3. Enqueues `PROVIDER_DATA_REFRESH` job with deterministic `jobId`
4. Skips duplicate job IDs within the scheduler instance

Mock examples: macro daily, weather every 10 minutes, energy every 5 minutes,
FX hourly.

## Failure behavior

On refresh failure:

- Error recorded in `RefreshFailureRecord` (observable, safe message only)
- Existing cache retained when still before `hardExpireAtUtc`
- Invalid provider payloads **do not** overwrite valid cache entries
- Circuit breaker and rate limits remain at the connector fetch layer (Chunk 127)

## Invalidation

`ProviderDataCache.invalidate()` supports:

- Provider-level
- Capability-level
- Resource-level
- Schema-version (incompatible entries removed on normalization upgrade)

## Storage growth controls

- Hard expiration cleanup (`cleanupExpired`)
- `maxHistoryEntries` per resource in persistence
- Raw payload retention policies and byte limits
- Content-hash deduplication on persist

## Security

Cache keys and metadata reject forbidden fragments (`token`, `password`,
`api_key`, `account_number`, health identifiers, etc.). See `keys.ts`.

Provider credentials stay in the Chunk 149 credential plane — never in cache
keys or catalog files.

## Tests

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning --test \
  packages/sunrey-chain/src/provider-runtime/data-delivery/data-delivery.test.ts
```

Covers: fresh hit, miss, stale hit, SWR background refresh, expiry,
single-flight, failure retention, invalid payload guard, invalidation,
schema invalidation, scheduled jobs, jitter, duplicate jobs, persistence
round-trip, retention cleanup, and secret-free keys.

## Related documentation

- `docs/providers/FREE_API_MASTER_CATALOG.md`
- `docs/productization/SUNREY_PROVIDER_INTEGRATION_STANDARD.md`
- `docs/economics/chunk-127-economic-data-connector-runtime.md`
- `docs/productization/PHASE_B_05_ASYNC_WORKFLOWS.md`
