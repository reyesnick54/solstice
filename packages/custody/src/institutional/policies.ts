import type { DestinationScreeningOutcome } from '../taxonomy.ts';
import type { TravelRuleDecision } from '../types.ts';
import type {
  ApprovalAction,
  ApprovalPolicy,
  CustodyVault,
  InstitutionalDestination,
  TransactionPreview,
  VelocityPolicy,
} from './types.ts';
import type { WithdrawalPolicyDecision } from './taxonomy.ts';
import { DEVELOPMENT_TIER_LIMITS } from './taxonomy.ts';

export function approvalSatisfied(
  policy: ApprovalPolicy,
  actions: readonly ApprovalAction[],
  quantity: bigint,
): boolean {
  const approvals = actions.filter((action) => action.decision === 'APPROVE');
  const unique = new Set(approvals.map((action) => action.actorId));
  if (approvals.some((action) => !policy.authorizedApproverIds.includes(action.actorId))) {
    return false;
  }
  if (policy.mode === 'SINGLE_OPERATOR') {
    return unique.size >= 1;
  }
  if (policy.mode === 'DUAL_CONTROL' || policy.mode === 'SECURITY_PLUS_OPERATIONS') {
    return unique.size >= 2;
  }
  if (policy.mode === 'M_OF_N_APPROVERS') {
    return unique.size >= policy.requiredApprovals;
  }
  if (policy.mode === 'HIGH_VALUE_COMMITTEE') {
    const needed = quantity >= policy.highValueThreshold ? Math.max(policy.requiredApprovals, 3) : 2;
    return unique.size >= needed;
  }
  return false;
}

export function evaluateWithdrawalPolicy(input: {
  readonly vault: CustodyVault;
  readonly quantity: bigint;
  readonly destination: InstitutionalDestination;
  readonly destinationHistoryCount: number;
  readonly screening: DestinationScreeningOutcome;
  readonly travelRule: TravelRuleDecision | null;
  readonly dailySpent: bigint;
  readonly epochSpent: bigint;
  readonly currentHeight: bigint;
  readonly riskFlag: boolean;
}): WithdrawalPolicyDecision {
  if (input.destination.status === 'REVOKED' || input.destination.status === 'RESTRICTED') {
    return 'REJECTED';
  }
  if (input.destination.status !== 'APPROVED') {
    return 'REJECTED';
  }
  if (
    input.destination.approvedAtHeight !== null &&
    input.currentHeight - input.destination.approvedAtHeight < input.vault.destinationPolicy.coolingPeriodHeights
  ) {
    return 'SECURITY_REVIEW';
  }
  if (input.screening === 'BLOCK') {
    return 'REJECTED';
  }
  if (input.screening === 'REVIEW' || input.travelRule?.applicability === 'RESEARCH_REQUIRED') {
    return 'COMPLIANCE_REVIEW';
  }
  if (input.riskFlag) {
    return 'SECURITY_REVIEW';
  }
  const velocity = input.vault.velocityPolicy;
  if (
    input.quantity > velocity.maxPerWithdrawal ||
    input.dailySpent + input.quantity > velocity.dailyLimit ||
    input.epochSpent + input.quantity > velocity.epochLimit
  ) {
    return 'REJECTED';
  }
  const tierLimit = DEVELOPMENT_TIER_LIMITS[input.vault.securityTier];
  if (input.quantity > tierLimit) {
    return 'REJECTED';
  }
  if (input.quantity >= input.vault.approvalPolicy.highValueThreshold) {
    return 'ADDITIONAL_APPROVAL_REQUIRED';
  }
  if (input.vault.approvalPolicy.mode !== 'SINGLE_OPERATOR') {
    return 'ADDITIONAL_APPROVAL_REQUIRED';
  }
  void input.destinationHistoryCount;
  return 'ELIGIBLE';
}

export function previewBindsApprovedBytes(
  preview: TransactionPreview,
  signedCanonicalHex: string,
): boolean {
  return preview.canonicalBytesHex === signedCanonicalHex;
}

export function remainingVelocity(
  policy: VelocityPolicy,
  dailySpent: bigint,
  epochSpent: bigint,
): { readonly dailyRemaining: bigint; readonly epochRemaining: bigint } {
  return {
    dailyRemaining: policy.dailyLimit - dailySpent,
    epochRemaining: policy.epochLimit - epochSpent,
  };
}
