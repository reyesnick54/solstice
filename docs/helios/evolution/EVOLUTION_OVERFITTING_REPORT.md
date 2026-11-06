# EVOL14 — Overfitting Stress Report

## Injected flashy strategy

- **Genome ID:** `sgnm_evol14_overfit_flashy`
- **Design:** Extreme `entryZScore` / tight `volatilityThresholdBps` plus a restrictive **REGIME_GATE** (permits `LOW_VOL_TREND`, conflicts with stressed `HIGH_VOL_STRESS` regime).

## Rejection channels (at least one must fire)

The qualification simulation asserts **`overfitCandidateRejected === true`** when any of the following holds:

| Gate | Mechanism |
|------|-----------|
| Holdout degradation | Synthetic holdout return path is materially negative vs training narrative. |
| DSR | Deflated Sharpe from `buildAntiOverfittingDiagnostics` ≤ 0 (multiple-testing adjusted flag false). |
| PBO | Simplified CSCV-style probability of backtest overfitting ≥ threshold in simulation. |
| Fragility | Falsification stress shows large fitness delta or extreme entry threshold. |
| Regime generalization | `evaluateStrategyRegimeGating` blocks when prohibited regime is active. |

**Observed reasons** are listed in simulation output under `overfitRejectionReasons` (e.g. `HOLDOUT_DEGRADATION`, `DSR_NON_POSITIVE`, `PBO_ELEVATED`, `FRAGILITY_UNDER_STRESS`, `REGIME_GATE:HIGH_VOL_STRESS`).

## Injected robust strategy

- **Genome ID:** `sgnm_evol14_moderate_robust`
- **Expected:** Higher robustness score than the flashy genome; **`moderateCandidatePreferred`** true in simulation.

## Artifacts

- JSON: `performance/helios/results/helios-evol14/helios-evol14-qualification-<sha>.json`
- Final narrative: `docs/helios/evolution/HELIOS_STRATEGY_EVOLUTION_FINAL_REPORT.md`
