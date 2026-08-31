/**
 * ACCESS Wave 2 — Segmented Access provider capability interfaces.
 *
 * Providers implement only the interfaces matching their declared capabilities.
 */

import type { AccessCapacityCategory } from '../../taxonomy.ts';
import type { AccessProviderId, AccessProviderOutcome } from '../types.ts';
import type { AccessCapacity, AccessCapacityCandidate, AccessOpportunity, AccessProduct } from './domain-types.ts';
import type { AccessProvider } from './contract.ts';

export type AccessInventorySearchRequest = {
  readonly requestId: string;
  readonly category: AccessCapacityCategory;
  readonly query: string;
  readonly geography: string | null;
  readonly limit: number;
};

export type AccessInventorySearchResult = {
  readonly requestId: string;
  readonly opportunities: readonly AccessOpportunity[];
  readonly simulationOnly: boolean;
  readonly sandboxOnly?: true;
};

export type AccessAvailabilityRequest = {
  readonly requestId: string;
  readonly productId: string;
  readonly quantity: bigint;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly geography: string | null;
};

export type AccessAvailabilityResult = {
  readonly requestId: string;
  readonly providerId: AccessProviderId;
  readonly available: boolean;
  readonly availableQuantity: bigint;
  readonly reason: string;
  readonly simulationOnly: boolean;
  readonly sandboxOnly?: true;
};

export type AccessProviderQuote = {
  readonly quoteId: string;
  readonly providerId: AccessProviderId;
  readonly productId: string;
  readonly quantity: bigint;
  readonly priceMinorUnits: bigint;
  readonly currency: string;
  readonly expiresAt: string;
  readonly simulationOnly: boolean;
  readonly sandboxOnly?: true;
  readonly providerRateToken: string | null;
};

export type AccessQuoteRequest = {
  readonly requestId: string;
  readonly productId: string;
  readonly quantity: bigint;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly geography: string | null;
  readonly idempotencyKey: string;
};

export type AccessReservationRequest = {
  readonly requestId: string;
  readonly quoteId: string;
  readonly subjectRef: string;
  readonly idempotencyKey: string;
};

export type AccessReservation = {
  readonly reservationId: string;
  readonly providerId: AccessProviderId;
  readonly quoteId: string;
  readonly state: 'HELD' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'FAILED' | 'UNKNOWN';
  readonly expiresAt: string;
  readonly simulationOnly: boolean;
  readonly sandboxOnly?: true;
};

export type AccessBookingRequest = {
  readonly requestId: string;
  readonly reservationId: string;
  readonly subjectRef: string;
  readonly idempotencyKey: string;
};

export type AccessBooking = {
  readonly bookingId: string;
  readonly providerId: AccessProviderId;
  readonly reservationId: string;
  readonly state: 'CONFIRMED' | 'CANCELLED' | 'FAILED' | 'UNKNOWN';
  readonly simulationOnly: boolean;
  readonly sandboxOnly?: true;
};

export type AccessFulfillmentStatusRequest = {
  readonly requestId: string;
  readonly bookingId: string;
};

export type AccessFulfillmentStatus = {
  readonly bookingId: string;
  readonly providerId: AccessProviderId;
  readonly state: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'UNKNOWN';
  readonly lastUpdatedAt: string;
  readonly simulationOnly: boolean;
};

export type AccessCancellationRequest = {
  readonly requestId: string;
  readonly bookingId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
};

export type AccessCancellation = {
  readonly cancellationId: string;
  readonly providerId: AccessProviderId;
  readonly bookingId: string;
  readonly state: 'CANCELLED' | 'REFUND_PENDING' | 'FAILED' | 'UNKNOWN';
  readonly simulationOnly: boolean;
};

export type AccessRefundRequest = {
  readonly requestId: string;
  readonly bookingId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
};

export type AccessRefund = {
  readonly refundId: string;
  readonly providerId: AccessProviderId;
  readonly bookingId: string;
  readonly state: 'PENDING' | 'COMPLETED' | 'FAILED';
  readonly simulationOnly: boolean;
};

export type AccessRefundStatusRequest = {
  readonly requestId: string;
  readonly refundId: string;
};

