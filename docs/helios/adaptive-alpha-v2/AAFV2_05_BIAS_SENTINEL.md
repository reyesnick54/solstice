# AAFV2.5 — Statistical Coverage and Research Bias Sentinel

Deterministic sentinel comparing **INTENDED_ELIGIBLE_UNIVERSE** versus **OBSERVED_USABLE_UNIVERSE** for Strategy Genome research datasets. Protects HELIOS from false alpha caused by data-selection artifacts.

## Owner

`packages/platform/src/helios/feature-fabric/bias-sentinel/`

## Comparisons

Across market capitalization, liquidity, volatility, sector, industry, geography, jurisdiction, venue, asset age, listing age, provider, asset class, lawful point-in-time historical return, and feature coverage.

## Detected bias dimensions (minimum)

- `COVERAGE_BIAS`, `SURVIVORSHIP_BIAS`, `LARGE_CAP_BIAS`, `SMALL_CAP_BIAS`
- `SECTOR_BIAS`, `INDUSTRY_BIAS`, `GEOGRAPHIC_BIAS`, `VENUE_BIAS`, `PROVIDER_BIAS`
- `LIQUIDITY_BIAS`, `HISTORY_LENGTH_BIAS`, `DELISTING_BIAS`, `CORPORATE_ACTION_BIAS`

## Severity

| Severity | Default promotion gate |
|----------|------------------------|
| `PASS` | `CONTINUE` |
| `WARNING` | `REVIEW_REQUIRED` |
| `SEVERE` | `BLOCK_PROMOTION` |
| `INSUFFICIENT_DATA` | `REVIEW_REQUIRED` (policy-configurable) |

Diagnostics are deterministic (coverage deltas, SMD, TVD, bucket comparisons, missingness correlations, train/holdout drift). **No LLM pass/fail.** Correlation evidence is labeled `correlationIsNotCausation: true`.

Optional strata missingness diagnostic: conditional missing rates by sector|geography|provider|cap bucket — descriptive only, not automatic IPW correction.

## Integration

| Component | Bridge |
|-----------|--------|
| AAFV2.3 / AAF04 dataset compiler | `biasSentinelProfilesFromCompilerManifest` |
| AAFV2.4 coverage tensor | `biasSentinelInputFromCoverageTensor` |
| Strategy Lab | `packages/strategy-lab/src/evaluation/bias-sentinel-promotion-gate.ts` |
| Strategy Genome | `attachBiasAssessmentToStrategyGenome` |
| Evidence Vault | `sealBiasSentinelAssessmentEvidence` |

## Qualification

Marker: `HELIOS_AAFV2_05_BIAS_SENTINEL_QUALIFIED`

- Tests: `tests/helios-aafv2-05-bias-sentinel.test.ts`
- Gate script: `scripts/helios-aafv2-05-qualify.ts`

Does not grant Execution Authority or change simulation / `LIVE_*` posture.
