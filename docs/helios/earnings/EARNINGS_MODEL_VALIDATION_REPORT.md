# Earnings Model Validation Report

**Generated (UTC):** 2026-11-04T14:17:06.366Z  
**Git SHA:** `fa6d4ab2456371029a4a3d73f77702dddf2f0ab6`  
**Reality gate:** `ARCHITECTURALLY_QUALIFIED`  
**Marker:** `HELIOS_EARNINGS_INTELLIGENCE_V1_QUALIFIED`  
**Evidence JSON:** `performance/helios/results/helios-earn12/helios-earn12-qualification-fa6d4ab24563.json`

## Holdout chronology

- Train events: 28
- Validation events: 10
- Holdout events: 10
- Walk-forward folds: 5
- Embargo violations: 0
- Issuer leakage violations: 0

## HELIOS vs naive seasonal (EPS MAE improvement bps)

0

## HELIOS full stack — holdout forecast metrics

- EPS MAE (minor units): 103
- Revenue MAE (minor units): 1042469
- Directional accuracy (bps): 10000
- Beat/miss Brier score: 0.26593225
- Log loss: 0.7250708408567742
- Calibration drift (bps): 2000
- Interval coverage (bps): 0

## Baseline comparison (holdout Brier)

| Strategy | Brier |
|----------|------:|
| NAIVE_SEASONAL_EARNINGS | 0.25 |
| ROBUST_CONSENSUS | 0.2541 |
| LAST_QUARTER | 0.2461 |
| CONSENSUS_ONLY | 0.25 |
| FUNDAMENTALS_ONLY | 0.2502 |
| TRANSCRIPT_ONLY | 0.2556 |
| OPTIONS_ONLY | 0.2515 |
| FULL_ENSEMBLE | 0.2520 |
| HELIOS_FULL_STACK | 0.2659 |

HELIOS full-stack Brier is **not** better than naive seasonal on this fixture holdout.

## Alpha significance (investment research metrics, holdout)

- Abnormal return rank correlation: -0.091
- Return predictability significant: **false**
- Alpha significance: **not supported** (simulation fixture; `MINIMUM_SAMPLE_FOR_RETURN_SIGNIFICANCE` not met for promotion)

## Anti-overfitting

- Trial count: 2
- Deflated Sharpe (DSR): n/a (sample) — `sampleSizePermitsDiagnostics: false`
- PBO: n/a (sample)
- Multiple-testing adjusted: false
- Insignificant alpha not promoted: true

## Reality gate notes

- Holdout forecast metrics below qualification thresholds or insufficient holdout events
- Return predictability treated as not statistically significant (simulation fixture)

## Promotion verdict

| Tier | Claimed |
|------|---------|
| ARCHITECTURALLY_QUALIFIED | **Yes** |
| FORECASTING_QUALIFIED | **No** |
| PAPER_ALPHA_CANDIDATE | **No** |
| FORWARD_ALPHA_SUPPORTED | **No** |
| LIVE_ALPHA_SUPPORTED | **No** |
