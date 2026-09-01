import type { MerchantExchangeProfile, PurchaseIntent } from './types.ts';
import type { PurchaseCategory } from './taxonomy.ts';

export const MERCHANT_ELIGIBILITY_OUTCOMES = ['ELIGIBLE', 'INELIGIBLE'] as const;
export type MerchantEligibilityOutcome = (typeof MERCHANT_ELIGIBILITY_OUTCOMES)[number];

export type MerchantEligibilityInput = {
  readonly merchant: MerchantExchangeProfile | undefined;
  readonly intent: PurchaseIntent;
  readonly now: string;
};

export type MerchantEligibilityResult = {
  readonly outcome: MerchantEligibilityOutcome;
  readonly reasons: readonly string[];
};

/**
 * Merchant eligibility checks. Uses provider/capability architecture;
 * missing KYB verification is represented honestly.
 */
export function evaluateMerchantEligibility(input: MerchantEligibilityInput): MerchantEligibilityResult {
  const { merchant, intent } = input;
  if (!merchant) {
    return deny(['MERCHANT_NOT_FOUND']);
  }
  if (merchant.status !== 'ACTIVE') {
    return deny(['MERCHANT_NOT_ACTIVE']);
  }
  if (merchant.verificationState !== 'PROVIDER_VERIFIED') {
    return deny(['MERCHANT_KYB_NOT_VERIFIED']);
  }
  if (!merchant.offerPermissions.includes('SUBMIT_OFFER')) {
    return deny(['OFFER_PERMISSION_DENIED']);
  }
  if (!merchant.supportedCategories.includes(intent.required.category)) {
    return deny(['CATEGORY_NOT_SUPPORTED']);
  }
  if (!merchant.supportedRegions.includes(intent.locationConstraint.countryCode)) {
    return deny(['GEOGRAPHY_NOT_SUPPORTED']);
  }
  if (merchant.complianceRestricted) {
    return deny(['COMPLIANCE_RESTRICTED']);
  }
  return Object.freeze({ outcome: 'ELIGIBLE', reasons: Object.freeze(['ELIGIBLE']) });
}

export function filterEligibleMerchants(
  merchants: readonly MerchantExchangeProfile[],
  intent: PurchaseIntent,
  now: string,
): readonly MerchantExchangeProfile[] {
  return Object.freeze(
    merchants.filter((merchant) => evaluateMerchantEligibility({ merchant, intent, now }).outcome === 'ELIGIBLE'),
  );
}

export function merchantSupportsCategory(
  merchant: MerchantExchangeProfile,
  category: PurchaseCategory,
): boolean {
  return merchant.supportedCategories.includes(category);
}

function deny(reasons: readonly string[]): MerchantEligibilityResult {
  return Object.freeze({ outcome: 'INELIGIBLE', reasons: Object.freeze([...reasons]) });
}
