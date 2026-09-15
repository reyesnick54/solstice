import type { Clock } from '../../../config/src/clock.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { CustomerId } from '../../../domain/src/customer.ts';
import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { CompiledEconomicMandate } from '../mandate/types.ts';
import { validateApprovalBinding, approvalPermittedScope } from './approval-binding.ts';
import { capabilityPermittedScope, platformPermittedScope, validateCapabilityForScope } from './capability-binding.ts';
import { sealAuthorityBindingDecision } from './evidence.ts';
import { bindingDecisionIdFor } from './ids.ts';
import {
  mandateBindingRefFromCompiled,
  mandatePermittedScopeFromCompiled,
  requestedScopeWithinMandate,
  validateMandateBinding,
} from './mandate-binding.ts';
import { detectMaterialScopeChange } from './material-change.ts';
import { applyRevocationToWorkOrder, revocationEffectForMandate } from './revocation.ts';
import { intersectWorkOrderScope } from './scope.ts';
import { InMemoryHeliosWorkOrderStore } from './store.ts';
import type {
  ApprovalClass,
  BindingCheckpoint,
  BindingDecisionOutcome,
} from './taxonomy.ts';
import type {
  AuthorityBindingDecision,
  BindingFailure,
  CapabilityBindingContext,
  EconomicWorkOrder,
  ToolModelCapabilityGrant,
  WorkOrderApprovalRef,
  WorkOrderScope,
} from './types.ts';
import { createEconomicWorkOrderDraft } from './work-order.ts';
import type { EconomicWorkOrderId } from './ids.ts';

export type EvaluateBindingInput = {
  readonly workOrder: EconomicWorkOrder;
  readonly mandate: CompiledEconomicMandate;
  readonly capabilityContext: CapabilityBindingContext;
  readonly checkpoint: BindingCheckpoint;
  readonly actorId: string;
  readonly approvedScope?: WorkOrderScope | null;
};

/**
 * Binds Economic Work Orders to current mandate, capability, and approval
 * authority. HELIOS may only narrow authority; it never widens it.
 */
export class HeliosWorkOrderBindingService {
  private readonly clock: Clock;
  private readonly evidence?: EvidenceVault;
  readonly store: InMemoryHeliosWorkOrderStore;
  private decisionSequence = 0;

  constructor(input: {
    readonly clock: Clock;
    readonly evidence?: EvidenceVault;
    readonly store?: InMemoryHeliosWorkOrderStore;
  }) {
    this.clock = input.clock;
    if (input.evidence) {
      this.evidence = input.evidence;
    }
    this.store = input.store ?? new InMemoryHeliosWorkOrderStore();
  }

  createWorkOrder(input: {
    readonly workOrderId: EconomicWorkOrderId;
    readonly customerId: CustomerId;
    readonly subjectId: string;
    readonly growObjectiveId: string;
    readonly requestedScope: WorkOrderScope;
    readonly mandate: CompiledEconomicMandate;
    readonly capabilityContext: CapabilityBindingContext;
    readonly approvalRef: WorkOrderApprovalRef | null;
    readonly requiredApprovalClass: ApprovalClass;
    readonly actorId: string;
  }): Result<EconomicWorkOrder, BindingFailure> {
    if (input.capabilityContext.customerId !== input.customerId) {
      return err({ code: 'WORK_ORDER_CUSTOMER_MISMATCH', message: 'capability context customer mismatch' });
    }
    if (input.subjectId !== input.mandate.subjectId) {
      return err({ code: 'MANDATE_CUSTOMER_MISMATCH', message: 'mandate does not belong to this customer work order subject' });
    }
    const mandateRef = mandateBindingRefFromCompiled(input.mandate, input.customerId, this.clock.now());
    const draft = createEconomicWorkOrderDraft({
      workOrderId: input.workOrderId,
      customerId: input.customerId,
      subjectId: input.subjectId,
      growObjectiveId: input.growObjectiveId,
      requestedScope: input.requestedScope,
      mandateRef,
      approvalRef: input.approvalRef,
      requiredApprovalClass: input.requiredApprovalClass,
      now: this.clock.now(),
    });
    const evaluation = this.evaluateBinding({
      workOrder: draft,
      mandate: input.mandate,
      capabilityContext: input.capabilityContext,
      checkpoint: 'CREATION',
      actorId: input.actorId,
      approvedScope: input.approvalRef ? input.requestedScope : null,
    });
    if (!evaluation.ok) {
      return err(evaluation.error);
    }
    const decision = evaluation.value;
    if (decision.outcome === 'BLOCKED') {
      return err({
        code: decision.reasonCodes[0] ?? 'MANDATE_SCOPE_EXCEEDED',
        message: 'work order authority binding blocked at creation',
      });
    }
    const workOrder = Object.freeze({
      ...draft,
      state: decision.outcome === 'REQUIRES_REVIEW' ? 'REQUIRES_REVIEW' : 'AWAITING_AUTHORITY',
      effectiveScope: decision.effectiveScope,
      updatedAt: this.clock.now(),
    });
    this.store.putWorkOrder(workOrder);
    return ok(workOrder);
  }

