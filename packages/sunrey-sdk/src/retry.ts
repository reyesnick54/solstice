/**
 * Safe SDK retries.
 *
 * Reads may retry. Signed transaction submission always reuses the same
 * transaction ID. A lost HTTP response must never create a new economic
 * transaction.
 */

export type RetryPolicy = {
  readonly maxAttempts: number;
  readonly backoffMs: readonly number[];
  readonly retryReads: boolean;
  readonly retrySignedSubmission: 'SAME_TRANSACTION_ID_ONLY';
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({
  maxAttempts: 3,
  backoffMs: Object.freeze([50, 150, 400]),
  retryReads: true,
  retrySignedSubmission: 'SAME_TRANSACTION_ID_ONLY',
});

export function shouldRetryRead(status: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): boolean {
  if (!policy.retryReads) {
    return false;
  }
  return status === 429 || status === 503 || status >= 500;
}

export function submissionRetrySafe(input: {
  readonly previousTransactionId: string;
  readonly nextTransactionId: string;
}): boolean {
  return input.previousTransactionId === input.nextTransactionId && input.previousTransactionId.length > 0;
}
