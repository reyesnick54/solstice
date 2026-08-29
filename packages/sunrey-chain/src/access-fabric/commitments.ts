import { commitCanonical } from '../hash.ts';
import { ACCESS_COMMITMENT_DOMAINS } from './policy.ts';
import type {
  AccessGrantRecord,
  AccessReservation,
  AccessWorkflowEvent,
  DeliveryClaim,
  RefundAdjustmentProposal,
  UsageProof,
} from './types.ts';

function sortedFields(
  value: Readonly<Record<string, string | number | boolean | null>>,
): Readonly<Record<string, string | number | boolean | null>> {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

export function commitAccessDomain(
  domain: string,
  fields: Readonly<Record<string, string | number | boolean | null>>,
): string {
  return commitCanonical({ domain, fields: sortedFields(fields) });
}

export function reservationCommitment(reservation: AccessReservation): string {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS.RESERVATION, {
    reservationId: reservation.reservationId,
    sessionId: reservation.sessionId,
    subjectRef: reservation.subjectRef,
    providerRef: reservation.providerRef,
    serviceDomain: reservation.serviceDomain,
    reservedQuantity: reservation.reservedQuantity.toString(),
    unit: reservation.unit,
    policyRef: reservation.policyRef,
    purpose: reservation.purpose,
  });
}

export function grantCommitment(grant: AccessGrantRecord): string {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS.GRANT, {
    grantId: grant.grantId,
    reservationId: grant.reservationId,
    sessionId: grant.sessionId,
    policyRef: grant.policyRef,
    purpose: grant.purpose,
    considerationRef: grant.considerationRef,
    considerationMinorUnits: grant.considerationMinorUnits.toString(),
    considerationCurrency: grant.considerationCurrency,
  });
}

export function usageProofCommitment(proof: UsageProof): string {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS.USAGE_PROOF, {
    proofId: proof.proofId,
    sessionId: proof.sessionId,
    measuredQuantity: proof.measuredQuantity.toString(),
    unit: proof.unit,
    evidenceQuality: proof.evidenceQuality,
    provenanceDigest: proof.provenance.provenanceDigest,
    contentCommitment: proof.provenance.contentCommitment,
    sourceClass: proof.provenance.sourceClass,
    nonce: proof.nonce,
  });
}

export function deliveryClaimCommitment(claim: DeliveryClaim): string {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS.DELIVERY_CLAIM, {
    claimId: claim.claimId,
    sessionId: claim.sessionId,
    deliveredQuantity: claim.deliveredQuantity.toString(),
    reservedQuantity: claim.reservedQuantity.toString(),
    unit: claim.unit,
    claimStatus: claim.claimStatus,
    evidenceQuality: claim.evidenceQuality,
    provenanceDigest: claim.provenance.provenanceDigest,
    contentCommitment: claim.provenance.contentCommitment,
    sourceClass: claim.provenance.sourceClass,
    nonce: claim.nonce,
  });
}

export function workflowEventCommitment(input: {
  readonly event: AccessWorkflowEvent;
  readonly sessionId: string;
  readonly recordId: string;
  readonly occurredAtUtc: string;
  readonly usageProofCommitment?: string | null;
  readonly deliveryClaimCommitment?: string | null;
}): string {
  const domain =
    ACCESS_COMMITMENT_DOMAINS[input.event] ??
    (`access.fabric.${input.event.toLowerCase().replace(/_/g, '-')}.v1` as const);
  return commitAccessDomain(domain, {
    event: input.event,
    sessionId: input.sessionId,
    recordId: input.recordId,
    occurredAtUtc: input.occurredAtUtc,
    usageProofCommitment: input.usageProofCommitment ?? null,
    deliveryClaimCommitment: input.deliveryClaimCommitment ?? null,
  });
}

export function disputeCommitment(input: {
  readonly disputeId: string;
  readonly sessionId: string;
  readonly reason: string;
  readonly openedAtUtc: string;
}): string {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS.DISPUTE, {
    disputeId: input.disputeId,
    sessionId: input.sessionId,
    reason: input.reason,
    openedAtUtc: input.openedAtUtc,
  });
}

export function refundProposalCommitment(proposal: RefundAdjustmentProposal): string {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS.REFUND_ADJUSTMENT_PROPOSAL, {
    proposalId: proposal.proposalId,
    sessionId: proposal.sessionId,
    adjustmentMinorUnits: proposal.adjustmentMinorUnits.toString(),
    currency: proposal.currency,
    reason: proposal.reason,
    considerationRef: proposal.considerationRef,
    requiresKernelReview: true,
    routedToFinancialAuthority: true,
  });
}

export function idempotencyCommitment(nonce: string, sessionId: string): string {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS.IDEMPOTENCY, { nonce, sessionId });
}
