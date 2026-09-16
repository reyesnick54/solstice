import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { ExecutableOpportunityState } from './taxonomy.ts';

const TRANSITIONS: Readonly<Record<ExecutableOpportunityState, readonly ExecutableOpportunityState[]>> = {
  DISCOVERED: Object.freeze([
    'EVIDENCE_VERIFIED',
    'REJECTED',
    'EXPIRED',
    'STALE',
    'DATA_DEGRADED',
    'REVIEW_REQUIRED',
  ]),
  EVIDENCE_VERIFIED: Object.freeze([
    'CUSTOMER_ELIGIBLE',
    'INELIGIBLE',
    'REJECTED',
    'EXPIRED',
    'STALE',
    'DATA_DEGRADED',
    'REVIEW_REQUIRED',
  ]),
  CUSTOMER_ELIGIBLE: Object.freeze([
    'EXECUTION_ROUTE_READY',
    'NO_ROUTE',
    'INELIGIBLE',
    'REJECTED',
    'EXPIRED',
    'STALE',
    'REVIEW_REQUIRED',
  ]),
  EXECUTION_ROUTE_READY: Object.freeze([
    'QUALIFIED_FOR_PROPOSAL',
    'NO_ROUTE',
    'REJECTED',
    'EXPIRED',
    'STALE',
    'REVIEW_REQUIRED',
  ]),
  QUALIFIED_FOR_PROPOSAL: Object.freeze(['EXPIRED', 'STALE', 'REVIEW_REQUIRED']),
  REJECTED: Object.freeze([]),
  EXPIRED: Object.freeze([]),
  STALE: Object.freeze(['DISCOVERED', 'REJECTED']),
  INELIGIBLE: Object.freeze(['CUSTOMER_ELIGIBLE', 'REJECTED']),
  NO_ROUTE: Object.freeze(['EXECUTION_ROUTE_READY', 'REJECTED']),
  DATA_DEGRADED: Object.freeze(['DISCOVERED', 'REJECTED']),
  REVIEW_REQUIRED: Object.freeze(['DISCOVERED', 'REJECTED', 'QUALIFIED_FOR_PROPOSAL']),
};

export function canTransitionExecutableOpportunity(
  from: ExecutableOpportunityState,
  to: ExecutableOpportunityState,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transitionExecutableOpportunity(
  from: ExecutableOpportunityState,
  to: ExecutableOpportunityState,
): Result<ExecutableOpportunityState, { readonly code: 'INVALID_EXECUTABLE_OPPORTUNITY_TRANSITION'; readonly message: string }> {
  if (!canTransitionExecutableOpportunity(from, to)) {
    return err({
      code: 'INVALID_EXECUTABLE_OPPORTUNITY_TRANSITION',
      message: `cannot move executable opportunity from ${from} to ${to}`,
    });
  }
  return ok(to);
}

export function isTerminalExecutableOpportunity(state: ExecutableOpportunityState): boolean {
  return (
    state === 'QUALIFIED_FOR_PROPOSAL' ||
    state === 'REJECTED' ||
    state === 'EXPIRED' ||
    state === 'INELIGIBLE' ||
    state === 'NO_ROUTE' ||
    state === 'DATA_DEGRADED'
  );
}

export function isProgressiveExecutableOpportunity(state: ExecutableOpportunityState): boolean {
  return (
    state === 'DISCOVERED' ||
    state === 'EVIDENCE_VERIFIED' ||
    state === 'CUSTOMER_ELIGIBLE' ||
    state === 'EXECUTION_ROUTE_READY' ||
    state === 'QUALIFIED_FOR_PROPOSAL'
  );
}
