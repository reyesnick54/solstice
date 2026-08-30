# Macroeconomic Providers (Wave 2 Prompt 8)

## Overview

Wave 2 Prompt 8 integrates macroeconomic and government-economic-data providers
using the Wave 1 provider infrastructure (`packages/provider-sdk`,
`packages/sunrey-chain/src/provider-runtime/data-delivery`).

External macro observations are **read-only evidence**. They do not issue
Execution Authority, post ledger journals, or authorize financial execution.

## Integrated providers (9)

| Provider ID | Name | Authority | Launch tier | Production |
| --- | --- | --- | --- | --- |
| `fred` | Federal Reserve Economic Data | authoritative_official | production_candidate | Blocked without `FRED_API_KEY` |
| `world-bank` | World Bank Open Data | authoritative_official | production_candidate | Eligible (no auth) |
| `econdb` | Econdb | derived_data | secondary_source | Blocked — commercial use unclear |
| `us-treasury-fiscaldata` | U.S. Treasury FiscalData | authoritative_official | production_candidate | Eligible (no auth) |
| `data-usa` | Data USA | derived_data | secondary_source | Eligible (no auth) |
| `census-gov` | U.S. Census Bureau | authoritative_official | production_candidate | Blocked without `CENSUS_API_KEY` |
| `saudi-open-data` | Saudi Open Data Portal | authoritative_official | secondary_source | Partially verified |
| `usaspending` | USAspending.gov | authoritative_official | production_candidate | Eligible (no auth) |
| `federal-register` | Federal Register API | authoritative_official | fallback_source | Eligible (no auth) |

Catalog source: `packages/sunrey-chain/src/macro/catalog-entries.ts`
(synced to `config/providers/free-api-catalog.yaml` via `scripts/sync-macro-catalog.mjs`).

## Capabilities

- `macroeconomic_indicators`
- `economic_indicators`
- `inflation`, `employment`, `interest_rates`, `gdp` (provider-specific)
- `fiscal_data`, `public_spending`, `treasury_data`, `government_statistics`

## Architecture

```
External Provider API
    ↓
Macro Adapter (packages/sunrey-chain/src/macro/adapters/*)
    ↓
HttpProviderTransport + Auth Resolver + Reliability Control Plane (provider-sdk)
    ↓
ExternalObservation<MacroIndicator>
    ↓
MacroDataService
    ↓
World BFF (services/api/src/consumer/world-economy-adapter.ts)
    ↓
Consumer Application
```

Domain services resolve providers by **capability** via `ProviderFactory.listByCapability()`,
not by vendor class.

## Canonical indicator mapping

Canonical IDs live in `packages/sunrey-chain/src/macro/indicator-mapping.ts`.

Examples:

| Canonical ID | FRED | World Bank |
| --- | --- | --- |
| `US_CPI` | `CPIAUCSL` | — |
| `US_GDP` | `GDP` | `NY.GDP.MKTP.KD.ZG` |
| `US_UNEMPLOYMENT` | `UNRATE` | `SL.UEM.TOTL.ZS` |
| `US_TREASURY_10Y` | `DGS10` | — |

Mappings are created only where semantics are compatible. Provider-native IDs
are preserved in provenance metadata.

## Country normalization

ISO 3166-1 alpha-2 via `normalizeCountryCode()` in
`packages/sunrey-chain/src/macro/country.ts`. Saudi datasets map to `SA`.

## Cache policies

Capability-specific policies from `packages/sunrey-chain/src/provider-runtime/data-delivery/policies.ts`:

| Capability prefix | Fresh TTL | Persist |
| --- | ---: | --- |
| `macro.gdp` | 24h | yes |
| `macro.indicator.monthly` | 30d | yes |
| Treasury yields (daily) | 5m | yes |

## Refresh schedules

Defined in `packages/sunrey-chain/src/macro/refresh-schedules.ts`:

- Monthly indicators: daily refresh with jitter
- Daily Treasury rates: hourly refresh
- Annual population/GDP: weekly refresh

## Fallback behavior

`MacroDataService` selects providers in priority order (critical → high → medium → low).
On failure:

1. Try next eligible provider with compatible indicator mapping
2. Use valid cache if permitted (stale-while-revalidate)
3. Mark stale observations explicitly
4. Return degraded partial response with warnings (not HTTP 500)

## BFF endpoints

| Route | Description |
| --- | --- |
| `GET /api/v1/world/economy` | Global macro overview |
| `GET /api/v1/world/economy/indicators` | Indicators by category |
| `GET /api/v1/world/economy/countries/:country` | Country snapshot |
| `GET /api/v1/world/economy/series/:indicator` | Time series (`?country=US`) |

Responses expose sanitized source metadata only (provider name, timestamps, freshness).
No credentials or internal ops details.

## Agent / Grow integration

Macro observations convert to read-only agent evidence via
`packages/sunrey-chain/src/macro/agent-evidence.ts` using
`toAgentEvidenceRef()` from provider-sdk. `grantsExecutionAuthority` is always `false`.

## Simulation vs live

- **Simulation** (default): `FixtureTransport` serves deterministic JSON fixtures. No network.
- **Live**: `FetchProviderTransport` with SSRF controls. Blocked when `ENVIRONMENT=simulation`.

## Known limitations

- Catalog is partial (9 of 126 providers). Full master list pending.
- `econdb` blocked from production pending commercial-use review.
- `saudi-open-data` partially verified.
- Federal Register provides regulatory documents, not time-series indicators.
- No multi-source consensus engine yet (Prompt 9+).

## Tests

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/wave-2-prompt-8-macro-providers.test.ts
npm run providers:validate
```
