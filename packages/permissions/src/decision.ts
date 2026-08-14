import type { UtcInstant } from '../../domain/src/time.ts';
import type { ExecutionAuthority } from './execution-authority.ts';

export const DECISION_STATUSES = [
  'ALLOW',
  'REQUIRE_MANUAL_REVIEW',
  'DEFER',
  'BLOCK',
] as const;

export type DecisionStatus = (typeof DECISION_STATUSES)[number];

/**
 * Monotonic rank. A later proof may only escalate (raise) the combined
 * status. It must never downgrade a more severe result.
 */
export const DECISION_RANK: { readonly [S in DecisionStatus]: number } = {
  ALLOW: 0,
  REQUIRE_MANUAL_REVIEW: 1,
  DEFER: 2,
  BLOCK: 3,
};

export const PROOF_NAMES = [
  'IDENTITY',
  'AUTHORITY',
  'JURISDICTION',
  'COMPLIANCE',
  'RISK',
  'PURPOSE',
] as const;

export type ProofName = (typeof PROOF_NAMES)[number];

export type ProofEvaluation = {
  readonly proof: ProofName;
  readonly status: DecisionStatus;
  readonly reason: string;
};

/**
 * Kernel decision. On ALLOW, a signed Execution Authority is attached.
 * On any other status the authority is null. Callers must return this
 * object unchanged when they do not proceed — never downgrade or reinterpret.
 */
export type PolicyDecisionRef = {
  readonly packId: string | null;
  readonly packVersion: string | null;
  readonly versionId: string | null;
  readonly packHash: string | null;
  readonly factsHash: string;
  readonly evaluatedRuleIds: readonly string[];
  readonly decision: DecisionStatus;
  readonly reasonCodes: readonly string[];
  readonly jurisdiction: string | null;
  readonly legalConfidence: string;
  readonly reviewId: string | null;
};

export type AuthorizationDecision = {
  readonly status: DecisionStatus;
  readonly intentId: string;
  readonly actionType: string;
  readonly proofs: readonly ProofEvaluation[];
  readonly executionAuthority: ExecutionAuthority | null;
  readonly evidenceRecordId: string;
  readonly decidedAt: UtcInstant;
  readonly policySnapshot?: PolicyDecisionRef;
};

export function combineProofs(proofs: readonly ProofEvaluation[]): DecisionStatus {
  let combined: DecisionStatus = 'ALLOW';
  for (const proof of proofs) {
    if (DECISION_RANK[proof.status] > DECISION_RANK[combined]) {
      combined = proof.status;
    }
  }
  return combined;
}
