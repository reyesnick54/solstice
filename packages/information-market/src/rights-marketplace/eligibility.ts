import type { DataProduct, InformationRight, RightsMarketplaceFailure } from './types.ts';
import { formIsPrivacyPreferred, purposeIsHeightened, SENSITIVE_CATEGORIES } from './taxonomy.ts';
import type { LicensePurpose } from './taxonomy.ts';

export function evaluateProductEligibility(input: {
  readonly product: Pick<
    DataProduct,
    | 'form'
    | 'rightIds'
    | 'classification'
    | 'eligiblePurposes'
    | 'sensitiveCategory'
    | 'minimumAggregationThreshold'
    | 'jurisdiction'
    | 'retentionDays'
    | 'licensingEligible'
    | 'privacyPolicyVersion'
  >;
  readonly rights: readonly InformationRight[];
  readonly consentActive: boolean;
  readonly purpose: LicensePurpose;
  readonly cohortSize?: number;
}): RightsMarketplaceFailure | null {
  if (!input.product.licensingEligible) {
    return { code: 'LICENSING_INELIGIBLE', message: 'product is not licensing-eligible' };
  }
  if (!input.product.privacyPolicyVersion) {
    return { code: 'PRIVACY_POLICY_REQUIRED', message: 'privacy policy version is required' };
  }
  if (!input.product.classification) {
    return { code: 'CLASSIFICATION_REQUIRED', message: 'classification is required before product creation' };
  }
  if (input.product.jurisdiction.length !== 2) {
    return { code: 'JURISDICTION_INVALID', message: 'jurisdiction must be an ISO-like simulation code' };
  }
  if (input.product.retentionDays <= 0) {
    return { code: 'RETENTION_REQUIRED', message: 'retention must be a positive duration' };
  }
  if (!input.consentActive) {
    return { code: 'CONSENT_REQUIRED', message: 'canonical consent must be ACTIVE before product creation' };
  }
  if (input.product.rightIds.length === 0 || input.rights.length === 0) {
    return { code: 'RIGHTS_REQUIRED', message: 'product creation requires underlying usage rights' };
  }
  for (const right of input.rights) {
    if (right.status !== 'ACTIVE') {
      return { code: 'RIGHT_NOT_ACTIVE', message: `right ${right.rightId} is not ACTIVE` };
    }
    if (right.licenseability !== 'LICENSEABLE') {
      return { code: 'RIGHT_NOT_LICENSEABLE', message: `right ${right.rightId} is not licenseable` };
    }
    if (right.ownershipTransferred) {
      return { code: 'OWNERSHIP_ASSUMED', message: 'usage rights cannot be treated as transferred ownership' };
    }
    if (!right.eligiblePurposes.includes(input.purpose)) {
      return { code: 'PURPOSE_NOT_ON_RIGHT', message: `right ${right.rightId} does not permit ${input.purpose}` };
    }
    if (right.prohibitedPurposes.includes(input.purpose)) {
      return { code: 'PURPOSE_PROHIBITED_ON_RIGHT', message: `right ${right.rightId} prohibits ${input.purpose}` };
    }
  }
  if (!input.product.eligiblePurposes.includes(input.purpose)) {
    return { code: 'PURPOSE_NOT_ON_PRODUCT', message: `product does not permit ${input.purpose}` };
  }
  const aggregated = formIsPrivacyPreferred(input.product.form) || input.product.form === 'AGGREGATED_DATASET';
  if (aggregated) {
    const cohort = input.cohortSize ?? 0;
    if (cohort < input.product.minimumAggregationThreshold) {
      return {
        code: 'MIN_COHORT_NOT_MET',
        message: `aggregated product requires cohort >= ${input.product.minimumAggregationThreshold}`,
      };
    }
  }
  if (input.product.sensitiveCategory || input.rights.some((right) => (SENSITIVE_CATEGORIES as readonly string[]).includes(right.underlyingCategory))) {
    if (!purposeIsHeightened(input.purpose) && input.product.minimumAggregationThreshold < 25) {
      return {
        code: 'SENSITIVE_THRESHOLD',
        message: 'sensitive categories require a stricter aggregation threshold',
      };
    }
    if (purposeIsHeightened(input.purpose)) {
      return {
        code: 'SENSITIVE_HEIGHTENED_PURPOSE',
        message: 'sensitive categories cannot be licensed for heightened purposes without separate authorization',
      };
    }
  }
  return null;
}
