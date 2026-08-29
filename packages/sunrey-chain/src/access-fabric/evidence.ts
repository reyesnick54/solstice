import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { AccessWorkflowEvent, AccessCompletionSummary, AccessSession } from './types.ts';

export const ACCESS_EVIDENCE_KINDS = Object.freeze({
  WORKFLOW: 'ACCESS_FABRIC_WORKFLOW',
  USAGE_PROOF: 'ACCESS_FABRIC_USAGE_PROOF',
  DELIVERY_CLAIM: 'ACCESS_FABRIC_DELIVERY_CLAIM',
  DISPUTE: 'ACCESS_FABRIC_DISPUTE',
  REFUND_PROPOSAL: 'ACCESS_FABRIC_REFUND_PROPOSAL',
  COMPLETION_SUMMARY: 'ACCESS_FABRIC_COMPLETION_SUMMARY',
});

export function sealWorkflowEvidence(
  vault: EvidenceVault,
  input: {
    readonly event: AccessWorkflowEvent;
    readonly sessionId: string;
    readonly recordId: string;
    readonly chainCommitment: string;
    readonly usageProofId?: string | null;
    readonly deliveryClaimId?: string | null;
  },
): string {
  const record = vault.seal(ACCESS_EVIDENCE_KINDS.WORKFLOW, {
    event: input.event,
    sessionId: input.sessionId,
    recordId: input.recordId,
    chainCommitment: input.chainCommitment,
    usageProofId: input.usageProofId ?? null,
    deliveryClaimId: input.deliveryClaimId ?? null,
  });
  return record.evidenceId;
}

export function sealUsageProofEvidence(vault: EvidenceVault, proof: unknown): string {
  return vault.seal(ACCESS_EVIDENCE_KINDS.USAGE_PROOF, proof).evidenceId;
}

export function sealDeliveryClaimEvidence(vault: EvidenceVault, claim: unknown): string {
  return vault.seal(ACCESS_EVIDENCE_KINDS.DELIVERY_CLAIM, claim).evidenceId;
}

export function sealDisputeEvidence(vault: EvidenceVault, dispute: unknown): string {
  return vault.seal(ACCESS_EVIDENCE_KINDS.DISPUTE, dispute).evidenceId;
}

export function sealRefundProposalEvidence(vault: EvidenceVault, proposal: unknown): string {
  return vault.seal(ACCESS_EVIDENCE_KINDS.REFUND_PROPOSAL, proposal).evidenceId;
}

export function buildCompletionSummary(session: AccessSession): AccessCompletionSummary {
  const delivered = session.deliveryClaimIds.length > 0 ? session.deliveryClaimIds.join(',') : 'none';
  const usage = session.cumulativeUsage.toString();
  return Object.freeze({
    sessionId: session.sessionId,
    whyAccessGranted: `${session.grant.policyRef}:${session.grant.purpose}`,
    whatWasReserved: `${session.reservation.reservedQuantity.toString()} ${session.reservation.unit}`,
    whatWasDelivered: delivered,
    howMuchUsed: `${usage} ${session.reservation.unit}`,
    policyAllowed: session.grant.policyRef,
    considerationExchanged: `${session.grant.considerationMinorUnits.toString()} ${session.grant.considerationCurrency} (${session.grant.considerationRef})`,
    completionEvidenceRefs: Object.freeze([...session.workflowRecordIds]),
  });
}

export function sealCompletionSummary(
  vault: EvidenceVault,
  session: AccessSession,
): { readonly summary: AccessCompletionSummary; readonly evidenceId: string } {
  const summary = buildCompletionSummary(session);
  const evidenceId = vault.seal(ACCESS_EVIDENCE_KINDS.COMPLETION_SUMMARY, summary).evidenceId;
  return Object.freeze({ summary, evidenceId });
}
