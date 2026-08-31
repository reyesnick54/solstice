/**
 * ACCESS Wave 3 — proportional refund allocation across funding sources.
 */

export type RefundAllocationPolicyId = 'PROPORTIONAL_V1' | 'USER_FIRST_V1';

export type RefundAllocationInput = {
  readonly totalRefundMinorUnits: bigint;
  readonly originalAccessContribution: bigint;
  readonly originalUserContribution: bigint;
  readonly originalTokenContribution: bigint;
  readonly policyId: RefundAllocationPolicyId;
};

export type RefundAllocation = {
  readonly accessPoolRefundMinorUnits: bigint;
  readonly userRefundMinorUnits: bigint;
  readonly tokenRefundMinorUnits: bigint;
  readonly policyId: RefundAllocationPolicyId;
  readonly policyVersion: string;
};

export function allocateRefund(input: RefundAllocationInput): RefundAllocation {
  const totalOriginal =
    input.originalAccessContribution + input.originalUserContribution + input.originalTokenContribution;
  if (input.totalRefundMinorUnits <= 0n) {
    return Object.freeze({
      accessPoolRefundMinorUnits: 0n,
      userRefundMinorUnits: 0n,
      tokenRefundMinorUnits: 0n,
      policyId: input.policyId,
      policyVersion: 'v1',
    });
  }
  if (totalOriginal === 0n) {
    return Object.freeze({
      accessPoolRefundMinorUnits: 0n,
      userRefundMinorUnits: input.totalRefundMinorUnits,
      tokenRefundMinorUnits: 0n,
      policyId: input.policyId,
      policyVersion: 'v1',
    });
  }

  if (input.policyId === 'USER_FIRST_V1') {
    const userRefund =
      input.totalRefundMinorUnits < input.originalUserContribution
        ? input.totalRefundMinorUnits
        : input.originalUserContribution;
    const remainder = input.totalRefundMinorUnits - userRefund;
    const accessRefund =
      remainder < input.originalAccessContribution ? remainder : input.originalAccessContribution;
    return Object.freeze({
      accessPoolRefundMinorUnits: accessRefund,
      userRefundMinorUnits: userRefund,
      tokenRefundMinorUnits: 0n,
      policyId: input.policyId,
      policyVersion: 'v1',
    });
  }

  const refund = input.totalRefundMinorUnits;
  const accessShare = (refund * input.originalAccessContribution) / totalOriginal;
  const userShare = (refund * input.originalUserContribution) / totalOriginal;
  const tokenShare = refund - accessShare - userShare;
  return Object.freeze({
    accessPoolRefundMinorUnits: accessShare,
    userRefundMinorUnits: userShare,
    tokenRefundMinorUnits: tokenShare,
    policyId: 'PROPORTIONAL_V1',
    policyVersion: 'v1',
  });
}
