/**
 * Request timeout enforcement. Every outbound call has a bounded timeout.
 */

import { clampTimeoutMs } from './policy.ts';
import type { ReliabilityClock } from './reliability-types.ts';

export class ProviderTimeoutError extends Error {
  readonly code = 'PROVIDER_TIMEOUT' as const;
  constructor(message = 'provider request exceeded timeout') {
    super(message);
    this.name = 'ProviderTimeoutError';
  }
}

export function remainingBudgetMs(deadlineMs: number, nowMs: number): number {
  return Math.max(0, deadlineMs - nowMs);
}

export function effectiveTimeoutMs(requestedTimeoutMs: number, deadlineMs?: number, nowMs?: number): number {
  const bounded = clampTimeoutMs(requestedTimeoutMs);
  if (deadlineMs === undefined || nowMs === undefined) {
    return bounded;
  }
  const remaining = remainingBudgetMs(deadlineMs, nowMs);
  if (remaining <= 0) {
    return MIN_REMAINING_MS;
  }
  return Math.min(bounded, remaining);
}

const MIN_REMAINING_MS = 1;

export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  clock: ReliabilityClock,
): Promise<T> {
  const budget = clampTimeoutMs(timeoutMs);
  const controller = new AbortController();
  const started = clock.nowMs();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      operation(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new ProviderTimeoutError());
        }, budget);
      }),
    ]);
    if (clock.nowMs() - started > budget) {
      throw new ProviderTimeoutError();
    }
    return result;
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export function assertDeadlineRemaining(deadlineMs: number, nowMs: number): void {
  if (remainingBudgetMs(deadlineMs, nowMs) <= 0) {
    throw new ProviderTimeoutError('deadline budget exceeded before provider call');
  }
}