  activateWorkOrder(
    workOrderId: EconomicWorkOrderId,
    mandate: CompiledEconomicMandate,
    capabilityContext: CapabilityBindingContext,
    actorId: string,
    approvedScope?: WorkOrderScope | null,
  ): Result<EconomicWorkOrder, BindingFailure> {
    const workOrder = this.store.getWorkOrder(workOrderId);
    if (!workOrder) {
      return err({ code: 'WORK_ORDER_CUSTOMER_MISMATCH', message: 'work order not found' });
    }
    if (workOrder.customerId !== capabilityContext.customerId) {
      return err({ code: 'WORK_ORDER_CUSTOMER_MISMATCH', message: 'customer isolation violation' });
    }
    const evaluation = this.evaluateBinding({
      workOrder,
      mandate,
      capabilityContext,
      checkpoint: 'ACTIVATION',
      actorId,
      approvedScope,
    });
    if (!evaluation.ok) {
      return err(evaluation.error);
    }
    const decision = evaluation.value;
    if (decision.outcome === 'BLOCKED' || decision.outcome === 'REQUIRES_REVIEW') {
      const blocked = Object.freeze({
        ...workOrder,
        state: decision.outcome === 'REQUIRES_REVIEW' ? 'REQUIRES_REVIEW' : 'BLOCKED',
        effectiveScope: null,
        updatedAt: this.clock.now(),
      });
      this.store.putWorkOrder(blocked);
      return err({
        code: decision.reasonCodes[0] ?? 'MANDATE_NOT_ACTIVE',
        message: 'work order cannot activate under current authority',
      });
    }
    const active = Object.freeze({
      ...workOrder,
      state: 'ACTIVE',
      effectiveScope: decision.effectiveScope,
      activatedAt: this.clock.now(),
      updatedAt: this.clock.now(),
    });
    this.store.putWorkOrder(active);
    this.issueToolModelGrant(active);
    return ok(active);
  }

  revalidateAtCheckpoint(
    workOrderId: EconomicWorkOrderId,
    mandate: CompiledEconomicMandate,
    capabilityContext: CapabilityBindingContext,
    checkpoint: BindingCheckpoint,
    actorId: string,
    approvedScope?: WorkOrderScope | null,
  ): Result<AuthorityBindingDecision, BindingFailure> {
    const workOrder = this.store.getWorkOrder(workOrderId);
    if (!workOrder) {
      return err({ code: 'WORK_ORDER_CUSTOMER_MISMATCH', message: 'work order not found' });
    }
    return this.evaluateBinding({
      workOrder,
      mandate,
      capabilityContext,
      checkpoint,
      actorId,
      approvedScope,
    });
  }

