import { randomUUID } from 'node:crypto';

import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { availableUnits } from './capacity-source.ts';
import { asCapacityPoolId } from './ids.ts';
import type { CapacityPoolId } from './ids.ts';
import type { CapacityPool, CapacityReservation } from './types.ts';

export type StoreRejection = {
  readonly code:
    | 'POOL_NOT_FOUND'
    | 'POOL_CONFLICT'
    | 'POOL_CAPACITY_EXCEEDED'
    | 'RESERVATION_NOT_FOUND'
    | 'RESERVATION_CONFLICT'
    | 'ILLEGAL_TRANSITION';
  readonly message: string;
};

export function freezePool(pool: CapacityPool): CapacityPool {
  if (pool.totalUnits < 0 || pool.reservedUnits < 0 || pool.heldUnits < 0) {
    throw new Error('capacity units must be non-negative');
  }
  if (pool.reservedUnits + pool.heldUnits > pool.totalUnits) {
    throw new Error('capacity oversold');
  }
  return Object.freeze({ ...pool });
}

export function freezeReservation(row: CapacityReservation): CapacityReservation {
  if (row.requestedUnits <= 0) {
    throw new Error('requested units must be positive');
  }
  if (row.heldUnits < 0 || row.confirmedUnits < 0) {
    throw new Error('held/confirmed units must be non-negative');
  }
  return Object.freeze({ ...row });
}

/**
 * In-memory capacity store with per-pool epoch CAS and mutex.
 * Concurrent reservations against the same pool cannot oversell.
 */
export class CapacityStore {
  private readonly pools = new Map<string, CapacityPool>();
  private readonly reservations = new Map<string, CapacityReservation>();
  private readonly byIdempotency = new Map<string, CapacityReservation>();
  private readonly poolLocks = new Map<string, Promise<void>>();

  putPool(pool: CapacityPool): void {
    this.pools.set(pool.poolId as string, freezePool(pool));
  }

  getPool(poolId: CapacityPoolId): CapacityPool | undefined {
    return this.pools.get(poolId as string);
  }

  listPools(): readonly CapacityPool[] {
    return [...this.pools.values()];
  }

  getReservation(id: string): CapacityReservation | undefined {
    return this.reservations.get(id);
  }

  getByIdempotencyKey(key: string): CapacityReservation | undefined {
    return this.byIdempotency.get(key);
  }

  listReservations(): readonly CapacityReservation[] {
    return [...this.reservations.values()];
  }

  putReservation(reservation: CapacityReservation): void {
    const frozen = freezeReservation(reservation);
    this.reservations.set(frozen.reservationId as string, frozen);
    this.byIdempotency.set(frozen.idempotencyKey, frozen);
  }

  /**
   * Atomically place a soft hold. Fails closed when capacity is insufficient
   * unless partial units are explicitly allowed by the caller.
   */
  placeSoftHold(input: {
    readonly poolId: CapacityPoolId;
    readonly units: number;
    readonly expectedEpoch: number;
    readonly now: UtcInstant;
    readonly partialAllowed: boolean;
  }): Result<{ readonly pool: CapacityPool; readonly heldUnits: number }, StoreRejection> {
    const pool = this.pools.get(input.poolId as string);
    if (!pool) {
      return err({ code: 'POOL_NOT_FOUND', message: 'capacity pool does not exist' });
    }
    if (pool.epoch !== input.expectedEpoch) {
      return err({ code: 'POOL_CONFLICT', message: 'pool epoch changed; retry' });
    }
    const available = availableUnits(pool);
    let heldUnits = input.units;
    if (input.partialAllowed) {
      heldUnits = Math.min(input.units, available);
      if (heldUnits <= 0) {
        return err({ code: 'POOL_CAPACITY_EXCEEDED', message: 'no capacity available' });
      }
    } else if (input.units > available) {
      return err({ code: 'POOL_CAPACITY_EXCEEDED', message: 'insufficient capacity' });
    }
    const next = freezePool({
      ...pool,
      heldUnits: pool.heldUnits + heldUnits,
      epoch: pool.epoch + 1,
      updatedAt: input.now,
    });
    this.pools.set(pool.poolId as string, next);
    return ok({ pool: next, heldUnits });
  }

