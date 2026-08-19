/**
 * Chunk 119 — stable rejection codes for canonical unit migration.
 *
 * These names are shared by oracle, claim-candidate, and productive
 * verification. They do not authorize MoonRey and do not weaken
 * historical Chunk 74 / Chunk 44 refusal codes.
 */

export const CANONICAL_MEASUREMENT_REJECTION_CODES = [
  'CANONICAL_UNIT_REQUIRED',
  'NORMALIZATION_RECEIPT_REQUIRED',
  'NORMALIZATION_VERSION_MISMATCH',
  'NORMALIZATION_CONTEXT_REQUIRED',
  'NORMALIZATION_DIMENSION_MISMATCH',
  'NORMALIZATION_SEMANTIC_MISMATCH',
  'LOSSY_NORMALIZATION_FORBIDDEN',
  'LEGACY_NORMALIZATION_NOT_ALLOWED_FOR_NEW_CONTRIBUTION',
  'FACT_UNIT_MISMATCH',
  'CLAIM_UNIT_MISMATCH',
] as const;
export type CanonicalMeasurementRejectionCode = (typeof CANONICAL_MEASUREMENT_REJECTION_CODES)[number];

export type CanonicalMeasurementRefusal = {
  readonly code: CanonicalMeasurementRejectionCode;
  readonly detail: string;
};

export function measurementRefusal(
  code: CanonicalMeasurementRejectionCode,
  detail: string,
): CanonicalMeasurementRefusal {
  return Object.freeze({ code, detail });
}
