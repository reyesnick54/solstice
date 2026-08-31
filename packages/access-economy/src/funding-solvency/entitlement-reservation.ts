/**
 * ACCESS Wave 1 — Atomic entitlement unit reservations.
 */

import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessEntitlementReservation } from './types.ts';
import type { AccessEntitlementLedger } from './entitlement-ledger.ts';

export type EntitlementReservationResult =
  | { readonly ok: true; readonly reservation: AccessEntitlementReservation }
  | { readonly ok: false; readonly code: 'INSUFFICIENT_ENTITLEMENT' | 'NOT_FOUND' | 'IDEMPOTENT'; readonly reservation?: AccessEntitlementReservation };

export class AccessEntitlementReservationStore {
  private readonly reservations = new Map<string, AccessEntitlementReservation>();
  private readonly byIdempotency = new Map<string, AccessEntitlementReservation>();
  private readonly entitlementLocks = new Map<string, Promise<void>>();
  private readonly entitlementLedger: AccessEntitlementLedger;

  constructor(entitlementLedger: AccessEntitlementLedger) {
    this.entitlementLedger = entitlementLedger;
  }

  async withEntitlementLock<T>(entitlementId: string, fn: () => T | Promise<T>): Promise<T> {
    const previous = this.entitlementLocks.get(entitlementId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const next = previous.then(() => gate);
    this.entitlementLocks.set(entitlementId, next);
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async reserve(input: {
    readonly entitlementId: string;
    readonly accessTransactionId: string;
    readonly userId: string;
    readonly category: string;
    readonly unit: string;
    readonly quantity: bigint;
    readonly expiresAt: UtcInstant;
    readonly evidenceReference: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<EntitlementReservationResult> {
    return this.withEntitlementLock(input.entitlementId, () => {
      const prior = this.byIdempotency.get(input.idempotencyKey);
      if (prior) {
        return { ok: false, code: 'IDEMPOTENT', reservation: prior };
      }

      const balance = this.entitlementLedger.getBalance(input.entitlementId);
      if (!balance || balance.remaining < input.quantity) {
        return { ok: false, code: 'INSUFFICIENT_ENTITLEMENT' };
      }

      const reservation: AccessEntitlementReservation = Object.freeze({
        entitlementReservationId: `eres_${randomUUID()}`,
        entitlementId: input.entitlementId,
        accessTransactionId: input.accessTransactionId,
        userId: input.userId,
        category: input.category,
        unit: input.unit,
        quantity: input.quantity,
        expiresAt: input.expiresAt,
        status: 'RESERVED',
        idempotencyKey: input.idempotencyKey,
        evidenceReference: input.evidenceReference,
        createdAt: input.now,
        updatedAt: input.now,
      });

      this.entitlementLedger.reserve({
        entitlementId: input.entitlementId,
        userId: input.userId,
        category: input.category,
        unit: input.unit,
        quantity: input.quantity,
        reservationReference: reservation.entitlementReservationId,
        transactionReference: input.accessTransactionId,
        evidenceReference: input.evidenceReference,
        createdAt: input.now,
        idempotencyKey: `reserve:${input.idempotencyKey}`,
      });

      this.reservations.set(reservation.entitlementReservationId, reservation);
      this.byIdempotency.set(input.idempotencyKey, reservation);
      return { ok: true, reservation };
    });
  }

  async release(input: {
    readonly entitlementReservationId: string;
    readonly evidenceReference: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<AccessEntitlementReservation | null> {
    const current = this.reservations.get(input.entitlementReservationId);
    if (!current) {
      return null;
    }
    return this.withEntitlementLock(current.entitlementId, () => {
      const prior = this.byIdempotency.get(input.idempotencyKey);
      if (prior) {
        return prior;
      }

      this.entitlementLedger.releaseReservation({
        entitlementId: current.entitlementId,
        userId: current.userId,
        category: current.category,
        unit: current.unit,
        quantity: current.quantity,
        reservationReference: current.entitlementReservationId,
        transactionReference: current.accessTransactionId,
        evidenceReference: input.evidenceReference,
        createdAt: input.now,
        idempotencyKey: `release:${input.idempotencyKey}`,
      });

      const next: AccessEntitlementReservation = Object.freeze({
        ...current,
        status: 'RELEASED',
        updatedAt: input.now,
      });
      this.reservations.set(input.entitlementReservationId, next);
      this.byIdempotency.set(input.idempotencyKey, next);
      return next;
    });
  }

  async consume(input: {
    readonly entitlementReservationId: string;
    readonly evidenceReference: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<AccessEntitlementReservation | null> {
    const current = this.reservations.get(input.entitlementReservationId);
    if (!current || current.status !== 'RESERVED') {
      return null;
    }
    return this.withEntitlementLock(current.entitlementId, () => {
      const prior = this.byIdempotency.get(input.idempotencyKey);
      if (prior) {
        return prior;
      }

      this.entitlementLedger.redeem({
        entitlementId: current.entitlementId,
        userId: current.userId,
        category: current.category,
        unit: current.unit,
        quantity: current.quantity,
        reservationReference: current.entitlementReservationId,
        transactionReference: current.accessTransactionId,
        evidenceReference: input.evidenceReference,
        createdAt: input.now,
        idempotencyKey: `consume:${input.idempotencyKey}`,
      });

      const next: AccessEntitlementReservation = Object.freeze({
        ...current,
        status: 'CONSUMED',
        updatedAt: input.now,
      });
      this.reservations.set(input.entitlementReservationId, next);
      this.byIdempotency.set(input.idempotencyKey, next);
      return next;
    });
  }

  totalReserved(entitlementId: string): bigint {
    return [...this.reservations.values()]
      .filter((row) => row.entitlementId === entitlementId && row.status === 'RESERVED')
      .reduce((sum, row) => sum + row.quantity, 0n);
  }

  getReservation(id: string): AccessEntitlementReservation | undefined {
    return this.reservations.get(id);
  }
}
