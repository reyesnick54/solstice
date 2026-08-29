export const ACCESS_CATEGORIES = [
  'VEHICLE_RENTAL',
  'TRAVEL_EXPERIENCE',
  'LODGING',
  'RECURRING_FOOD_ACCESS',
  'EXPERIENCE_COMPOSITION',
  'OTHER_ACCESS',
] as const;

export type AccessCategory = (typeof ACCESS_CATEGORIES)[number];

export const ACCESS_INTENT_KINDS = ['ONE_TIME', 'RECURRING', 'EXPERIENCE_COMPOSITION'] as const;

export type AccessIntentKind = (typeof ACCESS_INTENT_KINDS)[number];

export const ACCESS_EXPERIENCE_LEVELS = ['ATOMIC', 'COMPOSITE'] as const;

export type AccessExperienceLevel = (typeof ACCESS_EXPERIENCE_LEVELS)[number];

export const ACCESS_CONSTRAINT_KINDS = [
  'SPENDING_LIMIT',
  'ACCESS_ONLY',
  'NO_AUTO_PURCHASE',
  'MANDATE_BOUND',
] as const;

export type AccessConstraintKind = (typeof ACCESS_CONSTRAINT_KINDS)[number];

export const ACCESS_RECURRENCE = ['WEEKLY', 'MONTHLY', 'CUSTOM'] as const;

export type AccessRecurrence = (typeof ACCESS_RECURRENCE)[number];

export const ACCESS_DURATION_UNITS = ['DAY', 'WEEK', 'MONTH'] as const;

export type AccessDurationUnit = (typeof ACCESS_DURATION_UNITS)[number];

export const AUTHORIZED_GRAPH_CATEGORIES = [
  'GOAL',
  'PREFERENCE',
  'INSIGHT',
  'CASH_FLOW',
  'RISK_PROFILE',
] as const;

export type AuthorizedGraphCategory = (typeof AUTHORIZED_GRAPH_CATEGORIES)[number];

export function isAccessCategory(value: unknown): value is AccessCategory {
  return typeof value === 'string' && (ACCESS_CATEGORIES as readonly string[]).includes(value);
}

export function isAccessIntentKind(value: unknown): value is AccessIntentKind {
  return typeof value === 'string' && (ACCESS_INTENT_KINDS as readonly string[]).includes(value);
}

export function isAuthorizedGraphCategory(value: unknown): value is AuthorizedGraphCategory {
  return typeof value === 'string' && (AUTHORIZED_GRAPH_CATEGORIES as readonly string[]).includes(value);
}
