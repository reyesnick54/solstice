/**
 * ALPHA14 — evidence committee human review gate before live-capital promotion.
 */

import type { ForwardAlphaRealityStatus } from './taxonomy.ts';

export const HELIOS_ALPHA14_EVIDENCE_COMMITTEE = 'HELIOS_ALPHA14_EVIDENCE_COMMITTEE' as const;

export type CommitteeReviewDecision = 'DEFER' | 'APPROVE_PAPER' | 'APPROVE_LIVE' | 'REFUSE';

export function committeeMayPromote(
  status: ForwardAlphaRealityStatus,
  decision: CommitteeReviewDecision,
): boolean {
  if (decision === 'REFUSE' || decision === 'DEFER') {
    return false;
  }
  if (decision === 'APPROVE_PAPER') {
    return status === 'FORWARD_ALPHA_SUPPORTED' || status === 'FORWARD_ROBUSTNESS_SUPPORTED';
  }
  if (decision === 'APPROVE_LIVE') {
    return status === 'PAPER_IMPLEMENTATION_SUPPORTED';
  }
  return false;
}
