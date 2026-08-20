/**
 * Crash-safe exchange operational persistence. Native asset authority remains
 * finalized chain state. This store is not a second ledger.
 *
 * FILE_NOT_FOUND initializes an empty fixture. Corruption fails closed.
 */

import { dirname, join } from 'node:path';

import {
  DurableStoreError,
  type NativeOperationalAssetId,
  type SnapshotPersistOptions,
  assertNativeAsset,
  isNativeOperationalAssetId,
  loadEnvelopeOrEmpty,
  persistEnvelopeAtomic,
  wrapSnapshot,
} from '../production/snapshot-envelope.ts';

export type DurableOrderState = 'OPEN' | 'RESERVED' | 'FILLED' | 'CANCELLED';

export const EXCHANGE_ORDER_TRANSITIONS: {
  readonly [S in DurableOrderState]: readonly DurableOrderState[];
} = {
  OPEN: ['RESERVED', 'CANCELLED'],
  RESERVED: ['FILLED', 'CANCELLED'],
  FILLED: [],
  CANCELLED: [],
};

export type DurableOrder = {
  readonly orderId: string;
  readonly clientIdempotencyKey: string;
  readonly state: DurableOrderState;
  readonly holdId: string | null;
  readonly baseAsset: NativeOperationalAssetId;
  readonly quoteAsset: NativeOperationalAssetId;
  readonly revision: number;
};

export type DurableReservation = {
  readonly reservationId: string;
  readonly orderId: string;
  readonly assetId: NativeOperationalAssetId;
  readonly quantity: string;
  readonly revision: number;
};

export type DurableTrade = {
  readonly tradeId: string;
  readonly buyOrderId: string;
  readonly sellOrderId: string;
};

export type DurableSettlementIntent = {
  readonly intentId: string;
  readonly tradeId: string;
  readonly baseAsset: NativeOperationalAssetId;
  readonly quoteAsset: NativeOperationalAssetId;
  readonly submission: 'PENDING' | 'KNOWN' | 'SUBMISSION_UNKNOWN';
  readonly journalId: string | null;
  readonly revision: number;
};

export type ExchangeDurableSnapshot = {
  readonly orders: readonly DurableOrder[];
  readonly reservations: readonly DurableReservation[];
  readonly trades: readonly DurableTrade[];
  readonly settlements: readonly DurableSettlementIntent[];
  readonly chainRemainsNativeAssetAuthority: true;
};

const EMPTY_EXCHANGE: ExchangeDurableSnapshot = Object.freeze({
  orders: [],
  reservations: [],
  trades: [],
  settlements: [],
  chainRemainsNativeAssetAuthority: true,
});

export class DurableExchangeStore {
  readonly path: string;
  private snapshot: ExchangeDurableSnapshot;
  private sequence: number;
  private persistOptions: SnapshotPersistOptions;

  constructor(directory: string, persistOptions: SnapshotPersistOptions = {}) {
    this.path = join(directory, 'exchange.durable.json');
    this.persistOptions = persistOptions;
    const loaded = loadEnvelopeOrEmpty(this.path, 'EXCHANGE', isExchangeSnapshot);
    if (loaded.kind === 'EMPTY') {
      this.snapshot = EMPTY_EXCHANGE;
      this.sequence = 0;
      return;
    }
    this.snapshot = loaded.envelope.payload;
    this.sequence = loaded.envelope.sequence;
  }

  upsertOrder(order: DurableOrder): DurableOrder {
    const existing = this.snapshot.orders.find((row) => row.clientIdempotencyKey === order.clientIdempotencyKey);
    if (existing) {
      return existing;
    }
    assertNativeAsset(order.baseAsset, 'order.baseAsset');
    assertNativeAsset(order.quoteAsset, 'order.quoteAsset');
    this.snapshot = { ...this.snapshot, orders: [...this.snapshot.orders, { ...order, revision: order.revision ?? 1 }] };
    this.persist();
    return order;
  }

  transitionOrder(orderId: string, to: DurableOrderState, expectedRevision?: number): DurableOrder {
    const current = this.snapshot.orders.find((row) => row.orderId === orderId);
    if (!current) {
      throw new Error('order not found');
    }
    if (expectedRevision !== undefined && current.revision !== expectedRevision) {
      throw new DurableStoreError('STALE_REVISION', `stale writer for order ${orderId}`);
    }
    if (!EXCHANGE_ORDER_TRANSITIONS[current.state].includes(to)) {
      throw new DurableStoreError('ILLEGAL_TRANSITION', `exchange order ${current.state} → ${to} is illegal`);
    }
    const next: DurableOrder = { ...current, state: to, revision: current.revision + 1 };
    this.snapshot = {
      ...this.snapshot,
      orders: this.snapshot.orders.map((row) => (row.orderId === orderId ? next : row)),
    };
    this.persist();
    return next;
  }

  reserve(reservation: DurableReservation): void {
    assertNativeAsset(reservation.assetId, 'reservation.assetId');
    this.snapshot = { ...this.snapshot, reservations: [...this.snapshot.reservations, reservation] };
    this.persist();
  }

  recordTrade(trade: DurableTrade): void {
    this.snapshot = { ...this.snapshot, trades: [...this.snapshot.trades, trade] };
    this.persist();
  }

  recordSettlement(intent: DurableSettlementIntent): void {
    assertNativeAsset(intent.baseAsset, 'settlement.baseAsset');
    assertNativeAsset(intent.quoteAsset, 'settlement.quoteAsset');
    this.snapshot = { ...this.snapshot, settlements: [...this.snapshot.settlements, intent] };
    this.persist();
  }

  reopen(): DurableExchangeStore {
    return new DurableExchangeStore(dirname(this.path));
  }

  list(): ExchangeDurableSnapshot {
    return this.snapshot;
  }

  private persist(): void {
    this.sequence += 1;
    persistEnvelopeAtomic(
      this.path,
      wrapSnapshot({
        storeKind: 'EXCHANGE',
        sequence: this.sequence,
        createdAt: new Date().toISOString(),
        payload: this.snapshot,
      }),
      this.persistOptions,
    );
  }
}

function isExchangeSnapshot(value: unknown): value is ExchangeDurableSnapshot {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.chainRemainsNativeAssetAuthority !== true) {
    return false;
  }
  if (!Array.isArray(record.orders) || !Array.isArray(record.reservations) || !Array.isArray(record.settlements)) {
    return false;
  }
  return (
    (record.orders as readonly unknown[]).every(isOrder) &&
    (record.reservations as readonly unknown[]).every(isReservation) &&
    (record.settlements as readonly unknown[]).every(isSettlement)
  );
}

function isOrder(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.orderId === 'string' &&
    typeof row.clientIdempotencyKey === 'string' &&
    isNativeOperationalAssetId(row.baseAsset) &&
    isNativeOperationalAssetId(row.quoteAsset)
  );
}

function isReservation(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.reservationId === 'string' && isNativeOperationalAssetId(row.assetId);
}

function isSettlement(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.intentId === 'string' &&
    isNativeOperationalAssetId(row.baseAsset) &&
    isNativeOperationalAssetId(row.quoteAsset)
  );
}

export { DurableStoreError };
