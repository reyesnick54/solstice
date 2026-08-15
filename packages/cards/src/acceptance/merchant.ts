import type { AccountId } from '../../../domain/src/account.ts';
import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { BusinessIdentityId } from '../../../identity/src/ids.ts';
import { assertNoSensitiveCardData } from '../pci-boundary.ts';
import type { MerchantId } from './ids.ts';

export const MERCHANT_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED'] as const;
export type MerchantStatus = (typeof MERCHANT_STATUSES)[number];

export const ACCEPTANCE_CAPABILITIES = ['CONTACTLESS_SOFTPOS'] as const;
export type AcceptanceCapability = (typeof ACCEPTANCE_CAPABILITIES)[number];

/**
 * Minimum merchant acceptance record. Reuses canonical BusinessIdentity.
 * This is not a second business KYC model and is not an acquiring-license claim.
 */
export type MerchantAcceptance = {
  readonly merchantId: MerchantId;
  readonly businessIdentityId: BusinessIdentityId;
  readonly status: MerchantStatus;
  readonly settlementAccountId: AccountId;
  readonly jurisdiction: Jurisdiction;
  readonly acceptanceCapabilities: readonly AcceptanceCapability[];
  readonly acquiringLicenseClaim: 'NONE';
  readonly createdAt: UtcInstant;
};

export function freezeMerchant(merchant: MerchantAcceptance): MerchantAcceptance {
  assertNoSensitiveCardData(merchant, 'merchant');
  if (merchant.acquiringLicenseClaim !== 'NONE') {
    throw new TypeError('Solstice must not claim an acquiring license');
  }
  return Object.freeze({
    ...merchant,
    acquiringLicenseClaim: 'NONE',
    acceptanceCapabilities: Object.freeze([...merchant.acceptanceCapabilities]),
  });
}