export type AccessCapacityContribution = {
  readonly providerId: AccessProviderId;
  readonly category: AccessCapacityCategory;
  readonly productId: string;
  readonly geography: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly units: bigint;
  readonly unit: import('../types.ts').CanonicalCapacityUnit;
  readonly retailValueMinorUnits: bigint | null;
  readonly providerCostMinorUnits: bigint | null;
  readonly currency: string | null;
  readonly settlementPreference: string | null;
  readonly evidenceId: string | null;
  readonly termsRef: string | null;
};

/** Discovery and inventory operations. */
export type AccessInventoryProvider = AccessProvider & {
  search(request: AccessInventorySearchRequest): AccessProviderOutcome<AccessInventorySearchResult>;
  getAvailability(request: AccessAvailabilityRequest): AccessProviderOutcome<AccessAvailabilityResult>;
  getInventory?(productId: string): AccessProviderOutcome<AccessProduct>;
  getOpportunity?(productId: string): AccessProviderOutcome<AccessOpportunity>;
};

/** Quote operations only — no settlement. */
export type AccessQuoteProvider = AccessProvider & {
  getQuote(request: AccessQuoteRequest): AccessProviderOutcome<AccessProviderQuote>;
};

/** Fulfillment lifecycle operations. */
export type AccessFulfillmentProvider = AccessProvider & {
  reserve?(request: AccessReservationRequest): AccessProviderOutcome<AccessReservation>;
  book?(request: AccessBookingRequest): AccessProviderOutcome<AccessBooking>;
  cancel?(request: AccessCancellationRequest): AccessProviderOutcome<AccessCancellation>;
  getStatus?(request: AccessFulfillmentStatusRequest): AccessProviderOutcome<AccessFulfillmentStatus>;
  reconcile?(bookingId: string): AccessProviderOutcome<AccessBooking>;
};

/** Provider-side commercial refund interaction. Does not modify SunRey fiat ledger. */
export type AccessRefundProvider = AccessProvider & {
  requestRefund?(request: AccessRefundRequest): AccessProviderOutcome<AccessRefund>;
  getRefundStatus?(request: AccessRefundStatusRequest): AccessProviderOutcome<AccessRefund>;
};

/** Prepared for Access Wave 3 — interface only, no implementation. */
export const ACCESS_SETTLEMENT_CAPABILITIES = [
  'AUTHORIZE_PAYMENT',
  'CAPTURE_PAYMENT',
  'VOID_PAYMENT',
  'REFUND_PAYMENT',
  'PAYOUT',
  'RECONCILE_PAYMENT',
] as const;
export type AccessSettlementCapability = (typeof ACCESS_SETTLEMENT_CAPABILITIES)[number];

export type AccessSettlementProvider = AccessProvider & {
  readonly settlementCapabilities: readonly AccessSettlementCapability[];
};

/** Future-facing productive capacity contribution. No MR settlement. */
export type AccessCapacityContributor = AccessProvider & {
  publishCapacity(contribution: AccessCapacityContribution): AccessProviderOutcome<AccessCapacityCandidate>;
};

export function isInventoryProvider(provider: AccessProvider): provider is AccessInventoryProvider {
  return 'search' in provider && typeof (provider as AccessInventoryProvider).search === 'function';
}

export function isQuoteProvider(provider: AccessProvider): provider is AccessQuoteProvider {
  return 'getQuote' in provider && typeof (provider as AccessQuoteProvider).getQuote === 'function';
}

export function isFulfillmentProvider(provider: AccessProvider): provider is AccessFulfillmentProvider {
  return (
    ('reserve' in provider && typeof (provider as AccessFulfillmentProvider).reserve === 'function') ||
    ('book' in provider && typeof (provider as AccessFulfillmentProvider).book === 'function')
  );
}

export function isRefundProvider(provider: AccessProvider): provider is AccessRefundProvider {
  return 'requestRefund' in provider && typeof (provider as AccessRefundProvider).requestRefund === 'function';
}

export function isCapacityContributor(provider: AccessProvider): provider is AccessCapacityContributor {
  return 'publishCapacity' in provider && typeof (provider as AccessCapacityContributor).publishCapacity === 'function';
}
