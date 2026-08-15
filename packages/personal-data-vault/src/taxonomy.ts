/**
 * Personal Data Vault vocabularies.
 *
 * Sensitivity values are internal engineering classifications.
 * They are not GDPR/CCPA/PDPL/HIPAA legal categories.
 *
 * DataAsset is not a financial asset. It carries no monetary balance.
 * Contribution eligibility is not authorization to sell, share, or tokenize.
 */

export const DATA_CATEGORIES = [
  'IDENTITY_ATTRIBUTE',
  'EXTERNAL_FINANCIAL_ACCOUNT_DATA',
  'PAYROLL_DATA',
  'TRANSACTION_DATA',
  'PURCHASE_HISTORY',
  'RECEIPT',
  'DOCUMENT',
  'USER_DECLARED_DATA',
  'DEVICE_ACTIVITY_SUMMARY',
  'COMMUNICATION_METADATA',
  'LOCATION_SUMMARY',
  'PREFERENCE_DATA',
  'DATA_CONTRIBUTION_CANDIDATE',
] as const;

export type DataCategory = (typeof DATA_CATEGORIES)[number];

export const SENSITIVITY_CLASSES = ['PERSONAL', 'SENSITIVE', 'HIGHLY_SENSITIVE', 'RESTRICTED'] as const;
export type SensitivityClass = (typeof SENSITIVITY_CLASSES)[number];

export const PROVENANCE_KINDS = [
  'USER_UPLOADED',
  'USER_DECLARED',
  'SOLSTICE_GENERATED',
  'EXTERNAL_CONNECTOR',
  'DERIVED',
  'IMPORTED_ARCHIVE',
] as const;
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

export const ASSET_LIFECYCLE_STATES = [
  'ACTIVE',
  'SUPERSEDED',
  'DELETION_REQUESTED',
  'DELETED',
  'RETAINED_BY_POLICY',
] as const;
export type AssetLifecycleState = (typeof ASSET_LIFECYCLE_STATES)[number];

export const VERSION_STATES = ['ACTIVE', 'SUPERSEDED', 'DELETED', 'TOMBSTONED'] as const;
export type VersionState = (typeof VERSION_STATES)[number];

export const CONTRIBUTION_MARKS = ['NOT_MARKED', 'ELIGIBLE_FOR_CONTRIBUTION_REVIEW'] as const;
export type ContributionMark = (typeof CONTRIBUTION_MARKS)[number];

export const VAULT_OPERATIONS = [
  'OPEN_VAULT',
  'INGEST',
  'READ_METADATA',
  'READ_PAYLOAD',
  'READ_MINIMIZED',
  'VERSION',
  'DERIVE',
  'EXPORT',
  'DELETE',
  'ROTATE_KEY',
  'MARK_CONTRIBUTION',
  'AGENT_READ',
  'THIRD_PARTY_USE',
  'OPERATOR_READ',
] as const;
export type VaultOperation = (typeof VAULT_OPERATIONS)[number];

export const ACCESS_DECISIONS = ['ALLOWED', 'DENIED'] as const;
export type AccessDecision = (typeof ACCESS_DECISIONS)[number];

export const DATA_USE_CLASSES = [
  'SUBJECT_SELF_ACCESS',
  'THIRD_PARTY',
  'INTERNAL_SYSTEM',
  'CONTRIBUTION',
  'AGENT_BROAD_READ',
  'OPERATOR_ACCESS',
] as const;
export type DataUseClass = (typeof DATA_USE_CLASSES)[number];

export const RETENTION_OUTCOMES = ['DELETE_ALLOWED', 'RETENTION_REQUIRED', 'REVIEW_REQUIRED'] as const;
export type RetentionOutcome = (typeof RETENTION_OUTCOMES)[number];

export const SUPPORTED_CONTENT_TYPES = ['application/json', 'text/plain'] as const;
export type SupportedContentType = (typeof SUPPORTED_CONTENT_TYPES)[number];

export const LEGAL_STATUSES = ['DRAFT', 'RESEARCH_REQUIRED', 'COUNSEL_REVIEWED', 'CONFIRMED_BY_COUNSEL'] as const;
export type LegalStatus = (typeof LEGAL_STATUSES)[number];

export const PDV_LEGAL_STATUS = Object.freeze({
  status: 'RESEARCH_REQUIRED' as const satisfies LegalStatus,
  counselConfirmed: false,
  gdprComplianceClaim: false,
  ccpaComplianceClaim: false,
  saudiPdplComplianceClaim: false,
  uaePdplComplianceClaim: false,
  hipaaComplianceClaim: false,
  legalOwnershipClaim: false,
  portabilityComplianceClaim: false,
  irreversibleErasureClaim: false,
  note: 'Technical privacy controls are not legal approval. Counsel has not confirmed any privacy-law mapping.',
});

export const PDV_LIMITS = Object.freeze({
  maxPayloadBytes: 262_144,
  maxSchemaDepth: 8,
  maxRecordCount: 500,
  maxIngestionsPerSubject: 200,
  maxExportAssets: 200,
});

export const EVIDENCE_KIND_PDV = 'PERSONAL_DATA_VAULT';

export const EXPORT_FORMAT = 'SolsticePersonalDataExportV1' as const;

export function isDataCategory(value: string): value is DataCategory {
  return (DATA_CATEGORIES as readonly string[]).includes(value);
}

export function isSensitivityClass(value: string): value is SensitivityClass {
  return (SENSITIVITY_CLASSES as readonly string[]).includes(value);
}

export function isSupportedContentType(value: string): value is SupportedContentType {
  return (SUPPORTED_CONTENT_TYPES as readonly string[]).includes(value);
}
