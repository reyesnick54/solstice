import { createHash } from 'node:crypto';

import type { OrderPayloadDigestFields } from './types.ts';

export function executionPayloadHash(payload: OrderPayloadDigestFields): string {
  const canonical = JSON.stringify({
    instrumentId: payload.instrumentId,
    side: payload.side,
    quantityUnits: payload.quantityUnits,
    orderType: payload.orderType,
    limitPriceMinorUnits: payload.limitPriceMinorUnits,
    currency: payload.currency,
    timeInForce: payload.timeInForce,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function submissionAttemptIdFor(operationId: string, attemptNumber: number): string {
  return `exec03_att_${operationId}_${attemptNumber}`;
}

export function submissionReceiptIdFor(operationId: string, providerOrderId: string): string {
  const digest = createHash('sha256')
    .update(`${operationId}:${providerOrderId}`, 'utf8')
    .digest('hex')
    .slice(0, 24);
  return `exec03_rcpt_${digest}`;
}

export function submissionAmbiguityIdFor(operationId: string, attemptId: string): string {
  return `exec03_amb_${operationId}_${attemptId}`;
}
