import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../domain/src/time.ts';
import { asWaitlistEntryId, type CapacityPoolId, type CapacityReservationId, type WaitlistEntryId } from './ids.ts';

export type WaitlistEntry = {
  readonly entryId: WaitlistEntryId;
  readonly poolId: CapacityPoolId;
  readonly reservationId: CapacityReservationId | null;
  readonly actorId: string;
  readonly accountId: string;
  readonly requestedUnits: number;
  readonly idempotencyKey: string;
  readonly createdAt: UtcInstant;
  readonly promotedAt: UtcInstant | null;
};

export type WaitlistHooks = {
  onWaitlisted?(entry: WaitlistEntry): void;
  onPromoted?(entry: WaitlistEntry, reservationId: CapacityReservationId): void;
};

export class WaitlistStore {
  private readonly entries = new Map<string, WaitlistEntry>();
  private readonly byPool = new Map<string, WaitlistEntry[]>();
  private readonly hooks: WaitlistHooks;

  constructor(hooks: WaitlistHooks = {}) {
    this.hooks = hooks;
  }

  enqueue(input: {
    readonly poolId: CapacityPoolId;
    readonly actorId: string;
    readonly accountId: string;
    readonly requestedUnits: number;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): WaitlistEntry {
    const existing = [...this.entries.values()].find((row) => row.idempotencyKey === input.idempotencyKey);
    if (existing) {
      return existing;
    }
    const entry: WaitlistEntry = Object.freeze({
      entryId: asWaitlistEntryId(`wl_${randomUUID()}`),
      poolId: input.poolId,
      reservationId: null,
      actorId: input.actorId,
      accountId: input.accountId,
      requestedUnits: input.requestedUnits,
      idempotencyKey: input.idempotencyKey,
      createdAt: input.now,
      promotedAt: null,
    });
    this.entries.set(entry.entryId as string, entry);
    const poolRows = this.byPool.get(input.poolId as string) ?? [];
    poolRows.push(entry);
    this.byPool.set(input.poolId as string, poolRows);
    this.hooks.onWaitlisted?.(entry);
    return entry;
  }

  listForPool(poolId: CapacityPoolId): readonly WaitlistEntry[] {
    return (this.byPool.get(poolId as string) ?? []).filter((row) => row.promotedAt === null);
  }

  promote(entryId: WaitlistEntryId, reservationId: CapacityReservationId, now: UtcInstant): WaitlistEntry | undefined {
    const current = this.entries.get(entryId as string);
    if (!current || current.promotedAt !== null) {
      return undefined;
    }
    const next: WaitlistEntry = Object.freeze({
      ...current,
      reservationId,
      promotedAt: now,
    });
    this.entries.set(entryId as string, next);
    this.hooks.onPromoted?.(next, reservationId);
    return next;
  }
}
