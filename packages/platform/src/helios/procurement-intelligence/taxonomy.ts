/**
 * HELIOS ALT10 — government procurement and demand intelligence taxonomy.
 */

export const HELIOS_PROCUREMENT_DEMAND_SCHEMA = 'sunrey.helios.procurement-demand.v1' as const;

export const HELIOS_ALT10_PROCUREMENT_INTELLIGENCE_QUALIFIED =
  'HELIOS_ALT10_PROCUREMENT_INTELLIGENCE_QUALIFIED' as const;

export const HELIOS_ALT10_PROCUREMENT_INTELLIGENCE_BLOCKED =
  'HELIOS_ALT10_PROCUREMENT_INTELLIGENCE_BLOCKED' as const;

export const PROCUREMENT_DEMAND_FEATURE_IDS = [
  'newAwards',
  'awardMomentum',
  'obligationMomentum',
  'backlogProxy',
  'agencyConcentration',
  'programConcentration',
  'renewalRate',
  'modificationRate',
  'cancellationRate',
] as const;

export type ProcurementDemandFeatureId = (typeof PROCUREMENT_DEMAND_FEATURE_IDS)[number];

export const PROCUREMENT_NORMALIZATION_DENOMINATORS = [
  'companyRevenue',
  'marketCap',
  'existingGovernmentBusiness',
] as const;

export type ProcurementNormalizationDenominator = (typeof PROCUREMENT_NORMALIZATION_DENOMINATORS)[number];

export const CONTRACT_REVENUE_CONVERSION_SCHEMA = 'sunrey.helios.contract-revenue-conversion.v1' as const;
