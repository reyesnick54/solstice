import { LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED, type Clock } from '@solstice/config';
import { err, ok, type CustomerId, type Result } from '@solstice/domain';
import type { EvidenceVault } from '@solstice/evidence';
import { executionPlanIdFor, transitionIdFor } from './ids.ts';
import { InMemoryHeliosExecutionPlanStore } from './store.ts';
import {
  canTransitionExecutionPlan,
  EXECUTION_PLAN_POLICY_VERSION,
  type ExecutionPlanStatus,
} from './taxonomy.ts';
import type {
  CreateExecutionPlanInput,
  ExecutionPlan,
  ExecutionPlanFailure,
  ExecutionPlanLeg,
  ExecutionPlanTransitionRecord,
  ExecutionPlanValidationPorts,
  TransitionExecutionPlanInput,
} from './types.ts';
import {
  validateCapitalReservation,
  validateComplianceApproval,
  validateExecutionPlanCreation,
  validatePlanStillValid,
  validateRiskApproval,
} from './validators.ts';

export const HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN = 'HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN' as const;

function fail(code: ExecutionPlanFailure['code'], message: string): Result<never, ExecutionPlanFailure> {
  return err({ code, message });
}

function freezeLeg(input: CreateExecutionPlanInput['legs'][number]): ExecutionPlanLeg {
  return Object.freeze({
    legId: input.legId,
    legIndex: input.legIndex,
    instrumentId: input.instrumentId,
    assetClass: input.assetClass,
    direction: input.direction,
    targetQuantityUnits: input.targetQuantityUnits,
    targetNotionalMinorUnits: input.targetNotionalMinorUnits,
    maximumApprovedQuantityUnits: input.maximumApprovedQuantityUnits,
    maximumApprovedNotionalMinorUnits: input.maximumApprovedNotionalMinorUnits,
    executionCurrency: input.executionCurrency,
    constraints: input.constraints,
    hedgeRole: input.hedgeRole ?? null,
  });
}

/**
 * Canonical HELIOS universal multi-asset execution plan coordinator.
 * Converts qualified allocation decisions into deterministic execution plans.
 * Does not issue Execution Authority or post journals directly.
 */
export class HeliosExecutionPlanService {
  private readonly clock: Clock;
  private readonly evidence?: EvidenceVault;
  private readonly validation: ExecutionPlanValidationPorts;
  readonly store: InMemoryHeliosExecutionPlanStore;

  constructor(input: {
    readonly clock: Clock;
    readonly evidence?: EvidenceVault;
    readonly validation: ExecutionPlanValidationPorts;
    readonly store?: InMemoryHeliosExecutionPlanStore;
  }) {
    this.clock = input.clock;
    if (input.evidence) {
      this.evidence = input.evidence;
    }
    this.validation = input.validation;
    this.store = input.store ?? new InMemoryHeliosExecutionPlanStore();
  }

  createPlan(input: CreateExecutionPlanInput): Result<ExecutionPlan, ExecutionPlanFailure> {
    if (LIVE_INVESTMENT_EXECUTION || LIVE_TRADING_ENABLED) {
      return fail('LIVE_GATE_BLOCKED', 'live execution gates must remain explicit and disabled');
    }
    if (input.legs.length === 0) {
      return fail('INSTRUMENT_NOT_EXECUTABLE', 'execution plan requires at least one leg');
    }

    const executionPlanId = executionPlanIdFor(input.workOrderId, input.envelopeId, input.idempotencyKey);
    const existing = this.store.getPlan(executionPlanId);
    if (existing) {
      return ok(existing);
    }

    const legs = Object.freeze(input.legs.map(freezeLeg));
    const plan: ExecutionPlan = Object.freeze({
      executionPlanId,
      customerId: input.customerId,
      mandateId: input.mandateId,
      workOrderId: input.workOrderId,
      opportunityId: input.opportunityId,
      strategyCapsuleId: input.strategyCapsuleRef.capsuleId,
      strategyCapsuleVersion: input.strategyCapsuleRef.version,
      strategyCapsuleRef: input.strategyCapsuleRef,
      envelopeId: input.envelopeId,
      decisionValidUntil: input.decisionValidUntil,
      legs,
      multiLegCoordination: input.multiLegCoordination ?? null,
      authorizationRefs: Object.freeze({
        riskAuthorizationReference: null,
        complianceAuthorizationReference: null,
        capitalReservationReference: null,
      }),
      evidenceRefs: Object.freeze([...input.evidenceRefs]),
      status: 'DRAFT',
      policyVersion: EXECUTION_PLAN_POLICY_VERSION,
      idempotencyKey: input.idempotencyKey,
      createdAt: input.now,
      updatedAt: input.now,
      aiRecommendedCharacteristics: Object.freeze([...(input.aiRecommendedCharacteristics ?? [])]),
      grantsExecutionAuthority: false,
      grantsFinancialEffect: false,
      authorizesFinancialExecution: false,
    });

    const validation = validateExecutionPlanCreation(plan, this.validation, input.now);
    if (!validation.ok) {
      return fail(validation.failure.code, validation.failure.message);
    }

    this.store.putPlan(plan);
    return ok(plan);
  }

