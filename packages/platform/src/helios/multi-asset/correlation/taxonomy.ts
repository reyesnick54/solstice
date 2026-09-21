/**
 * HELIOS Multi-Asset M17 — correlation taxonomy.
 */

export const CORRELATION_METHODOLOGIES = [
  'PEARSON_SIMPLE_RETURN_BPS',
] as const;
export type CorrelationMethodology = (typeof CORRELATION_METHODOLOGIES)[number];

export const CORRELATION_WINDOW_HORIZONS = ['SHORT', 'MEDIUM', 'LONG'] as const;
export type CorrelationWindowHorizon = (typeof CORRELATION_WINDOW_HORIZONS)[number];

export const CORRELATION_RELATIONSHIP_STATES = [
  'NORMAL',
  'ELEVATED_CORRELATION',
  'CORRELATION_BREAKDOWN',
  'INSUFFICIENT_HISTORY',
  'UNSTABLE_RELATIONSHIP',
  'STALE_OBSERVATIONS',
] as const;
export type CorrelationRelationshipState = (typeof CORRELATION_RELATIONSHIP_STATES)[number];

export const CORRELATION_DATA_QUALITY_BANDS = [
  'HIGH',
  'MEDIUM',
  'LOW',
  'UNUSABLE',
] as const;
export type CorrelationDataQualityBand = (typeof CORRELATION_DATA_QUALITY_BANDS)[number];

export const CORRELATION_CHANGE_KINDS = [
  'ELEVATION',
  'BREAKDOWN',
  'SIGN_FLIP',
  'INSTABILITY',
] as const;
export type CorrelationChangeKind = (typeof CORRELATION_CHANGE_KINDS)[number];

/** Correlation expressed in basis points: -10000 = -1.0, +10000 = +1.0. */
export const CORRELATION_BPS_SCALE = 10_000 as const;

/** Default elevated correlation threshold (0.70). */
export const ELEVATED_CORRELATION_THRESHOLD_BPS = 7_000 as const;

/** Default cluster membership threshold (0.65). */
export const CLUSTER_CORRELATION_THRESHOLD_BPS = 6_500 as const;

/** Minimum breakdown delta from prior elevated window (0.25). */
export const CORRELATION_BREAKDOWN_DELTA_BPS = 2_500 as const;
