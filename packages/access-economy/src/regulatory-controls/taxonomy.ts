/**
 * ACCESS Wave 5 Prompt 40 — Regulatory, accounting, treasury, and disclosure taxonomy.
 *
 * Software architecture classifications only. Final legal, accounting, tax,
 * consumer-protection, and regulatory treatment requires qualified review.
 */

export const ACCESS_REGULATORY_CONTROLS_SCHEMA = 'sunrey.access.regulatory-controls.v1' as const;
export const ACCESS_REGULATORY_CONTROLS_CHUNK = 'ACCESS-40' as const;

/** Explicit economic classification for Access entitlements and allocations. */
export const ACCESS_ECONOMIC_CLASSIFICATIONS = [
  'NON_CASH_ACCESS_RIGHT',
] as const;
export type AccessEconomicClassification = (typeof ACCESS_ECONOMIC_CLASSIFICATIONS)[number];

/** What Access is explicitly NOT classified as. */
export const FORBIDDEN_ACCESS_ECONOMIC_CLASSIFICATIONS = [
  'BANK_DEPOSIT',
  'CASH_BALANCE',
  'STABLECOIN',
  'TOKEN_REDEMPTION',
  'GUARANTEED_FIAT_VALUE',
  'UNCONDITIONAL_PROVIDER_CLAIM',
] as const;
export type ForbiddenAccessEconomicClassification =
  (typeof FORBIDDEN_ACCESS_ECONOMIC_CLASSIFICATIONS)[number];

/** Configurable accounting-event classifications for accountant review. */
export const ACCESS_ACCOUNTING_EVENT_TYPES = [
  'ACCESS_ALLOCATION_CREATED',
  'ACCESS_FUNDING_RECEIVED',
  'ACCESS_FUNDING_RESERVED',
  'ACCESS_FUNDING_RELEASED',
  'ACCESS_PROVIDER_PAYMENT_AUTHORIZED',
  'ACCESS_PROVIDER_PAYMENT_CAPTURED',
  'ACCESS_USER_COPAY_AUTHORIZED',
  'ACCESS_USER_COPAY_CAPTURED',
  'ACCESS_PROVIDER_REFUND_RECEIVED',
  'ACCESS_USER_REFUND_ISSUED',
  'ACCESS_ENTITLEMENT_EXPIRED',
  'ACCESS_ENTITLEMENT_RESTORED',
] as const;
export type AccessAccountingEventType = (typeof ACCESS_ACCOUNTING_EVENT_TYPES)[number];

/** Conceptual liability recognition stages — not GAAP/IFRS conclusions. */
export const ACCESS_LIABILITY_RECOGNITION_STAGES = [
  'ALLOCATION_CREATED',
  'FUNDING_RESERVATION_CREATED',
  'PROVIDER_PAYMENT_AUTHORIZED',
  'PROVIDER_PAYMENT_CAPTURED',
  'REFUND_PENDING',
] as const;
export type AccessLiabilityRecognitionStage =
  (typeof ACCESS_LIABILITY_RECOGNITION_STAGES)[number];

/** Conceptual GL account roles — accountants assign real COA numbers. */
export const ACCESS_GL_ACCOUNT_ROLES = [
  'ACCESS_PROGRAM_CASH',
  'ACCESS_SETTLEMENT_PAYABLE',
  'USER_COPAY_CLEARING',
  'PROVIDER_SETTLEMENT_CLEARING',
  'REFUND_RECEIVABLE',
  'ACCESS_PROMOTIONAL_EXPENSE',
  'PROVIDER_DISCOUNT_BENEFIT',
  'SPONSOR_FUNDING',
  'EMPLOYER_PROGRAM_FUNDING',
  'GOVERNMENT_PROGRAM_FUNDING',
  'SUBSCRIPTION_PROGRAM_FUNDING',
  'ACCESS_SERVICE_FEE_REVENUE',
] as const;
export type AccessGlAccountRole = (typeof ACCESS_GL_ACCOUNT_ROLES)[number];

/** Funding source classification for treasury and solvency controls. */
export const ACCESS_FUNDING_SOURCE_CLASSIFICATIONS = [
  'CASH_FUNDED',
  'DISCOUNT_CAPACITY',
  'PROVIDER_CONTRIBUTED_CAPACITY',
  'SPONSOR_FUNDED',
  'EMPLOYER_FUNDED',
  'GOVERNMENT_FUNDED',
  'PROMOTIONAL_BUDGET',
] as const;
export type AccessFundingSourceClassification =
  (typeof ACCESS_FUNDING_SOURCE_CLASSIFICATIONS)[number];

/** Treasury operational kill-switch states. */
export const ACCESS_TREASURY_OPERATIONAL_STATES = [
  'NORMAL',
  'LIMITED',
  'NEW_REDEMPTIONS_PAUSED',
  'SETTLEMENTS_RESTRICTED',
  'EMERGENCY_RECONCILIATION_ONLY',
] as const;
export type AccessTreasuryOperationalState =
  (typeof ACCESS_TREASURY_OPERATIONAL_STATES)[number];

