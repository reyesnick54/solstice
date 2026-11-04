# HELIOS Earnings Intelligence — Final Report (EARN12)

**Workstream:** HEALTH01 — final earnings requalification on current `main`  
**Git SHA:** `fa6d4ab2456371029a4a3d73f77702dddf2f0ab6`  
**Qualification evaluated (UTC):** 2026-11-04T14:17:06.366Z  
**Qualification marker:** `HELIOS_EARNINGS_INTELLIGENCE_V1_QUALIFIED`  
**Schema:** `helios.earnings-intelligence.v1`  
**Reality gate (evidence):** `ARCHITECTURALLY_QUALIFIED` — not upgraded to forecasting or alpha tiers  
**Environment:** simulation only — `LIVE_TRADING_ENABLED` remains false; trading authority unchanged.

## Objective

EARN12 closes the earnings intelligence workstream (EARN01–EARN11) with a mandatory anti-overfitting gate. Architecture implementation does **not** imply alpha proven; reality-gate statuses are explicit and conservative.

## Stack verified on current main

| Work package | Module (registry) | Status |
|-------------|-------------------|--------|
| EARN01 | `earn01-domain.ts` | QUALIFIED |
| EARN02 | `event-graph/service.ts` | QUALIFIED |
| EARN03 | `earn03-surprise-tensor.ts` | QUALIFIED |
| EARN04 | `analyst-expectations/index.ts` | QUALIFIED |
| EARN05 | `transcript/service.ts` | QUALIFIED |
| EARN06 | `earn06-earnings-quality.ts` | QUALIFIED |
| EARN07 | `options/index.ts` | QUALIFIED |
| EARN08 | `event-network/index.ts` | QUALIFIED |
| EARN09 | `state-estimator/index.ts` | QUALIFIED |
| EARN10 | `earn10-agent-committee.ts` | QUALIFIED |
| EARN11 | `earn11-strategy-genome.ts` | QUALIFIED |
| EARN12 | `qualification.ts` | QUALIFIED |

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

## Qualification commands (this run)

| Step | Result |
|------|--------|
| `npm run helios:earn12:qualify` (full, non-fast) | **PASS** — marker `HELIOS_EARNINGS_INTELLIGENCE_V1_QUALIFIED` |
| EARN01–EARN12 test harness (13 suites, 77 tests) | **PASS** (0 failures) |
| Subprocess: AAF V2 + Strategy Lab | **PASS** |
| Subprocess: Execution Twin OS02 | **PASS** |
| `check:production-safety` | **PASS** |

Evidence JSON: `performance/helios/results/helios-earn12/helios-earn12-qualification-fa6d4ab24563.json`

## Holdout chronology (fixture universe)

| Metric | Value |
|--------|------:|
| Training events | 28 |
| Validation events | 10 |
| Holdout events | 10 |
| Walk-forward folds | 5 |
| Embargo violations | 0 |
| Issuer leakage violations | 0 |

## Forecast and investment metrics (HELIOS full stack, holdout)

| Metric | HELIOS_FULL_STACK | NAIVE_SEASONAL (baseline) |
|--------|------------------:|-------------------------:|
| EPS MAE (minor units) | 103 | 0 |
| HELIOS vs naive EPS MAE improvement (bps) | **0** (no improvement vs naive on fixture holdout) | — |
| Beat/miss Brier score | 0.266 | 0.25 |
| Log loss | 0.725 | 0.693 |
| Calibration drift (bps) | 2000 | 2000 |
| Interval coverage (bps) | 0 | 7000 |
| Return predictability significant | **false** | **false** |
| Abnormal return rank correlation | -0.091 | -0.091 |

Holdout event count (10) meets structural chronology checks but **does not** meet forecasting promotion thresholds on EPS/revenue MAE, Brier, and interval coverage for `FORECASTING_QUALIFIED`.

## Anti-overfitting and alpha promotion

| Diagnostic | Value |
|------------|-------|
| Trial count (append-only registry) | 2 |
| Deflated Sharpe Ratio (DSR) | **n/a** — `sampleSizePermitsDiagnostics: false` |
| Probability of backtest overfitting (PBO) | **n/a** — insufficient trial/sample depth |
| Multiple-testing adjusted | false |
| Insignificant alpha not promoted | **true** |

## Reality gate (explicit)

Statuses are derived from holdout forecast metrics, chronology integrity, and anti-overfitting diagnostics — not from module presence alone.

- **ARCHITECTURALLY_QUALIFIED** — **current evidence status** — modules and pipeline wired; chronology clean; alpha not promoted.
- **FORECASTING_QUALIFIED** — **not claimed** — holdout forecast thresholds not met on simulation fixture.
- **PAPER_ALPHA_CANDIDATE** — **not claimed** — no multiple-testing-adjusted paper candidate.
- **FORWARD_ALPHA_SUPPORTED** / **LIVE_ALPHA_SUPPORTED** — **not claimed** in this repository qualification path.

Reality gate notes:

- Holdout forecast metrics below qualification thresholds or insufficient holdout events
- Return predictability treated as not statistically significant (simulation fixture)

## Anti-overfitting design

- Append-only **TrialId** registry (successes and failures retained).
- Deflated Sharpe Ratio and PBO/CSCV diagnostics when sample size permits.
- Strict train / validation / holdout, walk-forward folds, event embargo, issuer-aware leakage checks.

## Canonical owner

`packages/platform/src/helios/earnings-intelligence/`

Run qualification: `npm run helios:earn12:qualify` (full) or `npm run helios:earn12:qualify:fast` (subprocess skipped).
