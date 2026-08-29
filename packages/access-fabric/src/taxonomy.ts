/**
 * SunRey Access Fabric — entitlement provenance and access vocabulary.
 *
 * Provenance labels classify where an entitlement originated. They are not
 * assumptions that any particular government or society provides them.
 */

export const ACCESS_ENTITLEMENT_SOURCES = [
  'BASELINE',
  'PUBLIC_BENEFIT',
  'EMPLOYER',
  'COMMUNITY',
  'PURCHASED',
  'REWARD',
  'MEMBERSHIP',
  'PROMOTION',
  'ROLLOVER',
] as const;
export type AccessEntitlementSource = (typeof ACCESS_ENTITLEMENT_SOURCES)[number];

export const REPLENISHMENT_POLICIES = [
  'NONE',
  'FIXED_WINDOW',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
] as const;
export type ReplenishmentPolicyKind = (typeof REPLENISHMENT_POLICIES)[number];

export const ACCESS_RESTRICTION_KINDS = [
  'TIME_WINDOW',
  'VENUE',
  'MODALITY',
  'COMPANION_REQUIRED',
  'ADVANCE_NOTICE',
  'CUSTOM',
] as const;
export type AccessRestrictionKind = (typeof ACCESS_RESTRICTION_KINDS)[number];

export const ACCESS_ENTITLEMENT_FAILURE_CODES = [
  'HUMAN_WORTH_SCORE_FORBIDDEN',
  'FORBIDDEN_SCORE_FIELD',
  'SENSITIVE_DATA_DEPENDENCE_FORBIDDEN',
  'RAW_PDV_CONTENT_FORBIDDEN',
  'MONETARY_ASSET_FORBIDDEN',
  'TRANSFERABLE_BALANCE_FORBIDDEN',
  'ENTITLEMENT_EXPIRED',
  'ENTITLEMENT_NOT_STARTED',
  'JURISDICTION_DENIED',
  'POLICY_INELIGIBLE',
  'MANDATE_NARROWED',
  'CAPACITY_EXHAUSTED',
  'TRANSFER_FORBIDDEN',
  'DUPLICATE_USAGE_EVENT',
  'INVALID_INPUT',
] as const;
export type AccessEntitlementFailureCode = (typeof ACCESS_ENTITLEMENT_FAILURE_CODES)[number];

export const FORBIDDEN_SCORE_FIELDS = [
  'humanWorthScore',
  'humanWorth',
  'socialCreditScore',
  'desirabilityScore',
  'reputationScore',
  'creditScore',
  'worthinessScore',
  'accessWorthScore',
  'eligibilityScore',
] as const;

export const FORBIDDEN_SENSITIVE_DEPENDENCIES = [
  'rawPdvContent',
  'rawPdv',
  'raw_pdv',
  'creditBureauRaw',
  'creditReportRaw',
  'socialGraphRaw',
  'protectedTraitRanking',
] as const;

export const ACCESS_FABRIC_INVARIANTS = Object.freeze({
  humanWorthScore: false as const,
  isMonetaryAsset: false as const,
  isTransferableBalance: false as const,
  defaultTransferability: false as const,
});
