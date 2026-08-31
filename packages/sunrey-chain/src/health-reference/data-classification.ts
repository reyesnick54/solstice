/**
 * Data classification for public health reference observations.
 * Separated from PHI, medical records, genetic data, and private wellness data.
 */

export const HEALTH_DATA_CLASSIFICATIONS = Object.freeze({
  PUBLIC_HEALTH_REFERENCE: 'PUBLIC_HEALTH_REFERENCE',
  PHI: 'PHI',
  MEDICAL_RECORD: 'MEDICAL_RECORD',
  GENETIC_DATA: 'GENETIC_DATA',
  BIOMETRIC_DATA: 'BIOMETRIC_DATA',
  BEHAVIORAL_PROFILE: 'BEHAVIORAL_PROFILE',
  PRIVATE_WELLNESS: 'PRIVATE_WELLNESS',
} as const);

export type HealthDataClassification =
  (typeof HEALTH_DATA_CLASSIFICATIONS)[keyof typeof HEALTH_DATA_CLASSIFICATIONS];

/** All Wave 6 health reference observations carry this classification. */
export function classifyPublicHealthReference(): typeof HEALTH_DATA_CLASSIFICATIONS.PUBLIC_HEALTH_REFERENCE {
  return HEALTH_DATA_CLASSIFICATIONS.PUBLIC_HEALTH_REFERENCE;
}

export function isSensitiveHealthClassification(
  classification: HealthDataClassification,
): boolean {
  return classification !== HEALTH_DATA_CLASSIFICATIONS.PUBLIC_HEALTH_REFERENCE;
}
