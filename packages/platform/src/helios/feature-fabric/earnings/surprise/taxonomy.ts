/**
 * HELIOS EARN03 — earnings surprise tensor taxonomy.
 */

export const HELIOS_EARN03_SURPRISE_TENSOR_SCHEMA = 'sunrey.helios.earn03.surprise-tensor.v1' as const;

export const EARNINGS_SURPRISE_DIMENSIONS = [
  'EPS',
  'REVENUE',
  'GROSS_MARGIN',
  'OPERATING_MARGIN',
  'EBITDA',
  'OPERATING_INCOME',
  'FCF',
  'CAPEX',
  'BOOKINGS',
  'BACKLOG',
  'UNIT_VOLUME',
  'SEGMENT_REVENUE',
  'SEGMENT_MARGIN',
  'GUIDANCE',
] as const;

export type EarningsSurpriseDimension = (typeof EARNINGS_SURPRISE_DIMENSIONS)[number];

export const EARNINGS_EXPECTATION_SOURCES = [
  'STREET_CONSENSUS',
  'ROBUST_STREET_CONSENSUS',
  'COMPANY_GUIDANCE',
  'HELIOS_INTERNAL_FORECAST',
  'SEASONAL_HISTORICAL_MODEL',
  'PRICE_IMPLIED_EXPECTATION',
] as const;

export type EarningsExpectationSource = (typeof EARNINGS_EXPECTATION_SOURCES)[number];

export const EARNINGS_SURPRISE_METHODS = [
  'CONSENSUS_DISPERSION_SUE',
  'PRICE_SCALED_SURPRISE',
  'HISTORICAL_SEASONAL_SUE',
  'ROBUST_MEDIAN_SUE',
  'REVENUE_MARGIN_STANDARDIZED',
  'GUIDANCE_MIDPOINT_VS_PRIOR',
  'GUIDANCE_MIDPOINT_VS_CONSENSUS',
] as const;

export type EarningsSurpriseMethod = (typeof EARNINGS_SURPRISE_METHODS)[number];

export const BEAT_QUALITY_DRIVERS = [
  'OPERATING',
  'REVENUE',
  'MARGIN',
  'TAX',
  'SHARE_COUNT',
  'NON_OPERATING',
  'ONE_TIME',
  'NON_GAAP_ADJUSTMENT',
  'WORKING_CAPITAL',
  'UNKNOWN',
] as const;

export type BeatQualityDriver = (typeof BEAT_QUALITY_DRIVERS)[number];

export const PEER_NORMALIZATION_SCOPES = [
  'INDUSTRY_RELATIVE',
  'SECTOR_RELATIVE',
  'MARKET_CAP_BUCKET',
] as const;

export type PeerNormalizationScope = (typeof PEER_NORMALIZATION_SCOPES)[number];

export const EARN03_FORMULA_VERSION = '1.0.0' as const;

export const DIMENSION_VALUE_KIND: Readonly<
  Record<EarningsSurpriseDimension, 'currency_minor' | 'ratio_scaled' | 'count_units' | 'guidance_midpoint'>
> = Object.freeze({
  EPS: 'currency_minor',
  REVENUE: 'currency_minor',
  GROSS_MARGIN: 'ratio_scaled',
  OPERATING_MARGIN: 'ratio_scaled',
  EBITDA: 'currency_minor',
  OPERATING_INCOME: 'currency_minor',
  FCF: 'currency_minor',
  CAPEX: 'currency_minor',
  BOOKINGS: 'currency_minor',
  BACKLOG: 'currency_minor',
  UNIT_VOLUME: 'count_units',
  SEGMENT_REVENUE: 'currency_minor',
  SEGMENT_MARGIN: 'ratio_scaled',
  GUIDANCE: 'guidance_midpoint',
});

export function isMarginOrRatioDimension(dimension: EarningsSurpriseDimension): boolean {
  const kind = DIMENSION_VALUE_KIND[dimension];
  return kind === 'ratio_scaled';
}

export function methodsForDimension(dimension: EarningsSurpriseDimension): readonly EarningsSurpriseMethod[] {
  if (dimension === 'GUIDANCE') {
    return Object.freeze(['GUIDANCE_MIDPOINT_VS_PRIOR', 'GUIDANCE_MIDPOINT_VS_CONSENSUS']);
  }
  if (isMarginOrRatioDimension(dimension)) {
    return Object.freeze([
      'CONSENSUS_DISPERSION_SUE',
      'PRICE_SCALED_SURPRISE',
      'ROBUST_MEDIAN_SUE',
      'REVENUE_MARGIN_STANDARDIZED',
    ]);
  }
  return Object.freeze([
    'CONSENSUS_DISPERSION_SUE',
    'PRICE_SCALED_SURPRISE',
    'HISTORICAL_SEASONAL_SUE',
    'ROBUST_MEDIAN_SUE',
    'REVENUE_MARGIN_STANDARDIZED',
  ]);
}
