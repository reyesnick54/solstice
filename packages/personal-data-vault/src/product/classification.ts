/**
 * Product classification for Vault Data Records.
 *
 * These are engineering classifications used for access, retention, and
 * redaction. They are not GDPR/CCPA/PDPL/HIPAA legal categories.
 *
 * Supporting a sensitive class in the schema does not authorize collection.
 * HEALTH / BIOMETRIC / GENETIC require an explicit product purpose and
 * applicable consent before ingest.
 */

export const PRODUCT_CLASSIFICATIONS = [
  'PUBLIC',
  'USER_PROVIDED',
  'PERSONAL',
  'FINANCIAL_SENSITIVE',
  'IDENTITY_SENSITIVE',
  'HEALTH_SENSITIVE',
  'BIOMETRIC_SENSITIVE',
  'GENETIC_SENSITIVE',
  'CONFIDENTIAL',
  'SECRET',
] as const;
export type ProductClassification = (typeof PRODUCT_CLASSIFICATIONS)[number];

export const HIGHLY_SENSITIVE_CLASSIFICATIONS = [
  'HEALTH_SENSITIVE',
  'BIOMETRIC_SENSITIVE',
  'GENETIC_SENSITIVE',
  'SECRET',
] as const;
export type HighlySensitiveClassification = (typeof HIGHLY_SENSITIVE_CLASSIFICATIONS)[number];

export function isProductClassification(value: string): value is ProductClassification {
  return (PRODUCT_CLASSIFICATIONS as readonly string[]).includes(value);
}

export function isHighlySensitiveClassification(value: string): boolean {
  return (HIGHLY_SENSITIVE_CLASSIFICATIONS as readonly string[]).includes(value);
}

export function classificationFromLegacySensitivity(
  sensitivity: 'PERSONAL' | 'SENSITIVE' | 'HIGHLY_SENSITIVE' | 'RESTRICTED',
  categoryHint?: string,
): ProductClassification {
  if (sensitivity === 'RESTRICTED') {
    return 'CONFIDENTIAL';
  }
  if (sensitivity === 'HIGHLY_SENSITIVE') {
    if (categoryHint === 'IDENTITY_ATTRIBUTE') {
      return 'IDENTITY_SENSITIVE';
    }
    return 'FINANCIAL_SENSITIVE';
  }
  if (sensitivity === 'SENSITIVE') {
    return categoryHint === 'IDENTITY_ATTRIBUTE' ? 'IDENTITY_SENSITIVE' : 'FINANCIAL_SENSITIVE';
  }
  return 'PERSONAL';
}
