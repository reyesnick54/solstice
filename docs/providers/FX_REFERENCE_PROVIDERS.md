# FX Reference Providers

Wave 2 Prompt 9 integrates free foreign-exchange **reference data** providers into
SunRey's normalized external-data plane. This is reference data only.

## Scope

These providers supply observations for:

- UI reference displays
- World / economic context
- Financial Agent research evidence
- Indicative conversion estimates
- Reasonableness checks

They do **not** supply:

- Settlement rates
- Payment execution quotes
- Banking provider rates
- Ledger authority

## Providers (partial catalog)

| Provider ID | Type | Launch tier | Authority class | Update cadence |
| --- | --- | --- | --- | --- |
| `bank-of-russia` | Central bank | production_candidate | authoritative_official | Daily |
| `national-bank-poland` | Central bank | production_candidate | authoritative_official | Daily |
| `frankfurter` | Aggregator | production_candidate | reference_data | Daily |
| `currency-api` | Aggregator | secondary_source | reference_data | Near real-time |
| `exchangerate-dev` | Aggregator | secondary_source | reference_data | Near real-time |
| `exchangerate-host` | Aggregator | fallback_source | reference_data | Near real-time |
| `economia-awesome` | Aggregator | secondary_source | reference_data | Near real-time |

Blocked (catalog only, not activated):

| Provider ID | Reason |
| --- | --- |
| `currencyapi-com` | `blocked_pending_review` |

## Canonical model

`FxReferenceRate` in `packages/payments/src/fx-reference/types.ts`:

- `baseCurrency` / `quoteCurrency` — ISO 4217
- `numerator` / `denominator` — exact rational bigint rate
- `effectiveAt`, `sourceTimestamp`, `retrievedAt`
- `rateType` — `SPOT`, `DAILY_REFERENCE`, `HISTORICAL`
- `providerId`, `authorityClass`, `freshness`, `observationId`
- `derivedFrom` — provenance for cross/inverse rates

Execution remains on `FxExecutionQuote` / regulated `FxLiquidityProvider`.

## Cross and inverse rates

When a direct pair is unavailable:

1. Try inverse (`SAR/USD` from `USD/SAR`)
2. Try cross via `USD` or `EUR` bridge

Derived rates use `authorityClass: derived_data` and retain `derivedFrom`
observation IDs. They are never presented as provider-native.

## Caching and refresh

Capability key: `fx.reference.latest`

| State | Policy |
| --- | --- |
| Fresh TTL | 30 seconds |
| Stale-while-revalidate | 60 seconds |
| Hard expire | 5 minutes |

Historical rates may be cached longer. Central-bank daily feeds are not
polled minute-by-minute.

Provider precedence (lower number wins):

1. `bank-of-russia` (10)
2. `national-bank-poland` (20)
3. `frankfurter` (30)
4. Secondary aggregators (40–70)
5. `exchangerate-host` fallback (60)

Multiple provider observations are retained independently. No averaging.

## BFF endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/fx/reference` | Provider list or `?base=&quote=` lookup |
| `GET /api/v1/fx/reference/:base/:quote` | Single pair reference rate |
| `GET /api/v1/fx/reference/:base/:quote/history?date=` | Historical reference |

Responses include `authority: FX_REFERENCE_ONLY_NOT_EXECUTION` and never expose
credentials or internal rate-limit state.

## Simulation posture

- `ENVIRONMENT=simulation`
- All `LIVE_*` flags remain `false`
- Adapters use fixture transports only (no live HTTP)
- Catalog `population_status: partial` (7 active FX + 1 blocked; full 126 list pending)

## Related

- `docs/providers/FREE_API_MASTER_CATALOG.md`
- `docs/providers/PROVIDER_SDK_ARCHITECTURE.md`
- `docs/providers/PROVIDER_CACHE_AND_REFRESH.md`
- `packages/payments/src/fx-reference/`
