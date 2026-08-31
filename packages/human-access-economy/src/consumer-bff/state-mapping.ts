import type { RedemptionStatus } from '../../../access-economy/src/providers/redemption/types.ts';
import type { ConsumerFundingStatus, ConsumerProductStatus, ConsumerTransactionStatus } from './types.ts';

export function mapRedemptionToConsumerStatus(status: RedemptionStatus): ConsumerTransactionStatus {
  switch (status) {
    case 'REDEEMED':
      return 'CONFIRMED';
    case 'READY_FOR_APPROVAL':
    case 'AUTHORIZATION_REQUIRED':
    case 'USER_CONTRIBUTION_REQUIRED':
      return 'ACTION_REQUIRED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'REFUNDED':
      return 'REFUNDED';
    case 'FAILED':
      return 'FAILED';
    case 'PROVIDER_UNAVAILABLE':
    case 'POLICY_BLOCKED':
    case 'NOT_ELIGIBLE':
    case 'ENTITLEMENT_INSUFFICIENT':
      return 'FAILED';
    case 'QUOTE_EXPIRED':
      return 'FAILED';
    default:
      return 'PROCESSING';
  }
}

export function mapReconciliationRequiredStatus(): ConsumerTransactionStatus {
  return 'PROCESSING_CONFIRMATION';
}

export function consumerStatusMessage(status: ConsumerTransactionStatus): string {
  switch (status) {
    case 'PROCESSING':
      return 'Your Access transaction is processing.';
    case 'PROCESSING_CONFIRMATION':
      return "We're confirming this transaction with the provider.";
    case 'BOOKED':
      return 'Your booking is held with the provider.';
    case 'CONFIRMED':
      return 'Your Access booking is confirmed.';
    case 'FULFILLED':
      return 'Your Access booking has been fulfilled.';
    case 'CANCELLED':
      return 'This Access transaction was cancelled.';
    case 'REFUND_PENDING':
      return 'A refund is pending from the provider.';
    case 'REFUNDED':
      return 'Your refund has been processed.';
    case 'ACTION_REQUIRED':
      return 'Additional action is required to complete this transaction.';
    case 'FAILED':
      return 'This Access transaction could not be completed.';
    default:
      return 'Transaction status is being updated.';
  }
}

export function mapFundingStatus(input: {
  readonly poolSolvent: boolean;
  readonly allocatableUnits: bigint;
  readonly publishedUnits: bigint;
}): ConsumerFundingStatus {
  if (!input.poolSolvent || input.allocatableUnits <= 0n) {
    return 'TEMPORARILY_UNAVAILABLE';
  }
  if (input.allocatableUnits * 10n < input.publishedUnits) {
    return 'LIMITED';
  }
  return 'AVAILABLE';
}

export function mapDiscoveryStatus(providerAvailable: boolean): import('./types.ts').ConsumerDiscoveryStatus {
  return providerAvailable ? 'AVAILABLE' : 'TEMPORARILY_UNAVAILABLE';
}

export function overallProductStatus(simulation: boolean, enabled: boolean): ConsumerProductStatus {
  if (!enabled) return 'UNAVAILABLE';
  return simulation ? 'SIMULATED' : 'PARTIAL';
}

export function mapProviderErrorCode(code: string): import('./types.ts').ConsumerAccessErrorCode | null {
  switch (code) {
    case 'PROVIDER_UNAVAILABLE':
      return 'PROVIDER_TEMPORARILY_UNAVAILABLE';
    case 'QUOTE_EXPIRED':
      return 'QUOTE_EXPIRED';
    case 'PRICE_CHANGED':
      return 'PRICE_CHANGED';
    case 'AUTHORIZATION_REQUIRED':
    case 'USER_CONTRIBUTION_REQUIRED':
      return 'PAYMENT_ACTION_REQUIRED';
    default:
      return null;
  }
}
