# HELIOS Multi-Asset Expansion M01–M04 Closure

This document closes the first four milestones of the HELIOS Multi-Asset Expansion track: canonical instruments, observations, session/contract context, and usable market state with deterministic tradability.

## Implemented architecture

### M01 — Canonical instruments

Input contract: `MultiAssetInstrumentRecord` in `packages/platform/src/helios/multi-asset/m01/types.ts`.

Each instrument carries jurisdiction-scoped identity (`instrumentId`), asset class, venue, currency, price scale, and lifecycle flags (`active`, `halted`, `researchOnly`). Futures carry optional expiry metadata for roll evaluation.

Existing HELIOS capital-market and executable-opportunity layers (H07/H09) remain the upstream registries; M04 consumes normalized instrument snapshots rather than duplicating registry ownership.

### M02 — Observations

Input contract: `MultiAssetObservationBundle` in `packages/platform/src/helios/multi-asset/m02/types.ts`.

Quote and bar observations include deterministic freshness, entitlement, provider health, timestamp consistency, and corroboration counts. M04 never reads provider adapters directly.

Existing HELIOS observation fabric (H08) remains the upstream ingestion owner.

### M03 — Sessions and contracts

Input contract: `MultiAssetSessionContractRecord` in `packages/platform/src/helios/multi-asset/m03/types.ts`.

Session state, liquidity, volatility, futures roll posture, and execution-route capability are composed separately from raw quotes. A price existing does not imply an open session or executable route.

Existing executable-opportunity terms and venue session taxonomies (H09) inform this layer without replacing them.

### M04 — Canonical market state and tradability

Core module: `packages/platform/src/helios/multi-asset/`.

| Component | Responsibility |
|-----------|----------------|
| `evaluate.ts` | Builds canonical `MarketState` from M01–M03 inputs |
| `data-quality.ts` | Deterministic quality assessment across freshness, completeness, provider health, entitlement, timestamp consistency, spread sanity, and corroboration |
| `tradability.ts` | Emits tradability state plus separated capability flags |
| `bridge.ts` | Provider-neutral views for Opportunity Research, Stat Arb, Volatility, Microstructure, Execution Research, and Strategy Lab |
| `qualification.ts` | Emits `HELIOS_MULTI_ASSET_M04_MARKET_STATE_QUALIFIED` when acceptance scenarios pass |

`MarketState` includes reference price, bid/ask/spread, volume, bar timeframes, freshness, data quality, volatility and liquidity posture, futures roll state, entitlement and provider health, execution capability, confidence, and evidence references.

Tradability states are deterministic: `TRADABLE`, `RESEARCH_ONLY`, `DATA_STALE`, `MARKET_CLOSED`, `INSUFFICIENT_DATA`, `PROVIDER_DEGRADED`, `ENTITLEMENT_BLOCKED`, `EXECUTION_UNAVAILABLE`, `CONTRACT_EXPIRING`, and `INSTRUMENT_INACTIVE`.

Capability dimensions remain separate:

- **observable** — evidence exists
- **researchable** — safe for research consumption
- **proposal eligible** — sufficient for Grow proposal qualification
- **executable** — open session, healthy data, and execution route available

No AI is used to decide whether financial data is valid.

## Remaining external provider dependencies

M04 is provider-neutral at evaluation time. Upstream layers still depend on external market-data and execution providers for live enrichment:

- Capital-market observation fetch (H07) — Finnhub and future provider candidates
- HELIOS observation fabric (H08) — provider-sdk ingestion and trust integration
- Execution route registry (H09) — sandbox and production-candidate broker routes

M04 does not activate live trading, change `ENVIRONMENT`, or flip any `LIVE_*` flag.

## Known limitations

1. **Snapshot inputs only** — M04 evaluates in-memory M01–M03 snapshots; durable market-state persistence is not part of M04.
2. **No automatic M01–M03 adapters in platform** — Callers must map H07/H08/H09 artifacts into M01–M03 records until dedicated multi-asset adapters land.
3. **Fixed spread sanity threshold** — Extreme spread detection uses a deterministic 500 bps cutoff; venue-specific calibration belongs in a later milestone.
4. **Research bridge admission policies are static** — Per-consumer policies are coded defaults, not mandate-scoped configuration.
5. **Futures roll inference is upstream** — M04 surfaces roll state supplied by M03; it does not compute roll calendars itself.
6. **M05 not started** — Strategy consumption, durable caching, and live orchestration hooks are intentionally out of scope for this closure.

## Qualification marker

Passing acceptance tests emit:

`HELIOS_MULTI_ASSET_M04_MARKET_STATE_QUALIFIED`

Test file: `tests/helios-m04-multi-asset-market-state.test.ts`
