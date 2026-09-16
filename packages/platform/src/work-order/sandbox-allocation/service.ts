import { randomUUID } from 'node:crypto';

import type { Clock } from '../../../../config/src/clock.ts';
import { err, isErr, ok, type Result } from '../../../../domain/src/result.ts';
import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import type { GrowComplianceCheckpointInput } from '../../grow/lifecycle/compliance-checkpoint.ts';
import type { CompiledEconomicMandate } from '../../mandate/types.ts';
import type { CapabilityBindingContext, WorkOrderApprovalRef } from '../../helios/types.ts';
import { AuthorityBoundWorkOrderService } from '../authority-gate.ts';
import type { EconomicWorkOrder } from '../types.ts';
import { sealAllocationEvidence } from './evidence.ts';
import { asGrowSandboxAllocationId } from './ids.ts';
import {
  assertPositiveMinorUnits,
  type SandboxAccountFundsPort,
  type SandboxCapitalReservationPort,
} from './ports.ts';
import { InMemoryGrowSandboxAllocationStore } from './store.ts';
import type {
  GrowAllocationFailure,
  GrowSandboxAllocation,
  ReleaseGrowSandboxAllocationInput,
  RequestGrowSandboxAllocationInput,
} from './types.ts';
import {
  allocationStatusForAccepted,
  assertSandboxEnvironment,
  computeAllocatableMinorUnits,
  computeLiquidityRetentionMinorUnits,
  evaluateAllocationCompliance,
  evaluateAllocationRisk,
  type AllocationRiskInput,
  validateMandateCurrency,
  validateMandateSingleActionLimit,
  validateWorkOrderForAllocation,
} from './validation.ts';

export type RequestGrowSandboxAllocationContext = {
  readonly mandate: CompiledEconomicMandate;
  readonly capabilityContext: CapabilityBindingContext;
  readonly approvalRef: WorkOrderApprovalRef | null;
  readonly riskFacts: AllocationRiskInput;
  readonly complianceFacts: GrowComplianceCheckpointInput;
  readonly actorId: string;
};

/**
 * Binds HELIOS Economic Work Orders to canonical sandbox account cash via
 * coordination records and canonical holds. Not a second balance or ledger.
 */
export class GrowSandboxAllocationService {
  private readonly clock: Clock;
  private readonly evidence?: EvidenceVault;
  private readonly funds: SandboxAccountFundsPort;
  private readonly reservations: SandboxCapitalReservationPort;
  private readonly authority: AuthorityBoundWorkOrderService;
  readonly store: InMemoryGrowSandboxAllocationStore;

  constructor(input: {
    readonly clock: Clock;
    readonly funds: SandboxAccountFundsPort;
    readonly reservations: SandboxCapitalReservationPort;
    readonly authority: AuthorityBoundWorkOrderService;
    readonly evidence?: EvidenceVault;
    readonly store?: InMemoryGrowSandboxAllocationStore;
  }) {
    this.clock = input.clock;
    this.funds = input.funds;
    this.reservations = input.reservations;
    this.authority = input.authority;
    if (input.evidence) {
      this.evidence = input.evidence;
    }
    this.store = input.store ?? new InMemoryGrowSandboxAllocationStore();
  }

