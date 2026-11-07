# HELIOS Market Data — MD15 Current-Main Requalification Report

**Engineering marker:** `HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED`

**Git SHA:** `2146aa191d01323d9c2cfff6bd8411e640809802`

**Evaluated at (UTC):** `2026-11-07T16:23:35.673Z`

**Subprocess gates:** GREEN

## Posture (unchanged)

- `ENVIRONMENT=simulation`
- `MARKET_DATA_LIVE_SHADOW_ENABLED=false`
- `LIVE_TRADING_ENABLED=false`
- `LIVE_INVESTMENT_EXECUTION=false`
- `production_authorized=false`

This marker means **architecture / engineering qualification**. It does **not** mean a commercial data provider is contracted or licensed.

## MD01–MD14 canonical verification

| Package | Capability | Canonical owner | Qualification |
|---------|------------|-----------------|----------------|
| MD01 | Canonical market-data fabric | `packages/platform/src/helios/market-data/md01/index.ts` | QUALIFIED (module + test) |
| MD02 | Precision time and knowable-at envelope | `packages/platform/src/helios/market-data/md02/index.ts` | QUALIFIED (module + test) |
| MD03 | Sequence recovery and gap handling | `packages/platform/src/helios/market-data/md03/index.ts` | QUALIFIED (module + test) |
| MD04 | Deterministic order books | `packages/platform/src/helios/market-data/md04-order-book/index.ts` | QUALIFIED (module + test) |
| MD05 | Redundant feed arbitration | `packages/platform/src/helios/market-data/md05/index.ts` | QUALIFIED (module + test) |
| MD06 | Instrument master | `packages/platform/src/helios/market-data/md06-instrument-master/index.ts` | QUALIFIED (module + test) |
| MD07 | U.S. equity consolidated/direct market state | `packages/platform/src/helios/market-data/md07-us-equity/index.ts` | QUALIFIED (module + test) |
| MD08 | Derivatives market data intelligence | `packages/platform/src/helios/market-data/md08/index.ts` | QUALIFIED (module + test) |
| MD09 | Multi-venue crypto | `packages/platform/src/helios/market-data/md09/index.ts` | QUALIFIED (module + test) |
| MD10 | FX, rates, and commodity reference fabric | `packages/platform/src/helios/market-data/md10/index.ts` | QUALIFIED (module + test) |
| MD11 | Deterministic replay | `packages/sunrey-exchange/src/market-data/md11/index.ts` | QUALIFIED (module + test) |
| MD12 | Quality and microstructure | `packages/platform/src/helios/market-data/md12/index.ts` | QUALIFIED (module + test) |
| MD13 | Live-data resilience and chaos | `packages/platform/src/helios/market-data-live/md13/index.ts` | QUALIFIED (module + test) |
| MD14 | Final production-shaped qualification | `packages/platform/src/helios/market-data/md14-qualification.ts` | QUALIFIED (module + test) |

## MD14 integration harness

- **Owner:** `packages/platform/src/helios/market-data/md14-qualification.ts`
- **E2E pipeline:** `e2e-pipeline.ts` (canonical MD01–MD05 + MD12 stages)
- **Canonical probes:** `md14-canonical-probes.ts` (MD06, MD09, MD10, MD13 harnesses)
- **Qualification test:** `tests/helios-md14-market-data-qualification.test.ts`
- **Runner:** `npm run helios:md14:qualify`

## E2E and adversarial

- E2E pipeline ok: **true**
- Adversarial scenarios: **8/8**

## Blockers

_None._

