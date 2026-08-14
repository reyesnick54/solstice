import type { DurableEventEnvelope } from './envelope.ts';

export type OrderingGuarantee = {
  readonly scope: 'aggregate';
  readonly globalOrder: false;
  readonly description: string;
};

/**
 * Events for one aggregate carry aggregateSequence so a consumer can
 * detect stale or out-of-order delivery. This fabric does not promise
 * a global total order across aggregates or databases.
 */
export const ORDERING_GUARANTEE: OrderingGuarantee = Object.freeze({
  scope: 'aggregate',
  globalOrder: false,
  description:
    'Per-aggregate sequence is assigned in the producing ledger transaction. Transport is at-least-once and may reorder across aggregates. Consumers must treat a sequence gap or regression as out-of-order.',
});

export type OrderCheck =
  | { readonly status: 'IN_ORDER'; readonly expected: number }
  | { readonly status: 'DUPLICATE'; readonly lastSeen: number }
  | { readonly status: 'OUT_OF_ORDER'; readonly lastSeen: number; readonly received: number };

export function checkAggregateOrder(lastSeen: number | undefined, incoming: DurableEventEnvelope): OrderCheck {
  if (lastSeen === undefined) {
    return { status: 'IN_ORDER', expected: incoming.aggregateSequence };
  }
  if (incoming.aggregateSequence === lastSeen) {
    return { status: 'DUPLICATE', lastSeen };
  }
  if (incoming.aggregateSequence === lastSeen + 1) {
    return { status: 'IN_ORDER', expected: incoming.aggregateSequence };
  }
  return {
    status: 'OUT_OF_ORDER',
    lastSeen,
    received: incoming.aggregateSequence,
  };
}

export class OutOfOrderEventError extends Error {
  readonly reasonCode = 'OUT_OF_ORDER_AGGREGATE_EVENT';
  readonly lastSeen: number;
  readonly received: number;

  constructor(lastSeen: number, received: number) {
    super(`out-of-order aggregate event: lastSeen=${lastSeen} received=${received}`);
    this.name = 'OutOfOrderEventError';
    this.lastSeen = lastSeen;
    this.received = received;
  }
}

export function assertInOrder(lastSeen: number | undefined, incoming: DurableEventEnvelope): void {
  const check = checkAggregateOrder(lastSeen, incoming);
  if (check.status === 'OUT_OF_ORDER') {
    throw new OutOfOrderEventError(check.lastSeen, check.received);
  }
}
