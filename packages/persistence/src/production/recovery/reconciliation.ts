import type { OperationalSnapshot } from '../operational/types.ts';
import type { RecoveryReadiness, UnresolvedOperation } from './types.ts';

export function discoverUnresolved(snapshot: OperationalSnapshot, nowIso = new Date().toISOString()): readonly UnresolvedOperation[] {
  const unresolved: UnresolvedOperation[] = [];
  for (const payment of snapshot.payments) {
    if (payment.status === 'SUBMISSION_UNKNOWN') {
      unresolved.push({
        domain: 'PAYMENT',
        id: payment.paymentId,
        reason: 'SUBMISSION_UNKNOWN',
        queryBeforeRetry: true,
      });
    }
  }
  for (const withdrawal of snapshot.withdrawals) {
    if (withdrawal.state === 'SUBMISSION_UNKNOWN') {
      unresolved.push({
        domain: 'CUSTODY',
        id: withdrawal.withdrawalId,
        reason: 'SUBMISSION_UNKNOWN',
        queryBeforeRetry: true,
      });
    }
  }
  for (const settlement of snapshot.settlements) {
    if (settlement.submission === 'PENDING' || settlement.submission === 'SUBMISSION_UNKNOWN') {
      unresolved.push({
        domain: 'EXCHANGE',
        id: settlement.intentId,
        reason: 'PENDING_SETTLEMENT',
        queryBeforeRetry: true,
      });
    }
  }
  for (const row of snapshot.outbox) {
    if (row.state === 'IN_FLIGHT' && row.leaseExpiresAt !== null && row.leaseExpiresAt <= nowIso) {
      unresolved.push({
        domain: 'OUTBOX',
        id: row.eventId,
        reason: 'IN_FLIGHT_LEASE_EXPIRED',
        queryBeforeRetry: true,
      });
    }
  }
  for (const row of snapshot.inbox) {
    if (row.interrupted || row.state === 'PROCESSING') {
      unresolved.push({
        domain: 'INBOX',
        id: `${row.consumerId}:${row.eventId}`,
        reason: 'INBOX_INTERRUPTED',
        queryBeforeRetry: true,
      });
    }
  }
  for (const provider of snapshot.providers) {
    if (provider.revalidationState === 'PENDING') {
      unresolved.push({
        domain: 'PROVIDER',
        id: provider.providerId,
        reason: 'REVALIDATION_PENDING',
        queryBeforeRetry: true,
      });
    }
    if (provider.acceptanceStatus === 'REVOKED') {
      unresolved.push({
        domain: 'PROVIDER',
        id: provider.providerId,
        reason: 'REVOKED_PROVIDER',
        queryBeforeRetry: true,
      });
    }
  }
  return Object.freeze(unresolved);
}

export function recoverOutboxForRehydration(snapshot: OperationalSnapshot): OperationalSnapshot {
  return {
    ...snapshot,
    outbox: snapshot.outbox.map((row) =>
      row.state === 'IN_FLIGHT' ? { ...row, state: 'PENDING' as const, notAJournal: true as const } : row,
    ),
  };
}

export function readinessFor(unresolved: readonly UnresolvedOperation[], corrupt: boolean): RecoveryReadiness {
  if (corrupt) {
    return 'CORRUPT_STATE';
  }
  if (unresolved.some((row) => row.reason === 'REVOKED_PROVIDER')) {
    return 'MANUAL_REVIEW_REQUIRED';
  }
  if (unresolved.length > 0) {
    return 'RECONCILIATION_REQUIRED';
  }
  return 'READY';
}
