# HELIOS Earnings Intelligence — Final Report (EARN12)

**Qualification marker:** `HELIOS_EARNINGS_INTELLIGENCE_V1_QUALIFIED`  
**Schema:** `helios.earnings-intelligence.v1`  
**Environment:** simulation only — live trading remains disabled.

## Objective

EARN12 closes the earnings intelligence workstream (EARN01–EARN11) with a mandatory anti-overfitting gate. Architecture implementation does **not** imply alpha proven; reality-gate statuses are explicit and conservative.

## Stack verified

| Work package | Capability |
|-------------|------------|
| EARN01 | Domain normalization and issuer calendar |
| EARN02 | Event graph (calendar → filing layers) |
| EARN03 | Surprise tensor (EPS / revenue) |
| EARN04 | Analyst expectations and revisions |
| EARN05 | Transcript intelligence (PIT tone) |
| EARN06 | Earnings quality scoring |
| EARN07 | Options-implied move state |
| EARN08 | Peer read-through / attention / PEAD bias |
| EARN09 | Probabilistic estimator |
| EARN10 | Agent committee aggregation |
| EARN11 | Strategy Genome materialization |
| EARN12 | Benchmarks, chronology, trial registry, reality gate |

## Reality gate (explicit)

Statuses are derived from holdout forecast metrics, chronology integrity, and anti-overfitting diagnostics — not from module presence alone.

- **ARCHITECTURALLY_QUALIFIED** — modules and pipeline wired.
- **FORECASTING_QUALIFIED** — holdout forecast thresholds met.
- **PAPER_ALPHA_CANDIDATE** — multiple-testing-adjusted research candidate only (simulation).
- **FORWARD_ALPHA_SUPPORTED** / **LIVE_ALPHA_SUPPORTED** — not claimed in this repository qualification path.

## Anti-overfitting

- Append-only **TrialId** registry (successes and failures retained).
- Deflated Sharpe Ratio and PBO/CSCV diagnostics when sample size permits.
- Strict train / validation / holdout, walk-forward folds, event embargo, issuer-aware leakage checks.

## Canonical owner

`packages/platform/src/helios/earnings-intelligence/`

Run qualification: `npm run helios:earn12:qualify`
