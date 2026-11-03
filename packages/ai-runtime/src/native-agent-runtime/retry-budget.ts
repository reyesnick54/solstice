import type { AiFailureCode } from '../taxonomy.ts';
import { classifyInferenceRetry, retryDelayMs, shouldRetryAttempt } from '../async-inference/retry.ts';

export type InferenceRetryBudgetLimits = {
  readonly maxAttempts: number;
  readonly maxRetryableFailures: number;
};

export type RetryBudgetSnapshot = {
  readonly attempts: number;
  readonly retryableFailures: number;
  readonly exhausted: boolean;
};

/**
 * Bounded retry budget for gateway inference. Non-retryable Kernel/policy
 * failures consume the attempt but do not spin.
 */
export class InferenceRetryBudget {
  private attempts = 0;
  private retryableFailures = 0;
  private readonly limits: InferenceRetryBudgetLimits;

  constructor(limits: InferenceRetryBudgetLimits) {
    this.limits = limits;
  }

  snapshot(): RetryBudgetSnapshot {
    return Object.freeze({
      attempts: this.attempts,
      retryableFailures: this.retryableFailures,
      exhausted: this.attempts >= this.limits.maxAttempts,
    });
  }

  beginAttempt(): boolean {
    if (this.attempts >= this.limits.maxAttempts) {
      return false;
    }
    this.attempts += 1;
    return true;
  }

  recordFailure(code: AiFailureCode): { readonly retry: boolean; readonly delayMs: number } {
    const category = classifyInferenceRetry(code);
    if (category === 'RETRYABLE') {
      this.retryableFailures += 1;
    }
    const retry =
      category === 'RETRYABLE' &&
      shouldRetryAttempt({
        category,
        attempt: this.attempts,
        maxAttempts: this.limits.maxAttempts,
      }) &&
      this.retryableFailures <= this.limits.maxRetryableFailures;
    return Object.freeze({
      retry,
      delayMs: retry ? retryDelayMs(this.attempts) : 0,
    });
  }

  reset(): void {
    this.attempts = 0;
    this.retryableFailures = 0;
  }
}