  approveRisk(
    executionPlanId: ExecutionPlan['executionPlanId'],
    customerId: CustomerId,
    idempotencyKey: string,
  ): Result<ExecutionPlan, ExecutionPlanFailure> {
    return this.transition({
      executionPlanId,
      customerId,
      targetStatus: 'RISK_APPROVED',
      idempotencyKey,
      now: this.clock.now(),
      beforeTransition: (plan) => validateRiskApproval(plan, this.validation),
      onSuccess: (plan) => {
        const risk = this.validation.riskApproved({
          executionPlanId: plan.executionPlanId,
          customerId: plan.customerId,
          workOrderId: plan.workOrderId,
          legs: plan.legs,
        });
        return Object.freeze({
          ...plan,
          authorizationRefs: Object.freeze({
            ...plan.authorizationRefs,
            riskAuthorizationReference: risk.reference,
          }),
        });
      },
    });
  }

  approveCompliance(
    executionPlanId: ExecutionPlan['executionPlanId'],
    customerId: CustomerId,
    idempotencyKey: string,
  ): Result<ExecutionPlan, ExecutionPlanFailure> {
    return this.transition({
      executionPlanId,
      customerId,
      targetStatus: 'COMPLIANCE_APPROVED',
      idempotencyKey,
      now: this.clock.now(),
      beforeTransition: (plan) => validateComplianceApproval(plan, this.validation),
      onSuccess: (plan) => {
        const compliance = this.validation.complianceApproved({
          executionPlanId: plan.executionPlanId,
          customerId: plan.customerId,
          workOrderId: plan.workOrderId,
          envelopeId: plan.envelopeId,
        });
        return Object.freeze({
          ...plan,
          authorizationRefs: Object.freeze({
            ...plan.authorizationRefs,
            complianceAuthorizationReference: compliance.reference,
          }),
        });
      },
    });
  }

  authorizePlan(
    executionPlanId: ExecutionPlan['executionPlanId'],
    customerId: CustomerId,
    idempotencyKey: string,
  ): Result<ExecutionPlan, ExecutionPlanFailure> {
    return this.transition({
      executionPlanId,
      customerId,
      targetStatus: 'AUTHORIZED',
      idempotencyKey,
      now: this.clock.now(),
      beforeTransition: (plan) => {
        if (!plan.authorizationRefs.riskAuthorizationReference) {
          return Object.freeze({
            ok: false as const,
            failure: Object.freeze({
              code: 'RISK_APPROVAL_MISSING' as const,
              message: 'Risk approval must precede authorization',
            }),
          });
        }
        if (!plan.authorizationRefs.complianceAuthorizationReference) {
          return Object.freeze({
            ok: false as const,
            failure: Object.freeze({
              code: 'COMPLIANCE_APPROVAL_MISSING' as const,
              message: 'Compliance approval must precede authorization',
            }),
          });
        }
        return validatePlanStillValid(plan, this.validation, this.clock.now());
      },
    });
  }

  markReadyForRouting(
    executionPlanId: ExecutionPlan['executionPlanId'],
    customerId: CustomerId,
    idempotencyKey: string,
  ): Result<ExecutionPlan, ExecutionPlanFailure> {
    return this.transition({
      executionPlanId,
      customerId,
      targetStatus: 'READY_FOR_ROUTING',
      idempotencyKey,
      now: this.clock.now(),
      beforeTransition: (plan) => validateCapitalReservation(plan, this.validation),
      onSuccess: (plan) => {
        const totalNotional = plan.legs.reduce((sum, leg) => sum + BigInt(leg.targetNotionalMinorUnits), 0n);
        const currency = plan.legs[0]?.executionCurrency ?? 'USD';
        const capital = this.validation.capitalReserved({
          executionPlanId: plan.executionPlanId,
          customerId: plan.customerId,
          totalNotionalMinorUnits: totalNotional.toString(),
          currency,
        });
        return Object.freeze({
          ...plan,
          authorizationRefs: Object.freeze({
            ...plan.authorizationRefs,
            capitalReservationReference: capital.reference,
          }),
        });
      },
    });
  }

  markRouted(
    executionPlanId: ExecutionPlan['executionPlanId'],
    customerId: CustomerId,
    idempotencyKey: string,
  ): Result<ExecutionPlan, ExecutionPlanFailure> {
    return this.transition({
      executionPlanId,
      customerId,
      targetStatus: 'ROUTED',
      idempotencyKey,
      now: this.clock.now(),
    });
  }

