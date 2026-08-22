import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { OpportunityStatus } from './taxonomy.ts';

const TRANSITIONS: Readonly<Record<OpportunityStatus, readonly OpportunityStatus[]>> = {
  DETECTED: Object.freeze(['ELIGIBLE', 'INELIGIBLE', 'EXPIRED', 'SUPERSEDED']),
  ELIGIBLE: Object.freeze(['PRESENTED', 'INELIGIBLE', 'EXPIRED', 'SUPERSEDED', 'DISMISSED']),
  INELIGIBLE: Object.freeze(['ELIGIBLE', 'EXPIRED', 'SUPERSEDED']),
  PRESENTED: Object.freeze(['DISMISSED', 'ACCEPTED_FOR_PROPOSAL', 'EXPIRED', 'SUPERSEDED', 'COMPLETED', 'INELIGIBLE']),
  DISMISSED: Object.freeze(['SUPERSEDED', 'EXPIRED']),
  ACCEPTED_FOR_PROPOSAL: Object.freeze(['COMPLETED', 'SUPERSEDED', 'EXPIRED', 'DISMISSED']),
  EXPIRED: Object.freeze(['SUPERSEDED']),
  SUPERSEDED: Object.freeze([]),
  COMPLETED: Object.freeze([]),
};

export function canTransitionOpportunity(from: OpportunityStatus, to: OpportunityStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transitionOpportunity(
  from: OpportunityStatus,
  to: OpportunityStatus,
): Result<OpportunityStatus, { readonly code: 'INVALID_OPPORTUNITY_TRANSITION'; readonly message: string }> {
  if (!canTransitionOpportunity(from, to)) {
    return err({
      code: 'INVALID_OPPORTUNITY_TRANSITION',
      message: `cannot move opportunity from ${from} to ${to}`,
    });
  }
  return ok(to);
}

export function isTerminalOpportunity(status: OpportunityStatus): boolean {
  return status === 'SUPERSEDED' || status === 'COMPLETED' || status === 'EXPIRED' || status === 'DISMISSED';
}