  async requestAllocation(
    actor: unknown,
    input: RequestGrowSandboxAllocationInput,
    context: RequestGrowSandboxAllocationContext,
  ): Promise<Result<GrowSandboxAllocation, GrowAllocationFailure>> {
    const sandbox = assertSandboxEnvironment();
    if (isErr(sandbox)) {
      return sandbox;
    }

    const replay = this.store.getByIdempotency(input.customerId, input.idempotencyKey);
    if (replay) {
      return ok(replay);
    }

    const positive = assertPositiveMinorUnits(input.requestedAmount.minorUnits);
    if (isErr(positive)) {
      return positive;
    }

    const loaded = this.authority.coordination.getEconomicWorkOrder(
      actor,
      input.workOrderId,
      input.customerId,
    );
    if (!loaded.ok) {
      return err({ code: 'WORK_ORDER_CUSTOMER_MISMATCH', message: loaded.error.message });
    }

    const workOrder = loaded.value;
    const validated = validateWorkOrderForAllocation(
      workOrder,
      input.customerId,
      input.requestedAmount.currency,
    );
    if (isErr(validated)) {
      return validated;
    }

    const mandateCurrency = validateMandateCurrency(context.mandate, input.requestedAmount.currency);
    if (isErr(mandateCurrency)) {
      return mandateCurrency;
    }

    const revalidated = this.authority.revalidateAuthority(
      input.workOrderId,
      context.capabilityContext.customerId,
      {
        mandate: context.mandate,
        capabilityContext: context.capabilityContext,
        approvalRef: context.approvalRef,
      },
      'FINANCIAL_PROPOSAL',
      context.actorId,
    );
    if (!revalidated.ok) {
      return err({ code: 'AUTHORITY_REFUSED', message: revalidated.error.message });
    }

    const risk = evaluateAllocationRisk(context.riskFacts);
    if (isErr(risk)) {
      this.recordRefusal({
        workOrder,
        input,
        context,
        riskDecision: 'REFUSE',
        complianceDecision: 'ALLOW',
        refusal: risk.error,
      });
      return err(risk.error);
    }

    const compliance = evaluateAllocationCompliance(context.complianceFacts);
    if (isErr(compliance)) {
      this.recordRefusal({
        workOrder,
        input,
        context,
        riskDecision: 'ALLOW',
        complianceDecision: 'REFUSE',
        refusal: compliance.error,
      });
      return err(compliance.error);
    }

    if (!this.funds.ownsAccount(input.customerId, validated.value.accountId)) {
      return err({ code: 'ACCOUNT_OWNER_MISMATCH', message: 'customer does not own the requested account' });
    }

    const position = this.funds.getPosition(input.customerId, validated.value.accountId);
    if (isErr(position)) {
      return position;
    }
    if (position.value.currency !== input.requestedAmount.currency) {
      return err({ code: 'CURRENCY_MISMATCH', message: 'account currency does not match allocation request' });
    }

    const mandateLimit = validateMandateSingleActionLimit(
      context.mandate,
      input.requestedAmount.minorUnits,
      input.requestedAmount.currency,
    );
    if (isErr(mandateLimit)) {
      this.recordRefusal({
        workOrder,
        input,
        context,
        riskDecision: 'ALLOW',
        complianceDecision: 'ALLOW',
        refusal: mandateLimit.error,
        position: position.value,
      });
      return err(mandateLimit.error);
    }

    const liquidityRetentionMinorUnits = computeLiquidityRetentionMinorUnits(
      context.mandate,
      input.requestedAmount.currency,
    );
    const allocatable = computeAllocatableMinorUnits({
      requestedMinorUnits: input.requestedAmount.minorUnits,
      position: position.value,
      capitalCeilingMinorUnits: validated.value.capitalCeilingMinorUnits,
      liquidityRetentionMinorUnits,
    });
    if (allocatable.refusal) {
      this.recordRefusal({
        workOrder,
        input,
        context,
        riskDecision: 'ALLOW',
        complianceDecision: 'ALLOW',
        refusal: allocatable.refusal,
        position: position.value,
      });
      return err(allocatable.refusal);
    }

    const allocationId = asGrowSandboxAllocationId(`gsa_${randomUUID()}`);
    const reservation = await this.reservations.reserve({
      customerId: input.customerId,
      accountId: validated.value.accountId,
      currency: input.requestedAmount.currency,
      requestedAmountMinorUnits: input.requestedAmount.minorUnits,
      capitalCeilingMinorUnits: validated.value.capitalCeilingMinorUnits,
      liquidityRetentionMinorUnits,
      idempotencyKey: input.idempotencyKey,
      allocationId,
      workOrderId: input.workOrderId,
    });
    if (!reservation.ok) {
      this.recordRefusal({
        workOrder,
        input,
        context,
        riskDecision: 'ALLOW',
        complianceDecision: 'ALLOW',
        refusal: reservation.error,
        position: position.value,
      });
      return err(reservation.error);
    }

    const now = this.clock.now();
    const allocation = Object.freeze({
      allocationId,
      workOrderId: input.workOrderId,
      customerId: input.customerId,
      accountId: validated.value.accountId,
      currency: input.requestedAmount.currency,
      environment: 'simulation' as const,
      executionMode: input.executionMode,
      requestedAmountMinorUnits: input.requestedAmount.minorUnits,
      acceptedAmountMinorUnits: reservation.value.reservedAmountMinorUnits,
      reservedAmountMinorUnits: reservation.value.reservedAmountMinorUnits,
      availableAtRequestMinorUnits: position.value.availableMinorUnits,
      status: allocationStatusForAccepted(
        input.requestedAmount.minorUnits,
        reservation.value.reservedAmountMinorUnits,
      ),
      mandateRef: Object.freeze({
        mandateId: context.mandate.mandateId,
        mandateVersion: context.mandate.version,
      }),
      controlRefs: Object.freeze({
        approvalReference: workOrder.authorityReferences.approvalReference,
        capabilityContextReference: workOrder.authorityReferences.capabilityContextReference,
        authorityDecisionReference: revalidated.value.mandateRef.mandateId,
      }),
      balanceReference: Object.freeze({
        accountId: position.value.accountId,
        epoch: reservation.value.epoch,
        asOf: position.value.asOf,
        ledgerBalanceMinorUnits: position.value.ledgerBalanceMinorUnits,
        settledMinorUnits: position.value.settledMinorUnits,
        heldMinorUnits: position.value.heldMinorUnits,
        availableMinorUnits: position.value.availableMinorUnits,
      }),
      holdId: reservation.value.holdId,
      reservationReference: reservation.value.reservationReference,
      riskDecision: 'ALLOW' as const,
      complianceDecision: 'ALLOW' as const,
      refusalReason: null,
      createdAt: now,
      updatedAt: now,
      version: 1,
      idempotencyKey: input.idempotencyKey,
      createsFinancialAuthority: false as const,
      postsLedger: false as const,
      impliesLiveProvider: false as const,
    });

    this.store.put(allocation);
    if (this.evidence) {
      sealAllocationEvidence(this.evidence, 'GROW_SANDBOX_ALLOCATION_RESERVED', allocation);
    }
    return ok(allocation);
  }

