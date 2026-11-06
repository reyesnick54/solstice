import type { UtcInstant } from '@solstice/domain';

import type { EnsembleCompanyCharacteristics } from './applicability.ts';
import type { HistoricalModelResearchRecord } from './reliability.ts';
import type { EnsembleValueQuantile, IntrinsicModelCandidate, MarketReferencedModelCandidate } from './types.ts';

export const VAL11_FIXTURE_ENTITY_ID = 'helios-val11-demo-issuer' as const;
export const VAL11_FIXTURE_AS_OF = '2024-06-30T20:00:00.000Z' as UtcInstant;
export const VAL11_FIXTURE_CURRENCY = 'USD' as const;

function q(perShareMinor: bigint, evMinor: bigint): readonly EnsembleValueQuantile[] {
  return Object.freeze([
    Object.freeze({ quantile: 'p10', equityValuePerShareMinor: perShareMinor - 500n, enterpriseValueMinor: evMinor - 5_000n }),
    Object.freeze({ quantile: 'p50', equityValuePerShareMinor: perShareMinor, enterpriseValueMinor: evMinor }),
    Object.freeze({ quantile: 'p90', equityValuePerShareMinor: perShareMinor + 700n, enterpriseValueMinor: evMinor + 6_000n }),
  ]);
}

export function val11DemoCompanyProfile(): EnsembleCompanyCharacteristics {
  return Object.freeze({
    canonicalEntityId: VAL11_FIXTURE_ENTITY_ID,
    sector: 'Financials',
    reportingSegments: 3,
    paysRegularDividend: true,
    hasPositiveOperatingCashFlow: true,
    hasMeaningfulBookEquity: true,
    hasMarketPrice: true,
    hasPeerUniverse: true,
    isPreRevenue: false,
    hasLeverageInputs: true,
    characteristicTags: Object.freeze(['BANK', 'MATURE_DIVIDEND_PAYER', 'CONGLOMERATE'] as const),
    isLossMaking: false,
    isHighGrowth: false,
    assetIntensityScore: 0.42,
    forecastEvidenceQuality: 0.72,
  });
}

export function val11DemoIntrinsicCandidates(): readonly IntrinsicModelCandidate[] {
  return Object.freeze([
    Object.freeze({
      candidateId: 'intrinsic-dcf-fcff',
      lane: 'INTRINSIC',
      method: 'DCF_FCFF',
      applicable: true,
      applicabilityScore: 0.45,
      uncertaintyScore: 0.35,
      equityValuePerShareMinor: 4_200n,
      enterpriseValueMinor: 42_000n,
      quantiles: q(4_200n, 42_000n),
      inputKeysUsed: Object.freeze(['fcf_forecast', 'wacc', 'terminal_growth']),
      grantsExecutionAuthority: false,
      researchOnly: true,
      notAFact: true,
    }),
    Object.freeze({
      candidateId: 'intrinsic-residual-income',
      lane: 'INTRINSIC',
      method: 'RESIDUAL_INCOME',
      applicable: true,
      applicabilityScore: 0.82,
      uncertaintyScore: 0.22,
      equityValuePerShareMinor: 4_450n,
      enterpriseValueMinor: 44_500n,
      quantiles: q(4_450n, 44_500n),
      inputKeysUsed: Object.freeze(['book_equity', 'cost_of_equity', 'residual_earnings']),
      grantsExecutionAuthority: false,
      researchOnly: true,
      notAFact: true,
    }),
    Object.freeze({
      candidateId: 'intrinsic-sotp',
      lane: 'INTRINSIC',
      method: 'SUM_OF_PARTS',
      applicable: true,
      applicabilityScore: 0.78,
      uncertaintyScore: 0.28,
      equityValuePerShareMinor: 4_600n,
      enterpriseValueMinor: 46_000n,
      quantiles: q(4_600n, 46_000n),
      inputKeysUsed: Object.freeze(['segment_ebitda', 'holdco_discount']),
      grantsExecutionAuthority: false,
      researchOnly: true,
      notAFact: true,
    }),
  ]);
}

export function val11DemoMarketReferencedCandidates(): readonly MarketReferencedModelCandidate[] {
  return Object.freeze([
    Object.freeze({
      candidateId: 'market-comps',
      lane: 'MARKET_REFERENCED',
      method: 'COMPARABLE_MULTIPLES',
      applicable: true,
      applicabilityScore: 0.7,
      uncertaintyScore: 0.3,
      equityValuePerShareMinor: 4_050n,
      enterpriseValueMinor: 40_500n,
      quantiles: q(4_050n, 40_500n),
      inputKeysUsed: Object.freeze(['peer_multiples', 'marketPriceMinor']),
      grantsExecutionAuthority: false,
      researchOnly: true,
      notAFact: true,
    }),
    Object.freeze({
      candidateId: 'market-reverse-dcf',
      lane: 'MARKET_REFERENCED',
      method: 'REVERSE_DCF',
      applicable: true,
      applicabilityScore: 0.66,
      uncertaintyScore: 0.32,
      equityValuePerShareMinor: 3_980n,
      enterpriseValueMinor: 39_800n,
      quantiles: q(3_980n, 39_800n),
      inputKeysUsed: Object.freeze(['marketPriceMinor', 'implied_growth']),
      grantsExecutionAuthority: false,
      researchOnly: true,
      notAFact: true,
    }),
  ]);
}

export function val11DemoHistoricalReliability(): readonly HistoricalModelResearchRecord[] {
  const asOf = VAL11_FIXTURE_AS_OF;
  return Object.freeze([
    Object.freeze({
      method: 'RESIDUAL_INCOME',
      lane: 'INTRINSIC',
      inputForecastAccuracy: 0.71,
      cashFlowForecastAccuracy: 0.68,
      marginForecastAccuracy: 0.74,
      modelStability: 0.8,
      terminalDependence: 0.25,
      dataQuality: 0.77,
      assumptionPlausibility: 0.79,
      sampleCount: 12,
      asOf,
    }),
    Object.freeze({
      method: 'DCF_FCFF',
      lane: 'INTRINSIC',
      inputForecastAccuracy: 0.62,
      cashFlowForecastAccuracy: 0.58,
      marginForecastAccuracy: 0.6,
      modelStability: 0.55,
      terminalDependence: 0.62,
      dataQuality: 0.7,
      assumptionPlausibility: 0.64,
      sampleCount: 11,
      asOf,
    }),
    Object.freeze({
      method: 'COMPARABLE_MULTIPLES',
      lane: 'MARKET_REFERENCED',
      inputForecastAccuracy: 0.66,
      cashFlowForecastAccuracy: null,
      marginForecastAccuracy: 0.63,
      modelStability: 0.58,
      terminalDependence: null,
      dataQuality: 0.72,
      assumptionPlausibility: 0.67,
      sampleCount: 14,
      asOf,
    }),
  ]);
}
