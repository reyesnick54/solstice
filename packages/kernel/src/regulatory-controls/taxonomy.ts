/**
 * Wave 7 — Jurisdiction and regulatory-control taxonomy.
 *
 * Engineering configuration dimensions only. Not legal conclusions.
 * All profiles carry legalStatus: RESEARCH_REQUIRED unless counsel approves.
 */

export const REGULATORY_CATEGORIES = [
  'BANKING',
  'INVESTMENT',
  'DIGITAL_ASSETS',
  'EXCHANGE',
  'MONEY_TRANSMISSION',
  'HEALTH_DATA',
  'CONSUMER_PRIVACY',
  'RESEARCH_DATA',
  'AI_AGENTS',
  'CROSS_BORDER_DATA',
] as const;
export type RegulatoryCategory = (typeof REGULATORY_CATEGORIES)[number];

export const RETENTION_CATEGORIES = [
  'TRANSACTION_RECORDS',
  'LEDGER_RECORDS',
  'EVIDENCE_VAULT',
  'RAW_PROVIDER_RESPONSES',
  'PERSONAL_DATA',
  'CONSENT_RECORDS',
  'USAGE_RECEIPTS',
  'LOGS',
  'TEMPORARY_CACHES',
] as const;
export type RetentionCategory = (typeof RETENTION_CATEGORIES)[number];

/** Categories that must never be destructively deleted by ordinary retention. */
export const IMMUTABLE_RETENTION_CATEGORIES: readonly RetentionCategory[] = Object.freeze([
  'LEDGER_RECORDS',
  'EVIDENCE_VAULT',
  'TRANSACTION_RECORDS',
]);

export const STORAGE_REGIONS = [
  'EU_WEST',
  'EU_CENTRAL',
  'US_EAST',
  'US_WEST',
  'UK_SOUTH',
  'ME_CENTRAL',
  'AP_SOUTHEAST',
  'PROCESSING_ONLY',
  'UNSPECIFIED',
] as const;
export type StorageRegion = (typeof STORAGE_REGIONS)[number];

export const PROVIDER_LICENSE_CAPABILITIES = [
  'QUERY',
  'PERSIST',
  'INTERNAL_COMPUTATION',
  'REDISTRIBUTE',
  'COMMERCIAL_USE',
  'NON_COMMERCIAL_USE',
] as const;
export type ProviderLicenseCapability = (typeof PROVIDER_LICENSE_CAPABILITIES)[number];

export const REGULATED_FEATURES = [
  'EXCHANGE',
  'INVESTMENT_AGENT_EXECUTION',
  'BANKING_TRANSFER',
  'CRYPTO_CONVERSION',
  'HEALTH_DATA_CONTRIBUTION',
  'HIN_SENSITIVE_CATEGORY',
  'CROSS_BORDER_TRANSFER',
  'AI_AGENT_FINANCIAL_AUTOMATION',
] as const;
export type RegulatedFeature = (typeof REGULATED_FEATURES)[number];

export const JURISDICTION_DIMENSIONS = [
  'USER',
  'ENTITY',
  'DATA_SOURCE',
  'DATA_STORAGE',
  'SERVICE',
  'TRANSACTION',
] as const;
export type JurisdictionDimension = (typeof JURISDICTION_DIMENSIONS)[number];

export const RESIDENCY_CONSTRAINT_MODES = [
  'ALLOWED_REGIONS',
  'PROHIBITED_REGIONS',
  'CROSS_BORDER_RESTRICTED',
  'PROCESSING_ONLY_NO_PERSIST',
] as const;
export type ResidencyConstraintMode = (typeof RESIDENCY_CONSTRAINT_MODES)[number];

export const COMPLIANCE_RECEIPT_KINDS = [
  'POLICY',
  'JURISDICTION',
  'IDENTITY_ASSURANCE',
  'RIGHTS',
  'CONSENT',
  'PROVIDER_LICENSE',
  'SERVICE_FEATURE_GATE',
  'RETENTION',
  'RESIDENCY',
  'LEGAL_HOLD',
  'DECISION',
] as const;
export type ComplianceReceiptKind = (typeof COMPLIANCE_RECEIPT_KINDS)[number];

export const REGULATORY_CONTROL_OUTCOMES = [
  'ALLOW',
  'DENY',
  'DEFER',
  'REQUIRE_MANUAL_REVIEW',
] as const;
export type RegulatoryControlOutcome = (typeof REGULATORY_CONTROL_OUTCOMES)[number];

export const LEGAL_REVIEW_STATUS = 'RESEARCH_REQUIRED' as const;
export type LegalReviewStatus = typeof LEGAL_REVIEW_STATUS;
