import type { HumanDataClassification } from './taxonomy.ts';

/**
 * Policy-oriented sensitivity ordering for Human Economy data.
 * Higher rank = more restrictive handling required.
 */
const CLASSIFICATION_RANK: Readonly<Record<HumanDataClassification, number>> = Object.freeze({
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  PERSONAL: 3,
  SENSITIVE_PERSONAL: 4,
  HIGHLY_RESTRICTED: 5,
});

export function isHumanDataClassification(value: string): value is HumanDataClassification {
  return value in CLASSIFICATION_RANK;
}

export function classificationRank(classification: HumanDataClassification): number {
  return CLASSIFICATION_RANK[classification];
}

export function requiresExplicitConsent(classification: HumanDataClassification): boolean {
  return classificationRank(classification) >= classificationRank('PERSONAL');
}

export function requiresPurposeAuthorization(classification: HumanDataClassification): boolean {
  return classificationRank(classification) >= classificationRank('SENSITIVE_PERSONAL');
}

export function isContributionEligibleClassification(classification: HumanDataClassification): boolean {
  return classification !== 'HIGHLY_RESTRICTED' || false;
}

/**
 * Maps PDV product classifications to Human Economy policy classifications.
 * Does not assert legal category equivalence.
 */
export function mapProductClassificationToHumanData(
  productClassification: string,
): HumanDataClassification {
  switch (productClassification) {
    case 'PUBLIC':
    case 'USER_PROVIDED':
      return 'PERSONAL';
    case 'PERSONAL':
      return 'PERSONAL';
    case 'FINANCIAL_SENSITIVE':
    case 'IDENTITY_SENSITIVE':
      return 'SENSITIVE_PERSONAL';
    case 'HEALTH_SENSITIVE':
    case 'BIOMETRIC_SENSITIVE':
    case 'GENETIC_SENSITIVE':
      return 'HIGHLY_RESTRICTED';
    case 'CONFIDENTIAL':
      return 'CONFIDENTIAL';
    case 'SECRET':
      return 'HIGHLY_RESTRICTED';
    default:
      return 'INTERNAL';
  }
}

export function classificationPermitsOnChainCommitment(
  classification: HumanDataClassification,
): boolean {
  return classificationRank(classification) <= classificationRank('CONFIDENTIAL');
}

export function maxClassification(
  left: HumanDataClassification,
  right: HumanDataClassification,
): HumanDataClassification {
  return classificationRank(left) >= classificationRank(right) ? left : right;
}
