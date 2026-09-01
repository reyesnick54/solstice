import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { FulfillmentStatus } from './taxonomy.ts';

export type IllegalFulfillmentTransition = {
  readonly code: 'ILLEGAL_FULFILLMENT_TRANSITION';
  readonly purchaseId: string;
  readonly from: FulfillmentStatus;
  readonly to: FulfillmentStatus;
};

export const ALLOWED_FULFILLMENT_TRANSITIONS: {
  readonly [S in FulfillmentStatus]: readonly FulfillmentStatus[];
} = {
  ORDERED: ['ACCEPTED_BY_MERCHANT', 'DISPUTED', 'REFUNDED'],
  ACCEPTED_BY_MERCHANT: ['PROCESSING', 'SERVICE_SCHEDULED', 'DISPUTED', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'SERVICE_SCHEDULED', 'DELIVERED', 'COMPLETED', 'DISPUTED', 'REFUNDED'],
  SHIPPED: ['DELIVERED', 'DISPUTED', 'REFUNDED'],
  SERVICE_SCHEDULED: ['COMPLETED', 'DISPUTED', 'REFUNDED'],
  DELIVERED: ['COMPLETED', 'DISPUTED', 'REFUNDED'],
  COMPLETED: [],
  DISPUTED: ['REFUNDED', 'COMPLETED'],
  REFUNDED: [],
};

export function canTransitionFulfillment(from: FulfillmentStatus, to: FulfillmentStatus): boolean {
  return ALLOWED_FULFILLMENT_TRANSITIONS[from].includes(to);
}

export function assertFulfillmentTransition(
  purchaseId: string,
  from: FulfillmentStatus,
  to: FulfillmentStatus,
): Result<true, IllegalFulfillmentTransition> {
  if (!canTransitionFulfillment(from, to)) {
    return err(Object.freeze({ code: 'ILLEGAL_FULFILLMENT_TRANSITION' as const, purchaseId, from, to }));
  }
  return ok(true);
}

export function isTerminalFulfillment(status: FulfillmentStatus): boolean {
  return status === 'COMPLETED' || status === 'REFUNDED';
}
