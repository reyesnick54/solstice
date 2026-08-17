/**
 * Crash-safe exchange operational persistence. Native asset authority remains
 * finalized chain state. This store is not a second ledger.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type DurableOrder = {
  readonly orderId: string;
  readonly clientIdempotencyKey: string;
  readonly state: 'OPEN' | 'RESERVED' | 'FILLED' | 'CANCELLED';
  readonly holdId: string | null;
};

export type DurableReservation = {
  readonly reservationId: string;
  readonly orderId: string;
  readonly quantity: string;
};

export type DurableTrade = {
  readonly tradeId: string;
  readonly buyOrderId: string;
  readonly sellOrderId: string;
};

export type DurableSettlementIntent = {
  readonly intentId: string;
  readonly tradeId: string;
  readonly submission: 'KNOWN' | 'SUBMISSION_UNKNOWN';
  readonly journalId: string | null;
};

export type ExchangeDurableSnapshot = {
  readonly orders: readonly DurableOrder[];
  readonly reservations: readonly DurableReservation[];
  readonly trades: readonly DurableTrade[];
  readonly settlements: readonly DurableSettlementIntent[];
  readonly chainRemainsNativeAssetAuthority: true;
};

export class DurableExchangeStore {
  readonly path: string;
  private snapshot: ExchangeDurableSnapshot;

  constructor(directory: string) {
    this.path = join(directory, 'exchange.durable.json');
    this.snapshot = loadOrEmpty(this.path);
  }

  upsertOrder(order: DurableOrder): DurableOrder {
    const existing = this.snapshot.orders.find((row) => row.clientIdempotencyKey === order.clientIdempotencyKey);
    if (existing) {
      return existing;
    }
    this.snapshot = { ...this.snapshot, orders: [...this.snapshot.orders, order] };
    persistAtomic(this.path, this.snapshot);
    return order;
  }

  reserve(reservation: DurableReservation): void {
    this.snapshot = { ...this.snapshot, reservations: [...this.snapshot.reservations, reservation] };
    persistAtomic(this.path, this.snapshot);
  }

  recordTrade(trade: DurableTrade): void {
    this.snapshot = { ...this.snapshot, trades: [...this.snapshot.trades, trade] };
    persistAtomic(this.path, this.snapshot);
  }

  recordSettlement(intent: DurableSettlementIntent): void {
    this.snapshot = { ...this.snapshot, settlements: [...this.snapshot.settlements, intent] };
    persistAtomic(this.path, this.snapshot);
  }

  reopen(): DurableExchangeStore {
    return new DurableExchangeStore(dirname(this.path));
  }

  list(): ExchangeDurableSnapshot {
    return this.snapshot;
  }
}

function loadOrEmpty(path: string): ExchangeDurableSnapshot {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ExchangeDurableSnapshot;
  } catch {
    return {
      orders: [],
      reservations: [],
      trades: [],
      settlements: [],
      chainRemainsNativeAssetAuthority: true,
    };
  }
}

function persistAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(value), { mode: 0o600 });
  renameSync(tmp, path);
}
