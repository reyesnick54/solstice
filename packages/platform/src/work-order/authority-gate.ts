import type { Clock } from '../../../config/src/clock.ts';
import { asCustomerId, type CustomerId } from '../../../domain/src/customer.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { DomainEventLog } from '../../../events/src/events.ts';
import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import {
  HeliosWorkOrderBindingService,
  type ApprovalClass,
  type BindingFailure,
  type CapabilityBindingContext,
  type EconomicWorkOrder as BoundWorkOrder,
  type WorkOrderApprovalRef,
} from '../helios/index.ts';
import { asEconomicWorkOrderId as asBoundWorkOrderId } from '../helios/ids.ts';
import type { CompiledEconomicMandate } from '../mandate/types.ts';
import { canTransitionWorkOrder } from './lifecycle.ts';
import { scopeFromCoordinationWorkOrder } from './scope-mapper.ts';
import { EconomicWorkOrderService } from './service.ts';
import type {
  CreateEconomicWorkOrderInput,
  EconomicWorkOrder,
  WorkOrderFailure,
} from './types.ts';

export type AuthorityGateInput = {
  readonly mandate: CompiledEconomicMandate;
  readonly capabilityContext: CapabilityBindingContext;
  readonly approvalRef: WorkOrderApprovalRef | null;
  readonly requiredApprovalClass: ApprovalClass;
  readonly growObjectiveId: string;
};

export type AuthorityBoundWorkOrder = {
  readonly coordination: EconomicWorkOrder;
  readonly binding: BoundWorkOrder;
};

/**
 * Composes H04 coordination envelopes with H05 mandate/capability/approval binding.
 * A coordination Work Order is never treated as permission by itself.
 */
export class AuthorityBoundWorkOrderService {
  readonly coordination: EconomicWorkOrderService;
  readonly binding: HeliosWorkOrderBindingService;

  constructor(input: {
    readonly clock: Clock;
    readonly events: DomainEventLog;
    readonly evidence?: EvidenceVault;
    readonly coordination?: EconomicWorkOrderService;
    readonly binding?: HeliosWorkOrderBindingService;
  }) {
    this.coordination =
      input.coordination ??
      new EconomicWorkOrderService({ clock: input.clock, events: input.events });
    this.binding =
      input.binding ??
      new HeliosWorkOrderBindingService({
        clock: input.clock,
        ...(input.evidence ? { evidence: input.evidence } : {}),
      });
  }

  createWithAuthority(
    actor: unknown,
    input: CreateEconomicWorkOrderInput,
    authority: AuthorityGateInput,
    actorId: string,
  ): Result<AuthorityBoundWorkOrder, WorkOrderFailure | BindingFailure> {
    const customerId = asCustomerId(input.customerId);
    if (authority.capabilityContext.customerId !== customerId) {
      return err({ code: 'WORK_ORDER_CUSTOMER_MISMATCH', message: 'capability context customer mismatch' });
    }
    const created = this.coordination.createEconomicWorkOrder(actor, input);
    if (!created.ok) {
      return created;
    }
    const bound = this.binding.createWorkOrder({
      workOrderId: asBoundWorkOrderId(created.value.workOrderId),
      customerId,
      subjectId: created.value.subjectId,
      growObjectiveId: authority.growObjectiveId,
      requestedScope: scopeFromCoordinationWorkOrder(created.value),
      mandate: authority.mandate,
      capabilityContext: authority.capabilityContext,
      approvalRef: authority.approvalRef,
      requiredApprovalClass: authority.requiredApprovalClass,
      actorId,
    });
    if (!bound.ok) {
      return bound;
    }
    return ok(Object.freeze({ coordination: created.value, binding: bound.value }));
  }

  activateWithAuthority(
    actor: unknown,
    workOrderId: string,
    customerId: string,
    authority: Pick<AuthorityGateInput, 'mandate' | 'capabilityContext' | 'approvalRef'>,
    actorId: string,
  ): Result<AuthorityBoundWorkOrder, WorkOrderFailure | BindingFailure> {
    const loaded = this.coordination.getEconomicWorkOrder(actor, workOrderId, customerId);
    if (!loaded.ok) {
      return loaded;
    }
    const boundId = asBoundWorkOrderId(workOrderId);
    const activation = this.binding.activateWorkOrder(
      boundId,
      authority.mandate,
      authority.capabilityContext,
      actorId,
      authority.approvalRef ? scopeFromCoordinationWorkOrder(loaded.value) : null,
    );
    if (!activation.ok) {
      if (canTransitionWorkOrder(loaded.value.state, 'BLOCKED')) {
        this.coordination.transitionEconomicWorkOrder(
          actor,
          workOrderId,
          customerId,
          'BLOCKED',
          `authority binding blocked: ${activation.error.code}`,
        );
      }
      return err(activation.error);
    }
    const activated = this.coordination.activateEconomicWorkOrder(actor, workOrderId, customerId);
    if (!activated.ok) {
      return activated;
    }
    return ok(Object.freeze({ coordination: activated.value, binding: activation.value }));
  }

