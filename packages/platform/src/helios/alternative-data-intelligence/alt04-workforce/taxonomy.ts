/**
 * HELIOS ALT04 — workforce / hiring alternative data taxonomy.
 * Investment-research interpretation only; does not grant Execution Authority.
 */

export const HELIOS_ALT04_WORKFORCE_SCHEMA = 'sunrey.helios.alt04.workforce-intelligence.v1' as const;
export const HELIOS_ALT04_WORKFORCE_AUTHORITY = 'helios:alternative-data:workforce:research' as const;

export const HELIOS_ALT04_WORKFORCE_INTELLIGENCE_QUALIFIED =
  'HELIOS_ALT04_WORKFORCE_INTELLIGENCE_QUALIFIED' as const;
export const HELIOS_ALT04_WORKFORCE_INTELLIGENCE_BLOCKED =
  'HELIOS_ALT04_WORKFORCE_INTELLIGENCE_BLOCKED' as const;

/** Research prediction targets — not optimized primarily for stock return. */
export const WORKFORCE_RESEARCH_PREDICTION_TARGETS = Object.freeze([
  'future_revenue_growth',
  'employee_growth',
  'operating_expense',
  'earnings_surprise',
  'capex_rd_changes',
] as const);
export type WorkforceResearchPredictionTarget = (typeof WORKFORCE_RESEARCH_PREDICTION_TARGETS)[number];

export const HIRING_MOTIVE_ESTIMATES = Object.freeze([
  'EXPANSION',
  'REPLACEMENT',
  'SEASONAL',
  'TURNOVER',
  'UNKNOWN',
] as const);
export type HiringMotiveEstimate = (typeof HIRING_MOTIVE_ESTIMATES)[number];

export const WORKFORCE_SKILL_BUCKETS = Object.freeze([
  'AI',
  'DATA',
  'SOFTWARE',
  'SALES',
  'OPERATIONS',
  'MANUFACTURING',
  'R_AND_D',
  'FINANCE',
  'LEGAL',
  'SECURITY',
  'LOGISTICS',
  'OTHER',
] as const);
export type WorkforceSkillBucket = (typeof WORKFORCE_SKILL_BUCKETS)[number];

export const HIRING_DEMAND_BANDS = Object.freeze(['CONTRACTING', 'STABLE', 'ELEVATED', 'SURGE'] as const);
export type HiringDemandBand = (typeof HIRING_DEMAND_BANDS)[number];

export const WORKFORCE_EXPANSION_BANDS = Object.freeze(['SHRINKING', 'FLAT', 'EXPANDING', 'RAPID'] as const);
export type WorkforceExpansionBand = (typeof WORKFORCE_EXPANSION_BANDS)[number];

export const HIRING_QUALITY_BANDS = Object.freeze(['LOW_SIGNAL', 'MIXED', 'ACTIONABLE', 'HIGH_COVERAGE'] as const);
export type HiringQualityBand = (typeof HIRING_QUALITY_BANDS)[number];

/** Operational interpretation — posting growth is not universally bullish. */
export const WORKFORCE_OPERATIONAL_STANCES = Object.freeze([
  'NEUTRAL',
  'CAUTIOUSLY_POSITIVE',
  'CAUTIOUSLY_NEGATIVE',
  'MIXED',
  'INSUFFICIENT_COVERAGE',
] as const);
export type WorkforceOperationalStance = (typeof WORKFORCE_OPERATIONAL_STANCES)[number];

export const COVERAGE_REWEIGHT_DIMENSIONS = Object.freeze([
  'firm_size',
  'geography',
  'industry',
  'establishment_class',
] as const);
export type CoverageReweightDimension = (typeof COVERAGE_REWEIGHT_DIMENSIONS)[number];
