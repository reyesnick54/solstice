export const ACCESS_BOUND_KINDS = Object.freeze([
  'TIME',
  'QUANTITY',
  'LOCATION',
  'USAGE',
] as const);

export type AccessBoundKind = (typeof ACCESS_BOUND_KINDS)[number];

export const ACCESS_RIGHT_STATES = Object.freeze([
  'DRAFT',
  'PROPOSED',
  'POLICY_PENDING',
  'AUTHORIZED',
  'RESERVED',
  'ACTIVE',
  'FULFILLED',
  'EXPIRED',
  'REVOKED',
  'REFUSED',
] as const);

export type AccessRightState = (typeof ACCESS_RIGHT_STATES)[number];

export const ACCESS_INTENT_KINDS = Object.freeze([
  'REQUEST',
  'RENEW',
  'EXTEND',
  'SURRENDER',
  'TRANSFER_PROPOSAL',
] as const);

export type AccessIntentKind = (typeof ACCESS_INTENT_KINDS)[number];

export const ACCESS_CAPACITY_CATEGORIES = Object.freeze([
  'VEHICLE_HOURS',
  'HOUSING_ROOM_NIGHTS',
  'TRANSPORTATION',
  'TRAVEL',
  'FOOD',
  'ENERGY',
  'COMPUTE',
  'ROBOTICS',
  'MANUFACTURING',
  'GOODS',
  'SERVICES',
  'EXPERIENCES',
] as const);

export type AccessCapacityCategory = (typeof ACCESS_CAPACITY_CATEGORIES)[number];

export const FORBIDDEN_ACCESS_SCORE_FIELDS = Object.freeze([
  'humanWorthScore',
  'socialCreditScore',
  'accessCoinBalance',
  'blendedReturn',
  'apy',
  'apr',
  'yieldRate',
  'growthRate',
  'creditworthinessScore',
] as const);

export const FORBIDDEN_ACCESS_TOKEN_FIELDS = Object.freeze([
  'accessCoin',
  'accessToken',
  'accessCurrency',
  'fixedPeg',
  'sunreyMoonreyPeg',
] as const);

export function isAccessBoundKind(value: string): value is AccessBoundKind {
  return (ACCESS_BOUND_KINDS as readonly string[]).includes(value);
}

export function isAccessRightState(value: string): value is AccessRightState {
  return (ACCESS_RIGHT_STATES as readonly string[]).includes(value);
}

export function isAccessIntentKind(value: string): value is AccessIntentKind {
  return (ACCESS_INTENT_KINDS as readonly string[]).includes(value);
}

export function isAccessCapacityCategory(value: string): value is AccessCapacityCategory {
  return (ACCESS_CAPACITY_CATEGORIES as readonly string[]).includes(value);
}
