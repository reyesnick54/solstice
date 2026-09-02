/**
 * Wave 3 — Economic Proof Architecture constants.
 *
 * Canonical proof-lattice schema versions. Observations, evidence, verified
 * facts, and claims have zero monetary authority at every stage.
 */

export const ECONOMIC_PROOF_PLATFORM_ID = 'sunrey.economic-proof.v1' as const;

export const ECONOMIC_OBSERVATION_SCHEMA_VERSION = 'sunrey.economic-proof.observation.v1' as const;
export const ECONOMIC_EVIDENCE_SCHEMA_VERSION = 'sunrey.economic-proof.evidence.v1' as const;
export const VERIFIED_ECONOMIC_FACT_SCHEMA_VERSION = 'sunrey.economic-proof.verified-fact.v1' as const;
export const CANONICAL_ECONOMIC_CLAIM_SCHEMA_VERSION = 'sunrey.economic-proof.claim.v1' as const;

export const SUPPORTED_OBSERVATION_SCHEMA_VERSIONS = [ECONOMIC_OBSERVATION_SCHEMA_VERSION] as const;
export const SUPPORTED_EVIDENCE_SCHEMA_VERSIONS = [ECONOMIC_EVIDENCE_SCHEMA_VERSION] as const;
export const SUPPORTED_VERIFIED_FACT_SCHEMA_VERSIONS = [VERIFIED_ECONOMIC_FACT_SCHEMA_VERSION] as const;
export const SUPPORTED_CLAIM_SCHEMA_VERSIONS = [CANONICAL_ECONOMIC_CLAIM_SCHEMA_VERSION] as const;

export const ECONOMIC_DOMAINS = ['HUMAN_ECONOMIC', 'PRODUCTIVE_ECONOMIC'] as const;
export type EconomicDomain = (typeof ECONOMIC_DOMAINS)[number];

export const SOURCE_CLASSES = [
  'SANDBOX_FIXTURE',
  'CERTIFIED_CANDIDATE',
  'INSTITUTIONAL',
  'SENSOR_NETWORK',
  'PUBLIC_REFERENCE',
  'HUMAN_INFORMATION_NETWORK',
  'ORACLE_NETWORK',
] as const;
export type ProofSourceClass = (typeof SOURCE_CLASSES)[number];

export const VERIFICATION_STATUSES = [
  'PENDING',
  'VERIFIED',
  'DISPUTED',
  'STALE',
  'INVALID',
  'SUPERSEDED',
] as const;
export type ProofVerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const CHALLENGE_STATUSES = ['NONE', 'OPEN', 'UNDER_REVIEW', 'UPHELD', 'REJECTED', 'WITHDRAWN'] as const;
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

export const MONETIZATION_STATUSES = [
  'NOT_ELIGIBLE',
  'ELIGIBLE_FOR_VALUATION',
  'VALUATION_IN_PROGRESS',
  'PROPOSAL_PENDING',
  'MONETIZED',
  'REFUSED',
] as const;
export type MonetizationStatus = (typeof MONETIZATION_STATUSES)[number];

export const FRESHNESS_STATES = ['FRESH', 'AGING', 'STALE', 'EXPIRED'] as const;
export type ProofFreshnessState = (typeof FRESHNESS_STATES)[number];

export const INTEGRITY_STATES = ['INTACT', 'TAMPERED', 'UNSIGNED', 'INVALID_SIGNATURE'] as const;
export type ProofIntegrityState = (typeof INTEGRITY_STATES)[number];

export const EVIDENCE_KINDS = [
  'PROVIDER_RECORD',
  'ATTESTATION',
  'DOCUMENT_DIGEST',
  'MEASUREMENT',
  'SIGNED_RECEIPT',
  'CRYPTOGRAPHIC_HASH',
  'COMPUTATION_RECEIPT',
  'VERIFICATION_OUTPUT',
  'EXTERNAL_SOURCE_REFERENCE',
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const CLAIM_TYPES = [
  'HUMAN_CONTRIBUTION',
  'INFORMATION_RIGHT_REALIZATION',
  'PRODUCTIVE_OUTPUT',
  'PRODUCTIVE_CAPACITY',
  'RESOURCE_USAGE',
  'SERVICE_DELIVERY',
] as const;
export type EconomicClaimType = (typeof CLAIM_TYPES)[number];

/** Proof objects never carry monetary mutation authority. */
export const ZERO_MONETARY_AUTHORITY = true as const;
export const PRODUCTION_ECONOMICS_ACTIVE = false as const;
export const SIMULATION_ONLY = true as const;

export const PROOF_HASH_DOMAINS = {
  observation: 'SUNREY_ECONOMIC_OBSERVATION_V1',
  evidence: 'SUNREY_ECONOMIC_EVIDENCE_V1',
  verifiedFact: 'SUNREY_VERIFIED_ECONOMIC_FACT_V1',
  claim: 'SUNREY_CANONICAL_ECONOMIC_CLAIM_V1',
} as const;
