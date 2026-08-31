/**
 * ACCESS Wave 2 / Prompt 32 — Commercial Access Provider canonical types.
 *
 * Provider-neutral commercial booking vocabulary. Vendor-native payloads must
 * not escape adapter boundaries. Settlement orchestration is Access Wave 3.
 */

import type { AccessCapacityCategory } from '../../taxonomy.ts';
import type { CanonicalCapacityUnit } from '../types.ts';

/** Commercial capability vocabulary — provider-specific declaration required. */
export const COMMERCIAL_ACCESS_CAPABILITY_IDS = [
  'SEARCH',
  'AVAILABILITY',
  'QUOTE',
  'RESERVE',
  'BOOK',
  'CANCEL',
  'REFUND',
  'STATUS',
  'RECONCILE',
  'FULFILLMENT_EVIDENCE',
] as const;
export type CommercialAccessCapabilityId = (typeof COMMERCIAL_ACCESS_CAPABILITY_IDS)[number];

/** Alias required by Prompt 32 specification. */
export type AccessProviderCapability = {
  readonly capabilityId: CommercialAccessCapabilityId;
  readonly supported: boolean;
  readonly notes: string | null;
};

export const COMMERCIAL_PROVIDER_ACTIVATION_STATES = [
  'DISCOVERY_ONLY',
  'SANDBOX',
  'PREVIEW',
  'PRODUCTION',
  'BLOCKED_PENDING_CREDENTIALS',
  'BLOCKED_PENDING_CONTRACT',
  'BLOCKED_PENDING_COMPLIANCE',
  'DISABLED',
] as const;
export type CommercialProviderActivationState = (typeof COMMERCIAL_PROVIDER_ACTIVATION_STATES)[number];

export const COMMERCIAL_PROVIDER_IDS = [
  'amadeus',
  'booking_com',
  'viator',
  'ticketmaster_partner',
  'ticketmaster_discovery',
] as const;
export type CommercialProviderId = (typeof COMMERCIAL_PROVIDER_IDS)[number];

export const QUOTE_CLASSIFICATIONS = ['REFERENCE', 'INDICATIVE', 'FIRM'] as const;
export type QuoteClassification = (typeof QUOTE_CLASSIFICATIONS)[number];

export const PROVIDER_BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'FAILED',
  'CANCELLED',
  'FULFILLED',
  'UNKNOWN',
] as const;
export type ProviderBookingStatus = (typeof PROVIDER_BOOKING_STATUSES)[number];

export const RECONCILIATION_STATES = ['RESOLVED', 'RECONCILIATION_REQUIRED', 'NOT_APPLICABLE'] as const;
export type ReconciliationState = (typeof RECONCILIATION_STATES)[number];

export type CommercialProviderProvenance = {
  readonly source: 'FIXTURE' | 'SANDBOX' | 'PRODUCTION';
  readonly retrievedAt: string;
  readonly cacheHit: boolean;
  readonly providerRequestId: string | null;
};

export type AccessProviderProductMapping = {
  readonly mappingId: string;
  readonly providerId: CommercialProviderId;
  readonly providerProductId: string;
  readonly accessProductId: string;
  readonly category: AccessCapacityCategory;
  readonly providerNativeUnit: string;
  readonly canonicalUnit: CanonicalCapacityUnit;
  readonly conversionPolicy: string | null;
  readonly geography: string | null;
  readonly status: 'ACTIVE' | 'INACTIVE' | 'PENDING_REVIEW';
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
};

export type CommercialMoneyBreakdown = {
  readonly currency: string;
  readonly minorUnits: bigint;
};

export type CommercialFeeLine = {
  readonly feeId: string;
  readonly label: string;
  readonly amount: CommercialMoneyBreakdown;
  readonly mandatory: boolean;
};

export type AccessProviderSearchRequest = {
  readonly requestId: string;
  readonly providerId: CommercialProviderId;
  readonly category: AccessCapacityCategory;
  readonly query: string;
  readonly location: string | null;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly limit: number;
};

export type AccessProviderSearchItem = {
  readonly providerProductId: string;
  readonly providerId: CommercialProviderId;
  readonly category: AccessCapacityCategory;
  readonly title: string;
  readonly description: string;
  readonly location: string | null;
  readonly canonicalUnit: CanonicalCapacityUnit;
};

