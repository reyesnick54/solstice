import type { UtcInstant } from '../../../domain/src/time.ts';
import { randomUUID } from 'node:crypto';
import { asResearchBudgetReservationId, asResearchSpendRecordId } from './ids.ts';
import type { BudgetUnitKind, SpendCostStatus } from './taxonomy.ts';
import type {
  HeliosFailure,
  ResearchBudgetReservation,
  ResearchBudgetSnapshot,
  ResearchSpendRecord,
} from './execution-types.ts';

export function initialBudgetSnapshot(input: {
  readonly ceilingAmount: string;
  readonly unitKind: BudgetUnitKind;
  readonly currency: string | null;
}): ResearchBudgetSnapshot {
  return Object.freeze({
    authorizedCeiling: input.ceilingAmount,
    unitKind: input.unitKind,
    currency: input.currency,
    reservedAmount: '0',
    recordedSpend: '0',
    estimatedAccrued: '0',
    releasedReservation: '0',
    remainingBudget: input.ceilingAmount,
  });
}

function parseBig(value: string): bigint {
  return BigInt(value);
}

function formatBig(value: bigint): string {
  return value.toString();
}

export function computeRemainingBudget(snapshot: ResearchBudgetSnapshot): string {
  const ceiling = parseBig(snapshot.authorizedCeiling);
  const reserved = parseBig(snapshot.reservedAmount);
  const spent = parseBig(snapshot.recordedSpend);
  const remaining = ceiling - reserved - spent;
  return remaining >= 0n ? formatBig(remaining) : '0';
}

export function canReserveBudget(
  snapshot: ResearchBudgetSnapshot,
  amount: string,
): { readonly ok: true } | HeliosFailure {
  const remaining = parseBig(computeRemainingBudget(snapshot));
  const requested = parseBig(amount);
  if (requested <= 0n) {
    return { code: 'RESERVATION_FAILED', message: 'reservation amount must be positive' };
  }
  if (requested > remaining) {
    return { code: 'BUDGET_EXHAUSTED', message: 'insufficient remaining research budget' };
  }
  return { ok: true };
}

export function applyReservation(
  snapshot: ResearchBudgetSnapshot,
  amount: string,
): ResearchBudgetSnapshot {
  const reserved = parseBig(snapshot.reservedAmount) + parseBig(amount);
  const next = Object.freeze({
    ...snapshot,
    reservedAmount: formatBig(reserved),
  });
  return Object.freeze({ ...next, remainingBudget: computeRemainingBudget(next) });
}

export function applySpend(
  snapshot: ResearchBudgetSnapshot,
  actualAmount: string,
  reservedAmount: string,
): ResearchBudgetSnapshot {
  const spent = parseBig(snapshot.recordedSpend) + parseBig(actualAmount);
  const reserved = parseBig(snapshot.reservedAmount) - parseBig(reservedAmount);
  const released = parseBig(snapshot.releasedReservation) + (parseBig(reservedAmount) - parseBig(actualAmount));
  const next = Object.freeze({
    ...snapshot,
    recordedSpend: formatBig(spent),
    reservedAmount: formatBig(reserved > 0n ? reserved : 0n),
    releasedReservation: formatBig(released > 0n ? released : 0n),
  });
  return Object.freeze({ ...next, remainingBudget: computeRemainingBudget(next) });
}

export function releaseUnusedReservation(
  snapshot: ResearchBudgetSnapshot,
  reservedAmount: string,
  usedAmount: string,
): ResearchBudgetSnapshot {
  const unused = parseBig(reservedAmount) - parseBig(usedAmount);
  if (unused <= 0n) {
    return snapshot;
  }
  const reserved = parseBig(snapshot.reservedAmount) - unused;
  const released = parseBig(snapshot.releasedReservation) + unused;
  const next = Object.freeze({
    ...snapshot,
    reservedAmount: formatBig(reserved > 0n ? reserved : 0n),
    releasedReservation: formatBig(released),
  });
  return Object.freeze({ ...next, remainingBudget: computeRemainingBudget(next) });
}

export function rejectBudgetSelfIncrease(
  currentCeiling: string,
  proposedCeiling: string,
): HeliosFailure | null {
  if (parseBig(proposedCeiling) > parseBig(currentCeiling)) {
    return {
      code: 'BUDGET_SELF_INCREASE_FORBIDDEN',
      message: 'worker cannot increase research budget ceiling',
    };
  }
  return null;
}

export function createReservation(input: {
  readonly workOrderId: import('./ids.ts').EconomicWorkOrderId;
  readonly taskId: import('./ids.ts').HeliosTaskId;
  readonly customerId: string;
  readonly unitKind: BudgetUnitKind;
  readonly amount: string;
  readonly now: UtcInstant;
}): ResearchBudgetReservation {
  return Object.freeze({
    reservationId: asResearchBudgetReservationId(`rbr_${randomUUID()}`),
    workOrderId: input.workOrderId,
    taskId: input.taskId,
    customerId: input.customerId,
    unitKind: input.unitKind,
    reservedAmount: input.amount,
    reconciledAmount: null,
    releasedAmount: null,
    state: 'ACTIVE',
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function createSpendRecord(input: {
  readonly workOrderId: import('./ids.ts').EconomicWorkOrderId;
  readonly taskId: import('./ids.ts').HeliosTaskId;
  readonly customerId: string;
  readonly programId: import('./ids.ts').HeliosProgramId;
  readonly budgetCategory: BudgetUnitKind;
  readonly reservedAmount: string;
  readonly actualAmount: string | null;
  readonly estimatedAmount: string | null;
  readonly costStatus: SpendCostStatus;
  readonly currency: string | null;
  readonly attemptNumber: number;
  readonly retryCausedAdditionalCost: boolean;
  readonly succeeded: boolean;
  readonly providerId?: string | null;
  readonly modelId?: string | null;
  readonly toolId?: string | null;
  readonly now: UtcInstant;
}): ResearchSpendRecord {
  return Object.freeze({
    spendId: asResearchSpendRecordId(`rsp_${randomUUID()}`),
    workOrderId: input.workOrderId,
    taskId: input.taskId,
    customerId: input.customerId,
    programId: input.programId,
    providerId: input.providerId ?? null,
    modelId: input.modelId ?? null,
    toolId: input.toolId ?? null,
    budgetCategory: input.budgetCategory,
    reservedAmount: input.reservedAmount,
    actualAmount: input.actualAmount,
    estimatedAmount: input.estimatedAmount,
    costStatus: input.costStatus,
    currency: input.currency,
    attemptNumber: input.attemptNumber,
    retryCausedAdditionalCost: input.retryCausedAdditionalCost,
    succeeded: input.succeeded,
    recordedAt: input.now,
  });
}
