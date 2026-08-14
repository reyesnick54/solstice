/**
 * Purpose proof catalog and compatibility matrix.
 *
 * Possession of data NEVER implies permission to use it. Purpose is evaluated
 * in the Compliance Kernel on every consent and personal-data intent. It is
 * not inferred from a prompt, session, or application-layer convention.
 *
 * Health / psychological data authorized for wellness research is unreachable
 * for advertising, credit, investment eligibility, or employment — even when
 * the caller holds a valid session and valid consent for a different purpose.
 *
 * Privacy pack rules that mention these pairings stay DRAFT. None are
 * CONFIRMED_BY_COUNSEL.
 */

export const DATA_PURPOSES = [
  'WELLNESS_RESEARCH',
  'MEDICAL_TREATMENT',
  'ADVERTISING',
  'CREDIT',
  'INVESTMENT_ELIGIBILITY',
  'EMPLOYMENT',
  'PRODUCT_IMPROVEMENT',
  'PERSONALIZATION',
  'REGULATORY',
  'CUSTOMER_SERVICE',
] as const;

export type DataPurpose = (typeof DATA_PURPOSES)[number];

export const PERSONAL_DATA_CATEGORIES = [
  'IDENTITY',
  'FINANCIAL',
  'HEALTH',
  'WELLNESS',
  'CONSUMPTION',
  'ENTERTAINMENT',
  'WORK',
  'LIFESTYLE',
  'GOALS',
  'PSYCHOLOGICAL',
  'PREFERENCES',
  'PURCHASE_INTENT',
] as const;

export type PersonalDataCategory = (typeof PERSONAL_DATA_CATEGORIES)[number];

export const SENSITIVE_CATEGORIES: readonly PersonalDataCategory[] = [
  'HEALTH',
  'PSYCHOLOGICAL',
];

export const PURPOSES_FORBIDDEN_FOR_SENSITIVE: readonly DataPurpose[] = [
  'ADVERTISING',
  'CREDIT',
  'INVESTMENT_ELIGIBILITY',
  'EMPLOYMENT',
];

export const LEGAL_BASES = [
  'CONSENT',
  'CONTRACT',
  'LEGAL_OBLIGATION',
  'VITAL_INTERESTS',
  'PUBLIC_TASK',
  'LEGITIMATE_INTERESTS',
] as const;

export type LegalBasis = (typeof LEGAL_BASES)[number];

export function isDataPurpose(value: unknown): value is DataPurpose {
  return typeof value === 'string' && (DATA_PURPOSES as readonly string[]).includes(value);
}

export function isPersonalDataCategory(value: unknown): value is PersonalDataCategory {
  return (
    typeof value === 'string' &&
    (PERSONAL_DATA_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isLegalBasis(value: unknown): value is LegalBasis {
  return typeof value === 'string' && (LEGAL_BASES as readonly string[]).includes(value);
}

export type PurposeCompatibility = {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
};

/**
 * Structural compatibility: sensitive categories cannot be used for
 * advertising, credit, investment eligibility, or employment under any
 * scoring weight, session, or consent-for-a-different-purpose.
 */
export function evaluatePurposeCompatibility(
  category: PersonalDataCategory,
  purpose: DataPurpose,
): PurposeCompatibility {
  const sensitive = (SENSITIVE_CATEGORIES as readonly string[]).includes(category);
  if (sensitive && (PURPOSES_FORBIDDEN_FOR_SENSITIVE as readonly string[]).includes(purpose)) {
    return Object.freeze({
      allowed: false,
      reasons: Object.freeze([
        `PURPOSE_INCOMPATIBLE: category ${category} cannot be used for ${purpose}`,
      ]),
    });
  }
  return Object.freeze({
    allowed: true,
    reasons: Object.freeze([
      `purpose ${purpose} is compatible with category ${category} under the simulation matrix`,
    ]),
  });
}
