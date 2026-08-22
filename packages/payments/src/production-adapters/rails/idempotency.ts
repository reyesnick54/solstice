/**
 * Payment idempotency and retry classification.
 *
 * SunRey always keeps its own execution/idempotency reference. Provider
 * idempotency is used when the vendor supports it. UNKNOWN submission
 * requires inquiry before resubmission.
 */

import { decideRetry } from '../../rail-retry.ts';
import type { CanonicalRailStatus } from '../../rail-types.ts';
import type { SubmissionCertainty } from '../types.ts';

export type PaymentIdempotencyRecord = {
  readonly sunreyExecutionRef: string;
  readonly sunreyIdempotencyKey: string;
  readonly providerIdempotencyKey: string | null;
  readonly providerSupportsIdempotency: boolean;
  readonly certainty: SubmissionCertainty;
};

export type SubmissionRetryDecision = {
  readonly allowed: boolean;
  readonly certainty: SubmissionCertainty;
  readonly reason: string;
  readonly nextAction: 'SUBMIT' | 'QUERY' | 'RECONCILE' | 'STOP';
};

export function classifySubmissionCertainty(input: {
  readonly submitted: boolean;
  readonly providerAcknowledged: boolean;
  readonly executionUnknown: boolean;
}): SubmissionCertainty {
  if (input.executionUnknown) {
    return 'UNKNOWN_SUBMISSION_STATUS';
  }
  if (input.submitted && input.providerAcknowledged) {
    return 'DEFINITELY_SUBMITTED';
  }
  if (!input.submitted) {
    return 'DEFINITELY_NOT_SUBMITTED';
  }
  return 'UNKNOWN_SUBMISSION_STATUS';
}

export function decidePaymentResubmission(input: {
  readonly certainty: SubmissionCertainty;
  readonly railStatus: CanonicalRailStatus | null;
}): SubmissionRetryDecision {
  if (input.certainty === 'UNKNOWN_SUBMISSION_STATUS') {
    return Object.freeze({
      allowed: false,
      certainty: input.certainty,
      reason: 'unknown_submission_requires_status_inquiry',
      nextAction: 'QUERY',
    });
  }
  if (input.certainty === 'DEFINITELY_SUBMITTED') {
    const retry = decideRetry('SUBMIT', input.railStatus, { executionUnknown: false });
    return Object.freeze({
      allowed: false,
      certainty: input.certainty,
      reason: retry.reason,
      nextAction: input.railStatus === 'UNKNOWN' ? 'RECONCILE' : 'STOP',
    });
  }
  const retry = decideRetry('SUBMIT', input.railStatus);
  return Object.freeze({
    allowed: retry.allowed,
    certainty: input.certainty,
    reason: retry.reason,
    nextAction: retry.allowed ? 'SUBMIT' : 'STOP',
  });
}

export function freezeIdempotencyRecord(input: PaymentIdempotencyRecord): PaymentIdempotencyRecord {
  if (!input.sunreyExecutionRef || !input.sunreyIdempotencyKey) {
    throw new TypeError('SunRey execution and idempotency references are mandatory');
  }
  return Object.freeze({ ...input });
}
