/**
 * Transaction lifecycle transitions.
 *
 * SUBMITTED → PENDING → INCLUDED → EXECUTED → FINALIZED
 * Any stage may transition to FAILED. Only FINALIZED is canonical monetary truth.
 */

import type { TransactionLifecycleRecord, TransactionLifecycleStatus } from './types.ts';

const ORDER: readonly TransactionLifecycleStatus[] = [
  'SUBMITTED',
  'PENDING',
  'INCLUDED',
  'EXECUTED',
  'FINALIZED',
];

export function lifecycleRank(status: TransactionLifecycleStatus): number {
  if (status === 'FAILED') {
    return -1;
  }
  return ORDER.indexOf(status);
}

export function canAdvance(
  current: TransactionLifecycleStatus,
  next: TransactionLifecycleStatus,
): boolean {
  if (current === 'FAILED' || current === 'FINALIZED') {
    return false;
  }
  if (next === 'FAILED') {
    return true;
  }
  return lifecycleRank(next) === lifecycleRank(current) + 1;
}

export function advanceLifecycle(
  record: TransactionLifecycleRecord,
  next: TransactionLifecycleStatus,
  meta: {
    readonly height?: bigint | null;
    readonly blockHash?: string | null;
    readonly failureReason?: string | null;
  } = {},
): TransactionLifecycleRecord {
  if (!canAdvance(record.status, next)) {
    throw new Error(`invalid lifecycle transition ${record.status} -> ${next}`);
  }
  return Object.freeze({
    txId: record.txId,
    status: next,
    height: meta.height ?? record.height,
    blockHash: meta.blockHash ?? record.blockHash,
    finalized: next === 'FINALIZED',
    failureReason: next === 'FAILED' ? meta.failureReason ?? 'rejected' : null,
  });
}

export function createSubmitted(txId: string): TransactionLifecycleRecord {
  return Object.freeze({
    txId,
    status: 'SUBMITTED',
    height: null,
    blockHash: null,
    finalized: false,
    failureReason: null,
  });
}

export function isCanonicalTruth(status: TransactionLifecycleStatus): boolean {
  return status === 'FINALIZED';
}

export function isNonFinalExposure(status: TransactionLifecycleStatus): boolean {
  return status === 'SUBMITTED' || status === 'PENDING' || status === 'INCLUDED' || status === 'EXECUTED';
}

export function advanceToIncluded(
  record: TransactionLifecycleRecord,
  meta: { readonly height: bigint; readonly blockHash: string },
): TransactionLifecycleRecord {
  let current = record;
  if (current.status === 'SUBMITTED') {
    current = advanceLifecycle(current, 'PENDING');
  }
  if (current.status === 'PENDING') {
    current = advanceLifecycle(current, 'INCLUDED', meta);
  }
  return current;
}
