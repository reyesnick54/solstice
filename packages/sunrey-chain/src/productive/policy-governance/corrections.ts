import { POLICY_GOVERNANCE_SCHEMA_VERSION } from './types.ts';

export const ISSUANCE_CORRECTION_KINDS = [
  'FUTURE_ELIGIBILITY',
  'FUTURE_POLICY',
  'FUTURE_ISSUANCE',
  'DISPUTE_REVIEW',
  'FRAUD_INCIDENT_EVIDENCE',
  'INVALID_CLAIM_EVIDENCE',
] as const;
export type IssuanceCorrectionKind = (typeof ISSUANCE_CORRECTION_KINDS)[number];

/**
 * Explicit correction evidence. Finalized issuance history is not rewritten.
 * Innocent downstream holders are not silently debited.
 */
export type IssuanceCorrectionRecord = {
  readonly schemaVersion: typeof POLICY_GOVERNANCE_SCHEMA_VERSION;
  readonly correctionId: string;
  readonly kind: IssuanceCorrectionKind;
  readonly targetIssuanceId: string;
  readonly targetContributionId: string;
  readonly reason: string;
  readonly evidenceIds: readonly string[];
  readonly activationHeight: number;
  readonly rewritesFinalizedHistory: false;
  readonly silentlyDebitsDownstreamHolders: false;
  readonly requiresSeparateGovernedMechanism: true;
  readonly governedTransactionId: string;
};

export function createIssuanceCorrection(input: {
  readonly correctionId: string;
  readonly kind: IssuanceCorrectionKind;
  readonly targetIssuanceId: string;
  readonly targetContributionId: string;
  readonly reason: string;
  readonly evidenceIds: readonly string[];
  readonly activationHeight: number;
  readonly governedTransactionId: string;
}): IssuanceCorrectionRecord {
  return Object.freeze({
    schemaVersion: POLICY_GOVERNANCE_SCHEMA_VERSION,
    correctionId: input.correctionId,
    kind: input.kind,
    targetIssuanceId: input.targetIssuanceId,
    targetContributionId: input.targetContributionId,
    reason: input.reason,
    evidenceIds: [...input.evidenceIds],
    activationHeight: input.activationHeight,
    rewritesFinalizedHistory: false,
    silentlyDebitsDownstreamHolders: false,
    requiresSeparateGovernedMechanism: true,
    governedTransactionId: input.governedTransactionId,
  });
}
