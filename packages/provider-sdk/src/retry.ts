/**
 * Bounded retry with exponential backoff and jitter.
 */

import type { ProviderReliabilityPolicy } from './policy.ts';
import type { ReliabilityClock } from './reliability-types.ts';

export type RetryDecision = {
  readonly retry: boolean;
  readonly delayMs: number;
  readonly reason: string;
};

export function computeBackoffDelayMs(
  policy: ProviderReliabilityPolicy,
  attemptIndex: number,
  jitterFraction = 0.25,
  random: () => number = Math.random,
): number {
  const exponent = Math.max(0, attemptIndex);
  const base = Math.min(policy.retryMaxDelayMs, policy.retryBaseDelayMs * 2 ** exponent);
  const jitter = Math.floor(random() * Math.max(1, base * jitterFraction));
  return base + jitter;
}

export function decideRetryDelay(input: {
  readonly policy: ProviderReliabilityPolicy;
  readonly attempt: number;
  readonly retryAfterMs?: number;
  readonly random?: () => number;
}): RetryDecision {
  const { policy, attempt, retryAfterMs } = input;
  if (attempt > policy.maxRetries) {
    return Object.freeze({ retry: false, delayMs: 0, reason: 'max_retries_exceeded' });
  }
  if (retryAfterMs !== undefined && policy.respectRetryAfter) {
    return Object.freeze({
      retry: true,
      delayMs: Math.min(policy.retryMaxDelayMs, retryAfterMs),
      reason: 'retry_after_header',
    });
  }
  return Object.freeze({
    retry: true,
    delayMs: computeBackoffDelayMs(policy, attempt - 1, 0.25, input.random),
    reason: 'exponential_backoff',
  });
}

export async function waitForRetry(clock: ReliabilityClock, delayMs: number): Promise<void> {
  if (delayMs <= 0) {
    return;
  }
  await clock.sleep(delayMs);
}
