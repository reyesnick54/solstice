import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { AuthorityBindingDecision } from './types.ts';

export function sealAuthorityBindingDecision(
  vault: EvidenceVault | undefined,
  decision: AuthorityBindingDecision,
): void {
  vault?.seal('HELIOS_AUTHORITY_BINDING', {
    decisionId: decision.decisionId,
    workOrderId: decision.workOrderId,
    customerId: decision.customerId,
    checkpoint: decision.checkpoint,
    outcome: decision.outcome,
    reasonCodes: decision.reasonCodes,
    mandateRef: {
      mandateId: decision.mandateRef.mandateId,
      mandateVersion: decision.mandateRef.mandateVersion,
      mandateState: decision.mandateRef.mandateState,
      snapshotHash: decision.mandateRef.snapshotHash,
    },
    capabilityContextVersion: decision.capabilityContextVersion,
    approvalRef: decision.approvalRef
      ? {
          approvalBindingId: decision.approvalRef.approvalBindingId,
          approvalId: decision.approvalRef.approvalId,
          scopeHash: decision.approvalRef.scopeHash,
        }
      : null,
    narrowedElements: decision.narrowedElements.map((item) => ({
      dimension: item.dimension,
      reasonCode: item.reasonCode,
    })),
    decidedAt: decision.decidedAt,
    actorId: decision.actorId,
    environment: decision.environment,
    grantsExecutionAuthority: false,
  });
}
