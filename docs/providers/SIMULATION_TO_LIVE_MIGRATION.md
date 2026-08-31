# Simulation to Live Migration

Wave 7 / Prompt 25 establishes explicit data modes and a simulation inventory.
This document classifies current product data sources and migration rules.

## Data mode configuration

| Variable | Values | Default |
|---|---|---|
| `SUNREY_DATA_MODE` | `live`, `simulation`, `preview` | `simulation` when `ENVIRONMENT=simulation` |

`SUNREY_DATA_MODE` controls reference-data preference. It does **not** enable
`LIVE_*` monetary flags or external bank connectivity.

## Rules

1. **Never represent simulation as LIVE.** BFF responses include explicit `dataState`.
2. **No silent fake data.** If no live source exists, return `UNAVAILABLE` or `STALE`.
3. **Do not delete test fixtures.** Classify as `KEEP_FOR_TEST`.
4. **Preserve demo paths** until live replacement is proven (`KEEP_FOR_DEMO`).
5. **Partial success is valid.** One domain failure must not blank an aggregator.

## Simulation inventory

Canonical inventory: `packages/external-data/src/simulation-inventory.ts`

| Classification | Meaning |
|---|---|
| `KEEP_FOR_TEST` | Required by CI; do not remove |
| `KEEP_FOR_DEMO` | Intentional sandbox/demo experience |
| `REPLACE_WITH_LIVE` | Canonical service exists; switch when authorized |
| `LIVE_SOURCE_NOT_AVAILABLE` | No valid provider; return UNAVAILABLE |
| `REMOVE_DEAD_PLACEHOLDER` | Unused stub; safe to delete after audit |

## Domain migration status

| Domain | Current | Target | Status |
|---|---|---|---|
| World economy | ExternalDataPlane facade | MacroDataService (full) | SIMULATED — facade wired |
| World markets | ExternalDataPlane facade | MarketReferenceService | SIMULATED — facade wired |
| World FX | ExternalDataPlane facade | FxReferenceService | SIMULATED — dual path |
| World resources (gold/silver/copper) | Sandbox commodity fixtures | ResourceDataProvider | SIMULATED |
| World resources (lithium) | none | ResourceDataProvider | UNAVAILABLE — no fabrication |
| World environment | EnvironmentalOracleService fixtures | EnvironmentalOracleService | SIMULATED |
| Grow opportunities | GrowthOrchestrator | Internal (not provider) | KEEP_FOR_DEMO |
| Grow context | growContextSnapshotAsync | ExternalDataPlane | SIMULATED — Prompt 25 route |
| Exchange markets | Sandbox BFF | MarketReferenceService | SIMULATED — reference only |
| MoonRey productive | ProductiveEconomyDataPlatform | ProductiveEconomySnapshot | SIMULATED — analytics only |
| Travel | Environmental travel context | TravelIntelligenceService | PARTIAL — no dedicated service yet |
| HIN reference | none | TBD | LIVE_SOURCE_NOT_AVAILABLE |
| Action Center events | sampleActionCenterEvents | Canonical event bus | SIMULATED events |
| Financial Agent evidence | AgentEvidenceCatalog | Categorized evidence | SIMULATED — Prompt 25 route |

## Safe replacement procedure

1. Confirm canonical domain service returns `ExternalObservation` envelopes.
2. Wire BFF adapter to domain service (not vendor adapter).
3. Set `dataState` from observation freshness + `SUNREY_DATA_MODE`.
4. Add contract test asserting BFF schema unchanged.
5. Run full CI (`npm run ci`).
6. Update simulation inventory classification.

## Missing live datasets

These return `UNAVAILABLE` rather than fabricated values:

- Lithium resource pricing
- Water / hydrogen standalone resource endpoints (catalog gap)
- HIN public nutrition/health reference
- Live real-estate property pricing
- Research intelligence and patent intelligence (services not yet implemented)
- Dedicated TravelIntelligenceService (environmental partial substitute)

## Intentionally retained simulations

- Grow opportunity feed (deterministic orchestrator)
- Exchange sandbox order book and execution lifecycle
- Agent conversation and proposal flows
- Provider fixture adapters in CI tests
- Personal Economy Agent mandate isolation proofs

## Production posture

`ENVIRONMENT=simulation` and all `LIVE_*` flags remain `false`. Prompt 25 does not
activate production provider connectivity. When live binding is authorized in a
future prompt, `SUNREY_DATA_MODE=live` will prefer provider-backed observations
while monetary execution remains separately gated.
