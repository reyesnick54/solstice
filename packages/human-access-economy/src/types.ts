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
    | 'QUOTE_EXPIRED';
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
