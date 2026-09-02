/**
 * Wave 6 Human Economy privacy, rights, and consent taxonomy.
 *
 * Engineering classifications and purpose codes support policy decisions.
 * They are not jurisdiction-specific legal conclusions.
 */

import type { PurposeAuthorizationCode } from '../rights/taxonomy.ts';

export const HUMAN_ECONOMY_SCHEMA_VERSION = 1 as const;
export type HumanEconomySchemaVersion = typeof HUMAN_ECONOMY_SCHEMA_VERSION;

/**
 * Policy-oriented data classification for Human Economy flows.
 * Distinct from PDV ProductClassification — mapped via classification.ts.
 */
export const HUMAN_DATA_CLASSIFICATIONS = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'PERSONAL',
  'SENSITIVE_PERSONAL',
  'HIGHLY_RESTRICTED',
] as const;
export type HumanDataClassification = (typeof HUMAN_DATA_CLASSIFICATIONS)[number];

export const HUMAN_ECONOMY_PURPOSE_CODES = [
  'IDENTITY_VERIFICATION',
  'CONTRIBUTION_VERIFICATION',
  'RESEARCH_USE',
  'AUTHORIZED_COMPUTATION',
  'ECONOMIC_VALUATION',
  'MONETARY_PROPOSAL',
  'PERSONAL_AGENT_USE',
] as const;
export type HumanEconomyPurposeCode = (typeof HUMAN_ECONOMY_PURPOSE_CODES)[number];

/**
 * Maps Human Economy purpose codes to Wave 3 PurposeAuthorizationCode values.
 * Purpose separation is enforced at the Human Economy layer — authorization for
 * one mapped purpose does not imply authorization for another.
 */
export const HUMAN_ECONOMY_TO_WAVE3_PURPOSE: Readonly<
  Record<HumanEconomyPurposeCode, PurposeAuthorizationCode>
> = Object.freeze({
  IDENTITY_VERIFICATION: 'CONTRIBUTION_VERIFICATION',
  CONTRIBUTION_VERIFICATION: 'CONTRIBUTION_VERIFICATION',
  RESEARCH_USE: 'RESEARCH',
  AUTHORIZED_COMPUTATION: 'AGENT_COMPUTATION',
  ECONOMIC_VALUATION: 'ECONOMIC_VALUATION',
  MONETARY_PROPOSAL: 'MONETARY_PROPOSAL',
  PERSONAL_AGENT_USE: 'AGENT_COMPUTATION',
});

/**
 * Explicit non-implication pairs. If purpose A is authorized, purpose B is NOT
 * automatically authorized even when they share a Wave 3 mapping.
 */
export const HUMAN_ECONOMY_PURPOSE_NON_IMPLICATIONS: Readonly<
  readonly (readonly [HumanEconomyPurposeCode, HumanEconomyPurposeCode])[]
> = Object.freeze([
  ['RESEARCH_USE', 'MONETARY_PROPOSAL'],
  ['RESEARCH_USE', 'ECONOMIC_VALUATION'],
  ['CONTRIBUTION_VERIFICATION', 'MONETARY_PROPOSAL'],
  ['CONTRIBUTION_VERIFICATION', 'ECONOMIC_VALUATION'],
  ['IDENTITY_VERIFICATION', 'RESEARCH_USE'],
  ['IDENTITY_VERIFICATION', 'AUTHORIZED_COMPUTATION'],
  ['PERSONAL_AGENT_USE', 'RESEARCH_USE'],
  ['PERSONAL_AGENT_USE', 'MONETARY_PROPOSAL'],
  ['PERSONAL_AGENT_USE', 'ECONOMIC_VALUATION'],
  ['AUTHORIZED_COMPUTATION', 'MONETARY_PROPOSAL'],
]);

export const AUTHORIZED_CONTRIBUTION_KINDS = [
  'AUTHORIZED_DATASET_CONTRIBUTION',
  'AUTHORIZED_COMPUTATION_PARTICIPATION',
] as const;
export type AuthorizedContributionKind = (typeof AUTHORIZED_CONTRIBUTION_KINDS)[number];

export const MINIMUM_NECESSARY_PROOF_KINDS = [
  'CREDENTIAL_VALID',
  'WORK_RECEIPT_VALID',
  'PUBLICATION_CONTRIBUTION_VERIFIED',
  'AUTHORIZED_COMPUTATION_COMPLETED',
] as const;
export type MinimumNecessaryProofKind = (typeof MINIMUM_NECESSARY_PROOF_KINDS)[number];

export const HUMAN_ECONOMY_COMMITMENT_DOMAINS = Object.freeze({
  HUMAN_CONSENT_GRANT: 'sunrey.economic-proof.human-consent-grant.v1',
  AUTHORIZED_CONTRIBUTION: 'sunrey.economic-proof.authorized-contribution.v1',
  USAGE_RECEIPT: 'sunrey.economic-proof.human-usage-receipt.v1',
  OFF_CHAIN_RECORD_REF: 'sunrey.economic-proof.off-chain-record-ref.v1',
});

export const OFF_CHAIN_SENSITIVE_FIELDS = Object.freeze([
  'rawMedicalRecord',
  'rawGeneticData',
  'rawCommunications',
  'rawLocationHistory',
  'rawSocialGraph',
  'governmentId',
  'legalName',
  'email',
  'phoneNumber',
  'rawPsychologicalAssessment',
  'rawDnaSequence',
]);

export const CONSENT_LIFECYCLE_STATES = [
  'DRAFT',
  'ACTIVE',
  'EXPIRED',
  'REVOKED',
  'RENEWED',
] as const;
export type ConsentLifecycleState = (typeof CONSENT_LIFECYCLE_STATES)[number];
