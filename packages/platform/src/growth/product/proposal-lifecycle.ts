/**
 * Maps product Financial Proposal statuses onto the Phase B approval machine.
 * Does not invent a competing transition table for authority-facing state.
 */

import { transitionApproval, type ApprovalState } from '../../../../permissions/src/approval.ts';
import type { FinancialProposalStatus } from './taxonomy.ts';

export const PRODUCT_TO_APPROVAL: Readonly<Record<FinancialProposalStatus, ApprovalState>> = {
  DRAFT: 'DRAFT',
  READY: 'PROPOSED',
  PRESENTED: 'POLICY_REVIEW',
  AWAITING_APPROVAL: 'AWAITING_USER_APPROVAL',
  AWAITING_STEP_UP: 'AWAITING_STEP_UP_AUTH',
  AWAITING_COMPLIANCE: 'AWAITING_COMPLIANCE',
  APPROVED: 'APPROVED',
  EXECUTING: 'EXECUTING',
  EXECUTED: 'EXECUTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  SUPERSEDED: 'CANCELLED',
};

const PRODUCT_TRANSITIONS: Readonly<Record<FinancialProposalStatus, readonly FinancialProposalStatus[]>> = {
  DRAFT: ['READY', 'CANCELLED', 'EXPIRED'],
  READY: ['PRESENTED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  PRESENTED: ['AWAITING_APPROVAL', 'AWAITING_STEP_UP', 'AWAITING_COMPLIANCE', 'REJECTED', 'EXPIRED', 'CANCELLED'],
  AWAITING_APPROVAL: ['APPROVED', 'AWAITING_STEP_UP', 'REJECTED', 'CANCELLED', 'EXPIRED', 'SUPERSEDED'],
  AWAITING_STEP_UP: ['PRESENTED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED'],
  AWAITING_COMPLIANCE: ['AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED'],
  APPROVED: ['EXECUTING', 'EXPIRED', 'CANCELLED', 'SUPERSEDED'],
  EXECUTING: ['EXECUTED', 'FAILED'],
  EXECUTED: [],
  REJECTED: [],
  EXPIRED: [],
  FAILED: [],
  CANCELLED: [],
  SUPERSEDED: [],
};

export function canTransitionProductProposal(
  from: FinancialProposalStatus,
  to: FinancialProposalStatus,
): boolean {
  return PRODUCT_TRANSITIONS[from].includes(to);
}

export function transitionProductProposal(
  from: FinancialProposalStatus,
  to: FinancialProposalStatus,
):
  | { readonly ok: true; readonly status: FinancialProposalStatus; readonly approvalState: ApprovalState }
  | { readonly ok: false; readonly message: string } {
  if (!canTransitionProductProposal(from, to)) {
    return { ok: false, message: `cannot move product proposal from ${from} to ${to}` };
  }
  const approval = transitionApproval(PRODUCT_TO_APPROVAL[from], PRODUCT_TO_APPROVAL[to]);
  if (!approval.ok) {
    return { ok: false, message: approval.error.message };
  }
  return { ok: true, status: to, approvalState: approval.state };
}

export function isMateriallyFrozen(status: FinancialProposalStatus): boolean {
  return status !== 'DRAFT' && status !== 'READY';
}

export function isTerminalProductProposal(status: FinancialProposalStatus): boolean {
  return (
    status === 'EXECUTED' ||
    status === 'REJECTED' ||
    status === 'EXPIRED' ||
    status === 'FAILED' ||
    status === 'CANCELLED' ||
    status === 'SUPERSEDED'
  );
}