  /**
   * Convert a soft hold into a firm reservation on confirmation.
   */
  confirmHold(input: {
    readonly poolId: CapacityPoolId;
    readonly heldUnits: number;
    readonly expectedEpoch: number;
    readonly now: UtcInstant;
  }): Result<CapacityPool, StoreRejection> {
    const pool = this.pools.get(input.poolId as string);
    if (!pool) {
      return err({ code: 'POOL_NOT_FOUND', message: 'capacity pool does not exist' });
    }
    if (pool.epoch !== input.expectedEpoch) {
      return err({ code: 'POOL_CONFLICT', message: 'pool epoch changed; retry' });
    }
    if (pool.heldUnits < input.heldUnits) {
      return err({ code: 'POOL_CAPACITY_EXCEEDED', message: 'hold exceeds pool held units' });
    }
    const next = freezePool({
      ...pool,
      heldUnits: pool.heldUnits - input.heldUnits,
      reservedUnits: pool.reservedUnits + input.heldUnits,
      epoch: pool.epoch + 1,
      updatedAt: input.now,
    });
    this.pools.set(pool.poolId as string, next);
    return ok(next);
  }

  /**
   * Release soft-held units (cancel/expire before confirmation).
   */
  releaseSoftHold(input: {
    readonly poolId: CapacityPoolId;
    readonly units: number;
    readonly expectedEpoch: number;
    readonly now: UtcInstant;
  }): Result<CapacityPool, StoreRejection> {
    const pool = this.pools.get(input.poolId as string);
    if (!pool) {
      return err({ code: 'POOL_NOT_FOUND', message: 'capacity pool does not exist' });
    }
    if (pool.epoch !== input.expectedEpoch) {
      return err({ code: 'POOL_CONFLICT', message: 'pool epoch changed; retry' });
    }
    const release = Math.min(input.units, pool.heldUnits);
    const next = freezePool({
      ...pool,
      heldUnits: pool.heldUnits - release,
      epoch: pool.epoch + 1,
      updatedAt: input.now,
    });
    this.pools.set(pool.poolId as string, next);
    return ok(next);
  }

  /**
   * Release firm reserved units (cancel/complete/fail after confirmation).
   */
  releaseFirmReservation(input: {
    readonly poolId: CapacityPoolId;
    readonly units: number;
    readonly expectedEpoch: number;
    readonly now: UtcInstant;
  }): Result<CapacityPool, StoreRejection> {
    const pool = this.pools.get(input.poolId as string);
    if (!pool) {
      return err({ code: 'POOL_NOT_FOUND', message: 'capacity pool does not exist' });
    }
    if (pool.epoch !== input.expectedEpoch) {
      return err({ code: 'POOL_CONFLICT', message: 'pool epoch changed; retry' });
    }
    const release = Math.min(input.units, pool.reservedUnits);
    const next = freezePool({
      ...pool,
      reservedUnits: pool.reservedUnits - release,
      epoch: pool.epoch + 1,
      updatedAt: input.now,
    });
    this.pools.set(pool.poolId as string, next);
    return ok(next);
  }

  async withPoolLock<T>(poolId: CapacityPoolId, fn: () => T | Promise<T>): Promise<T> {
    const key = poolId as string;
    const previous = this.poolLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const next = previous.then(() => gate);
    this.poolLocks.set(key, next);
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  seedPool(input: Omit<CapacityPool, 'epoch' | 'reservedUnits' | 'heldUnits' | 'updatedAt'> & {
    readonly now: UtcInstant;
  }): CapacityPool {
    const pool = freezePool({
      ...input,
      poolId: asCapacityPoolId(input.poolId as string),
      reservedUnits: 0,
      heldUnits: 0,
      epoch: 0,
      updatedAt: input.now,
    });
    this.putPool(pool);
    return pool;
  }

  newReservationId(prefix = 'capres'): string {
    return `${prefix}_${randomUUID()}`;
  }
}
