import type { UtcInstant } from '../../../domain/src/time.ts';
import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { EconomicWorkOrderId, HeliosTaskId } from './ids.ts';
import type { HeliosAuditEventKind } from './taxonomy.ts';
import type { AuthorityBindingDecision } from './types.ts';
import type { HeliosAuditEvent } from './execution-types.ts';

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

export function heliosAuditEvent(
  kind: HeliosAuditEventKind,
  occurredAt: UtcInstant,
  customerId: string,
  detail: string,
  ids: {
    readonly workOrderId?: EconomicWorkOrderId;
    readonly taskId?: HeliosTaskId;
  } = {},
): HeliosAuditEvent {
  return Object.freeze({
    kind,
    occurredAt,
    customerId,
    detail,
    ...ids,
  });
}
