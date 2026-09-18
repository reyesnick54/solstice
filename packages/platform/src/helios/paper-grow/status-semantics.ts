/**
 * HELIOS H26 — consumer-visible Grow status vocabulary mapped from canonical cycle state.
 * Does not invent a second lifecycle; maps internal GrowCycleStatus to explicit UI semantics.
 */

import type { GrowCycleStatus, GrowDegradedReason } from './taxonomy.ts';

export const CONSUMER_GROW_STATUSES = [
  'RESEARCHING',
  'WAITING_FOR_DATA',
  'NO_ACTION',
  'PROPOSAL_READY',
  'APPROVAL_REQUIRED',
  'AUTHORIZED',
  'SUBMITTED',
  'PARTIALLY_FILLED',
  'FILLED',
  'SETTLING',
  'RECONCILING',
  'AVAILABLE',
  'PAUSED',
  'DEGRADED',
  'ACTION_REQUIRED',
  'FAILED',
] as const;

export type ConsumerGrowStatus = (typeof CONSUMER_GROW_STATUSES)[number];

export type GrowStatusContext = {
  readonly cycleStatus: GrowCycleStatus;
  readonly degradedReasons: readonly GrowDegradedReason[];
  readonly executionState?: string | null;
  readonly proposalState?: string | null;
};

export function mapConsumerGrowStatus(ctx: GrowStatusContext): ConsumerGrowStatus {
  if (ctx.degradedReasons.includes('RECONCILIATION_PENDING')) {
    return 'RECONCILING';
  }
  if (ctx.degradedReasons.includes('MARKET_DATA_STALE')) {
    return 'WAITING_FOR_DATA';
  }
  if (ctx.degradedReasons.length > 0 && ctx.cycleStatus === 'DEGRADED') {
    return 'DEGRADED';
  }
  if (ctx.cycleStatus === 'BLOCKED') {
    return 'ACTION_REQUIRED';
  }
  if (ctx.executionState === 'PARTIALLY_COMPLETED') {
    return 'PARTIALLY_FILLED';
  }
  if (ctx.executionState === 'PROCESSING' || ctx.executionState === 'QUEUED') {
    return 'SETTLING';
  }
  switch (ctx.cycleStatus) {
    case 'RESEARCHING':
      return 'RESEARCHING';
    case 'NO_ACTION':
      return 'NO_ACTION';
    case 'PROPOSAL_READY':
      return ctx.proposalState === 'APPROVED' ? 'AUTHORIZED' : 'PROPOSAL_READY';
    case 'AWAITING_CONTROL':
      return 'APPROVAL_REQUIRED';
    case 'REJECTED':
      return 'FAILED';
    case 'PAPER_SUBMITTED':
      return 'SUBMITTED';
    case 'PAPER_FILLED':
      return 'FILLED';
    case 'PAPER_ACTIVE':
      return 'AVAILABLE';
    case 'PAPER_CLOSED':
      return 'AVAILABLE';
    case 'DEGRADED':
      return 'DEGRADED';
    default:
      return 'NO_ACTION';
  }
}

export function deriveNextRequiredCustomerAction(
  consumerStatus: ConsumerGrowStatus,
  cycleStatus: GrowCycleStatus,
): string | null {
  switch (consumerStatus) {
    case 'APPROVAL_REQUIRED':
      return 'Review and approve the pending Grow proposal';
    case 'PROPOSAL_READY':
      return cycleStatus === 'AWAITING_CONTROL' ? 'Complete step-up authentication' : 'Review the ready proposal';
    case 'ACTION_REQUIRED':
      return 'Resolve the blocking Grow restriction before continuing';
    case 'AUTHORIZED':
      return 'Confirm execution of the approved proposal';
    case 'DEGRADED':
      return 'Review degraded Grow service state';
    case 'WAITING_FOR_DATA':
      return 'Wait for refreshed market data or retry later';
    case 'RECONCILING':
      return 'Wait for reconciliation to complete';
    default:
      return null;
  }
}
