# Valuation Model Validation Report

**Marker:** `HELIOS_VALUATION_INTELLIGENCE_V1_QUALIFIED`  
**Schema:** `helios.valuation-intelligence.v1`

## Methodology

Validation combines:

1. **Synthetic known-answer fixtures** (VAL04 DCF, VAL07 RIV, VAL08 comps, VAL09 SOTP).  
2. **Point-in-time historical discipline** — inputs filtered by `knowableAt`; no modern leakage in backtest paths.  
3. **Benchmark comparisons** against simple DCF, median multiple, P/E, book value, and single-stage RIV.

## Metrics (not stock-return alpha)

- Forecast-input error (bps vs simple baselines)  
- Valuation stability score  
- Cross-model dispersion  
- Future realized **fundamental** accuracy (simulation fixtures)

Successful qualification **does not** require positive future stock returns.

## Reality gate

Pipeline resolves to `RESEARCH_ONLY` — valuation quality qualified for research and Strategy Genome features, not live trading or automatic strategy promotion.

Regenerate detailed numbers: `npm run helios:val12:qualify`
