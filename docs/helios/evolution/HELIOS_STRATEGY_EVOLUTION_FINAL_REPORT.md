# HELIOS Strategy Evolution — Final Report (EVOL14)

**Generated (UTC):** 2026-11-06T11:07:59.600Z  
**Git SHA:** `f1c1c5cefa846b8818c20aae068a73d8dbd60280`  
**Qualification marker:** `HELIOS_STRATEGY_SELF_EVOLUTION_V1_QUALIFIED`  
**Qualified:** yes

## Scope

Deterministic simulation of Strategy Genome self-evolution: seeds, population, mutation/crossover, invalid genome rejection, AAF V2 point-in-time dataset seal, inner train/validation, toy CMA-ES update, MAP-Elites-style archive cells, novelty distance, falsification stress, freeze, holdout diagnostics (DSR/PBO), challenger selection, forward shadow, Execution Twin paper track (no broker), champion/challenger comparison, research-only promotion, sealed evidence trail.

## Critical test — overfit rejection

Injected **flashy overfit** genome (`sgnm_evol14_overfit_flashy`): rejected when **any** of holdout degradation, non-positive DSR (multiple-testing adjusted), elevated PBO, fragility under stress, or regime gating applies.

**Rejection reasons observed:** HOLDOUT_DEGRADATION, DSR_NON_POSITIVE, FRAGILITY_UNDER_STRESS, REGIME_GATE:HIGH_VOL_STRESS

## Moderate candidate preference

Robust moderate genome preferred over flashy candidate: **yes**

## Live safety

- `LIVE_TRADING_ENABLED` must be `false` (enforced in qualification).
- Evolved strategies **do not** self-authorize live execution; promotion remains research-only (`liveEligible: false` on promotion capsule path; paper track is simulation).

## Evidence

- Trial ledger entries: 20 (success: 20, failed: 0)
- Sealed evidence hashes: 4
- JSON: `performance/helios/results/helios-evol14/helios-evol14-qualification-f1c1c5cefa84.json`

See also: `docs/helios/evolution/EVOLUTION_CAPABILITY_MATRIX.md`, `EVOLUTION_OVERFITTING_REPORT.md`, `EVOLUTION_LINEAGE_REPORT.md`.