  async releaseAllocation(
    input: ReleaseGrowSandboxAllocationInput,
  ): Promise<Result<GrowSandboxAllocation, GrowAllocationFailure>> {
    const allocation = this.store.get(input.allocationId, input.customerId);
    if (!allocation) {
      return err({ code: 'ALLOCATION_NOT_FOUND', message: 'allocation not found' });
    }
    if (allocation.status === 'RELEASED' || allocation.status === 'REFUSED') {
      return ok(allocation);
    }
    if (!allocation.holdId) {
      return err({ code: 'INVALID_RELEASE', message: 'allocation has no active reservation to release' });
    }
    const released = await this.reservations.release(allocation.holdId, input.reason);
    if (!released.ok) {
      return released;
    }
    const now = this.clock.now();
    const next = Object.freeze({
      ...allocation,
      status: 'RELEASED' as const,
      reservedAmountMinorUnits: '0',
      updatedAt: now,
      version: allocation.version + 1,
      refusalReason: input.reason,
    });
    this.store.put(next);
    if (this.evidence) {
      sealAllocationEvidence(this.evidence, 'GROW_SANDBOX_ALLOCATION_RELEASED', next, { reason: input.reason });
    }
    return ok(next);
  }

  private recordRefusal(input: {
    readonly workOrder: EconomicWorkOrder;
    readonly input: RequestGrowSandboxAllocationInput;
    readonly context: RequestGrowSandboxAllocationContext;
    readonly riskDecision: 'ALLOW' | 'REFUSE';
    readonly complianceDecision: 'ALLOW' | 'REFUSE';
    readonly refusal: GrowAllocationFailure;
    readonly position?: import('./ports.ts').SandboxAccountPosition;
  }): GrowSandboxAllocation {
    const now = this.clock.now();
    const allocation = Object.freeze({
      allocationId: asGrowSandboxAllocationId(`gsa_${randomUUID()}`),
      workOrderId: input.input.workOrderId,
      customerId: input.input.customerId,
      accountId: input.workOrder.capitalBoundary.accountId ?? 'unknown',
      currency: input.input.requestedAmount.currency,
      environment: 'simulation' as const,
      executionMode: input.input.executionMode,
      requestedAmountMinorUnits: input.input.requestedAmount.minorUnits,
      acceptedAmountMinorUnits: '0',
      reservedAmountMinorUnits: '0',
      availableAtRequestMinorUnits: input.position?.availableMinorUnits ?? '0',
      status: 'REFUSED' as const,
      mandateRef: Object.freeze({
        mandateId: input.context.mandate.mandateId,
        mandateVersion: input.context.mandate.version,
      }),
      controlRefs: Object.freeze({
        approvalReference: input.workOrder.authorityReferences.approvalReference,
        capabilityContextReference: input.workOrder.authorityReferences.capabilityContextReference,
        authorityDecisionReference: null,
      }),
      balanceReference: Object.freeze({
        accountId: input.position?.accountId ?? input.workOrder.capitalBoundary.accountId ?? 'unknown',
        epoch: input.position?.epoch ?? 0,
        asOf: input.position?.asOf ?? now,
        ledgerBalanceMinorUnits: input.position?.ledgerBalanceMinorUnits ?? '0',
        settledMinorUnits: input.position?.settledMinorUnits ?? '0',
        heldMinorUnits: input.position?.heldMinorUnits ?? '0',
        availableMinorUnits: input.position?.availableMinorUnits ?? '0',
      }),
      holdId: null,
      reservationReference: null,
      riskDecision: input.riskDecision,
      complianceDecision: input.complianceDecision,
      refusalReason: input.refusal.message,
      createdAt: now,
      updatedAt: now,
      version: 1,
      idempotencyKey: input.input.idempotencyKey,
      createsFinancialAuthority: false as const,
      postsLedger: false as const,
      impliesLiveProvider: false as const,
    });
    if (this.evidence) {
      sealAllocationEvidence(this.evidence, 'GROW_SANDBOX_ALLOCATION_REFUSED', allocation, {
        code: input.refusal.code,
      });
    }
    return allocation;
  }
}
