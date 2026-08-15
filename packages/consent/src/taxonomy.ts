/**
 * Consent vocabularies.
 *
 * Legal-status values are engineering hooks, not GDPR/CCPA/PDPL claims.
 * Consent is necessary for specified uses and may still be insufficient.
 */

export const CONSENT_STATES = [
  'DRAFT',
  'AWAITING_CONFIRMATION',
  'ACTIVE',
  'REVOKED',
  'EXPIRED',
  'SUPERSEDED',
  'REJECTED',
] as const;
export type ConsentState = (typeof CONSENT_STATES)[number];

export const TERMINAL_CONSENT_STATES = ['REVOKED', 'EXPIRED', 'SUPERSEDED', 'REJECTED'] as const;

export const CONSENT_OPERATIONS = [
  'READ',
  'DERIVE',
  'AGGREGATE',
  'EXPORT',
  'CONTRIBUTE',
  'SHARE',
] as const;
export type ConsentOperation = (typeof CONSENT_OPERATIONS)[number];

export const DERIVATION_TYPES = ['RAW', 'DERIVED_ONLY', 'AGGREGATE_ONLY'] as const;
export type DerivationType = (typeof DERIVATION_TYPES)[number];

export const ONWARD_SHARING_STATES = ['NOT_ALLOWED', 'ALLOWED_WITH_CONSTRAINTS'] as const;
export type OnwardSharingState = (typeof ONWARD_SHARING_STATES)[number];

export const RECIPIENT_KINDS = [
  'SOLSTICE_SERVICE',
  'EXTERNAL_RESEARCH_PARTNER',
  'EXTERNAL_DATA_RECIPIENT',
] as const;
export type RecipientKind = (typeof RECIPIENT_KINDS)[number];

export const PURPOSE_CODES = [
  'PERSONAL_BUDGET_ANALYSIS',
  'PERSONAL_ECONOMIC_GRAPH_DERIVATION',
  'PERSONAL_AGENT_ANALYSIS',
  'PRODUCT_IMPROVEMENT_RESEARCH',
  'AGGREGATED_RESEARCH',
  'DATA_CONTRIBUTION_RESEARCH',
] as const;
export type PurposeCode = (typeof PURPOSE_CODES)[number];

export const PURPOSE_CATEGORIES = [
  'SUBJECT_ANALYSIS',
  'GRAPH_DERIVATION',
  'AGENT_ANALYSIS',
  'PRODUCT_RESEARCH',
  'AGGREGATED_RESEARCH',
  'DATA_CONTRIBUTION',
] as const;
export type PurposeCategory = (typeof PURPOSE_CATEGORIES)[number];

export const PURPOSE_STATUSES = ['ACTIVE', 'RETIRED', 'SUPERSEDED'] as const;
export type PurposeStatus = (typeof PURPOSE_STATUSES)[number];

export const LEGAL_HOOK_STATUSES = [
  'RESEARCH_REQUIRED',
  'COUNSEL_REVIEW_REQUIRED',
  'COUNSEL_REVIEWED',
  'CONFIRMED_BY_COUNSEL',
] as const;
export type LegalHookStatus = (typeof LEGAL_HOOK_STATUSES)[number];

export const FIREWALL_DECISIONS = ['ALLOW', 'DENY', 'REVIEW_REQUIRED'] as const;
export type FirewallDecision = (typeof FIREWALL_DECISIONS)[number];

export const CONSENT_REASON_CODES = [
  'NO_ACTIVE_CONSENT',
  'PURPOSE_MISMATCH',
  'RESOURCE_OUT_OF_SCOPE',
  'OPERATION_OUT_OF_SCOPE',
  'RECIPIENT_OUT_OF_SCOPE',
  'CONSENT_EXPIRED',
  'CONSENT_REVOKED',
  'CONSENT_NOT_ACTIVE',
  'RETENTION_EXCEEDS_PERMISSION',
  'ONWARD_SHARING_DENIED',
  'ASSURANCE_INSUFFICIENT',
  'DEPENDENCY_NOT_IMPLEMENTED',
  'WILDCARD_GRANT_FORBIDDEN',
  'SUBJECT_MISMATCH',
  'ACTOR_CONTEXT_REQUIRED',
  'CAPABILITY_DENIED',
  'PURPOSE_UNKNOWN',
  'PURPOSE_RETIRED',
  'PERMIT_EXPIRED',
  'PERMIT_RECIPIENT_MISMATCH',
  'PERMIT_PURPOSE_MISMATCH',
  'PERMIT_INVALID',
  'LEGAL_BASIS_UNCERTAIN',
  'INTERNAL_SERVICE_INSUFFICIENT',
  'CROSS_SUBJECT_DENIED',
  'SUBJECT_SELF_ACCESS',
  'ALLOWED',
  'CLEAN_ROOM_NOT_IMPLEMENTED',
] as const;
export type ConsentReasonCode = (typeof CONSENT_REASON_CODES)[number];

export const CONSENT_LEGAL_STATUS = Object.freeze({
  status: 'RESEARCH_REQUIRED' as const satisfies LegalHookStatus,
  counselConfirmed: false,
  gdprComplianceClaim: false,
  ccpaComplianceClaim: false,
  saudiPdplComplianceClaim: false,
  uaePdplComplianceClaim: false,
  note: 'Explicit consent is not a legal-approval engine. Counsel has not confirmed any privacy-law mapping.',
});

export const PERMIT_TTL_MS = 5 * 60 * 1000;
export const PERMIT_MAX_TTL_MS = 15 * 60 * 1000;
export const MAX_CONSENT_TTL_MS = 730 * 24 * 60 * 60 * 1000;
export const EVIDENCE_KIND_CONSENT = 'CONSENT';

export const FORBIDDEN_WILDCARDS = Object.freeze(['ALL_DATA', 'ALL_PURPOSES', 'FOREVER']);

export const LEGAL_TRANSITIONS: Readonly<Record<ConsentState, readonly ConsentState[]>> = {
  DRAFT: ['AWAITING_CONFIRMATION', 'REJECTED'],
  AWAITING_CONFIRMATION: ['ACTIVE', 'REJECTED', 'DRAFT'],
  ACTIVE: ['REVOKED', 'EXPIRED', 'SUPERSEDED'],
  REVOKED: [],
  EXPIRED: [],
  SUPERSEDED: [],
  REJECTED: [],
};

export function isConsentState(value: string): value is ConsentState {
  return (CONSENT_STATES as readonly string[]).includes(value);
}

export function isConsentOperation(value: string): value is ConsentOperation {
  return (CONSENT_OPERATIONS as readonly string[]).includes(value);
}

export function isPurposeCode(value: string): value is PurposeCode {
  return (PURPOSE_CODES as readonly string[]).includes(value);
}

export function canTransition(from: ConsentState, to: ConsentState): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}
