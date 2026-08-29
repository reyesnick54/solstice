/**
 * ACCESS-14 — SunRey Access Provider Network canonical types.
 *
 * Provider-neutral discovery, availability, quote, reservation, booking,
 * fulfillment, and webhook vocabulary. External provider models must not
 * leak beyond adapter boundaries.
 */

import type { AccessCapacityCategory } from '../taxonomy.ts';

export const PROVIDER_CAPABILITY_IDS = [
  'CATALOG_SEARCH',
  'AVAILABILITY',
  'REALTIME_PRICING',
  'QUOTE',
  'RESERVE',
  'BOOK',
  'CANCEL',
  'MODIFY',
  'FULFILLMENT_STATUS',
  'WEBHOOKS',
  'REFUND',
  'PAYOUT',
  'IDENTITY_HANDOFF',
  'PAYMENT_HANDOFF',
] as const;
export type ProviderCapabilityId = (typeof PROVIDER_CAPABILITY_IDS)[number];

export const PROVIDER_INTEGRATION_STATES = [
  'SIMULATED',
  'DOCUMENTED_NOT_CONNECTED',
  'PARTNER_APPROVAL_REQUIRED',
  'CREDENTIALS_REQUIRED',
  'SANDBOX_AVAILABLE',
  'PRODUCTION_REVIEW_REQUIRED',
  'LIVE_DISABLED',
  'LIVE_ENABLED',
] as const;
export type ProviderIntegrationState = (typeof PROVIDER_INTEGRATION_STATES)[number];

export const PROVIDER_IDS = [
  'expedia',
  'turo',
  'doordash',
  'amazon',
  'airbnb',
] as const;
export type AccessProviderId = (typeof PROVIDER_IDS)[number];

export const CANONICAL_CAPACITY_UNITS = [
  'VEHICLE_DAY',
  'VEHICLE_HOUR',
  'ROOM_NIGHT',
  'OCCUPANCY_NIGHT',
  'PASSENGER_SEGMENT',
  'SEAT_DISTANCE',
  'FOOD_DELIVERY',
  'MEAL',
  'GROCERY_DELIVERY',
  'DELIVERY_RIGHT',
  'OWNERSHIP_PURCHASE',
  'CONSUMPTION_RIGHT',
  'GPU_HOUR',
  'INFERENCE_UNIT',
  'ROBOT_HOUR',
  'AUTOMATED_SERVICE_UNIT',
  'KWH',
  'EXPERIENCE_SLOT',
  'ADMISSION_RIGHT',
] as const;
export type CanonicalCapacityUnit = (typeof CANONICAL_CAPACITY_UNITS)[number];

export const PROVIDER_RIGHT_KINDS = [
  'ACCESS_RIGHT',
  'RESERVATION_RIGHT',
  'DELIVERY_RIGHT',
  'OWNERSHIP_PURCHASE',
  'OCCUPANCY_RIGHT',
] as const;
export type ProviderRightKind = (typeof PROVIDER_RIGHT_KINDS)[number];

export type ProviderCapability = {
  readonly capabilityId: ProviderCapabilityId;
  readonly supported: boolean;
  readonly integrationState: ProviderIntegrationState;
  readonly notes: string | null;
};

export type ProviderSettlementTerms = {
  readonly currency: string;
  readonly settlementRail: 'FIAT_PAYMENTS' | 'CUSTODY_SUNREY' | 'CUSTODY_MOONREY' | 'REWARD_CREDIT';
  readonly providerReceivesMinorUnits: bigint;
  readonly simulationOnly: true;
};

export type ProviderEvidenceReference = {
  readonly evidenceId: string;
  readonly kind: 'SIMULATION' | 'PROVIDER_RECEIPT' | 'FULFILLMENT_PROOF';
  readonly providerEventId: string | null;
};

export type ProviderCatalogItem = {
  readonly catalogItemId: string;
  readonly providerId: AccessProviderId;
  readonly category: AccessCapacityCategory;
  readonly canonicalUnit: CanonicalCapacityUnit;
  readonly title: string;
  readonly description: string;
  readonly location: string | null;
  readonly serviceClass: string | null;
  readonly rightKind: ProviderRightKind;
};

export type ProviderAvailabilityRequest = {
  readonly requestId: string;
  readonly providerId: AccessProviderId;
  readonly catalogItemId: string;
  readonly quantity: bigint;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly location: string | null;
};

export type ProviderAvailabilityResult = {
  readonly requestId: string;
  readonly providerId: AccessProviderId;
  readonly available: boolean;
  readonly availableQuantity: bigint;
  readonly earliestStart: string | null;
  readonly reason: string;
  readonly simulationOnly: true;
};

export type ProviderQuoteRequest = {
  readonly requestId: string;
  readonly providerId: AccessProviderId;
  readonly catalogItemId: string;
  readonly quantity: bigint;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly location: string | null;
  readonly idempotencyKey: string;
};