  amendScope(
    workOrderId: EconomicWorkOrderId,
    nextScope: WorkOrderScope,
    mandate: CompiledEconomicMandate,
    capabilityContext: CapabilityBindingContext,
    actorId: string,
    approvalRef: WorkOrderApprovalRef | null,
  ): Result<EconomicWorkOrder, BindingFailure> {
    const workOrder = this.store.getWorkOrder(workOrderId);
    if (!workOrder) {
      return err({ code: 'WORK_ORDER_CUSTOMER_MISMATCH', message: 'work order not found' });
    }
    const material = detectMaterialScopeChange(workOrder.requestedScope, nextScope);
    const requiresNewApproval = material.material && workOrder.requiredApprovalClass !== 'NONE';
    if (requiresNewApproval) {
      const pendingReview = Object.freeze({
        ...workOrder,
        requestedScope: nextScope,
        approvalRef: null,
        effectiveScope: null,
        state: 'REQUIRES_REVIEW',
        updatedAt: this.clock.now(),
      });
      this.store.putWorkOrder(pendingReview);
      return err({ code: 'APPROVAL_INVALIDATED', message: 'material scope change requires new approval' });
    }
    const amended = Object.freeze({
      ...workOrder,
      requestedScope: nextScope,
      approvalRef: approvalRef ?? workOrder.approvalRef,
      updatedAt: this.clock.now(),
    });
    this.store.putWorkOrder(amended);
    const evaluation = this.evaluateBinding({
      workOrder: amended,
      mandate,
      capabilityContext,
      checkpoint: 'AMENDMENT',
      actorId,
      approvedScope: approvalRef ? nextScope : null,
    });
    if (!evaluation.ok) {
      return err(evaluation.error);
    }
    const updated = Object.freeze({
      ...amended,
      effectiveScope: evaluation.value.effectiveScope,
      state: evaluation.value.outcome === 'BLOCKED' ? 'BLOCKED' : amended.state,
    });
    this.store.putWorkOrder(updated);
    return ok(updated);
  }

  handleAuthorityRevocation(
    workOrderId: EconomicWorkOrderId,
    mandate: CompiledEconomicMandate,
  ): Result<EconomicWorkOrder, BindingFailure> {
    const workOrder = this.store.getWorkOrder(workOrderId);
    if (!workOrder) {
      return err({ code: 'WORK_ORDER_CUSTOMER_MISMATCH', message: 'work order not found' });
    }
    const effect = revocationEffectForMandate(mandate, workOrder);
    if (!effect) {
      return ok(workOrder);
    }
    const revoked = applyRevocationToWorkOrder(workOrder, effect.nextState, this.clock.now());
    this.store.putWorkOrder(revoked);
    for (const grantId of [...this.store.decisionsForWorkOrder(workOrderId)].map(() => workOrder.workOrderId)) {
      this.store.revokeGrant(`tmg_${grantId}`, this.clock.now());
    }
    return ok(revoked);
  }