export type AccessProviderSearchResult = {
  readonly requestId: string;
  readonly providerId: CommercialProviderId;
  readonly items: readonly AccessProviderSearchItem[];
  readonly provenance: CommercialProviderProvenance;
};

export type AccessProviderAvailabilityRequest = {
  readonly requestId: string;
  readonly providerId: CommercialProviderId;
  readonly providerProductId: string;
  readonly quantity: bigint;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly location: string | null;
};

export type AccessProviderAvailability = {
  readonly providerId: CommercialProviderId;
  readonly providerProductId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly unitsAvailable: bigint | null;
  readonly status: 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE' | 'UNKNOWN';
  readonly inventoryReference: string | null;
  readonly expiresAt: string | null;
  readonly provenance: CommercialProviderProvenance;
};

export type AccessProviderQuoteRequest = {
  readonly requestId: string;
  readonly providerId: CommercialProviderId;
  readonly providerProductId: string;
  readonly category: AccessCapacityCategory;
  readonly quantity: bigint;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly location: string | null;
  readonly idempotencyKey: string;
};

export type AccessProviderQuote = {
  readonly providerQuoteId: string;
  readonly providerId: CommercialProviderId;
  readonly providerProductId: string;
  readonly category: AccessCapacityCategory;
  readonly classification: QuoteClassification;
  readonly units: bigint;
  readonly unit: CanonicalCapacityUnit;
  readonly baseAmount: CommercialMoneyBreakdown;
  readonly taxes: readonly CommercialFeeLine[];
  readonly mandatoryFees: readonly CommercialFeeLine[];
  readonly optionalFees: readonly CommercialFeeLine[];
  readonly securityDeposit: CommercialMoneyBreakdown | null;
  readonly totalAmount: CommercialMoneyBreakdown;
  readonly expiresAt: string;
  readonly termsReference: string | null;
  readonly cancellationPolicy: string | null;
  readonly providerReference: string | null;
  readonly provenance: CommercialProviderProvenance;
};

export type AccessProviderReservationRequest = {
  readonly requestId: string;
  readonly providerId: CommercialProviderId;
  readonly providerQuoteId: string;
  readonly travelerProfileRef: string;
  readonly idempotencyKey: string;
};

export type AccessProviderReservation = {
  readonly providerReservationId: string;
  readonly providerId: CommercialProviderId;
  readonly providerQuoteId: string;
  readonly state: 'HELD' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED' | 'FAILED';
  readonly expiresAt: string;
  readonly price: CommercialMoneyBreakdown;
  readonly inventoryStatus: 'HELD' | 'CONFIRMED' | 'RELEASED' | 'UNKNOWN';
  readonly provenance: CommercialProviderProvenance;
};

export type CommercialBookingProfile = {
  readonly profileRef: string;
  readonly givenName: string;
  readonly familyName: string;
  readonly email: string | null;
  readonly phone: string | null;
};

export type AccessProviderBookingRequest = {
  readonly requestId: string;
  readonly providerId: CommercialProviderId;
  readonly providerReservationId: string | null;
  readonly providerQuoteId: string;
  readonly travelerProfile: CommercialBookingProfile;
  readonly idempotencyKey: string;
};

export type AccessProviderBooking = {
  readonly providerBookingId: string;
  readonly providerId: CommercialProviderId;
  readonly reservationReference: string | null;
  readonly confirmationCode: string | null;
  readonly status: ProviderBookingStatus;
  readonly reconciliationState: ReconciliationState;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly travelerReference: string;
  readonly providerTerms: string | null;
  readonly cancellationPolicy: string | null;
  readonly totalAmount: CommercialMoneyBreakdown;
  readonly createdAt: string;
  readonly provenance: CommercialProviderProvenance;
};

export type AccessProviderCancellationRequest = {
  readonly requestId: string;
  readonly providerId: CommercialProviderId;
  readonly providerBookingId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
};

export type AccessProviderCancellation = {
  readonly cancelled: boolean;
  readonly refundEligible: boolean;
  readonly refundAmount: CommercialMoneyBreakdown | null;
  readonly penaltyAmount: CommercialMoneyBreakdown | null;
  readonly providerStatus: string;
  readonly providerReference: string | null;
  readonly provenance: CommercialProviderProvenance;
};

