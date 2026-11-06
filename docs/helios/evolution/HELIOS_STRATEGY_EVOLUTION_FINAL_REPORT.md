# HELIOS Strategy Evolution — Final Report (EVOL14)

**Generated (UTC):** 2026-11-06T15:48:18.098Z  
**Git SHA:** `db28710fc2077230101b5ab14c1fe8e6009abfbe`  
**Qualification marker:** `HELIOS_STRATEGY_SELF_EVOLUTION_V1_QUALIFIED`  
**Qualified:** yes

## Scope

End-to-end **research simulation** wired to canonical HELIOS modules on this SHA: **EVOL02** (`mutateStrategyGenome`, `crossoverStrategyGenomes`), **EVOL03** (`EvolutionArchive` inner-trial ledger), **EVOL04** (`attemptInsertElite` MAP-Elites archive), **EVOL05** (`runCmaEsGeneration`), **EVOL06** (`runPopulationSchedulerTick`), **EVOL07** (`computeStrategyNoveltyScore`), **EVOL08** (`StrategyFalsificationAgent`), **EVOL09** (sealed holdout vault + DSR/PBO firewall trial), **EVOL10** (`evaluateEvol10GenomeRegimeReport`), **EVOL11** (material champion comparison evidence), **EVOL12** (`buildEvol12SampleGenomeProposal`), **EVOL13** (`buildOperatorCreditState`). Plus AAF V2 PIT seal, forward shadow, Execution Twin paper track (simulation), and sealed evidence trail. **No** live broker or production authority.

## Critical test — overfit rejection

Injected **flashy overfit** genome (`sgnm_evol14_overfit_flashy`): rejected when **any** of holdout degradation, non-positive DSR (multiple-testing adjusted), elevated PBO, fragility under stress, or regime gating applies.

**Rejection reasons observed:** HOLDOUT_DEGRADATION, DSR_NON_POSITIVE, FRAGILITY_UNDER_STRESS, REGIME_GENERALIZATION:HIGH_VOL_STRESS, REGIME_GATE:HIGH_VOL_STRESS

## Moderate candidate preference

Robust moderate genome preferred over flashy candidate: **yes**

## Live safety

- `LIVE_TRADING_ENABLED` must be `false` (enforced in qualification).
- Evolved strategies **do not** self-authorize live execution; promotion remains research-only (`liveEligible: false` on promotion capsule path; paper track is simulation).

## Evidence

- Trial ledger entries: 24 (success: 22, failed: 1, blocked: 1)
- Sealed evidence hashes: 4
- JSON: `performance/helios/results/helios-evol14/helios-evol14-qualification-db28710fc207.json`

See also: `docs/helios/evolution/EVOLUTION_CAPABILITY_MATRIX.md`, `EVOLUTION_OVERFITTING_REPORT.md`, `EVOLUTION_LINEAGE_REPORT.md`.
