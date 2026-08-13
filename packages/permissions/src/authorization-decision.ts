import type { DecisionStatus, ProofEvaluation } from './decision.ts';
import type { ExecutionAuthority } from './execution-authority.ts';

export type AuthorizationDecision =
  | {
      readonly status: 'ALLOW';
      readonly intentId: string;
      readonly actionType: string;
      readonly proofs: readonly ProofEvaluation[];
      readonly executionAuthority: ExecutionAuthority;
      readonly reason: string;
      readonly decidedAt: string;
    }
  | {
      readonly status: Exclude<DecisionStatus, 'ALLOW'>;
      readonly intentId: string;
      readonly actionType: string;
      readonly proofs: readonly ProofEvaluation[];
      readonly reason: string;
      readonly decidedAt: string;
    };

export function isAllow(
  decision: AuthorizationDecision,
): decision is Extract<AuthorizationDecision, { status: 'ALLOW' }> {
  return decision.status === 'ALLOW';
}