  markPartiallyExecuted(
    executionPlanId: ExecutionPlan['executionPlanId'],
    customerId: CustomerId,
    idempotencyKey: string,
  ): Result<ExecutionPlan, ExecutionPlanFailure> {
    return this.transition({
      executionPlanId,
      customerId,
      targetStatus: 'PARTIALLY_EXECUTED',
      idempotencyKey,
      now: this.clock.now(),
    });
  }

  markExecuted(
    executionPlanId: ExecutionPlan['executionPlanId'],
    customerId: CustomerId,
    idempotencyKey: string,
  ): Result<ExecutionPlan, ExecutionPlanFailure> {
    return this.transition({
      executionPlanId,
      customerId,
      targetStatus: 'EXECUTED',
      idempotencyKey,
      now: this.clock.now(),
    });
  }

  cancelPlan(
    executionPlanId: ExecutionPlan['executionPlanId'],
    customerId: CustomerId,
    idempotencyKey: string,
  ): Result<ExecutionPlan, ExecutionPlanFailure> {
    return this.transition({
      executionPlanId,
      customerId,
      targetStatus: 'CANCELLED',
      idempotencyKey,
      now: this.clock.now(),
    });
  }

  expirePlan(
    executionPlanId: ExecutionPlan['executionPlanId'],
    customerId: CustomerId,
    idempotencyKey: string,
  ): Result<ExecutionPlan, ExecutionPlanFailure> {
    return this.transition({
      executionPlanId,
      customerId,
      targetStatus: 'EXPIRED',
      idempotencyKey,
      now: this.clock.now(),
    });
  }

  rejectPlan(
    executionPlanId: ExecutionPlan['executionPlanId'],
    customerId: CustomerId,
    idempotencyKey: string,
  ): Result<ExecutionPlan, ExecutionPlanFailure> {
    return this.transition({
      executionPlanId,
      customerId,
      targetStatus: 'REJECTED',
      idempotencyKey,
      now: this.clock.now(),
    });
  }

  markReconciliationRequired(
    executionPlanId: ExecutionPlan['executionPlanId'],
    customerId: CustomerId,
    idempotencyKey: string,
  ): Result<ExecutionPlan, ExecutionPlanFailure> {
    return this.transition({
      executionPlanId,
      customerId,
      targetStatus: 'RECONCILIATION_REQUIRED',
      idempotencyKey,
      now: this.clock.now(),
    });
  }

  transition(input: TransitionExecutionPlanInput & {
    readonly beforeTransition?: (plan: ExecutionPlan) => { readonly ok: true } | { readonly ok: false; readonly failure: ExecutionPlanFailure };
    readonly onSuccess?: (plan: ExecutionPlan) => ExecutionPlan;
  }): Result<ExecutionPlan, ExecutionPlanFailure> {
    const plan = this.store.getPlan(input.executionPlanId);
    if (!plan) return fail('PLAN_NOT_FOUND', 'execution plan not found');
    if (plan.customerId !== input.customerId) {
      return fail('CUSTOMER_MISMATCH', 'customer cannot access this execution plan');
    }

    const transitionId = transitionIdFor(plan.executionPlanId, input.targetStatus, input.idempotencyKey);
    if (this.store.isTransitionProcessed(transitionId)) {
      const current = this.store.getPlan(plan.executionPlanId);
      if (!current) return fail('PLAN_NOT_FOUND', 'execution plan not found');
      if (current.status === input.targetStatus) {
        return ok(current);
      }
    }

    if (plan.status === input.targetStatus) {
      return ok(plan);
    }

    if (!canTransitionExecutionPlan(plan.status, input.targetStatus)) {
      return fail('INVALID_TRANSITION', `cannot transition ${plan.status} → ${input.targetStatus}`);
    }

    if (input.beforeTransition) {
      const gate = input.beforeTransition(plan);
      if (!gate.ok) {
        return fail(gate.failure.code, gate.failure.message);
      }
    }

    const fromStatus = plan.status;
    let nextPlan = Object.freeze({
      ...plan,
      status: input.targetStatus,
      updatedAt: input.now,
    });
    if (input.onSuccess) {
      nextPlan = input.onSuccess(nextPlan);
    }

    const transition: ExecutionPlanTransitionRecord = Object.freeze({
      transitionId,
      executionPlanId: plan.executionPlanId,
      fromStatus,
      toStatus: input.targetStatus,
      idempotencyKey: input.idempotencyKey,
      evidenceRef: input.evidenceRef ?? null,
      transitionedAt: input.now,
    });

    this.store.recordTransition(transition);
    this.store.updatePlan(nextPlan);

    if (this.evidence && input.evidenceRef) {
      // Evidence refs are caller-supplied; vault sealing happens upstream.
    }

    return ok(nextPlan);
  }
}