export type ProviderQuote = {
  readonly quoteId: string;
  readonly providerId: AccessProviderId;
  readonly catalogItemId: string;
  readonly canonicalUnit: CanonicalCapacityUnit;
  readonly quantity: bigint;
  readonly providerPriceMinorUnits: bigint;
  readonly currency: string;
  readonly expiresAt: string;
  readonly settlementTerms: ProviderSettlementTerms;
  readonly simulationOnly: true;
};

export type ProviderReservationRequest = {
  readonly requestId: string;
  readonly providerId: AccessProviderId;
  readonly quoteId: string;
  readonly subjectRef: string;
  readonly idempotencyKey: string;
};

export type ProviderReservation = {
  readonly reservationId: string;
  readonly providerId: AccessProviderId;
  readonly quoteId: string;
  readonly state: 'HELD' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
  readonly expiresAt: string;
  readonly simulationOnly: true;
};

export type ProviderBookingRequest = {
  readonly requestId: string;
  readonly providerId: AccessProviderId;
  readonly reservationId: string;
  readonly subjectRef: string;
  readonly idempotencyKey: string;
};

export type ProviderBooking = {
  readonly bookingId: string;
  readonly providerId: AccessProviderId;
  readonly reservationId: string;
  readonly state: 'CONFIRMED' | 'CANCELLED' | 'FAILED';
  readonly rightKind: ProviderRightKind;
  readonly accessRightRef: string | null;
  readonly simulationOnly: true;
};

export type ProviderCancellationRequest = {
  readonly requestId: string;
  readonly providerId: AccessProviderId;
  readonly bookingId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
};

export type ProviderCancellation = {
  readonly cancellationId: string;
  readonly providerId: AccessProviderId;
  readonly bookingId: string;
  readonly state: 'CANCELLED' | 'REFUND_PENDING' | 'FAILED';
  readonly simulationOnly: true;
};

export const CANONICAL_FULFILLMENT_EVENTS = [
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'BOOKING_MODIFIED',
  'SERVICE_STARTED',
  'CHECK_IN',
  'CHECK_OUT',
  'ORDER_PREPARING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'VEHICLE_PICKUP',
  'VEHICLE_RETURN',
  'REFUND_INITIATED',
  'REFUND_COMPLETED',
  'PROVIDER_FAILURE',
] as const;
export type CanonicalFulfillmentEventKind = (typeof CANONICAL_FULFILLMENT_EVENTS)[number];

export type ProviderFulfillmentEvent = {
  readonly eventId: string;
  readonly providerId: AccessProviderId;
  readonly bookingId: string;
  readonly kind: CanonicalFulfillmentEventKind;
  readonly occurredAt: string;
  readonly evidenceRef: ProviderEvidenceReference;
  readonly simulationOnly: true;
};

export type ProviderWebhookEvent = {
  readonly webhookEventId: string;
  readonly providerId: AccessProviderId;
  readonly providerEventId: string;
  readonly receivedAt: string;
  readonly providerTimestamp: string | null;
  readonly canonicalKind: CanonicalFulfillmentEventKind;
  readonly idempotencyKey: string;
  readonly signatureVerified: boolean;
  readonly simulationOnly: true;
  readonly evidenceRef: ProviderEvidenceReference;
};

export type ProviderHealth = {
  readonly providerId: AccessProviderId;
  readonly integrationState: ProviderIntegrationState;
  readonly healthy: boolean;
  readonly lastCheckedAt: string;
  readonly message: string;
};

export type ProviderSearchRequest = {
  readonly requestId: string;
  readonly category: AccessCapacityCategory;
  readonly query: string;
  readonly location: string | null;
  readonly limit: number;
};

export type ProviderSearchResult = {
  readonly requestId: string;
  readonly items: readonly ProviderCatalogItem[];
  readonly simulationOnly: true;
};

export type AccessProviderSuccess<T> = {
  readonly ok: true;
  readonly value: T;
};

export type AccessProviderFailure = {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
};

export type AccessProviderOutcome<T> = AccessProviderSuccess<T> | AccessProviderFailure;

export type AccessProvider = {
  readonly providerId: AccessProviderId;
  readonly displayName: string;
  readonly integrationState: ProviderIntegrationState;
  readonly capabilities: readonly ProviderCapability[];
  readonly health: () => ProviderHealth;
  readonly search: (request: ProviderSearchRequest) => AccessProviderOutcome<ProviderSearchResult>;
  readonly availability: (request: ProviderAvailabilityRequest) => AccessProviderOutcome<ProviderAvailabilityResult>;
  readonly quote: (request: ProviderQuoteRequest) => AccessProviderOutcome<ProviderQuote>;
  readonly reserve: (request: ProviderReservationRequest) => AccessProviderOutcome<ProviderReservation>;
  readonly book: (request: ProviderBookingRequest) => AccessProviderOutcome<ProviderBooking>;
  readonly cancel: (request: ProviderCancellationRequest) => AccessProviderOutcome<ProviderCancellation>;
};