export type AccessProviderRefundRequest = {
  readonly requestId: string;
  readonly providerId: CommercialProviderId;
  readonly providerBookingId: string;
  readonly amount: CommercialMoneyBreakdown | null;
  readonly idempotencyKey: string;
};

export type AccessProviderRefund = {
  readonly providerRefundId: string;
  readonly providerId: CommercialProviderId;
  readonly providerBookingId: string;
  readonly state: 'INITIATED' | 'COMPLETED' | 'FAILED' | 'UNKNOWN';
  readonly refundAmount: CommercialMoneyBreakdown;
  readonly providerReference: string | null;
  readonly provenance: CommercialProviderProvenance;
};

export type AccessProviderReconcileRequest = {
  readonly requestId: string;
  readonly providerId: CommercialProviderId;
  readonly providerBookingId: string;
  readonly idempotencyKey: string;
};

export type AccessProviderReconcileResult = {
  readonly providerBookingId: string;
  readonly status: ProviderBookingStatus;
  readonly reconciliationState: ReconciliationState;
  readonly providerReference: string | null;
  readonly provenance: CommercialProviderProvenance;
};

export type CommercialProviderHealth = {
  readonly providerId: CommercialProviderId;
  readonly activationState: CommercialProviderActivationState;
  readonly healthy: boolean;
  readonly lastCheckedAt: string;
  readonly message: string;
};

export type CommercialProviderRegistration = {
  readonly providerId: CommercialProviderId;
  readonly displayName: string;
  readonly activationState: CommercialProviderActivationState;
  readonly capabilities: readonly AccessProviderCapability[];
  readonly categories: readonly AccessCapacityCategory[];
  readonly contractStatus: 'NONE' | 'PENDING' | 'SIGNED' | 'EXPIRED';
  readonly credentialStatus: 'NONE' | 'CONFIGURED' | 'VALIDATED' | 'MISSING';
};

export type CommercialProviderSuccess<T> = { readonly ok: true; readonly value: T };
export type CommercialProviderFailure = { readonly ok: false; readonly code: string; readonly message: string };
export type CommercialProviderOutcome<T> = CommercialProviderSuccess<T> | CommercialProviderFailure;

export type CommercialAccessProvider = {
  readonly providerId: CommercialProviderId;
  readonly displayName: string;
  readonly activationState: CommercialProviderActivationState;
  readonly capabilities: readonly AccessProviderCapability[];
  readonly health: () => CommercialProviderHealth;
  readonly search?: (request: AccessProviderSearchRequest) => CommercialProviderOutcome<AccessProviderSearchResult>;
  readonly getAvailability?: (
    request: AccessProviderAvailabilityRequest,
  ) => CommercialProviderOutcome<AccessProviderAvailability>;
  readonly quote?: (request: AccessProviderQuoteRequest) => CommercialProviderOutcome<AccessProviderQuote>;
  readonly reserve?: (
    request: AccessProviderReservationRequest,
  ) => CommercialProviderOutcome<AccessProviderReservation>;
  readonly releaseReservation?: (input: {
    readonly providerReservationId: string;
    readonly idempotencyKey: string;
  }) => CommercialProviderOutcome<{ readonly released: boolean }>;
  readonly getReservationStatus?: (input: {
    readonly providerReservationId: string;
  }) => CommercialProviderOutcome<AccessProviderReservation>;
  readonly book?: (request: AccessProviderBookingRequest) => CommercialProviderOutcome<AccessProviderBooking>;
  readonly cancelBooking?: (
    request: AccessProviderCancellationRequest,
  ) => CommercialProviderOutcome<AccessProviderCancellation>;
  readonly refund?: (request: AccessProviderRefundRequest) => CommercialProviderOutcome<AccessProviderRefund>;
  readonly reconcile?: (
    request: AccessProviderReconcileRequest,
  ) => CommercialProviderOutcome<AccessProviderReconcileResult>;
  readonly getBookingStatus?: (input: {
    readonly providerBookingId: string;
  }) => CommercialProviderOutcome<AccessProviderBooking>;
};
