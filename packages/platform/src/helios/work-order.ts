import { sha256Hex } from '../../../security/src/hash.ts';
import type { CustomerId } from '../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ApprovalClass } from './taxonomy.ts';
import type {
  EconomicWorkOrder,
  MandateBindingRef,
  WorkOrderApprovalRef,
  WorkOrderScope,
} from './types.ts';
import type { EconomicWorkOrderId } from './ids.ts';

export function workOrderContentHash(input: {
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly requestedScope: WorkOrderScope;
  readonly mandateRef: MandateBindingRef;
  readonly approvalRef: WorkOrderApprovalRef | null;
}): string {
  return sha256Hex(
    JSON.stringify({
      workOrderId: input.workOrderId,
      customerId: input.customerId,
      requestedScope: input.requestedScope,
      mandateRef: {
        mandateId: input.mandateRef.mandateId,
        mandateVersion: input.mandateRef.mandateVersion,
        snapshotHash: input.mandateRef.snapshotHash,
      },
      approvalRef: input.approvalRef
        ? { approvalBindingId: input.approvalRef.approvalBindingId, scopeHash: input.approvalRef.scopeHash }
        : null,
    }),
  );
}

export function createEconomicWorkOrderDraft(input: {
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly subjectId: string;
  readonly growObjectiveId: string;
  readonly requestedScope: WorkOrderScope;
  readonly mandateRef: MandateBindingRef;
  readonly approvalRef: WorkOrderApprovalRef | null;
  readonly requiredApprovalClass: ApprovalClass;
  readonly now: UtcInstant;
}): EconomicWorkOrder {
  const contentHash = workOrderContentHash({
    workOrderId: input.workOrderId,
    customerId: input.customerId,
    requestedScope: input.requestedScope,
    mandateRef: input.mandateRef,
    approvalRef: input.approvalRef,
  });
  return Object.freeze({
    workOrderId: input.workOrderId,
    customerId: input.customerId,
    subjectId: input.subjectId,
    growObjectiveId: input.growObjectiveId,
    state: 'DRAFT',
    requestedScope: input.requestedScope,
    effectiveScope: null,
    mandateRef: input.mandateRef,
    approvalRef: input.approvalRef,
    requiredApprovalClass: input.requiredApprovalClass,
    createdAt: input.now,
    updatedAt: input.now,
    activatedAt: null,
    contentHash,
    grantsExecutionAuthority: false,
    authorizesFinancialExecution: false,
  });
}