  resumeWithAuthority(
    actor: unknown,
    workOrderId: string,
    customerId: string,
    authority: Pick<AuthorityGateInput, 'mandate' | 'capabilityContext' | 'approvalRef'>,
    actorId: string,
  ): Result<AuthorityBoundWorkOrder, WorkOrderFailure | BindingFailure> {
    const loaded = this.coordination.getEconomicWorkOrder(actor, workOrderId, customerId);
    if (!loaded.ok) {
      return loaded;
    }
    if (loaded.value.state !== 'PAUSED') {
      return err({ code: 'INVALID_TRANSITION', message: 'work order is not paused' });
    }
    const revalidated = this.binding.revalidateAtCheckpoint(
      asBoundWorkOrderId(workOrderId),
      authority.mandate,
      authority.capabilityContext,
      'RESUME',
      actorId,
      authority.approvalRef ? scopeFromCoordinationWorkOrder(loaded.value) : null,
    );
    if (!revalidated.ok) {
      return revalidated;
    }
    if (revalidated.value.outcome === 'BLOCKED' || revalidated.value.outcome === 'REQUIRES_REVIEW') {
      this.coordination.transitionEconomicWorkOrder(
        actor,
        workOrderId,
        customerId,
        'BLOCKED',
        `authority revalidation blocked at resume: ${revalidated.value.reasonCodes.join(',')}`,
      );
      return err({
        code: revalidated.value.reasonCodes[0] ?? 'MANDATE_NOT_ACTIVE',
        message: 'work order cannot resume under current authority',
      });
    }
    const resumed = this.coordination.transitionEconomicWorkOrder(
      actor,
      workOrderId,
      customerId,
      'ACTIVE',
      'resumed after authority revalidation',
    );
    if (!resumed.ok) {
      return resumed;
    }
    const bound = this.binding.store.getWorkOrder(asBoundWorkOrderId(workOrderId));
    if (!bound) {
      return err({ code: 'WORK_ORDER_CUSTOMER_MISMATCH', message: 'bound work order not found' });
    }
    return ok(Object.freeze({ coordination: resumed.value, binding: bound }));
  }

  revalidateAuthority(
    workOrderId: string,
    customerId: CustomerId,
    authority: Pick<AuthorityGateInput, 'mandate' | 'capabilityContext' | 'approvalRef'>,
    checkpoint: 'TASK_DISPATCH' | 'FINANCIAL_PROPOSAL' | 'AUTHORITY_CHANGE',
    actorId: string,
  ): Result<BoundWorkOrder, BindingFailure> {
    const bound = this.binding.store.getWorkOrder(asBoundWorkOrderId(workOrderId));
    if (!bound || bound.customerId !== customerId) {
      return err({ code: 'WORK_ORDER_CUSTOMER_MISMATCH', message: 'bound work order not found' });
    }
    const scope = scopeFromCoordinationWorkOrder(
      this.coordination.store.get(workOrderId) as EconomicWorkOrder,
    );
    const decision = this.binding.revalidateAtCheckpoint(
      asBoundWorkOrderId(workOrderId),
      authority.mandate,
      authority.capabilityContext,
      checkpoint,
      actorId,
      authority.approvalRef ? scope : null,
    );
    if (!decision.ok) {
      return decision;
    }
    if (decision.value.outcome === 'BLOCKED' || decision.value.outcome === 'REQUIRES_REVIEW') {
      return err({
        code: decision.value.reasonCodes[0] ?? 'MANDATE_NOT_ACTIVE',
        message: `authority revalidation failed at ${checkpoint}`,
      });
    }
    const refreshed = this.binding.store.getWorkOrder(asBoundWorkOrderId(workOrderId));
    if (!refreshed) {
      return err({ code: 'WORK_ORDER_CUSTOMER_MISMATCH', message: 'bound work order not found' });
    }
    return ok(refreshed);
  }

  handleAuthorityRevocation(
    actor: unknown,
    workOrderId: string,
    customerId: string,
    mandate: CompiledEconomicMandate,
  ): Result<AuthorityBoundWorkOrder, WorkOrderFailure | BindingFailure> {
    const revoked = this.binding.handleAuthorityRevocation(asBoundWorkOrderId(workOrderId), mandate);
    if (!revoked.ok) {
      return revoked;
    }
    const loaded = this.coordination.getEconomicWorkOrder(actor, workOrderId, customerId);
    if (!loaded.ok) {
      return loaded;
    }
    const blocked = this.coordination.transitionEconomicWorkOrder(
      actor,
      workOrderId,
      customerId,
      'BLOCKED',
      `mandate ${mandate.state}; authority revoked`,
    );
    if (!blocked.ok) {
      return blocked;
    }
    return ok(Object.freeze({ coordination: blocked.value, binding: revoked.value }));
  }
}
