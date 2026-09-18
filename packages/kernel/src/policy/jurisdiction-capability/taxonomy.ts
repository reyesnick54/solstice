/**
 * HELIOS H28 — Eleven-jurisdiction capability framework vocabulary.
 *
 * Engineering taxonomy only. Capability states do not claim legal permission.
 * Jurisdiction pack != license. Provider connectivity != regulatory permission.
 */

/** Canonical H28 jurisdiction identifiers (11 requested jurisdictions). */
export const HELIOS_JURISDICTION_IDS = [
  'EU',
  'GB',
  'US',
  'SA',
  'IN',
  'CN',
  'JP',
  'SG',
  'KR',
  'MY',
  'AU',
] as const;

export type HeliosJurisdictionId = (typeof HELIOS_JURISDICTION_IDS)[number];

/** Explicit regulatory capability states — fail closed by default. */
export const JURISDICTION_CAPABILITY_STATES = [
  'UNMAPPED',
  'RESEARCH_REQUIRED',
  'LEGAL_REVIEW_REQUIRED',
  'DISABLED',
  'RESTRICTED',
  'SANDBOX_ONLY',
  'PARTNER_DEPENDENT',
  'APPROVED_FOR_TEST',
  'APPROVED_FOR_PRODUCTION',
  'SUSPENDED',
  'REVOKED',
] as const;

export type JurisdictionCapabilityState = (typeof JURISDICTION_CAPABILITY_STATES)[number];

/** Deterministic query outcomes. UNKNOWN must never be interpreted as ALLOWED. */
export const CAPABILITY_QUERY_OUTCOMES = [
  'ALLOWED',
  'DENIED',
  'RESTRICTED',
  'REVIEW_REQUIRED',
  'UNKNOWN',
] as const;

export type CapabilityQueryOutcome = (typeof CAPABILITY_QUERY_OUTCOMES)[number];

/** Provider regulatory dependency — contract presence does not imply legal capability. */
export const PROVIDER_DEPENDENCY_STATES = [
  'OWN_LICENSE',
  'PARTNER_DEPENDENT',
  'UNSUPPORTED',
  'UNKNOWN',
] as const;

export type ProviderDependencyState = (typeof PROVIDER_DEPENDENCY_STATES)[number];

/** Jurisdiction pack capability categories. */
export const CAPABILITY_CATEGORIES = [
  'IDENTITY_CUSTOMER',
  'PRODUCT',
  'MARKET_ACCESS',
  'DATA',
  'ALGORITHM_AI',
  'RECORDKEEPING_REPORTING',
] as const;

export type CapabilityCategory = (typeof CAPABILITY_CATEGORIES)[number];

/** Product / action capability identifiers used in queries. */
export const CAPABILITY_ACTIONS = [
  'CASH_ACCOUNT',
  'INVESTING',
  'DIGITAL_ASSETS',
  'FINANCIAL_ADVICE',
  'AUTOMATED_ACTIVITY',
  'TRANSFERS_PAYMENTS',
  'HELIOS_RESEARCH',
  'HELIOS_PROPOSAL',
  'HELIOS_STRATEGY_ACTIVATION',
  'HELIOS_WORK_ORDER_ACTIVATION',
  'PROVIDER_PROVISIONING',
  'ORDER_SUBMISSION',
  'WITHDRAWAL',
  'DATA_MODEL_USE',
] as const;

export type CapabilityAction = (typeof CAPABILITY_ACTIONS)[number];

export const JURISDICTION_CAPABILITY_SCHEMA_VERSION = '1.0.0' as const;
export const JURISDICTION_CAPABILITY_POLICY_VERSION = 'h28-v1' as const;

export const EU_MEMBER_STATE_CODES = Object.freeze([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
] as const);

export const US_STATE_OVERLAY_PREFIX = 'US-' as const;

export function isHeliosJurisdictionId(value: unknown): value is HeliosJurisdictionId {
  return typeof value === 'string' && (HELIOS_JURISDICTION_IDS as readonly string[]).includes(value);
}

export function isJurisdictionCapabilityState(value: unknown): value is JurisdictionCapabilityState {
  return typeof value === 'string' && (JURISDICTION_CAPABILITY_STATES as readonly string[]).includes(value);
}

export function isCapabilityQueryOutcome(value: unknown): value is CapabilityQueryOutcome {
  return typeof value === 'string' && (CAPABILITY_QUERY_OUTCOMES as readonly string[]).includes(value);
}
