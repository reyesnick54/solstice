export const RECURRING_FREQUENCIES = [
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'YEARLY',
  'VARIABLE',
] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const SUBSCRIPTION_CATEGORIES = [
  'STREAMING',
  'SOFTWARE',
  'TELECOMMUNICATIONS',
  'INSURANCE',
  'UTILITIES',
  'MEMBERSHIPS',
  'FITNESS',
  'MEDIA',
  'CLOUD_SERVICES',
  'FINANCIAL_SERVICES',
  'OTHER_RECURRING',
] as const;
export type SubscriptionCategory = (typeof SUBSCRIPTION_CATEGORIES)[number];

export const OBLIGATION_STATUSES = [
  'ACTIVE',
  'POTENTIAL',
  'CANCELLED',
  'PAUSED',
  'UNKNOWN',
] as const;
export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number];

export const CONFIDENCE_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const SAVINGS_OPPORTUNITY_TYPES = [
  'CANCEL_UNUSED',
  'DOWNGRADE_PLAN',
  'RENEGOTIATE_BILL',
  'SWITCH_PROVIDER',
  'REVIEW_DUPLICATE',
  'REVIEW_PRICE_INCREASE',
  'KEEP',
] as const;
export type SavingsOpportunityType = (typeof SAVINGS_OPPORTUNITY_TYPES)[number];

export const ACTION_TYPES = ['CANCEL', 'DOWNGRADE', 'RENEGOTIATE', 'SWITCH_PROVIDER', 'REVIEW', 'KEEP'] as const;
export type SubscriptionActionType = (typeof ACTION_TYPES)[number];

export const ACTION_CAPABILITY_LEVELS = [
  'ADVISORY_ONLY',
  'ACTION_SUPPORTED',
  'PROVIDER_REQUIRED',
  'MANUAL_USER_ACTION',
] as const;
export type ActionCapabilityLevel = (typeof ACTION_CAPABILITY_LEVELS)[number];

export const ACTION_LIFECYCLE_STATES = [
  'PROPOSED',
  'USER_REVIEW',
  'AUTHORIZED',
  'EXECUTING',
  'CONFIRMED',
  'FAILED',
] as const;
export type ActionLifecycleState = (typeof ACTION_LIFECYCLE_STATES)[number];

export const SAVINGS_KINDS = ['ESTIMATED', 'EXPECTED', 'VERIFIED'] as const;
export type SavingsKind = (typeof SAVINGS_KINDS)[number];

export const DUPLICATION_KINDS = ['POTENTIAL_DUPLICATION'] as const;
export type DuplicationKind = (typeof DUPLICATION_KINDS)[number];

export const SUBSCRIPTION_AUDIT_EVENTS = [
  'recurring_detected',
  'subscription_classified',
  'price_change_detected',
  'savings_opportunity_created',
  'action_proposed',
  'action_authorized',
  'action_started',
  'action_completed',
  'action_failed',
  'savings_verified',
] as const;
export type SubscriptionAuditEventKind = (typeof SUBSCRIPTION_AUDIT_EVENTS)[number];

export const DISCRETIONARY_MERCHANT_PATTERNS = [
  /\b(shell|chevron|bp|exxon|mobil|gas)\b/i,
  /\b(walmart|target|costco|kroger|safeway|whole foods|trader joe)\b/i,
  /\b(starbucks|mcdonald|chipotle|uber eats|doordash|grubhub)\b/i,
  /\b(amazon(?! web services| aws| prime video))\b/i,
  /\b(uber(?! eats)?|lyft)\b/i,
  /\b(delta|united|american air|southwest|airbnb|booking\.com)\b/i,
] as const;

export const UTILITY_MERCHANT_PATTERNS = [
  /\b(electric|power|energy|utility|water|gas co|pg&e|con edison)\b/i,
] as const;
