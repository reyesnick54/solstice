import { DECISION_RANK, type DecisionStatus } from '../../permissions/src/decision.ts';
import type { DecisionTransition, RestrictivenessChange } from './taxonomy.ts';

const STATUS_TOKEN: Record<DecisionStatus, 'ALLOW' | 'REVIEW' | 'DEFER' | 'BLOCK'> = {
  ALLOW: 'ALLOW',
  REQUIRE_MANUAL_REVIEW: 'REVIEW',
  DEFER: 'DEFER',
  BLOCK: 'BLOCK',
};

export function decisionTransition(
  current: DecisionStatus,
  candidate: DecisionStatus,
): DecisionTransition {
  return `${STATUS_TOKEN[current]}_TO_${STATUS_TOKEN[candidate]}` as DecisionTransition;
}

/**
 * Rank increase is more restrictive. A less-restrictive outcome is never
 * treated as legally desirable.
 */
export function restrictivenessChange(
  current: DecisionStatus,
  candidate: DecisionStatus,
): RestrictivenessChange {
  const delta = DECISION_RANK[candidate] - DECISION_RANK[current];
  if (delta > 0) {
    return 'MATERIALLY_MORE_RESTRICTIVE';
  }
  if (delta < 0) {
    return 'MATERIALLY_LESS_RESTRICTIVE';
  }
  return 'UNCHANGED';
}

export function stringSetDiff(
  current: readonly string[],
  candidate: readonly string[],
): { readonly added: readonly string[]; readonly removed: readonly string[] } {
  const from = new Set(current);
  const to = new Set(candidate);
  return Object.freeze({
    added: Object.freeze([...to].filter((item) => !from.has(item)).sort()),
    removed: Object.freeze([...from].filter((item) => !to.has(item)).sort()),
  });
}
