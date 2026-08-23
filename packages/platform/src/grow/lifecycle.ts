import type { UtcInstant } from '../../../domain/src/time.ts';
import { Money } from '../../../money/src/money.ts';
import {
  activatedPlanIdFor,
  asRecurringMandateId,
  monitoringCycleIdFor,
  planComponentIdFor,
  recurringMandateIdFor,
} from './ids.ts';
import { assertNoGuaranteedReturnClaim } from './no-guaranteed-returns.ts';
import type {
  ActivatedGrowthPlan,
  GrowFailure,
  GrowMonitoringCycle,
  GrowMonitoringFinding,
  GrowPerformanceReadModel,
  PlanComponent,
  RecurringContributionMandate,
} from './types.ts';
import type { RecurringFrequency } from './taxonomy.ts';

export function activateGrowthPlan(input: {
  readonly planId: string;
  readonly planVersion: number;
  readonly subjectId: string;
  readonly customerId: string;
  readonly now: UtcInstant;
  readonly components: readonly { readonly actionId: string; readonly amount: RecurringContributionMandate['amount'] }[];
}): ActivatedGrowthPlan {
  const activatedPlanId = activatedPlanIdFor(input.planId, input.planVersion);
  const pending = input.components.map((row) => planComponentIdFor(input.planId, row.actionId));
  const activated: ActivatedGrowthPlan = Object.freeze({
    activatedPlanId,
    planId: input.planId as ActivatedGrowthPlan['planId'],
    planVersion: input.planVersion as ActivatedGrowthPlan['planVersion'],
    subjectId: input.subjectId,
    customerId: input.customerId,
    lifecycle: 'ACTIVE',
    fundedComponentIds: Object.freeze([]),
    pendingComponentIds: Object.freeze(pending),
    completedComponentIds: Object.freeze([]),
    failedComponentIds: Object.freeze([]),
    recurringMandateIds: Object.freeze([]),
    activatedAt: input.now,
  });
  assertNoGuaranteedReturnClaim(activated, 'activated growth plan');
  return activated;
}

export function freezePlanComponents(
  plan: ActivatedGrowthPlan,
  components: readonly { readonly actionId: string; readonly amount: RecurringContributionMandate['amount'] }[],
): readonly PlanComponent[] {
  return Object.freeze(
    components.map((row) =>
      Object.freeze({
        componentId: planComponentIdFor(plan.planId, row.actionId),
        activatedPlanId: plan.activatedPlanId,
        actionId: row.actionId,
        state: 'PENDING' as const,
        amount: row.amount,
      }),
    ),
  );
}

export function moveComponent(
  plan: ActivatedGrowthPlan,
  componentId: PlanComponent['componentId'],
  to: 'FUNDED' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
): ActivatedGrowthPlan {
  const pending = plan.pendingComponentIds.filter((id) => id !== componentId);
  const funded = to === 'FUNDED' ? [...plan.fundedComponentIds, componentId] : plan.fundedComponentIds.filter((id) => id !== componentId);
  const completed = to === 'COMPLETED' ? [...plan.completedComponentIds, componentId] : plan.completedComponentIds;
  const failed = to === 'FAILED' ? [...plan.failedComponentIds, componentId] : plan.failedComponentIds;
  return Object.freeze({
    ...plan,
    pendingComponentIds: Object.freeze(pending),
    fundedComponentIds: Object.freeze(funded),
    completedComponentIds: Object.freeze(completed),
    failedComponentIds: Object.freeze(failed),
  });
}

export function createRecurringMandate(input: {
  readonly subjectId: string;
  readonly customerId: string;
  readonly amount: RecurringContributionMandate['amount'];
  readonly frequency: RecurringFrequency;
  readonly sourceAccountId: string;
  readonly destinationAccountId: string;
  readonly startAt: UtcInstant;
  readonly endAt?: UtcInstant;
  readonly maxAmountMinorUnits: string;
  readonly policy: string;
}): RecurringContributionMandate | GrowFailure {
  const requested = Money.fromMinorUnitsString(input.amount.minorUnits, input.amount.currency);
  const max = Money.fromMinorUnitsString(input.maxAmountMinorUnits, input.amount.currency);
  if (requested.cmp(max) > 0) {
    return { code: 'AMOUNT_EXCEEDS_MANDATE', message: 'recurring amount exceeds mandate maximum' };
  }
  return Object.freeze({
    recurringMandateId: recurringMandateIdFor(input.subjectId, `${input.frequency}_${input.amount.minorUnits}`),
    subjectId: input.subjectId,
    customerId: input.customerId,
    amount: input.amount,
    frequency: input.frequency,
    sourceAccountId: input.sourceAccountId,
    destinationAccountId: input.destinationAccountId,
    startAt: input.startAt,
    endAt: input.endAt ?? null,
    maxAmountMinorUnits: input.maxAmountMinorUnits,
    revocation: 'CUSTOMER_MAY_REVOKE',
    policy: input.policy,
    authorizationModel: 'EACH_OCCURRENCE_REVALIDATED',
    state: 'ACTIVE',
    agentMayIncreaseAmount: false,
    perpetualAuthorization: false,
  });
}

export function agentIncreaseRecurringAmount(
  mandate: RecurringContributionMandate,
  nextMinorUnits: string,
): GrowFailure {
  const current = Money.fromMinorUnitsString(mandate.amount.minorUnits, mandate.amount.currency);
  const next = Money.fromMinorUnitsString(nextMinorUnits, mandate.amount.currency);
  if (next.cmp(current) > 0) {
    return { code: 'AMOUNT_EXCEEDS_MANDATE', message: 'agent cannot increase recurring amount beyond the mandate' };
  }
  return { code: 'AMOUNT_EXCEEDS_MANDATE', message: 'agent cannot mutate recurring amount' };
}

