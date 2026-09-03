// @ts-nocheck
/**
 * ACCESS Wave 1 — Access Entitlement Ledger.
 *
 * Append-only domain subledger for Access unit movements.
 * Not the canonical financial ledger.
 */

import { randomUUID } from 'node:crypto';

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { deriveEntitlementBalance } from './balance.ts';
import type {
  EntitlementBalance,
  EntitlementLedgerEntry,
  EntitlementLedgerEntryType,
  EntitlementDirection,
} from './types.ts';

export type AppendEntitlementEntryInput = {
  readonly entitlementId: string;
  readonly userId: string;
  readonly category: string;
  readonly unit: string;
  readonly quantity: bigint;
  readonly direction: EntitlementDirection;
  readonly entryType: EntitlementLedgerEntryType;
  readonly transactionReference: string;
  readonly allocationReference?: string;
  readonly reservationReference?: string;
  readonly evidenceReference: string;
  readonly createdAt: UtcInstant;
  readonly idempotencyKey?: string;
};

export class AccessEntitlementLedger {
  private readonly entries: EntitlementLedgerEntry[] = [];
  private readonly idempotency = new Map<string, EntitlementLedgerEntry>();

  append(input: AppendEntitlementEntryInput): EntitlementLedgerEntry {
    if (input.quantity <= 0n) {
      throw new Error('entitlement ledger quantity must be positive');
    }
    if (input.idempotencyKey) {
      const prior = this.idempotency.get(input.idempotencyKey);
      if (prior) {
        return prior;
      }
    }

    const projected = this.projectBalanceAfter(input);
    if (projected.remaining < 0n) {
      throw new Error(
        `entitlement ledger would create negative remaining balance for ${input.entitlementId}`,
      );
    }
    if (projected.reserved < 0n || projected.consumed < 0n) {
      throw new Error(`entitlement ledger invariant violated for ${input.entitlementId}`);
    }

    const entry: EntitlementLedgerEntry = Object.freeze({
      entryId: `entl_${randomUUID()}`,
      entitlementId: input.entitlementId,
      userId: input.userId,
      category: input.category,
      unit: input.unit,
      quantity: input.quantity,
      direction: input.direction,
      entryType: input.entryType,
      transactionReference: input.transactionReference,
      allocationReference: input.allocationReference ?? null,
      reservationReference: input.reservationReference ?? null,
      evidenceReference: input.evidenceReference,
      createdAt: input.createdAt,
    });

    this.entries.push(entry);
    if (input.idempotencyKey) {
      this.idempotency.set(input.idempotencyKey, entry);
    }
    return entry;
  }

  private projectBalanceAfter(input: AppendEntitlementEntryInput): EntitlementBalance {
    const current = this.getBalance(input.entitlementId);
    const base: EntitlementBalance = current ?? {
      entitlementId: input.entitlementId,
      userId: input.userId,
      category: input.category,
      unit: input.unit,
      allocated: 0n,
      reserved: 0n,
      consumed: 0n,
      expired: 0n,
      released: 0n,
      reversed: 0n,
      remaining: 0n,
    };

    const qty = input.quantity;
    switch (input.entryType) {
      case 'ALLOCATION':
      case 'MANUAL_ADJUSTMENT':
        return {
          ...base,
          allocated: input.direction === 'CREDIT' ? base.allocated + qty : base.allocated - qty,
          remaining:
            input.direction === 'CREDIT' ? base.remaining + qty : base.remaining - qty,
        };
      case 'RESERVATION':
        return {
          ...base,
          reserved: base.reserved + qty,
          remaining: base.remaining - qty,
        };
      case 'RESERVATION_RELEASE':
        return {
          ...base,
          reserved: base.reserved - qty,
          released: base.released + qty,
          remaining: base.remaining + qty,
        };
      case 'REDEMPTION':
        return {
          ...base,
          reserved: base.reserved - qty,
          consumed: base.consumed + qty,
        };
      case 'REVERSAL':
        return {
          ...base,
          consumed: base.consumed - qty,
          reversed: base.reversed + qty,
          remaining: base.remaining + qty,
        };
      case 'EXPIRATION':
        return {
          ...base,
          expired: base.expired + qty,
          remaining: base.remaining - qty,
        };
      default:
        return base;
    }
  }

