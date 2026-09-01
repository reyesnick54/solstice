import type { MerchantSettlementStatus, PurchaseAuthorizationStatus } from './taxonomy.ts';
import type { MerchantPurchase } from './types.ts';

/**
 * Settlement boundary — separate from offer acceptance.
 *
 * Offer acceptance does NOT mark settlement complete.
 * Settlement requires confirmed payment through the payment rail.
 */
export type SettlementBoundary = {
  readonly offerAccepted: boolean;
  readonly paymentAuthorized: boolean;
  readonly paymentConfirmed: boolean;
  readonly settlementComplete: boolean;
};

export function evaluateSettlementBoundary(purchase: MerchantPurchase): SettlementBoundary {
  const offerAccepted = purchase.acceptedOffer !== null;
  const paymentAuthorized =
    purchase.authorizationStatus === 'AUTHORIZED' ||
    purchase.authorizationStatus === 'PAYMENT_SUBMITTED';
  const paymentConfirmed = purchase.authorizationStatus === 'PAYMENT_SUBMITTED' && purchase.paymentReference !== null;
  const settlementComplete = purchase.settlementStatus === 'SETTLED';
  return Object.freeze({ offerAccepted, paymentAuthorized, paymentConfirmed, settlementComplete });
}

export function nextSettlementStatus(
  current: MerchantSettlementStatus,
  event: 'PAYMENT_AUTHORIZED' | 'PAYMENT_CONFIRMED' | 'SETTLEMENT_QUEUED' | 'SETTLED' | 'FAILED',
): MerchantSettlementStatus | null {
  switch (current) {
    case 'NOT_STARTED':
      if (event === 'PAYMENT_AUTHORIZED') return 'PENDING_PAYMENT';
      return null;
    case 'PENDING_PAYMENT':
      if (event === 'PAYMENT_CONFIRMED') return 'PAYMENT_CONFIRMED';
      if (event === 'FAILED') return 'FAILED';
      return null;
    case 'PAYMENT_CONFIRMED':
      if (event === 'SETTLEMENT_QUEUED') return 'SETTLEMENT_QUEUED';
      if (event === 'FAILED') return 'FAILED';
      return null;
    case 'SETTLEMENT_QUEUED':
      if (event === 'SETTLED') return 'SETTLED';
      if (event === 'FAILED') return 'FAILED';
      return null;
    default:
      return null;
  }
}

export type PurchasePaymentBoundary = {
  readonly purchaseId: string;
  readonly authorizationStatus: PurchaseAuthorizationStatus;
  readonly paymentReference: string | null;
  readonly providerAvailable: boolean;
};

/**
 * Map purchase to payment boundary state.
 * When no payment provider is live, purchase stays PENDING/EXTERNAL.
 */
export function mapPaymentBoundary(
  purchase: MerchantPurchase,
  providerAvailable: boolean,
): PurchasePaymentBoundary {
  let status = purchase.authorizationStatus;
  if (!providerAvailable && status === 'AWAITING_USER_AUTHORIZATION') {
    status = 'PAYMENT_UNAVAILABLE';
  }
  return Object.freeze({
    purchaseId: purchase.purchaseId,
    authorizationStatus: status,
    paymentReference: purchase.paymentReference,
    providerAvailable,
  });
}
