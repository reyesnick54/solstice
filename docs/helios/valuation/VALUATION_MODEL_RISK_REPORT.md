# Valuation Model Risk Report

**Marker:** `HELIOS_VALUATION_INTELLIGENCE_V1_QUALIFIED`

## Model risk controls

| Risk | Mitigation |
|------|------------|
| Valuation mistaken for trade signal | `grantsExecutionAuthority: false` on all VAL outputs; gap and margin-of-safety labeled model-implied, not objective mispricing |
| Data leakage in backtests | `knowableAt` filtering and chronology checks in VAL12 pipeline |
| Overfitting to returns | Benchmarks emphasize fundamental forecast error; `investmentAlphaClaimed: false` in validation report |
| Committee mutating facts | VAL06 frozen evidence pack + immutable canonical financial facts |
| Auto-promotion from valuation | `autoPromoteStrategyCandidates: false` on `HeliosValuationState` |
| Production activation | `LIVE_TRADING_ENABLED=false`; simulation-only qualification |

## Agent committee (VAL06)

Required agents include BullValuationAgent, BearValuationAgent, ReverseDCFChallengeAgent, ModelRiskAgent, SOTPAgent, ResidualIncomeAgent, ComparableValuationAgent, and SynthesisAgent. VAL07–VAL11 evidence is attached via `extendedModelEvidence` on committee requests.

## Fragility & uncertainty (VAL10)

`valuationUncertainty` and `fragility` surface WACC sensitivity and cross-model dispersion for research prioritization — not position sizing authority.
