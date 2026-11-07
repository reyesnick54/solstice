# HELIOS Market Data — Current State (MD01)

**Qualification marker:** `HELIOS_MD01_MARKET_DATA_FABRIC_QUALIFIED`  
**Authority:** `MARKET_OBSERVATION_ONLY`  
**Schema:** `sunrey.market-data-event.v1` / `sunrey.helios.market-data-fabric.v1`

## Implemented

| Component | Location | Status |
|-----------|----------|--------|
| Canonical event types + validation | `packages/provider-sdk/src/market-data-capability/canonical-events.ts` | Implemented |
| Venue → MD01 bridge | `packages/provider-sdk/src/venue/canonical-event-bridge.ts` | Implemented |
| Certification anchor | `packages/external-data/src/certification/market-data/md01-events.ts` | Implemented |
| Exchange re-export | `packages/sunrey-exchange/src/market-data/canonical-events.ts` | Implemented |
| MD01 observation fabric | `packages/platform/src/helios/market-data/md01/` | Implemented |
| H08 integration hook | `packages/platform/src/helios/observation/md01-market-events.ts` | Implemented |
| Feature Fabric slice | `packages/platform/src/helios/feature-fabric/market-data/` | Implemented |
| Qualification tests | `tests/helios-md01-market-data-fabric.test.ts` | Implemented |

## Relationship to prior work

- **H08** (`helios/observation`) — generic observation envelope; MD01 seals market events through `Md01ObservationBridge`.
- **M02** (`helios/market-observation`) — multi-asset time-series observations; complementary to MD01 event fabric (no second platform).
- **AAF07** — external market-data **certification**; MD01 consumes certified capability metadata via `external-data` certification owner.

## Not in scope

- Live vendor HTTP feeds (`HELIOS_MARKET_DATA_LIVE_QUALIFY` remains separate harness).
- Execution Authority, order placement, or ledger mutation.
- `packages/market-data-v2` or duplicate registries.

## Verify locally

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/helios-md01-market-data-fabric.test.ts
```
