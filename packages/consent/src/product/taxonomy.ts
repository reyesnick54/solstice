/**
 * Product-facing consent vocabularies.
 *
 * Legal-status values remain engineering hooks. This catalog does not
 * claim GDPR/CCPA/PDPL compliance and never marks a rule
 * CONFIRMED_BY_COUNSEL.
 */

export const PURPOSE_FAMILIES = [
  'CORE_SERVICE',
  'PERSONALIZATION',
  'FINANCIAL_ANALYSIS',
  'AGENT_ASSISTANCE',
  'RESEARCH',
  'ANALYTICS',
  'DATA_LICENSING',
  'HIN_PARTICIPATION',
  'MARKETING',
  'PRODUCT_IMPROVEMENT',
] as const;
export type PurposeFamily = (typeof PURPOSE_FAMILIES)[number];

export const NECESSITY_CLASSES = [
  'REQUIRED_FOR_CORE_SERVICE',
  'OPTIONAL',
  'OPTIONAL_COMPENSATED',
] as const;
export type NecessityClass = (typeof NECESSITY_CLASSES)[number];

export const ECONOMIC_USE_CLASSES = [
  'NONE',
  'PERSONALIZATION',
  'AGGREGATED_RESEARCH',
  'ECONOMIC_LICENSING',
] as const;
export type EconomicUseClass = (typeof ECONOMIC_USE_CLASSES)[number];

export const ACCESS_DECISION_OUTCOMES = ['ALLOW', 'DENY', 'REQUIRE_CONSENT', 'REQUIRE_REVIEW'] as const;
export type AccessDecisionOutcome = (typeof ACCESS_DECISION_OUTCOMES)[number];

export const ACCESS_ACTOR_KINDS = [
  'SUBJECT',
  'FIRST_PARTY_SERVICE',
  'AGENT',
  'DELEGATE',
  'LICENSEE',
] as const;
export type AccessActorKind = (typeof ACCESS_ACTOR_KINDS)[number];

export const RIGHTS_REQUEST_TYPES = [
  'ACCESS',
  'EXPORT',
  'CORRECTION',
  'DELETION',
  'RESTRICTION',
  'OBJECTION',
  'CONSENT_WITHDRAWAL',
] as const;
export type RightsRequestType = (typeof RIGHTS_REQUEST_TYPES)[number];

export const RIGHTS_REQUEST_STATES = [
  'SUBMITTED',
  'IDENTITY_VERIFICATION_REQUIRED',
  'IN_REVIEW',
  'APPROVED',
  'PARTIALLY_APPROVED',
  'DENIED',
  'PROCESSING',
  'COMPLETED',
] as const;
export type RightsRequestState = (typeof RIGHTS_REQUEST_STATES)[number];

export const HIN_PARTICIPATION_STATES = [
  'NOT_ENROLLED',
  'ENROLLED',
  'PAUSED',
  'WITHDRAWN',
  'RESTRICTED',
] as const;
export type HinParticipationState = (typeof HIN_PARTICIPATION_STATES)[number];

export const LICENSEE_CLASSES = [
  'FIRST_PARTY_SUNREY',
  'SUNREY_AGENT',
  'APPROVED_LICENSEE',
  'HIN_NETWORK',
  'DELEGATE',
] as const;
export type LicenseeClass = (typeof LICENSEE_CLASSES)[number];

export const DELEGATION_RELATIONSHIPS = ['FAMILY_MEMBER', 'BUSINESS_ADMINISTRATOR'] as const;
export type DelegationRelationship = (typeof DELEGATION_RELATIONSHIPS)[number];

export const PERMISSION_BUNDLE_IDS = [
  'AGENT_SPENDING_DATA',
  'PERSONALIZATION_PREFERENCES',
  'HIN_OPTIONAL_PARTICIPATION',
  'ECONOMIC_DATA_LICENSING',
  'AGGREGATED_RESEARCH',
] as const;
export type PermissionBundleId = (typeof PERMISSION_BUNDLE_IDS)[number];

export const CURRENT_DATA_TERMS_VERSION = 'sunrey.data-terms.v1' as const;

export const PRODUCT_CONSENT_STATUSES = [
  'ACTIVE',
  'REVOKED',
  'EXPIRED',
  'SUPERSEDED',
  'SUSPENDED',
] as const;
export type ProductConsentStatus = (typeof PRODUCT_CONSENT_STATUSES)[number];
