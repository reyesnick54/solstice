import type { PoolClient } from 'pg';

import type { JournalPersistSink } from '../../../ledger/src/journal.ts';
import { LedgerInvariantError, type Journal } from '../../../ledger/src/types.ts';
import { ledgerAssetKey, ledgerScaledUnits } from '../../../money/src/ledger-amount.ts';
import type { ExecutionAuthority } from '../../../permissions/src/execution-authority.ts';
import { logPersistenceEvent } from '../logging.ts';
import { isUniqueViolation } from '../postgres/write.ts';

/**
 * PostgreSQL adapter behind Ledger.postJournal.
 * This is not a second ledger. It persists journals the Ledger already accepted.
 */
export class PostgresJournalStore implements JournalPersistSink {
  private readonly pending: Array<{
    readonly journal: Journal;
    readonly executionAuthority: ExecutionAuthority;
  }> = [];

  queueAcceptedJournal(journal: Journal, executionAuthority: ExecutionAuthority): void {
    if (!executionAuthority || executionAuthority.authorityId !== journal.executionAuthorityId) {
      throw new LedgerInvariantError(
        'AUTHORITY',
        'durable journal append requires the Execution Authority that authorized the journal',
      );
    }
    this.pending.push({ journal, executionAuthority });
  }

  takePending(): readonly { journal: Journal; executionAuthority: ExecutionAuthority }[] {
    return this.pending.splice(0, this.pending.length);
  }

  async flush(client: PoolClient): Promise<void> {
    for (const item of this.takePending()) {
      await insertAuthorizedJournal(client, item.journal, item.executionAuthority);
    }
  }
}

async function insertAuthorizedJournal(
  client: PoolClient,
  journal: Journal,
  executionAuthority: ExecutionAuthority,
): Promise<void> {
  if (executionAuthority.authorityId !== journal.executionAuthorityId) {
    throw new LedgerInvariantError(
      'AUTHORITY',
      'Execution Authority does not bind this journal',
    );
  }
  try {
    await client.query(
      `INSERT INTO ledger.journal (
         id, idempotency_key, execution_authority_id, action_type, asset,
         class_bridge_name, memo, created_at, status, effective_at, reference,
         correlation_id, causation_id, source_domain, evidence_record_id,
         reverses_journal_id, reversal_kind, request_fingerprint
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        journal.id,
        journal.idempotencyKey,
        journal.executionAuthorityId,
        journal.actionType,
        journal.asset,
        journal.classBridgeName ?? null,
        journal.memo ?? null,
        journal.createdAt,
        journal.status ?? 'POSTED',
        journal.effectiveAt ?? journal.createdAt,
        journal.reference ?? null,
        journal.correlationId ?? null,
        journal.causationId ?? null,
        journal.sourceDomain ?? null,
        journal.evidenceRecordId ?? null,
        journal.reversesJournalId ?? null,
        journal.reversalKind ?? null,
        journal.requestFingerprint ?? null,
      ],
    );
    await client.query(
      `INSERT INTO ledger.journal_idempotency (
         idempotency_key, request_fingerprint, journal_id, created_at
       ) VALUES ($1, $2, $3, $4)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        journal.idempotencyKey,
        journal.requestFingerprint ?? journal.id,
        journal.id,
        journal.createdAt,
      ],
    );
    for (let ordinal = 0; ordinal < journal.postings.length; ordinal += 1) {
      const posting = journal.postings[ordinal]!;
      await client.query(
        `INSERT INTO ledger.posting (
           id, journal_id, account_id, direction, currency, minor_units, ordinal
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          posting.id,
          journal.id,
          posting.accountId,
          posting.direction,
          ledgerAssetKey(posting.amount),
          ledgerScaledUnits(posting.amount).toString(),
          ordinal,
        ],
      );
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      logPersistenceEvent({
        level: 'error',
        code: 'JOURNAL_IDEMPOTENCY_CONFLICT',
        domain: 'ledger',
        message: 'journal idempotency key already persisted',
        journalId: journal.id,
      });
      throw new LedgerInvariantError(
        'IDEMPOTENCY',
        'idempotency key already bound to a different journal',
      );
    }
    logPersistenceEvent({
      level: 'error',
      code: 'JOURNAL_PERSIST_FAILED',
      domain: 'ledger',
      message: 'failed to persist an authorized journal',
      journalId: journal.id,
    });
    throw error;
  }
}
