/**
 * Wave 3 economic-proof rights taxonomy.
 *
 * Purpose identifiers are versioned and extensible. A rights check must evaluate
 * the actual requested purpose — permission for Purpose A is not permission for B.
 */

export const RIGHTS_SCHEMA_VERSION = 1 as const;
export type RightsSchemaVersion = typeof RIGHTS_SCHEMA_VERSION;

export const RIGHTS_COMMITMENT_SCHEMA_VERSION = 1 as const;

export const RIGHTS_ECONOMY_KINDS = ['HUMAN', 'PRODUCTIVE'] as const;
export type RightsEconomyKind = (typeof RIGHTS_ECONOMY_KINDS)[number];

export const RIGHTS_GRANT_STATES = ['ACTIVE', 'EXPIRED', 'REVOKED'] as const;
export type RightsGrantState = (typeof RIGHTS_GRANT_STATES)[number];

export const LICENSE_RESTRICTION_LEVELS = ['ALLOWED', 'RESTRICTED', 'FORBIDDEN'] as const;
export type LicenseRestrictionLevel = (typeof LICENSE_RESTRICTION_LEVELS)[number];

export const RIGHTS_EVALUATION_DECISIONS = ['ALLOW', 'DENY'] as const;
export type RightsEvaluationDecision = (typeof RIGHTS_EVALUATION_DECISIONS)[number];

/**
 * Extensible purpose identifiers for economic-proof rights evaluation.
 * These are distinct from consent PurposeCode values in packages/consent.
 */
export const PURPOSE_AUTHORIZATION_CODES = [
  'CONTRIBUTION_VERIFICATION',
  'ECONOMIC_VALUATION',
  'RESEARCH',
  'AGENT_COMPUTATION',
  'MONETARY_PROPOSAL',
  'DATA_OBSERVATION',
  'AGGREGATE_ANALYTICS',
  'EXPOSURE',
] as const;
export type PurposeAuthorizationCode = (typeof PURPOSE_AUTHORIZATION_CODES)[number];

export const RIGHTS_COMMITMENT_DOMAINS = Object.freeze({
  RIGHTS_GRANT: 'sunrey.economic-proof.rights-grant.v1',
  CONSENT_GRANT: 'sunrey.economic-proof.consent-grant.v1',
  PURPOSE_AUTHORIZATION: 'sunrey.economic-proof.purpose-authorization.v1',
  LICENSE_AUTHORIZATION: 'sunrey.economic-proof.license-authorization.v1',
  RIGHTS_COMMITMENT: 'sunrey.economic-proof.rights-commitment.v1',
  RIGHTS_ROOT: 'sunrey.economic-proof.rights-root.v1',
  RIGHTS_REVOCATION: 'sunrey.economic-proof.rights-revocation.v1',
  RIGHTS_DELTA: 'sunrey.economic-proof.rights-delta.v1',
});

export const RIGHTS_ROOT_DOMAIN = 'sunrey.economic-proof.rights-root.v1';

export const HUMAN_ECONOMY_FAIL_CLOSED_CONTRIBUTION_CLASSES = Object.freeze([
  'INFORMATION_RIGHT_CONTRIBUTION',
  'CREATIVE_CONTRIBUTION',
  'MODEL_TRAINING_CONTRIBUTION',
]);

export const OFF_CHAIN_RIGHTS_FIELDS = Object.freeze([
  'rawConsentDocument',
  'rawLicenseDocument',
  'legalName',
  'email',
  'governmentId',
  'rawPersonalData',
]);
