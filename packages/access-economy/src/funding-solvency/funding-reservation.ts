/**
 * ACCESS Wave 1 — Atomic funding reservations with pool-level locking.
 */

import { randomUUID } from 'node:crypto';

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import type { AccessFundingReservation, AccessFundingReservationStatus } from './types.ts';
import type { AccessFundingLedger } from './funding-ledger.ts';
import type { AccessFundingPoolRegistry } from './funding-pool.ts';

export type FundingReservationResult =
  | { readonly ok: true; readonly reservation: AccessFundingReservation }
  | { readonly ok: false; readonly code: 'INSUFFICIENT_FUNDING' | 'POOL_NOT_FOUND' | 'POOL_SUSPENDED' | 'CATEGORY_MISMATCH' | 'IDEMPOTENT'; readonly reservation?: AccessFundingReservation };

export class AccessFundingReservationStore {
  private readonly reservations = new Map<string, AccessFundingReservation>();
  private readonly byIdempotency = new Map<string, AccessFundingReservation>();
  private readonly poolLocks = new Map<string, Promise<void>>();
  private poolEpochs = new Map<string, number>();
  private readonly poolRegistry: AccessFundingPoolRegistry;
  private readonly fundingLedger: AccessFundingLedger;

  constructor(poolRegistry: AccessFundingPoolRegistry, fundingLedger: AccessFundingLedger) {
    this.poolRegistry = poolRegistry;
    this.fundingLedger = fundingLedger;
  }

