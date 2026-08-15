import type { Account } from '../../../domain/src/account.ts';
import type { BusinessIdentity } from '../../../identity/src/model.ts';
import type { MerchantAcceptance } from './merchant.ts';

export const MERCHANT_ELIGIBILITY_OUTCOMES = ['ELIGIBLE', 'INELIGIBLE'] as const;
export type MerchantEligibilityOutcome = (typeof MERCHANT_ELIGIBILITY_OUTCOMES)[number];

export type MerchantEligibilityInput = {
  readonly merchant: MerchantAcceptance | undefined;
  readonly business: BusinessIdentity | undefined;
  readonly settlementAccount: Account | undefined;
  readonly jurisdictionPermitted: boolean;
  readonly complianceClear: boolean;
  readonly fraudClear: boolean;
};

export type MerchantEligibilityResult = {
  readonly outcome: MerchantEligibilityOutcome;
  readonly reasons: readonly string[];
};

/**
 * Default deny. Simulation capability only — not an acquiring-license claim.
 */
export function evaluateMerchantEligibility(input: MerchantEligibilityInput): MerchantEligibilityResult {
  const reasons: string[] = [];
  if (!input.merchant) {
    return deny(['MERCHANT_NOT_FOUND']);
  }
  if (input.merchant.status !== 'ACTIVE') {
    return deny(['MERCHANT_NOT_ACTIVE']);
  }
  if (input.merchant.acquiringLicenseClaim !== 'NONE') {
    return deny(['ACQUIRING_LICENSE_CLAIM_FORBIDDEN']);
  }
  if (!input.business || input.business.businessStatus !== 'ACTIVE') {
    return deny(['BUSINESS_IDENTITY_NOT_ACTIVE']);
  }
  if (input.business.verificationState !== 'PROVIDER_VERIFIED') {
    return deny(['BUSINESS_KYC_NOT_VERIFIED']);
  }
  if (!input.settlementAccount || input.settlementAccount.status !== 'OPEN') {
    return deny(['SETTLEMENT_ACCOUNT_NOT_OPEN']);
  }
  if (input.settlementAccount.id !== input.merchant.settlementAccountId) {
    return deny(['SETTLEMENT_ACCOUNT_MISMATCH']);
  }
  if (!input.jurisdictionPermitted) {
    return deny(['JURISDICTION_NOT_PERMITTED']);
  }
  if (!input.complianceClear) {
    return deny(['COMPLIANCE_NOT_CLEAR']);
  }
  if (!input.fraudClear) {
    return deny(['FRAUD_NOT_CLEAR']);
  }
  reasons.push('ELIGIBLE');
  return Object.freeze({ outcome: 'ELIGIBLE', reasons: Object.freeze(reasons) });
}

function deny(reasons: readonly string[]): MerchantEligibilityResult {
  return Object.freeze({ outcome: 'INELIGIBLE', reasons: Object.freeze([...reasons]) });
}