export function transitionRecurring(
  mandate: RecurringContributionMandate,
  to: RecurringContributionMandate['state'],
): RecurringContributionMandate | GrowFailure {
  if (mandate.state === 'REVOKED') {
    return { code: 'RECURRING_REVOKED', message: 'revoked recurring mandate cannot be reused as perpetual authority' };
  }
  return Object.freeze({ ...mandate, state: to, recurringMandateId: asRecurringMandateId(mandate.recurringMandateId) });
}

export function performanceAgainstPlan(input: {
  readonly subjectId: string;
  readonly planId: string;
  readonly plannedContributions: RecurringContributionMandate['amount'];
  readonly executedContributions: RecurringContributionMandate['amount'];
  readonly withdrawals: RecurringContributionMandate['amount'];
  readonly currentValue: RecurringContributionMandate['amount'];
  readonly fees: RecurringContributionMandate['amount'];
  readonly goalTarget: RecurringContributionMandate['amount'];
  readonly timeRemainingDays: number | null;
}): GrowPerformanceReadModel {
  const planned = Money.fromMinorUnitsString(input.plannedContributions.minorUnits, input.plannedContributions.currency);
  const executed = Money.fromMinorUnitsString(input.executedContributions.minorUnits, input.executedContributions.currency);
  const current = Money.fromMinorUnitsString(input.currentValue.minorUnits, input.currentValue.currency);
  const fees = Money.fromMinorUnitsString(input.fees.minorUnits, input.fees.currency);
  const withdrawals = Money.fromMinorUnitsString(input.withdrawals.minorUnits, input.withdrawals.currency);
  const performance = current.minus(executed).plus(withdrawals);
  const deviation = executed.minus(planned);
  const model: GrowPerformanceReadModel = Object.freeze({
    subjectId: input.subjectId,
    planId: input.planId,
    plannedContributions: planned.toJSON(),
    executedContributions: executed.toJSON(),
    withdrawals: withdrawals.toJSON(),
    currentValue: current.toJSON(),
    performance: performance.toJSON(),
    fees: fees.toJSON(),
    deviation: deviation.toJSON(),
    goalProgressMinorUnits: current.minorUnits.toString(),
    goalTargetMinorUnits: input.goalTarget.minorUnits,
    timeRemainingDays: input.timeRemainingDays,
    marketPerformanceSeparatedFromDeposits: true,
    depositsAreNotPerformance: true,
  });
  assertNoGuaranteedReturnClaim(model, 'performance read model');
  return model;
}

export function evaluateRebalance(input: {
  readonly targetBps: number;
  readonly currentBps: number;
  readonly thresholdBps: number;
}): { readonly exceeded: boolean; readonly createsOpportunity: true; readonly automaticTrade: false } {
  const drift = Math.abs(input.currentBps - input.targetBps);
  return Object.freeze({
    exceeded: drift > input.thresholdBps,
    createsOpportunity: true,
    automaticTrade: false,
  });
}

export function runMonitoringCycle(input: {
  readonly subjectId: string;
  readonly now: UtcInstant;
  readonly cashReserveBelowTarget: boolean;
  readonly driftExceeded: boolean;
  readonly productAvailable: boolean;
}): GrowMonitoringCycle {
  const findings: GrowMonitoringFinding[] = [];
  if (input.cashReserveBelowTarget) {
    findings.push({
      kind: 'CASH_RESERVE',
      summary: 'Cash reserve is below the mandate floor. This creates an opportunity, not an automatic trade.',
      createsOpportunity: true,
      silentTradeForbidden: true,
    });
  }
  if (input.driftExceeded) {
    findings.push({
      kind: 'PORTFOLIO_DRIFT',
      summary: 'Allocation drift exceeded the configured threshold. Generate a proposal; do not auto-trade.',
      createsOpportunity: true,
      silentTradeForbidden: true,
    });
  }
  if (!input.productAvailable) {
    findings.push({
      kind: 'PRODUCT_AVAILABILITY',
      summary: 'A product used by the plan is unavailable. Reassess before any execution.',
      createsOpportunity: true,
      silentTradeForbidden: true,
    });
  }
  return Object.freeze({
    cycleId: monitoringCycleIdFor(input.subjectId, input.now),
    subjectId: input.subjectId,
    generatedAt: input.now,
    findings: Object.freeze(findings),
    newOpportunityIds: Object.freeze(findings.filter((row) => row.createsOpportunity).map((row) => `opp_${row.kind.toLowerCase()}`)),
    newProposalIds: Object.freeze([]),
    silentInvestmentChange: false,
  });
}

export function pauseActivatedPlan(plan: ActivatedGrowthPlan): ActivatedGrowthPlan {
  return Object.freeze({ ...plan, lifecycle: 'PAUSED' });
}

export function resumeActivatedPlan(plan: ActivatedGrowthPlan): ActivatedGrowthPlan {
  return Object.freeze({ ...plan, lifecycle: 'ACTIVE' });
}

export function cancelActivatedPlan(plan: ActivatedGrowthPlan): ActivatedGrowthPlan {
  return Object.freeze({
    ...plan,
    lifecycle: 'CANCELLED',
    pendingComponentIds: Object.freeze([]),
  });
}
