/**
 * ACCESS Wave 1 — Access Funding Ledger.
 *
 * Append-only domain subledger for fiat funding movements.
 * Not the canonical financial ledger; reconcilable via evidence references.
 */

import { randomUUID } from 'node:crypto';

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { deriveFundingPoolBalance } from './balance.ts';
import type {
  AccessFundingSource,
  FundingLedgerEntry,
  FundingLedgerEntryType,
  FundingDirection,
  FundingPoolBalance,
} from './types.ts';

export type AppendFundingEntryInput = {
  readonly fundingPoolId: string;
  readonly sourceId: string | null;
  readonly currency: string;
  readonly amountMinorUnits: bigint;
  readonly direction: FundingDirection;
  readonly entryType: FundingLedgerEntryType;
  readonly transactionReference: string;
  readonly reservationReference?: string;
  readonly evidenceReference: string;
  readonly createdAt: UtcInstant;
  readonly idempotencyKey?: string;
};

export class AccessFundingLedger {
  private readonly entries: FundingLedgerEntry[] = [];
  private readonly idempotency = new Map<string, FundingLedgerEntry>();

  append(input: AppendFundingEntryInput): FundingLedgerEntry {
    if (input.amountMinorUnits <= 0n) {
      throw new Error('funding ledger amount must be positive');
    }
    if (input.idempotencyKey) {
      const prior = this.idempotency.get(input.idempotencyKey);
      if (prior) {
        return prior;
      }
    }

    const entry: FundingLedgerEntry = Object.freeze({
      entryId: `fundl_${randomUUID()}`,
      fundingPoolId: input.fundingPoolId,
      sourceId: input.sourceId,
      currency: input.currency,
      amountMinorUnits: input.amountMinorUnits,
      direction: input.direction,
      entryType: input.entryType,
      transactionReference: input.transactionReference,
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

  recordFundingReceived(input: {
    readonly fundingPoolId: string;
    readonly sourceId: string;
    readonly currency: string;
    readonly amountMinorUnits: bigint;
    readonly transactionReference: string;
    readonly evidenceReference: string;
    readonly createdAt?: UtcInstant;
    readonly idempotencyKey?: string;
  }): FundingLedgerEntry {
    return this.append({
      ...input,
      direction: 'CREDIT',
      entryType: 'FUNDING_RECEIVED',
      createdAt: input.createdAt ?? asUtcInstant(new Date().toISOString()),
    });
  }

  reserveSettlement(input: {
    readonly fundingPoolId: string;
    readonly currency: string;
    readonly amountMinorUnits: bigint;
    readonly reservationReference: string;
    readonly transactionReference: string;
    readonly evidenceReference: string;
    readonly createdAt?: UtcInstant;
    readonly idempotencyKey?: string;
  }): FundingLedgerEntry {
    return this.append({
      ...input,
      sourceId: null,
      direction: 'DEBIT',
      entryType: 'SETTLEMENT_RESERVED',
      createdAt: input.createdAt ?? asUtcInstant(new Date().toISOString()),
    });
  }

  releaseSettlement(input: {
    readonly fundingPoolId: string;
    readonly currency: string;
    readonly amountMinorUnits: bigint;
    readonly reservationReference: string;
    readonly transactionReference: string;
    readonly evidenceReference: string;
    readonly createdAt?: UtcInstant;
    readonly idempotencyKey?: string;
  }): FundingLedgerEntry {
    return this.append({
      ...input,
      sourceId: null,
      direction: 'CREDIT',
      entryType: 'SETTLEMENT_RELEASED',
      createdAt: input.createdAt ?? asUtcInstant(new Date().toISOString()),
    });
  }

  captureSettlement(input: {
    readonly fundingPoolId: string;
    readonly currency: string;
    readonly amountMinorUnits: bigint;
    readonly reservationReference: string;
    readonly transactionReference: string;
    readonly evidenceReference: string;
    readonly createdAt?: UtcInstant;
    readonly idempotencyKey?: string;
  }): FundingLedgerEntry {
    return this.append({
      ...input,
      sourceId: null,
      direction: 'DEBIT',
      entryType: 'SETTLEMENT_CAPTURED',
      createdAt: input.createdAt ?? asUtcInstant(new Date().toISOString()),
    });
  }

  recordRefund(input: {
    readonly fundingPoolId: string;
    readonly currency: string;
    readonly amountMinorUnits: bigint;
    readonly transactionReference: string;
    readonly evidenceReference: string;
    readonly createdAt?: UtcInstant;
    readonly idempotencyKey?: string;
  }): FundingLedgerEntry {
    return this.append({
      ...input,
      sourceId: null,
      direction: 'CREDIT',
      entryType: 'REFUND_RECEIVED',
      createdAt: input.createdAt ?? asUtcInstant(new Date().toISOString()),
    });
  }

  allocateReserve(input: {
    readonly fundingPoolId: string;
    readonly currency: string;
    readonly amountMinorUnits: bigint;
    readonly reserveKind: 'refund' | 'risk';
    readonly transactionReference: string;
    readonly evidenceReference: string;
    readonly createdAt?: UtcInstant;
    readonly idempotencyKey?: string;
  }): FundingLedgerEntry {
    return this.append({
      fundingPoolId: input.fundingPoolId,
      sourceId: null,
      currency: input.currency,
      amountMinorUnits: input.amountMinorUnits,
      direction: 'DEBIT',
      entryType: 'RESERVE_ALLOCATED',
      transactionReference: `${input.reserveKind}:${input.transactionReference}`,
      evidenceReference: input.evidenceReference,
      createdAt: input.createdAt ?? asUtcInstant(new Date().toISOString()),
      ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
    });
  }

  getPoolBalance(
    fundingPoolId: string,
    currency: string,
    sources: readonly AccessFundingSource[],
    now: string,
  ): FundingPoolBalance {
    return deriveFundingPoolBalance(
      fundingPoolId,
      currency,
      this.entries,
      sources,
      now,
    );
  }

  listEntries(fundingPoolId?: string): readonly FundingLedgerEntry[] {
    if (fundingPoolId) {
      return Object.freeze(this.entries.filter((row) => row.fundingPoolId === fundingPoolId));
    }
    return Object.freeze([...this.entries]);
  }

  getByIdempotencyKey(key: string): FundingLedgerEntry | undefined {
    return this.idempotency.get(key);
  }
}
