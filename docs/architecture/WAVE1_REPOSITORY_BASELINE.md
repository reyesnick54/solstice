# Wave 1 Repository Baseline

**Status:** Established baseline for monetary authority audit (Wave 1)  
**Date:** 2026-09-02  
**Branch context:** `main` at Wave 1 audit start

## Purpose

This document records the repository state against which Wave 1 monetary authority work is validated. Wave 1 does **not** implement consensus, validators, blocks, Economic Awareness Fabric, oracle mesh, or economic graphs. It establishes and proves who and what may change monetary state.

## Core principle (non-negotiable)

> Economic systems may establish facts.  
> Only the canonical protocol monetary authority may establish monetary truth.

Preserved separations:

| Layer | May establish |
|-------|----------------|
| Economic fact | Observations, contributions, verified evidence |
| Valuation | Methodology outputs (PEVE, GPUV, HIN valuation) |
| Monetary policy | Issuance classes, ceilings, governance decisions |
| Coin quantity | `AssetSupplyBook` mutations via `authorizeIssuance` / `burn` |
| Exchange price | Last trade on Exchange; not protocol valuation |

`SUNREY_COIN` and `MOONREY_COIN` are protocol-native assets originating from different economic evidence domains.

## Canonical authority locations (frozen)

| Component | Owner package | Canonical path |
|-----------|---------------|----------------|
| Native supply book | `packages/sunrey-chain` | `src/economics/supply.ts` (`AssetSupplyBook`) |
| Mint gate | `packages/sunrey-chain` | `src/economics/issuance.ts` (`authorizeIssuance`) |
| Productized authority | `packages/sunrey-chain` | `src/native-assets/economic-controls.ts` (`ProtocolNativeSupplyAuthority`) |
| Issuance pipelines | `packages/sunrey-chain` | `src/native-assets/issuance-pipelines.ts` |
| Human contribution bridge | `packages/sunrey-chain` | `src/economics/human-contribution-bridge/gate.ts` |
| MoonRey settlement bridge | `packages/sunrey-chain` | `src/productive/policy-governance/value-settlement/bridge.ts` |
| Production activation firewall | `packages/sunrey-chain` | `src/economics/production-activation/` |
| Fiat ledger | `packages/ledger` | Kernel-gated `Ledger.postJournal` only |
| Customer accounts | `services/accounts` | Kernel-gated; no native supply |

Productization freeze references: `docs/productization/SUNREY_PRODUCTION_ARCHITECTURE_FREEZE.md`, `docs/productization/sunrey-authority-map.json`.

## Environment posture (must not change in Wave 1)

- `ENVIRONMENT` = `simulation`
- All `LIVE_*` flags = `false`
- `PRODUCTION_PARAMETER_UNCONFIGURED` remains the production issuance state
- `productionIssuanceActivated` = `false` on both native assets
- Mainnet economics = `ECONOMIC_PARAMETER_NOT_AUTHORIZED`

## Known parallel (non-canonical) supply surfaces

These exist for simulation, rehearsal, or application layers and **must not** be confused with `AssetSupplyBook`:

| Surface | Location | Risk if conflated |
|---------|----------|-------------------|
| Exchange `InMemoryCoinPort.seed()` | `packages/sunrey-exchange/src/adapters.ts` | Exchange-local circulating counter |
| Exchange `InMemoryNativeChain.issue()` | `packages/sunrey-exchange/src/native-clearing/chain.ts` | Test faucet on in-memory chain |
| `SunReyCoinService` ledger issuance | `packages/sunrey-coin/` | Kernel-gated fiat-ledger SunRey only |
| Productive shadow `NativeAssetSupplyState` | `packages/sunrey-chain/src/productive/supply.ts` | MoonRey metrics mirror |
| `FeeEngine.faucet` | `packages/sunrey-chain/src/fees/engine.ts` | Fee-account credits |
| `TestnetFaucet` | `packages/sunrey-chain/src/testnet/faucet.ts` | Pre-allocated testnet pool |
| Rehearsal direct book mutation | `packages/sunrey-chain/src/production-handoff/full-platform-candidate/runtime.ts` | Bypasses `authorizeIssuance` in fixtures |

## Validation baseline (Wave 1 start)

Commands run at baseline establishment:

```bash
npm ci
npm run integrity:check   # PASS
npm test economics        # 85 tests PASS
```

Targeted authority tests (all PASS at baseline):

- `packages/sunrey-chain/src/native-assets/productization.test.ts`
- `packages/sunrey-chain/src/economics.test.ts`
- `services/api/src/consumer-economy.test.ts`
- `packages/custody/src/dual-asset.test.ts`
- `packages/persistence/src/production/recovery/recovery.test.ts`

## Wave 1 deliverables

1. Full supply authority trace (see `WAVE1_AUTHORITY_AUDIT.md`)
2. Forbidden-actor verification matrix
3. SunRey and MoonRey issuance invariant audit
4. Supply invariant inventory and test mapping
5. Formal authority matrix
6. `SUNREY_MONETARY_AUTHORITY_CONTRACT.md` (permanent specification)
7. No regression in existing CI checks from documentation-only changes

## Out of scope (Wave 2+)

- Consensus, validators, blocks
- Economic Awareness Fabric
- Oracle mesh production wiring
- Personal Economic Graph as monetary authority
- Production mainnet activation
- New mint pathways
