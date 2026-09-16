import type { CustomerId } from '../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ApprovalClass } from './taxonomy.ts';
import type { BindingFailure, WorkOrderApprovalRef, WorkOrderScope } from './types.ts';
import { scopeHash } from './scope.ts';
import { approvalBindingIdFor } from './ids.ts';

export function createWorkOrderApprovalRef(input: {
  readonly workOrderId: string;
  readonly approvalId: string;
  readonly customerId: CustomerId;
  readonly actorId: string;
  readonly actorKind: WorkOrderApprovalRef['actorKind'];
  readonly approvalClass: ApprovalClass;
  readonly approvedScope: WorkOrderScope;
  readonly now: UtcInstant;
  readonly expiresAt?: UtcInstant | null;
}): WorkOrderApprovalRef | BindingFailure {
  if (input.actorKind !== 'CUSTOMER' && input.actorKind !== 'HUMAN_OPERATOR') {
    return { code: 'AGENT_CANNOT_APPROVE', message: 'only a human customer or operator may approve work order scope' };
  }
  return Object.freeze({
    approvalBindingId: approvalBindingIdFor(input.workOrderId, input.approvalId),
    approvalId: input.approvalId,
    customerId: input.customerId,
    actorId: input.actorId,
    actorKind: input.actorKind,
    approvalClass: input.approvalClass,
    scopeHash: scopeHash(input.approvedScope),
    effectiveAt: input.now,
    expiresAt: input.expiresAt ?? null,
  });
}

export function validateApprovalBinding(input: {
  readonly approvalRef: WorkOrderApprovalRef | null;
  readonly requiredApprovalClass: ApprovalClass;
  readonly customerId: CustomerId;
  readonly scope: WorkOrderScope;
  readonly now: UtcInstant;
}): BindingFailure | null {
  if (input.requiredApprovalClass === 'NONE') {
    return null;
  }
  if (!input.approvalRef) {
    return { code: 'APPROVAL_MISSING', message: 'explicit approval is required for this work order' };
  }
  if (input.approvalRef.customerId !== input.customerId) {
    return { code: 'APPROVAL_CUSTOMER_MISMATCH', message: 'approval does not belong to this customer' };
  }
  if (input.approvalRef.expiresAt && input.approvalRef.expiresAt <= input.now) {
    return { code: 'APPROVAL_EXPIRED', message: 'approval has expired' };
  }
  const currentHash = scopeHash(input.scope);
  if (input.approvalRef.scopeHash !== currentHash) {
    return { code: 'APPROVAL_SCOPE_MISMATCH', message: 'approval does not cover the current work order scope' };
  }
  return null;
}

export function approvalPermittedScope(
  approvalRef: WorkOrderApprovalRef | null,
  approvedScope: WorkOrderScope | null,
): WorkOrderScope | null {
  if (!approvalRef || !approvedScope) {
    return null;
  }
  return approvedScope;
}
