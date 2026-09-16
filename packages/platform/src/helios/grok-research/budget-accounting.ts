import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { BudgetUnitKind } from '../taxonomy.ts';
import type { EconomicWorkOrderId, HeliosTaskId } from '../ids.ts';
import { createSpendRecord } from '../budget.ts';
import type { ResearchSpendRecord } from '../execution-types.ts';
import type { GrokResearchUsage } from './types.ts';

export type BudgetLedger = {
  readonly consumed: string;
  readonly modelCalls: number;
  readonly toolCalls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly failedAttempts: number;
  readonly retries: number;
  readonly estimatedCostMicros: bigint;
  readonly startedAtMs: number;
};

export function initialBudgetLedger(startedAtMs: number): BudgetLedger {
  return Object.freeze({
    consumed: '0',
    modelCalls: 0,
    toolCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    failedAttempts: 0,
    retries: 0,
    estimatedCostMicros: 0n,
    startedAtMs,
  });
}

export function recordModelCall(
  ledger: BudgetLedger,
  input: { readonly inputTokens: number; readonly outputTokens: number; readonly costMicros: string },
): BudgetLedger {
  const modelCost = BigInt(input.costMicros || '0');
  const callCost = '50';
  return Object.freeze({
    ...ledger,
    consumed: (BigInt(ledger.consumed) + BigInt(callCost)).toString(),
    modelCalls: ledger.modelCalls + 1,
    inputTokens: ledger.inputTokens + input.inputTokens,
    outputTokens: ledger.outputTokens + input.outputTokens,
    estimatedCostMicros: ledger.estimatedCostMicros + modelCost,
  });
}

export function recordToolCall(ledger: BudgetLedger, budgetImpact: string): BudgetLedger {
  return Object.freeze({
    ...ledger,
    consumed: (BigInt(ledger.consumed) + BigInt(budgetImpact)).toString(),
    toolCalls: ledger.toolCalls + 1,
  });
}

export function recordFailedAttempt(ledger: BudgetLedger): BudgetLedger {
  return Object.freeze({
    ...ledger,
    failedAttempts: ledger.failedAttempts + 1,
  });
}

export function isBudgetExhausted(ledger: BudgetLedger, ceiling: string): boolean {
  return BigInt(ledger.consumed) >= BigInt(ceiling);
}

export function toResearchUsage(
  ledger: BudgetLedger,
  budgetUnitKind: BudgetUnitKind,
  nowMs: number,
): GrokResearchUsage {
  return Object.freeze({
    modelCalls: ledger.modelCalls,
    toolCalls: ledger.toolCalls,
    inputTokens: ledger.inputTokens,
    outputTokens: ledger.outputTokens,
    estimatedCostMicros: ledger.estimatedCostMicros.toString(),
    failedAttempts: ledger.failedAttempts,
    retries: ledger.retries,
    elapsedMs: nowMs - ledger.startedAtMs,
    budgetUnitKind,
    budgetConsumed: ledger.consumed,
  });
}

export function buildSpendRecords(input: {
  readonly ledger: BudgetLedger;
  readonly workOrderId: EconomicWorkOrderId;
  readonly taskId: HeliosTaskId;
  readonly customerId: string;
  readonly programId: import('../ids.ts').HeliosProgramId;
  readonly providerId: string;
  readonly modelId: string;
  readonly budgetUnitKind: BudgetUnitKind;
  readonly currency: string | null;
  readonly attemptNumber: number;
  readonly now: UtcInstant;
}): readonly ResearchSpendRecord[] {
  const records: ResearchSpendRecord[] = [];
  if (input.ledger.modelCalls > 0) {
    records.push(createSpendRecord({
      workOrderId: input.workOrderId,
      taskId: input.taskId,
      customerId: input.customerId,
      programId: input.programId,
      budgetCategory: input.budgetUnitKind,
      reservedAmount: input.ledger.consumed,
      actualAmount: input.ledger.consumed,
      estimatedAmount: null,
      costStatus: 'ACTUAL',
      currency: input.currency,
      attemptNumber: input.attemptNumber,
      retryCausedAdditionalCost: input.ledger.retries > 0,
      succeeded: true,
      providerId: input.providerId,
      modelId: input.modelId,
      toolId: null,
      now: input.now,
    }));
  }
  if (input.ledger.toolCalls > 0) {
    records.push(createSpendRecord({
      workOrderId: input.workOrderId,
      taskId: input.taskId,
      customerId: input.customerId,
      programId: input.programId,
      budgetCategory: 'TOOL_CALLS',
      reservedAmount: '0',
      actualAmount: String(input.ledger.toolCalls),
      estimatedAmount: null,
      costStatus: 'ACTUAL',
      currency: input.currency,
      attemptNumber: input.attemptNumber,
      retryCausedAdditionalCost: false,
      succeeded: true,
      providerId: input.providerId,
      modelId: null,
      toolId: 'grok_research_tools',
      now: input.now,
    }));
  }
  return Object.freeze(records);
}
