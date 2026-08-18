/**
 * Chunk 100 Human Information Network vocabularies.
 *
 * Rights apply to governed information uses, never to the intrinsic
 * worth of a person. Adding a value to an enum does not enable it.
 */

export const INFORMATION_CATEGORIES = [
  'FINANCIAL_ACTIVITY_METADATA',
  'HEALTH_WELLNESS',
  'COMMERCE_PREFERENCES',
  'MOBILITY_LOCATION',
  'PROFESSIONAL_INFORMATION',
  'CREATIVE_ACTIVITY',
  'DEVICE_ACTIVITY_SIGNALS',
  'OTHER_EXPLICITLY_APPROVED',
] as const;
export type InformationCategory = (typeof INFORMATION_CATEGORIES)[number];

export const DEFAULT_DENY_CATEGORIES = [
  'HEALTH_WELLNESS',
  'MOBILITY_LOCATION',
] as const satisfies readonly InformationCategory[];

export const INFORMATION_RIGHT_TYPES = [
  'ONE_TIME_COMPUTATION',
  'RECURRING_COMPUTATION',
  'AGGREGATED_ANALYTICS',
  'MODEL_TRAINING_PERMISSION',
  'MODEL_EVALUATION_PERMISSION',
  'VERIFIED_ATTRIBUTE_QUERY',
  'OTHER_GOVERNED_INFORMATION_RIGHT',
] as const;
export type InformationRightType = (typeof INFORMATION_RIGHT_TYPES)[number];

export const DEFAULT_ENABLED_RIGHT_TYPES = [
  'ONE_TIME_COMPUTATION',
  'AGGREGATED_ANALYTICS',
  'VERIFIED_ATTRIBUTE_QUERY',
] as const satisfies readonly InformationRightType[];

export const OUTPUT_CLASSES = [
  'BOOLEAN_ATTESTATION',
  'AGGREGATE_STATISTIC',
  'VERIFIED_ATTRIBUTE',
  'PRIVACY_SAFE_SCORE',
  'MODEL_UPDATE_ARTIFACT',
  'OTHER_APPROVED_OUTPUT',
] as const;
export type OutputClass = (typeof OUTPUT_CLASSES)[number];

export const RAW_EXPORT_POLICY = 'NO_RAW_EXPORT' as const;
export type RawExportPolicy = typeof RAW_EXPORT_POLICY;

export const PROCESSING_CLASSES = [
  'CLEAN_ROOM_COMPUTATION',
  'VERIFIED_ATTRIBUTE_QUERY',
  'AGGREGATED_ANALYTICS',
] as const;
export type ProcessingClass = (typeof PROCESSING_CLASSES)[number];

export const SENSITIVITY_CLASSES = [
  'PERSONAL',
  'SENSITIVE',
  'HIGHLY_SENSITIVE',
  'RESTRICTED',
] as const;
export type InformationSensitivityClass = (typeof SENSITIVITY_CLASSES)[number];

export const SOURCE_CLASSES = [
  'PERSONAL_DATA_VAULT',
  'APPROVED_EXTERNAL_PROTECTED_STORAGE',
  'AUTHORIZED_CONNECTOR',
] as const;
export type SourceClass = (typeof SOURCE_CLASSES)[number];

export const COMPENSATION_ASSETS = [
  'SUNREY_COIN',
  'APPROVED_FIAT',
  'APPROVED_APPLICATION_SETTLEMENT',
] as const;
export type NetworkCompensationAsset = (typeof COMPENSATION_ASSETS)[number];

export const INCIDENT_KINDS = [
  'UNAUTHORIZED_REQUEST',
  'POLICY_BYPASS',
  'RAW_DATA_EXPOSURE_ATTEMPT',
  'QUERY_ABUSE',
  'REIDENTIFICATION_SIGNAL',
  'WRONG_RECIPIENT',
  'CONSENT_MISMATCH',
] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number];

export const MOBILE_EVENT_KINDS = [
  'INFORMATION_REQUEST',
  'CONSENT_REQUEST',
  'USAGE_RECEIPT',
  'COMPENSATION_EVENT',
  'REVOCATION_CONFIRMATION',
  'SECURITY_EVENT',
] as const;
export type MobileEventKind = (typeof MOBILE_EVENT_KINDS)[number];

export const DEVELOPER_INFORMATION_SCOPES = [
  'HUMAN_INFORMATION_READ',
  'HUMAN_INFORMATION_REQUEST',
  'HUMAN_INFORMATION_CLEAN_ROOM',
] as const;
export type DeveloperInformationScope = (typeof DEVELOPER_INFORMATION_SCOPES)[number];

export const AGENT_INFORMATION_MANDATE = 'MANAGE_HUMAN_INFORMATION_PREFERENCES' as const;

export const GENERIC_ANY_FUTURE_PURPOSE = 'ANY_FUTURE_PURPOSE';

export const NETWORK_LEGAL_STATUS = Object.freeze({
  status: 'RESEARCH_REQUIRED' as const,
  counselConfirmed: false,
  productionActivated: false,
  liveBuyer: false,
  liveResearcher: false,
  liveDataMonetization: false,
  humanWorthScore: false,
  socialCredit: false,
  note: 'Engineering completion is not production legal or privacy authorization.',
});

export const EVIDENCE_KIND_HUMAN_INFORMATION = 'HUMAN_INFORMATION_NETWORK';

export const HUMAN_INFORMATION_RIGHTS_SAFETY = 'HUMAN_INFORMATION_RIGHTS_SAFETY' as const;
