export const DECISION_STATUSES = [
  'ALLOW',
  'DEFER',
  'REQUIRE_MANUAL_REVIEW',
  'BLOCK',
] as const;

export type DecisionStatus = (typeof DECISION_STATUSES)[number];

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
 * Monotonic escalation: posture can only tighten.
 * ALLOW < DEFER < REQUIRE_MANUAL_REVIEW < BLOCK
 */
export const DECISION_RANK: { readonly [S in DecisionStatus]: number } = {
  ALLOW: 0,
  DEFER: 1,
  REQUIRE_MANUAL_REVIEW: 2,
  BLOCK: 3,
};

export function escalate(
  current: DecisionStatus,
  next: DecisionStatus,
): DecisionStatus {
  return DECISION_RANK[next] > DECISION_RANK[current] ? next : current;
}

export function escalateAll(statuses: readonly DecisionStatus[]): DecisionStatus {
  let posture: DecisionStatus = 'ALLOW';
  for (const status of statuses) {
    posture = escalate(posture, status);
  }
  return posture;
}
