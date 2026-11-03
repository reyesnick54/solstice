/**
 * BYTEX order lifecycle transition table (clean-room port of Order.Apply rules).
 */

import type { BytexOrderEventKind, BytexOrderStatus } from './taxonomy.ts';
import type { BytexOrderLifecycleEvent, BytexOrderRecord } from './types.ts';

type TransitionKey = `${BytexOrderStatus}:${BytexOrderEventKind}`;

const TRANSITIONS = Object.freeze({
  'INITIALIZED:ORDER_DENIED': 'DENIED',
  'INITIALIZED:ORDER_EMULATED': 'EMULATED',
  'INITIALIZED:ORDER_RELEASED': 'RELEASED',
  'INITIALIZED:ORDER_SUBMITTED': 'SUBMITTED',
  'INITIALIZED:ORDER_REJECTED': 'REJECTED',
  'INITIALIZED:ORDER_ACCEPTED': 'ACCEPTED',
  'INITIALIZED:ORDER_CANCELED': 'CANCELED',
  'INITIALIZED:ORDER_EXPIRED': 'EXPIRED',
  'INITIALIZED:ORDER_TRIGGERED': 'TRIGGERED',
  'INITIALIZED:ORDER_PARTIAL_FILL': 'PARTIALLY_FILLED',
  'INITIALIZED:ORDER_FILLED': 'FILLED',
  'EMULATED:ORDER_CANCELED': 'CANCELED',
  'EMULATED:ORDER_EXPIRED': 'EXPIRED',
  'EMULATED:ORDER_RELEASED': 'RELEASED',
  'RELEASED:ORDER_DENIED': 'DENIED',
  'RELEASED:ORDER_SUBMITTED': 'SUBMITTED',
  'RELEASED:ORDER_CANCELED': 'CANCELED',
  'SUBMITTED:ORDER_PENDING_UPDATE': 'PENDING_UPDATE',
  'SUBMITTED:ORDER_PENDING_CANCEL': 'PENDING_CANCEL',
  'SUBMITTED:ORDER_REJECTED': 'REJECTED',
  'SUBMITTED:ORDER_CANCELED': 'CANCELED',
  'SUBMITTED:ORDER_ACCEPTED': 'ACCEPTED',
  'SUBMITTED:ORDER_EXPIRED': 'EXPIRED',
  'SUBMITTED:ORDER_TRIGGERED': 'TRIGGERED',
  'SUBMITTED:ORDER_PARTIAL_FILL': 'PARTIALLY_FILLED',
  'SUBMITTED:ORDER_FILLED': 'FILLED',
  'ACCEPTED:ORDER_REJECTED': 'REJECTED',
  'ACCEPTED:ORDER_PENDING_UPDATE': 'PENDING_UPDATE',
  'ACCEPTED:ORDER_PENDING_CANCEL': 'PENDING_CANCEL',
  'ACCEPTED:ORDER_CANCELED': 'CANCELED',
  'ACCEPTED:ORDER_TRIGGERED': 'TRIGGERED',
  'ACCEPTED:ORDER_EXPIRED': 'EXPIRED',
  'ACCEPTED:ORDER_PARTIAL_FILL': 'PARTIALLY_FILLED',
  'ACCEPTED:ORDER_FILLED': 'FILLED',
  'CANCELED:ORDER_PARTIAL_FILL': 'PARTIALLY_FILLED',
  'CANCELED:ORDER_FILLED': 'FILLED',
  'PARTIALLY_FILLED:ORDER_PARTIAL_FILL': 'PARTIALLY_FILLED',
  'PARTIALLY_FILLED:ORDER_FILLED': 'FILLED',
  'TRIGGERED:ORDER_PARTIAL_FILL': 'PARTIALLY_FILLED',
  'TRIGGERED:ORDER_FILLED': 'FILLED',
}) as Readonly<Partial<Record<TransitionKey, BytexOrderStatus>>>;

export class BytexOrderCoordinator {
  private readonly orders = new Map<string, BytexOrderRecord>();
  private orderEventSequence = 0;
  private readonly orderEvents: BytexOrderLifecycleEvent[] = [];

  listOrders(): readonly BytexOrderRecord[] {
    return Object.freeze([...this.orders.values()]);
  }

  orderEventsLog(): readonly BytexOrderLifecycleEvent[] {
    return Object.freeze([...this.orderEvents]);
  }

  restoreOrders(orders: readonly BytexOrderRecord[], fromSequence: number): void {
    this.orders.clear();
    this.orderEvents.length = 0;
    this.orderEventSequence = fromSequence;
    for (const order of orders) {
      this.orders.set(order.clientOrderId, Object.freeze({ ...order }));
    }
  }

  submit(input: {
    readonly clientOrderId: string;
    readonly instrumentId: string;
    readonly side: 'BUY' | 'SELL';
    readonly quantityMinor: bigint;
    readonly atNs: bigint;
  }): BytexOrderRecord {
    const existing = this.orders.get(input.clientOrderId);
    if (existing) {
      return existing;
    }
    const record: BytexOrderRecord = Object.freeze({
      clientOrderId: input.clientOrderId,
      instrumentId: input.instrumentId,
      side: input.side,
      status: 'INITIALIZED',
      quantityMinor: input.quantityMinor,
      filledQuantityMinor: 0n,
    });
    this.orders.set(input.clientOrderId, record);
    this.apply(input.clientOrderId, 'ORDER_SUBMITTED', input.atNs);
    this.apply(input.clientOrderId, 'ORDER_ACCEPTED', input.atNs);
    return this.orders.get(input.clientOrderId)!;
  }

  apply(clientOrderId: string, kind: BytexOrderEventKind, atNs: bigint, fillQuantityMinor = 0n): BytexOrderRecord {
    const order = this.orders.get(clientOrderId);
    if (!order) {
      throw new Error(`unknown order ${clientOrderId}`);
    }
    const key = `${order.status}:${kind}` as TransitionKey;
    const next = TRANSITIONS[key];
    if (!next) {
      throw new Error(`invalid order transition ${order.status} + ${kind}`);
    }
    let filled = order.filledQuantityMinor;
    if (kind === 'ORDER_PARTIAL_FILL') {
      filled += fillQuantityMinor;
    }
    if (kind === 'ORDER_FILLED') {
      filled = order.quantityMinor;
    }
    const updated: BytexOrderRecord = Object.freeze({
      ...order,
      status: next,
      filledQuantityMinor: filled,
    });
    this.orders.set(clientOrderId, updated);
    this.orderEventSequence += 1;
    this.orderEvents.push(
      Object.freeze({
        sequence: this.orderEventSequence,
        atNs,
        clientOrderId,
        kind,
        fromStatus: order.status,
        toStatus: next,
      }),
    );
    return updated;
  }
}
