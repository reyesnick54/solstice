# Market Reference Providers

Wave 2 / Prompt 10 — normalized market-reference layer for SunRey.

## Status

| Item | Value |
| --- | --- |
| Catalog population | `awaiting_master_list` |
| Catalog providers integrated | **0** |
| Simulation fallback | `sunrey-market-reference-simulation` |
| Environment | `simulation` only |
| Live provider connectivity | `false` |

The Wave 0 catalog (`config/providers/free-api-catalog.yaml`) remains empty. No
providers were invented for this prompt. When the authoritative 126-provider
master list is supplied, eligible entries tagged for markets, securities,
commodities, `market_prices`, `resource_prices`, or `asset_metadata` will bind
through the catalog adapter factory.

## Canonical owner

`packages/sunrey-exchange/src/market-reference/`

Extends the Exchange owner. Does **not** create `packages/market-data`,
`packages/market-reference`, or a second price authority.

## Providers integrated

### Catalog providers (0)

None — catalog shell is empty.

### Simulation fallback (1)

| Provider ID | Role | Authority |
| --- | --- | --- |
| `sunrey-market-reference-simulation` | Sandbox/tests/BFF when catalog is empty | `reference_data` |

## Assets and resources covered (simulation registry)

| Asset ID | Symbol | Class | Venue | Unit |
| --- | --- | --- | --- | --- |
| `SIM-ETF-1` | SIMETF | security | SIM-US (MIC XSIM) | USD |
| `COMMODITY:gold:USD:troy_oz` | XAU | commodity | COMEX | USD/troy oz |
| `COMMODITY:silver:USD:troy_oz` | XAG | commodity | COMEX | USD/troy oz |
| `COMMODITY:copper:USD:lb` | HG | commodity | LME | USD/lb |
| `SUNREY_COIN` | SUNREY | native | — | USD reference |
| `MOONREY_COIN` | MOONREY | native | — | USD reference |

Ticker alone is not assumed globally unique. Venue identity (`ticker@venueId`)
is used when disambiguation matters.

## Canonical models

- `MarketReferenceQuote` — spot/reference quote with provenance
- `MarketHistoryCandle` — OHLCV with interval, timezone, adjustment status
- `CommodityPriceObservation` — commodity, price, currency, explicit unit
- `MarketReferenceProvider` / `MarketReferenceService` — capability discovery + fallback chain

## Authority classification

| Type | Authority | May execute trades? | May settle? | May issue tokens? |
| --- | --- | --- | --- | --- |
| `MarketReferenceQuote` | `REFERENCE_ONLY` | No | No | No |
| `ExecutionQuote` | Exchange internal | Yes (via Kernel) | No | No |
| `SettlementPrice` | Ledger/custody | No | Yes | No |

Public market APIs are **reference/research data** unless future governance
explicitly promotes a regulated feed.

## Unit handling

- Source units are always retained on `CommodityPriceObservation.unit`
- Optional `normalizedUnit` + `unitTransformation` when conversion is performed
- Mass conversions use rational factors (`troy_oz` ↔ `kg` ↔ `lb` ↔ `g`)
- USD/oz is never silently converted to USD/kg

## Cache policies

| Capability | Fresh TTL | Stale window | Hard expire |
| --- | ---: | ---: | ---: |
| `market.reference.quote` | 30s | 120s | 600s |
| `market.reference.history.daily` | 1h | 24h | 7d |
| `market.reference.history.intraday` | 5m | 15m | 1h |
| `market.reference.commodity.daily` | 1h | 24h | 7d |
| `market.reference.asset_metadata` | 24h | 7d | 30d |

Implemented in:

- `packages/sunrey-exchange/src/market-reference/cache-policies.ts`
- `packages/sunrey-chain/src/provider-runtime/data-delivery/policies.ts`

## Domain integrations

| Domain | Integration | Path |
| --- | --- | --- |
| Grow | Read-only market evidence for opportunity analysis | `integrations/grow.ts` |
| Financial Agent | Read-only evidence; `REFERENCE_NOT_EXECUTION` label | `integrations/agent.ts` |
| Exchange | Context only; internal order book unchanged | `market-reference` service (no book mutation) |
| MoonRey | `REFERENCE_PRICE` commodity observations | `integrations/moonrey.ts` |
| World | Markets + resources snapshot | `integrations/world.ts` |

Flow:

```
Market Reference Data
        ↓
Agent / Grow Analysis
        ↓
Suitability / Compliance
        ↓
User Approval
        ↓
Authorized Execution Provider
```

## BFF routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/v1/markets/reference` | Service metadata + separation proof |
| GET | `/api/v1/markets/assets/{id}` | Asset metadata + reference quote |
| GET | `/api/v1/markets/assets/{id}/history` | Historical candles |
| GET | `/api/v1/world/resources` | Markets + commodity resources |
| GET | `/api/v1/world/resources/{resource}` | Single commodity observation |

Handler: `services/api/src/consumer/market-reference.ts`

## Provider fallback

Primary → secondary → fallback. No synthetic averaging across providers.
Fallback retains original source metadata on the observation.

## Tests

`tests/wave-2-prompt-10-market-reference.test.ts`

## Prompt 11 recommendation

When the 126-provider master list is supplied:

1. Populate `config/providers/free-api-catalog.yaml` with verified market/commodity entries
2. Implement live transport adapters per provider through `packages/provider-sdk`
3. Wire credential binding (Chunk 149 secret refs only)
4. Enable catalog adapter factory with real normalization pipelines
5. Add provider-specific asset mapping tables without conflicting canonical IDs
