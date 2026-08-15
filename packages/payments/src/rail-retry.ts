import type { CanonicalRailStatus, RailRetryClass } from './rail-types.ts';
import { retryClassFor } from './rail-types.ts';

export type RailOperation = 'SUBMIT' | 'QUERY' | 'CANCEL' | 'CALLBACK';

export type RetryDecision = {
  readonly retryClass: RailRetryClass;
  readonly allowed: boolean;
  readonly reason: string;
};

/**
 * Never apply generic HTTP retry behavior to payment submission.
 * Unknown execution requires a query before any resubmit.
 */
export function decideRetry(
  operation: RailOperation,
  status: CanonicalRailStatus | null,
  options: { readonly executionUnknown?: boolean } = {},
): RetryDecision {
  if (options.executionUnknown === true && operation === 'SUBMIT') {
    return Object.freeze({
      retryClass: 'DO_NOT_RETRY_WITHOUT_QUERY',
      allowed: false,
      reason: 'submission_unknown_requires_query',
    });
  }
  if (status === null && operation === 'SUBMIT') {
    return Object.freeze({
      retryClass: 'SAFE_WITH_IDEMPOTENCY',
      allowed: true,
      reason: 'no_prior_submission',
    });
  }
  const retryClass = retryClassFor(status ?? 'UNKNOWN', operation);
  if (retryClass === 'DO_NOT_RETRY_WITHOUT_QUERY' || retryClass === 'PERMANENT_FAILURE') {
    return Object.freeze({
      retryClass,
      allowed: false,
      reason: retryClass === 'PERMANENT_FAILURE' ? 'terminal_status' : 'query_required',
    });
  }
  return Object.freeze({
    retryClass,
    allowed: true,
    reason: retryClass === 'SAFE_WITH_IDEMPOTENCY' ? 'idempotent_resubmit' : 'safe_query',
  });
}
