/**
 * Failover is permitted only when the underlying financial operation
 * allows it. A submitted bank payment is never blindly resubmitted.
 */

import type { FailoverDecision, FailoverInquiry } from './types.ts';

export function evaluateFailover(inquiry: FailoverInquiry): FailoverDecision {
  if (inquiry.operation === 'MARKET_DATA_READ') {
    return Object.freeze({
      safety: 'SAFE_TO_FAILOVER',
      reason: 'market-data reads may fail over to an independent provider',
    });
  }
  if (inquiry.operation === 'FX_QUOTE_BEFORE_ACCEPT' && inquiry.submissionState === 'NOT_SUBMITTED') {
    return Object.freeze({
      safety: 'SAFE_TO_FAILOVER',
      reason: 'FX quote failover is permitted before quote acceptance',
    });
  }
  if (inquiry.operation === 'BANK_PAYMENT_SUBMIT') {
    if (inquiry.submissionState === 'NOT_SUBMITTED') {
      return Object.freeze({
        safety: 'SAFE_TO_FAILOVER',
        reason: 'no submission has occurred; another eligible provider may be selected',
      });
    }
    if (inquiry.submissionState === 'UNKNOWN') {
      return Object.freeze({
        safety: 'REQUIRES_RECONCILIATION',
        reason: 'bank payment status is unknown; do not resubmit to another provider',
      });
    }
    return Object.freeze({
      safety: 'NOT_SAFE_TO_FAILOVER',
      reason: 'a submitted bank payment must not be resubmitted to another provider',
    });
  }
  if (inquiry.submissionState === 'UNKNOWN') {
    return Object.freeze({
      safety: 'REQUIRES_RECONCILIATION',
      reason: 'unknown submission requires reconciliation before failover',
    });
  }
  return Object.freeze({
    safety: 'NOT_SAFE_TO_FAILOVER',
    reason: 'default financial failover is refuse-closed',
  });
}
