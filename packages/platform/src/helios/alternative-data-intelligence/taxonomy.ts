/**
 * ALT01 — canonical alternative-data intelligence taxonomy (HELIOS).
 */

export const HELIOS_ALT01_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA =
  'sunrey.helios.alt01.alternative-data-intelligence.v1' as const;

export const ALTERNATIVE_DATA_SIGNAL_FAMILIES = [
  'WORKFORCE',
  'DIGITAL_DEMAND',
  'SEARCH_ATTENTION',
  'WEB_ACTIVITY',
  'APP_ACTIVITY',
  'PRODUCT_DEMAND',
  'PRODUCT_PRICING',
  'LOGISTICS',
  'MARITIME',
  'SUPPLY_CHAIN',
  'GEOSPATIAL',
  'SATELLITE',
  'PHYSICAL_ACTIVITY',
  'PATENTS',
  'INNOVATION',
  'GOVERNMENT_PROCUREMENT',
  'REGULATORY',
  'ENERGY',
  'CLIMATE',
  'COMMODITY_FLOW',
] as const;

export type AlternativeDataSignalFamily = (typeof ALTERNATIVE_DATA_SIGNAL_FAMILIES)[number];

/** Provider surfaces preserved from Wave 5/6 and productive-economy catalog. */
export const ALT_DATA_PROVIDER_SURFACES = [
  'SATELLITE',
  'GEOSPATIAL',
  'LOGISTICS_OPERATOR',
  'GOVERNMENT',
  'MARKET_REFERENCE',
] as const;

export type AltDataProviderSurface = (typeof ALT_DATA_PROVIDER_SURFACES)[number];

export const ALT01_CANONICAL_FEATURE_IDS = [
  'alt01.workforce_posting_momentum',
  'alt01.digital_demand_index',
  'alt01.logistics_throughput_proxy',
  'alt01.geospatial_activity_level',
  'alt01.patent_filing_intensity',
  'alt01.supply_chain_stress_proxy',
] as const;

export type Alt01CanonicalFeatureId = (typeof ALT01_CANONICAL_FEATURE_IDS)[number];

export const ALT01_FORMULA_VERSIONS = Object.freeze({
  workforcePostingMomentum: '1.0.0',
  digitalDemandIndex: '1.0.0',
  logisticsThroughputProxy: '1.0.0',
  geospatialActivityLevel: '1.0.0',
  patentFilingIntensity: '1.0.0',
  supplyChainStressProxy: '1.0.0',
});

export const ALT01_AUTHORITY_CLASS = 'REFERENCE_AND_RESEARCH_ONLY' as const;
