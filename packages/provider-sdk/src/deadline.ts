/**
 * Deadline propagation — avoid runaway latency when upstream budget is small.
 */

import { assertDeadlineRemaining, effectiveTimeoutMs, remainingBudgetMs } from './timeout.ts';
import type { DeadlineContext } from './reliability-types.ts';

export function resolveDeadline(input: {
  readonly deadline?: DeadlineContext;
  readonly defaultBudgetMs: number;
  readonly nowMs: number;
}): { readonly deadlineMs: number; readonly timeoutMs: number } {
  const deadlineMs = input.deadline?.deadlineMs ?? input.nowMs + input.defaultBudgetMs;
  assertDeadlineRemaining(deadlineMs, input.nowMs);
  const timeoutMs = effectiveTimeoutMs(input.defaultBudgetMs, deadlineMs, input.nowMs);
  return Object.freeze({ deadlineMs, timeoutMs });
}

export function budgetExceeded(deadlineMs: number, nowMs: number): boolean {
  return remainingBudgetMs(deadlineMs, nowMs) <= 0;
}
