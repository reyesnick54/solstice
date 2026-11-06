# EVOL14 / EVOL15 — Overfitting Stress Report

**Git SHA:** `0b198fbe7f9a68c7d727523f619ba6297c4992e1`

## Injected flashy strategy

- **Genome ID:** `sgnm_evol14_overfit_flashy`
- **Design:** Extreme `entryZScore` / tight `volatilityThresholdBps` plus a restrictive **REGIME_GATE** (permits `LOW_VOL_TREND`, conflicts with stressed `HIGH_VOL_STRESS` regime in gating).

## Rejection channels (at least one must fire)

The qualification simulation asserts **`overfitCandidateRejected === true`** when any of the following holds:

| Gate | Mechanism |
|------|-----------|
| Holdout degradation | Synthetic holdout return path is materially negative vs training narrative (`buildAntiOverfittingDiagnostics`). |
| DSR | Deflated Sharpe from inner trial statistics ≤ 0 (multiple-testing adjusted path). |
| PBO | Simplified CSCV-style probability of backtest overfitting ≥ threshold in simulation. |
| Fragility | EVOL08 `StrategyFalsificationAgent` reports structural fragility or stress falsification. |
| Regime generalization | EVOL10 matrix places strongly negative return under `high_volatility` for the overfit genome; OS05 `evaluateStrategyRegimeGating` blocks prohibited `HIGH_VOL_STRESS`. |

**Observed reasons** (example from current run): `HOLDOUT_DEGRADATION`, `DSR_NON_POSITIVE`, `FRAGILITY_UNDER_STRESS`, `REGIME_GENERALIZATION:HIGH_VOL_STRESS`, `REGIME_GATE:HIGH_VOL_STRESS`.

## Trial ledger honesty

When the flashy genome is **rejected**, the multiple-testing firewall phase records outcome **`BLOCKED`** (not `SUCCESS`). The qualification JSON reports separate **`trialSuccessCount`**, **`trialFailureCount`**, and **`trialBlockedCount`** so blocked/rejected evaluations are not folded into “all green” success tallies.

## Injected robust strategy

- **Genome ID:** `sgnm_evol14_moderate_robust`
- **Expected:** Higher robustness score than the flashy genome; **`moderateCandidatePreferred`** true in simulation.

## Artifacts

- JSON: `performance/helios/results/helios-evol14/helios-evol14-qualification-<sha-prefix>.json`
- Final narrative: `docs/helios/evolution/HELIOS_STRATEGY_EVOLUTION_FINAL_REPORT.md`