  async withPoolLock<T>(fundingPoolId: string, fn: () => T | Promise<T>): Promise<T> {
    const previous = this.poolLocks.get(fundingPoolId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const next = previous.then(() => gate);
    this.poolLocks.set(fundingPoolId, next);
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private getEpoch(fundingPoolId: string): number {
    return this.poolEpochs.get(fundingPoolId) ?? 0;
  }

  private bumpEpoch(fundingPoolId: string): number {
    const next = this.getEpoch(fundingPoolId) + 1;
    this.poolEpochs.set(fundingPoolId, next);
    return next;
  }

  async reserve(input: {
    readonly fundingPoolId: string;
    readonly accessTransactionId: string;
    readonly userId: string;
    readonly currency: string;
    readonly amountMinorUnits: bigint;
    readonly category?: string;
    readonly expiresAt: UtcInstant;
    readonly evidenceReference: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<FundingReservationResult> {
    return this.withPoolLock(input.fundingPoolId, () => {
      const prior = this.byIdempotency.get(input.idempotencyKey);
      if (prior) {
        return { ok: false, code: 'IDEMPOTENT', reservation: prior };
      }

      const pool = this.poolRegistry.getPool(input.fundingPoolId);
      if (!pool) {
        return { ok: false, code: 'POOL_NOT_FOUND' };
      }
      if (pool.status !== 'ACTIVE') {
        return { ok: false, code: 'POOL_SUSPENDED' };
      }
      if (
        pool.categoryPolicy === 'STRICT_CATEGORY' &&
        pool.category !== null &&
        input.category !== undefined &&
        pool.category !== input.category
      ) {
        return { ok: false, code: 'CATEGORY_MISMATCH' };
      }

      const sources = this.poolRegistry.activeSourcesForPool(input.fundingPoolId, input.now);
      const balance = this.fundingLedger.getPoolBalance(
        input.fundingPoolId,
        input.currency,
        sources,
        input.now,
      );

      if (balance.availableCashFunding < input.amountMinorUnits) {
        return { ok: false, code: 'INSUFFICIENT_FUNDING' };
      }

      const reservation: AccessFundingReservation = Object.freeze({
        fundingReservationId: `fres_${randomUUID()}`,
        fundingPoolId: input.fundingPoolId,
        accessTransactionId: input.accessTransactionId,
        userId: input.userId,
        currency: input.currency,
        amountMinorUnits: input.amountMinorUnits,
        expiresAt: input.expiresAt,
        status: 'RESERVED',
        idempotencyKey: input.idempotencyKey,
        evidenceReference: input.evidenceReference,
        createdAt: input.now,
        updatedAt: input.now,
      });

      this.fundingLedger.reserveSettlement({
        fundingPoolId: input.fundingPoolId,
        currency: input.currency,
        amountMinorUnits: input.amountMinorUnits,
        reservationReference: reservation.fundingReservationId,
        transactionReference: input.accessTransactionId,
        evidenceReference: input.evidenceReference,
        createdAt: input.now,
        idempotencyKey: `reserve:${input.idempotencyKey}`,
      });

      this.reservations.set(reservation.fundingReservationId, reservation);
      this.byIdempotency.set(input.idempotencyKey, reservation);
      this.bumpEpoch(input.fundingPoolId);
      return { ok: true, reservation };
    });
  }

  async release(input: {
    readonly fundingReservationId: string;
    readonly evidenceReference: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<AccessFundingReservation | null> {
    const current = this.reservations.get(input.fundingReservationId);
    if (!current) {
      return null;
    }
    if (current.status === 'RELEASED') {
      return current;
    }
    return this.withPoolLock(current.fundingPoolId, () => {
      const prior = this.byIdempotency.get(input.idempotencyKey);
      if (prior) {
        return prior;
      }

      this.fundingLedger.releaseSettlement({
        fundingPoolId: current.fundingPoolId,
        currency: current.currency,
        amountMinorUnits: current.amountMinorUnits,
        reservationReference: current.fundingReservationId,
        transactionReference: current.accessTransactionId,
        evidenceReference: input.evidenceReference,
        createdAt: input.now,
        idempotencyKey: `release:${input.idempotencyKey}`,
      });

      const next: AccessFundingReservation = Object.freeze({
        ...current,
        status: 'RELEASED',
        updatedAt: input.now,
      });
      this.reservations.set(input.fundingReservationId, next);
      this.byIdempotency.set(input.idempotencyKey, next);
      this.bumpEpoch(current.fundingPoolId);
      return next;
    });
  }

  async consume(input: {
    readonly fundingReservationId: string;
    readonly evidenceReference: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<AccessFundingReservation | null> {
    const current = this.reservations.get(input.fundingReservationId);
    if (!current || current.status !== 'RESERVED') {
      return null;
    }
    return this.withPoolLock(current.fundingPoolId, () => {
      const prior = this.byIdempotency.get(input.idempotencyKey);
      if (prior) {
        return prior;
      }

      this.fundingLedger.captureSettlement({
        fundingPoolId: current.fundingPoolId,
        currency: current.currency,
        amountMinorUnits: current.amountMinorUnits,
        reservationReference: current.fundingReservationId,
        transactionReference: current.accessTransactionId,
        evidenceReference: input.evidenceReference,
        createdAt: input.now,
        idempotencyKey: `consume:${input.idempotencyKey}`,
      });

      const next: AccessFundingReservation = Object.freeze({
        ...current,
        status: 'CONSUMED',
        updatedAt: input.now,
      });
      this.reservations.set(input.fundingReservationId, next);
      this.byIdempotency.set(input.idempotencyKey, next);
      this.bumpEpoch(current.fundingPoolId);
      return next;
    });
  }

  async expireReservations(now: UtcInstant): Promise<readonly AccessFundingReservation[]> {
    const expired: AccessFundingReservation[] = [];
    for (const reservation of this.reservations.values()) {
      if (reservation.status === 'RESERVED' && reservation.expiresAt <= now) {
        const released = await this.release({
          fundingReservationId: reservation.fundingReservationId,
          evidenceReference: `expired:${reservation.fundingReservationId}`,
          idempotencyKey: `expire:${reservation.fundingReservationId}`,
          now,
        });
        if (released) {
          expired.push(
            Object.freeze({
              ...reservation,
              status: 'EXPIRED' as AccessFundingReservationStatus,
              updatedAt: now,
            }),
          );
        }
      }
    }
    return Object.freeze(expired);
  }

  listActiveReservations(fundingPoolId: string): readonly AccessFundingReservation[] {
    return Object.freeze(
      [...this.reservations.values()].filter(
        (row) => row.fundingPoolId === fundingPoolId && row.status === 'RESERVED',
      ),
    );
  }

  listStaleReservations(now: UtcInstant): readonly AccessFundingReservation[] {
    return Object.freeze(
      [...this.reservations.values()].filter(
        (row) => row.status === 'RESERVED' && row.expiresAt <= now,
      ),
    );
  }

  getReservation(id: string): AccessFundingReservation | undefined {
    return this.reservations.get(id);
  }

  getByIdempotencyKey(key: string): AccessFundingReservation | undefined {
    return this.byIdempotency.get(key);
  }

  totalReserved(fundingPoolId: string, currency: string): bigint {
    return [...this.reservations.values()]
      .filter(
        (row) =>
          row.fundingPoolId === fundingPoolId &&
          row.currency === currency &&
          row.status === 'RESERVED',
      )
      .reduce((sum, row) => sum + row.amountMinorUnits, 0n);
  }
}