  allocate(input: {
    readonly entitlementId: string;
    readonly userId: string;
    readonly category: string;
    readonly unit: string;
    readonly quantity: bigint;
    readonly allocationReference: string;
    readonly evidenceReference: string;
    readonly createdAt?: UtcInstant;
    readonly idempotencyKey?: string;
  }): EntitlementLedgerEntry {
    return this.append({
      ...input,
      direction: 'CREDIT',
      entryType: 'ALLOCATION',
      transactionReference: input.allocationReference,
      createdAt: input.createdAt ?? asUtcInstant(new Date().toISOString()),
    });
  }

  reserve(input: {
    readonly entitlementId: string;
    readonly userId: string;
    readonly category: string;
    readonly unit: string;
    readonly quantity: bigint;
    readonly reservationReference: string;
    readonly transactionReference: string;
    readonly evidenceReference: string;
    readonly createdAt?: UtcInstant;
    readonly idempotencyKey?: string;
  }): EntitlementLedgerEntry {
    return this.append({
      ...input,
      direction: 'DEBIT',
      entryType: 'RESERVATION',
      allocationReference: null,
      createdAt: input.createdAt ?? asUtcInstant(new Date().toISOString()),
    });
  }

  releaseReservation(input: {
    readonly entitlementId: string;
    readonly userId: string;
    readonly category: string;
    readonly unit: string;
    readonly quantity: bigint;
    readonly reservationReference: string;
    readonly transactionReference: string;
    readonly evidenceReference: string;
    readonly createdAt?: UtcInstant;
    readonly idempotencyKey?: string;
  }): EntitlementLedgerEntry {
    return this.append({
      ...input,
      direction: 'CREDIT',
      entryType: 'RESERVATION_RELEASE',
      allocationReference: null,
      createdAt: input.createdAt ?? asUtcInstant(new Date().toISOString()),
    });
  }

  redeem(input: {
    readonly entitlementId: string;
    readonly userId: string;
    readonly category: string;
    readonly unit: string;
    readonly quantity: bigint;
    readonly reservationReference: string;
    readonly transactionReference: string;
    readonly evidenceReference: string;
    readonly createdAt?: UtcInstant;
    readonly idempotencyKey?: string;
  }): EntitlementLedgerEntry {
    return this.append({
      ...input,
      direction: 'DEBIT',
      entryType: 'REDEMPTION',
      allocationReference: null,
      createdAt: input.createdAt ?? asUtcInstant(new Date().toISOString()),
    });
  }

  reverse(input: {
    readonly entitlementId: string;
    readonly userId: string;
    readonly category: string;
    readonly unit: string;
    readonly quantity: bigint;
    readonly transactionReference: string;
    readonly evidenceReference: string;
    readonly createdAt?: UtcInstant;
    readonly idempotencyKey?: string;
  }): EntitlementLedgerEntry {
    return this.append({
      ...input,
      direction: 'CREDIT',
      entryType: 'REVERSAL',
      reservationReference: null,
      allocationReference: null,
      createdAt: input.createdAt ?? asUtcInstant(new Date().toISOString()),
    });
  }

  expire(input: {
    readonly entitlementId: string;
    readonly userId: string;
    readonly category: string;
    readonly unit: string;
    readonly quantity: bigint;
    readonly transactionReference: string;
    readonly evidenceReference: string;
    readonly createdAt?: UtcInstant;
    readonly idempotencyKey?: string;
  }): EntitlementLedgerEntry {
    return this.append({
      ...input,
      direction: 'DEBIT',
      entryType: 'EXPIRATION',
      reservationReference: null,
      allocationReference: null,
      createdAt: input.createdAt ?? asUtcInstant(new Date().toISOString()),
    });
  }

  getBalance(entitlementId: string): EntitlementBalance | null {
    return deriveEntitlementBalance(entitlementId, this.entries);
  }

  listEntries(entitlementId?: string): readonly EntitlementLedgerEntry[] {
    if (entitlementId) {
      return Object.freeze(this.entries.filter((row) => row.entitlementId === entitlementId));
    }
    return Object.freeze([...this.entries]);
  }

  getByIdempotencyKey(key: string): EntitlementLedgerEntry | undefined {
    return this.idempotency.get(key);
  }
}
