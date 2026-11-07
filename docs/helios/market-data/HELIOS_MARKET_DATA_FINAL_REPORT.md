# HELIOS Market Data — MD14 Final Report

**Marker:** `HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED` (when CI and subprocess gates are green)

**Posture:** Simulation only. `LIVE_TRADING_ENABLED=false`. `production_authorized=false`. `MARKET_DATA_LIVE_SHADOW_ENABLED=false` in repository CI unless explicitly enabled in a controlled operator environment.

## Objective

Integrate and qualify the complete market-data fabric for **live read-only research** while keeping financial execution disabled.

## MD01–MD13 verification summary

| ID | Capability | Canonical owner |
|----|------------|-----------------|
| MD01 | Canonical observation fabric | `packages/platform/src/helios/observation/fabric.ts` |
| MD02 | Precision time / knowable-at | `packages/platform/src/helios/observation/information-time.ts` |
| MD03 | Sequence recovery | `packages/platform/src/helios/observation/quality.ts` |
| MD04 | Deterministic books | `packages/platform/src/helios/market-observation/order-book.ts` |
| MD05 | Redundant-source reconciliation | `packages/platform/src/helios/observation/lineage.ts` |
| MD06 | Instrument master | `packages/platform/src/helios/market-observation/instrument-registry.ts` |
| MD07 | Equities | `packages/sunrey-exchange/src/capital-market/` |
| MD08 | Derivatives / calendars | `packages/platform/src/helios/multi-asset/market-calendar/` |
| MD09 | Crypto | `packages/platform/src/helios/adaptive-alpha-fabric/aaf09-external-crypto/` |
| MD10 | FX, rates, commodities | `packages/platform/src/helios/multi-asset/gold/`, energy/WTI |
| MD11 | Replay | `packages/platform/src/helios/execution-twin/bytex-native/replay.ts` |
| MD12 | Quality / microstructure | `packages/platform/src/helios/multi-asset/data-quality.ts` |
| MD13 | Operations / conformance / chaos | `packages/external-data/src/certification/market-data/` |

## MD14 integration

- **Owner:** `packages/platform/src/helios/market-data/`
- **Qualification test:** `tests/helios-md14-market-data-qualification.test.ts`
- **Runner:** `npm run helios:md14:qualify`

## AAF integration

Research features must carry `eventTime`, `knowableAt`, provider lineage, sequence integrity, quality state, and entitlement state. Certification is blocked for `DESYNCHRONIZED`, `UNTRUSTED`, and `ENTITLEMENT_BLOCKED` observations (`aaf-integration.ts`).

## Execution Twin

Paper simulator may consume canonical live-shadow fixture streams. Production Execution Authority remains disabled; Execution Twin provider ports block live submit.

## Live shadow mode

`MARKET_DATA_LIVE_SHADOW_ENABLED` permits licensed read-only connectivity, ingestion, book reconstruction, features, research, and paper simulation. It does **not** permit broker orders, venue orders, custody movement, or customer capital deployment.

## Provider production evidence

Live-shadow eligibility requires credentials, contract/license reference, entitlement evidence, data-use policy, conformance, gap recovery, clock validation, chaos test, and **verified external connectivity**. Credentials are never committed. Fixture catalog providers remain `SANDBOX_QUALIFIED` only.

## End-to-end path

Synthetic qualification exercises: raw event → sequence verification → time envelope → normalized event → book reconstruction → redundant-source reconciliation → quality state → durable store → AAF feature → Strategy Lab → HELIOS research agent → paper Execution Twin (`e2e-pipeline.ts`).

## Status semantics

`REGISTERED` → `SANDBOX_QUALIFIED` → `READONLY_LIVE_QUALIFIED` → `PRODUCTION_RESEARCH_QUALIFIED` describes engineering qualification progress, **not** regulatory approval.