  private evaluateBinding(
    input: EvaluateBindingInput,
  ): Result<AuthorityBindingDecision, BindingFailure> {
    const now = this.clock.now();
    if (input.workOrder.customerId !== input.capabilityContext.customerId) {
      return err({ code: 'WORK_ORDER_CUSTOMER_MISMATCH', message: 'customer isolation violation' });
    }
    const mandateFailure = validateMandateBinding({
      mandate: input.mandate,
      mandateRef: input.workOrder.mandateRef,
      customerId: input.workOrder.customerId,
      now,
    });
    if (mandateFailure) {
      return this.recordDecision(input, 'BLOCKED', null, [mandateFailure.code], mandateFailure);
    }
    const capitalFailure = requestedScopeWithinMandate(
      input.workOrder.requestedScope.capitalCeiling,
      mandatePermittedScopeFromCompiled(input.mandate),
    );
    if (capitalFailure) {
      return this.recordDecision(input, 'BLOCKED', null, [capitalFailure.code], capitalFailure);
    }
    const capabilityFailure = validateCapabilityForScope(input.capabilityContext, input.workOrder.requestedScope);
    if (capabilityFailure) {
      return this.recordDecision(input, 'BLOCKED', null, [capabilityFailure.code], capabilityFailure);
    }
    const approvalFailure = validateApprovalBinding({
      approvalRef: input.workOrder.approvalRef,
      requiredApprovalClass: input.workOrder.requiredApprovalClass,
      customerId: input.workOrder.customerId,
      scope: input.workOrder.requestedScope,
      now,
    });
    if (approvalFailure) {
      const outcome: BindingDecisionOutcome =
        approvalFailure.code === 'APPROVAL_MISSING' ? 'REQUIRES_REVIEW' : 'BLOCKED';
      return this.recordDecision(input, outcome, null, [approvalFailure.code], approvalFailure);
    }

    const mandateScope = mandatePermittedScopeFromCompiled(input.mandate);
    const capabilityScope = capabilityPermittedScope(input.capabilityContext);
    const approvalScope = approvalPermittedScope(input.workOrder.approvalRef, input.approvedScope ?? null);
    const intersection = intersectWorkOrderScope({
      requested: input.workOrder.requestedScope,
      mandate: mandateScope,
      capabilityPermitted: capabilityScope,
      approvalPermitted: approvalScope,
      platformPermitted: platformPermittedScope(),
    });

    if (intersection.blocked) {
      const failure: BindingFailure = {
        code: intersection.reasonCodes[0] ?? 'MANDATE_SCOPE_EXCEEDED',
        message: 'effective scope intersection blocked',
      };
      return this.recordDecision(input, 'BLOCKED', null, intersection.reasonCodes, failure);
    }

    const outcome: BindingDecisionOutcome =
      intersection.narrowedElements.length > 0 ? 'NARROWED' : 'ALLOWED';
    return this.recordDecision(input, outcome, intersection.effective, intersection.reasonCodes);
  }

  private recordDecision(
    input: EvaluateBindingInput,
    outcome: BindingDecisionOutcome,
    effectiveScope: WorkOrderScope | null,
    reasonCodes: readonly BindingFailure['code'][] | readonly string[],
    failure?: BindingFailure,
  ): Result<AuthorityBindingDecision, BindingFailure> {
    this.decisionSequence += 1;
    const decision: AuthorityBindingDecision = Object.freeze({
      decisionId: bindingDecisionIdFor(input.workOrder.workOrderId, this.decisionSequence),
      workOrderId: input.workOrder.workOrderId,
      customerId: input.workOrder.customerId,
      checkpoint: input.checkpoint,
      outcome,
      requestedScope: input.workOrder.requestedScope,
      effectiveScope,
      narrowedElements: Object.freeze([]),
      reasonCodes: Object.freeze(reasonCodes as BindingFailure['code'][]),
      mandateRef: input.workOrder.mandateRef,
      capabilityContextVersion: input.capabilityContext.contextVersion,
      approvalRef: input.workOrder.approvalRef,
      decidedAt: this.clock.now(),
      actorId: input.actorId,
      environment: 'simulation',
    });
    this.store.appendDecision(decision);
    sealAuthorityBindingDecision(this.evidence, decision);
    if (failure) {
      return err(failure);
    }
    return ok(decision);
  }

  private issueToolModelGrant(workOrder: EconomicWorkOrder): void {
    if (!workOrder.effectiveScope) {
      return;
    }
    const grant: ToolModelCapabilityGrant = Object.freeze({
      grantId: `tmg_${workOrder.workOrderId}`,
      workOrderId: workOrder.workOrderId,
      customerId: workOrder.customerId,
      toolIds: workOrder.effectiveScope.toolIds,
      modelIds: workOrder.effectiveScope.modelIds,
      revocable: true,
      issuedAt: this.clock.now(),
      revokedAt: null,
    });
    this.store.putGrant(grant);
  }
}
