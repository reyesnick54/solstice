import type { AccessCategory, AccessActivityKind, AccessEntitlementStatus, AccessExperienceStatus, AccessIntentStatus, AccessReservationStatus } from './taxonomy.ts';

export type AccessMoneyQuote = {
  readonly currency: string;
  readonly minorUnits: string;
  readonly source: 'SIMULATION_FIXTURE';
};

export type AccessEntitlement = {
  readonly entitlementId: string;
  readonly customerId: string;
  readonly category: AccessCategory;
  readonly label: string;
  readonly status: AccessEntitlementStatus;
  readonly scope: string;
  readonly validFrom: string;
  readonly validUntil: string | null;
  readonly remainingUses: number | null;
  readonly simulationFixture: true;
};

export type AccessIntent = {
  readonly intentId: string;
  readonly customerId: string;
  readonly category: AccessCategory;
  readonly summary: string;
  readonly location: string | null;
  readonly status: AccessIntentStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
};

export type AccessQuote = {
  readonly quoteId: string;
  readonly customerId: string;
  readonly intentId: string | null;
  readonly category: AccessCategory;
  readonly summary: string;
  readonly pricing: AccessMoneyQuote | null;
  readonly capacityKnown: false;
  readonly expiresAt: string;
  readonly simulationFixture: true;
};

export type AccessReservation = {
  readonly reservationId: string;
  readonly customerId: string;
  readonly quoteId: string | null;
  readonly category: AccessCategory;
  readonly summary: string;
  readonly location: string | null;
  readonly status: AccessReservationStatus;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly pricing: AccessMoneyQuote | null;
  readonly createdAt: string;
};

export type AccessExperience = {
  readonly experienceId: string;
  readonly customerId: string;
  readonly category: AccessCategory;
  readonly title: string;
  readonly destination: string;
  readonly durationDays: number;
  readonly status: AccessExperienceStatus;
  readonly pricing: AccessMoneyQuote | null;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly createdAt: string;
};

export type AccessRecommendation = {
  readonly recommendationId: string;
  readonly category: AccessCategory;
  readonly title: string;
  readonly summary: string;
  readonly eligible: boolean;
  readonly reason: string;
};

export type AccessActivityRecord = {
  readonly activityId: string;
  readonly customerId: string;
  readonly kind: AccessActivityKind;
  readonly summary: string;
  readonly referenceId: string | null;
  readonly occurredAt: string;
};

export type AccessAvailabilityCategory = {
  readonly category: AccessCategory;
  readonly state: import('./taxonomy.ts').AccessAvailabilityState;
  readonly reason: string;
  readonly capacityKnown: false;
  readonly earliestKnown: string | null;
};

export type AccessAvailabilityStatus = {
  readonly overallState: import('./taxonomy.ts').AccessAvailabilityState;
  readonly categories: readonly AccessAvailabilityCategory[];
};

export type AccessFailure = {
  readonly code:
    | 'SUBJECT_MISMATCH'
    | 'CAPABILITY_DENIED'
    | 'NOT_FOUND'
    | 'INVALID_CATEGORY'
    | 'INVALID_TRANSITION'
    | 'FEATURE_DISABLED'
    | 'QUOTE_EXPIRED'
    | 'PROVIDER_UNAVAILABLE'
    | 'REDEMPTION_BLOCKED';
  readonly message: string;
};

export type CreateAccessIntentInput = {
  readonly category: AccessCategory;
  readonly summary: string;
  readonly location?: string;
  readonly idempotencyKey: string;
};

export type CheckAccessAvailabilityInput = {
  readonly category: AccessCategory;
  readonly summary?: string;
  readonly location?: string;
  readonly intentId?: string;
};

export type CreateAccessQuoteInput = {
  readonly category: AccessCategory;
  readonly summary: string;
  readonly location?: string;
  readonly intentId?: string;
  readonly idempotencyKey: string;
};

export type CreateAccessReservationInput = {
  readonly quoteId: string;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly idempotencyKey: string;
};

export type QuoteAccessExperienceInput = {
  readonly destination: string;
  readonly durationDays: number;
  readonly title?: string;
  readonly idempotencyKey: string;
};

export type AccessProviderView = {
  readonly providerId: string;
  readonly displayName: string;
  readonly integrationState: string;
  readonly categories: readonly string[];
  readonly liveEnabled: boolean;
};

export type AccessProviderCatalogItemView = {
  readonly catalogItemId: string;
  readonly providerId: string;
  readonly title: string;
  readonly description: string;
  readonly location: string | null;
  readonly canonicalUnit: string;
  readonly rightKind: string;
};

export type AccessProviderQuoteView = {
  readonly quoteId: string;
  readonly providerId: string;
  readonly catalogItemId: string;
  readonly canonicalUnit: string;
  readonly quantity: number;
  readonly providerPriceMinorUnits: string;
  readonly currency: string;
  readonly expiresAt: string;
  readonly simulationOnly: true;
};

export type AccessRedemptionPreviewView = {
  readonly redemptionId: string;
  readonly status: string;
  readonly providerPriceMinorUnits: string;
  readonly coverageMinorUnits: string | null;
  readonly userContributionMinorUnits: string;
  readonly entitlementUnitsHeld: number;
  readonly explanation: readonly string[];
};

export type AccessRedemptionView = {
  readonly redemptionId: string;
  readonly status: string;
  readonly providerId: string;
  readonly providerQuoteId: string;
  readonly providerBookingId: string | null;
  readonly accessRightRef: string | null;
  readonly rightKind: string | null;
  readonly entitlementHoldState: string;
};

export type SearchAccessProvidersInput = {
  readonly query: string;
  readonly location?: string;
  readonly category: AccessCategory;
  readonly providerId?: string;
};

export type CreateProviderQuoteInput = {
  readonly providerId: string;
  readonly catalogItemId: string;
  readonly quantity: number;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly location?: string;
  readonly idempotencyKey: string;
};

export type PreviewAccessRedemptionInput = {
  readonly redemptionId?: string;
  readonly quoteId: string;
  readonly entitlementId: string;
  readonly entitlementClass: string;
  readonly requestedQuantity: number;
  readonly maxUserContributionMinorUnits?: string;
  readonly intentId?: string;
  readonly category: AccessCategory;
  readonly providerId: string;
  readonly idempotencyKey: string;
};

export type StartAccessRedemptionInput = PreviewAccessRedemptionInput;

export type ConfirmAccessRedemptionInput = {
  readonly userApproved?: boolean;
  readonly userFiatMinorUnits?: string;
};