/** Treasury exposure status derived from policy evaluation. */
export const ACCESS_TREASURY_EXPOSURE_STATUSES = [
  'WITHIN_LIMITS',
  'APPROACHING_LIMIT',
  'LIMIT_BREACHED',
  'PAUSED',
] as const;
export type AccessTreasuryExposureStatus =
  (typeof ACCESS_TREASURY_EXPOSURE_STATUSES)[number];

/** Consumer disclosure types. */
export const ACCESS_DISCLOSURE_TYPES = [
  'ACCESS_NON_CASH_RIGHT',
  'CAPACITY_LIMITATION',
  'FUNDING_AVAILABILITY',
  'PROVIDER_TERMS',
  'QUOTE_EXPIRATION',
  'SECURITY_DEPOSIT',
  'INCIDENTALS',
  'CANCELLATION_POLICY',
  'REFUND_POLICY',
  'ACCESS_EXPIRATION',
  'PROVIDER_AVAILABILITY',
  'USER_COPAY',
  'NO_TOKEN_REDEMPTION',
  'SERVICE_PROVIDER_RELATIONSHIP',
  'PRICE_COMPONENTS',
  'ACCESS_SERVICE_FEE',
] as const;
export type AccessDisclosureType = (typeof ACCESS_DISCLOSURE_TYPES)[number];

export const ACCESS_DISCLOSURE_STATUSES = ['DRAFT', 'ACTIVE', 'RETIRED'] as const;
export type AccessDisclosureStatus = (typeof ACCESS_DISCLOSURE_STATUSES)[number];

/** Transparent refund lifecycle states — never conflate pending with completed. */
export const ACCESS_REFUND_STATES = [
  'PROVIDER_REFUND_PENDING',
  'PROVIDER_REFUND_RECEIVED',
  'USER_REFUND_PENDING',
  'USER_REFUNDED',
  'ACCESS_POOL_RESTORED',
  'ENTITLEMENT_RESTORED',
] as const;
export type AccessRefundState = (typeof ACCESS_REFUND_STATES)[number];

/** Dispute categories — do not conflate. */
export const ACCESS_DISPUTE_CATEGORIES = [
  'PROVIDER_DISPUTE',
  'PAYMENT_DISPUTE',
  'ACCESS_ENTITLEMENT_DISPUTE',
  'REFUND_DISPUTE',
] as const;
export type AccessDisputeCategory = (typeof ACCESS_DISPUTE_CATEGORIES)[number];

/** Provider contract states for production fulfillment gate. */
export const ACCESS_PROVIDER_CONTRACT_STATES = [
  'SANDBOX',
  'DISCOVERY_ONLY',
  'SIGNED',
  'APPROVED_FOR_PRODUCTION',
  'TERMINATED',
  'BLOCKED',
] as const;
export type AccessProviderContractState =
  (typeof ACCESS_PROVIDER_CONTRACT_STATES)[number];

/** Payment provider readiness for production settlement. */
export const ACCESS_PAYMENT_PROVIDER_STATES = [
  'SANDBOX_ONLY',
  'CREDENTIALS_REQUIRED',
  'COMPLIANCE_REVIEW',
  'APPROVED_FOR_PRODUCTION',
  'DISABLED',
] as const;
export type AccessPaymentProviderState =
  (typeof ACCESS_PAYMENT_PROVIDER_STATES)[number];

/** Jurisdiction policy dimensions — configurable, not legal conclusions. */
export const ACCESS_JURISDICTION_POLICY_DIMENSIONS = [
  'COUNTRY',
  'STATE_PROVINCE',
  'CATEGORY',
  'PAYMENT_RAIL',
  'PROVIDER',
  'PROGRAM',
  'USER_ELIGIBILITY',
] as const;
export type AccessJurisdictionPolicyDimension =
  (typeof ACCESS_JURISDICTION_POLICY_DIMENSIONS)[number];

/** Subscription funding boundary classification — not stored value. */
export const ACCESS_PROGRAM_FUNDING_CLASSIFICATIONS = [
  'PROGRAM_FUNDING_REVENUE',
  'NOT_BANK_DEPOSIT',
  'NOT_STORED_VALUE',
] as const;
export type AccessProgramFundingClassification =
  (typeof ACCESS_PROGRAM_FUNDING_CLASSIFICATIONS)[number];

/** Tax data boundary roles — provider-supplied values preserved. */
export const ACCESS_TAX_COMPONENT_ROLES = [
  'PROVIDER_COLLECTED_TAX',
  'SUNREY_FEE',
  'USER_FEE',
  'ACCESS_SUBSIDY',
] as const;
export type AccessTaxComponentRole = (typeof ACCESS_TAX_COMPONENT_ROLES)[number];
