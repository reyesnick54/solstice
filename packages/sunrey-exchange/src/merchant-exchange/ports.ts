import type { UtcInstant } from '../../../domain/src/time.ts';
import type { MerchantPurchase, PurchaseIntent } from './types.ts';
import type { MerchantExchangeMerchantId } from './ids.ts';

/** Payment authorization port — Merchant Exchange does not hold unrestricted payment authority. */
export type MerchantPaymentPort = {
  readonly providerAvailable: boolean;
  requestAuthorization(input: {
    readonly purchase: MerchantPurchase;
    readonly intent: PurchaseIntent;
    readonly userId: string;
    readonly now: UtcInstant;
  }): PaymentAuthorizationResult;
};

export type PaymentAuthorizationResult =
  | { readonly outcome: 'AUTHORIZED'; readonly paymentReference: string }
  | { readonly outcome: 'PENDING_USER_AUTHORIZATION' }
  | { readonly outcome: 'PROVIDER_UNAVAILABLE' }
  | { readonly outcome: 'REJECTED'; readonly reason: string };

/** Merchant registry port — merchants must be registered, not fabricated. */
export type MerchantRegistryPort = {
  getMerchant(merchantId: MerchantExchangeMerchantId): MerchantRegistryEntry | null;
  listActiveMerchants(): readonly MerchantRegistryEntry[];
};

export type MerchantRegistryEntry = {
  readonly merchantId: MerchantExchangeMerchantId;
  readonly ownerUserId: string | null;
  readonly businessIdentityId: string;
  readonly displayName: string;
  readonly status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  readonly supportedCategories: readonly string[];
  readonly supportedRegions: readonly string[];
  readonly verificationState: 'UNVERIFIED' | 'PROVIDER_VERIFIED' | 'REJECTED';
  readonly complianceRestricted: boolean;
};

/** Simulation payment port — does not fake settlement. */
export class SimulatedMerchantPaymentPort implements MerchantPaymentPort {
  readonly providerAvailable: boolean;

  constructor(providerAvailable = false) {
    this.providerAvailable = providerAvailable;
  }

  requestAuthorization(input: {
    readonly purchase: MerchantPurchase;
    readonly intent: PurchaseIntent;
    readonly userId: string;
    readonly now: UtcInstant;
  }): PaymentAuthorizationResult {
    if (!this.providerAvailable) {
      return { outcome: 'PROVIDER_UNAVAILABLE' };
    }
    return {
      outcome: 'AUTHORIZED',
      paymentReference: `sim_pay_${input.purchase.purchaseId}`,
    };
  }
}
