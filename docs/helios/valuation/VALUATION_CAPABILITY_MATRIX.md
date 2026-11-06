# Valuation Capability Matrix

**Stack marker:** `HELIOS_VALUATION_INTELLIGENCE_V1_QUALIFIED`

| Package | Status | Test |
|---------|--------|------|
| VAL01 | IMPLEMENTED | `tests/helios-val01-valuation-intelligence-domain.test.ts` |
| VAL02 | IMPLEMENTED | `tests/helios-val02-driver-forecast.test.ts` |
| VAL03 | IMPLEMENTED | `tests/helios-val03-cost-of-capital.test.ts` |
| VAL04 | IMPLEMENTED | `tests/helios-val04-probabilistic-dcf.test.ts` |
| VAL05 | IMPLEMENTED | `tests/helios-val05-reverse-dcf.test.ts` |
| VAL06 | IMPLEMENTED | `tests/helios-val06-agentic-valuation-committee.test.ts` |
| VAL07 | IMPLEMENTED | `tests/helios-val07-residual-income.test.ts` |
| VAL08 | IMPLEMENTED | `tests/helios-val08-probabilistic-comparables.test.ts` |
| VAL09 | IMPLEMENTED | `tests/helios-val09-sotp.test.ts` |
| VAL10 | IMPLEMENTED | `tests/helios-val10-uncertainty.test.ts` |
| VAL11 | IMPLEMENTED | `tests/helios-val11-adaptive-ensemble.test.ts` |
| VAL12 | IMPLEMENTED | `tests/helios-val12-valuation-intelligence-qualification.test.ts` |

## Strategy Genome features (AAF-gated)

- `intrinsic_value_gap`
- `reverse_dcf_growth_gap`
- `reverse_dcf_margin_gap`
- `valuation_uncertainty`
- `valuation_fragility`
- `cross_model_dispersion`
- `residual_income_gap`
- `peer_relative_gap`

## Research monitors

Monitors route to **Agent Research** only (never execution): valuation gap widening, reverse-DCF divergence, dispersion shifts, earnings-driven intrinsic moves, WACC shocks, peer regime repricing, SOTP segment shifts.
