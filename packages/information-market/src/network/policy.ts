import {
  DEFAULT_DENY_CATEGORIES,
  DEFAULT_ENABLED_RIGHT_TYPES,
  GENERIC_ANY_FUTURE_PURPOSE,
  NETWORK_LEGAL_STATUS,
  RAW_EXPORT_POLICY,
  type InformationCategory,
  type InformationRightType,
  type OutputClass,
} from './taxonomy.ts';

export type HumanInformationNetworkPolicy = {
  readonly policyVersion: string;
  readonly rawExportPolicy: typeof RAW_EXPORT_POLICY;
  readonly enabledRightTypes: readonly InformationRightType[];
  readonly defaultDenyCategories: readonly InformationCategory[];
  readonly permittedCategories: readonly InformationCategory[];
  readonly minCohortSize: number;
  readonly maxQueriesPerRequesterPurpose: number;
  readonly maxOutputRows: number;
  readonly allowAnyFuturePurpose: false;
  readonly consentTransfersOwnership: false;
  readonly productionActivated: false;
  readonly humanAuthorizationRequired: true;
  readonly privacyReviewRequired: true;
  readonly legalAnalysisRequired: true;
  readonly unrestrictedMintAuthority: false;
  readonly differentialPrivacyImplemented: false;
  readonly privacyBudgetVersion: string;
};

export type ProductionActivationGates = {
  readonly privacyReview: boolean;
  readonly legalAnalysis: boolean;
  readonly jurisdictionPolicy: boolean;
  readonly termsAgreements: boolean;
  readonly requesterControls: boolean;
  readonly humanAuthorization: boolean;
};

export function defaultNetworkPolicy(): HumanInformationNetworkPolicy {
  return Object.freeze({
    policyVersion: 'hin-policy-v1',
    rawExportPolicy: RAW_EXPORT_POLICY,
    enabledRightTypes: Object.freeze([...DEFAULT_ENABLED_RIGHT_TYPES]),
    defaultDenyCategories: Object.freeze([...DEFAULT_DENY_CATEGORIES]),
    permittedCategories: Object.freeze([
      'FINANCIAL_ACTIVITY_METADATA',
      'COMMERCE_PREFERENCES',
      'PROFESSIONAL_INFORMATION',
      'CREATIVE_ACTIVITY',
      'DEVICE_ACTIVITY_SIGNALS',
    ]),
    minCohortSize: 10,
    maxQueriesPerRequesterPurpose: 8,
    maxOutputRows: 1,
    allowAnyFuturePurpose: false,
    consentTransfersOwnership: false,
    productionActivated: false,
    humanAuthorizationRequired: true,
    privacyReviewRequired: true,
    legalAnalysisRequired: true,
    unrestrictedMintAuthority: false,
    differentialPrivacyImplemented: false,
    privacyBudgetVersion: 'privacy-budget-v1-no-dp-claim',
  });
}

export function rightTypeEnabled(policy: HumanInformationNetworkPolicy, rightType: InformationRightType): boolean {
  return policy.enabledRightTypes.includes(rightType);
}

export function categoryPermitted(policy: HumanInformationNetworkPolicy, category: InformationCategory): boolean {
  if (policy.defaultDenyCategories.includes(category)) {
    return false;
  }
  return policy.permittedCategories.includes(category);
}

export function purposePermitted(purpose: string): boolean {
  const normalized = purpose.trim().toUpperCase().replace(/\s+/g, '_');
  if (!purpose.trim()) {
    return false;
  }
  if (normalized === GENERIC_ANY_FUTURE_PURPOSE || normalized === 'ANY' || normalized.includes('ANY_FUTURE')) {
    return false;
  }
  return true;
}

export function outputClassIsPersonWorthScore(outputClass: OutputClass, purpose: string): boolean {
  if (outputClass !== 'PRIVACY_SAFE_SCORE') {
    return false;
  }
  const lowered = purpose.toLowerCase();
  return lowered.includes('social credit') || lowered.includes('human worth') || lowered.includes('citizen score');
}

export function evaluateProductionActivation(
  gates: Partial<ProductionActivationGates> = {},
): {
  readonly gates: ProductionActivationGates;
  readonly engineeringComplete: true;
  readonly productionActivated: false;
  readonly legalStatus: typeof NETWORK_LEGAL_STATUS;
  readonly reasonCodes: readonly string[];
} {
  const complete: ProductionActivationGates = {
    privacyReview: gates.privacyReview === true,
    legalAnalysis: gates.legalAnalysis === true,
    jurisdictionPolicy: gates.jurisdictionPolicy === true,
    termsAgreements: gates.termsAgreements === true,
    requesterControls: gates.requesterControls === true,
    humanAuthorization: gates.humanAuthorization === true,
  };
  const reasons = Object.entries(complete)
    .filter(([, ready]) => !ready)
    .map(([name]) => `MISSING_${name.replace(/[A-Z]/g, (ch) => `_${ch}`).toUpperCase()}`);
  return Object.freeze({
    gates: Object.freeze(complete),
    engineeringComplete: true,
    productionActivated: false,
    legalStatus: NETWORK_LEGAL_STATUS,
    reasonCodes: Object.freeze(
      reasons.length > 0 ? reasons : ['ENGINEERING_INSUFFICIENT_WITHOUT_EXTERNAL_PRIVACY_LEGAL_AUTH'],
    ),
  });
}
