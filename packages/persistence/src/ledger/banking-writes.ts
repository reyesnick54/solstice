import type { PoolClient } from 'pg';

import type { FeeAssessment } from '../../../domain/src/fee.ts';
import type { FundsHold } from '../../../domain/src/hold.ts';
import type { PendingSettlementRecord } from '../../../domain/src/pending-settlement.ts';
import type { ReconciliationItem } from '../../../domain/src/reconciliation.ts';
import type { ReversalRecord } from '../../../domain/src/reversal.ts';
import type { CustomerStatement } from '../../../domain/src/statement.ts';
import type { ExternalAccountCoordinate } from '../../../domain/src/coordinates.ts';

export async function upsertHold(client: PoolClient, hold: FundsHold): Promise<void> {
  await client.query(
    `INSERT INTO ledger.funds_hold (
       id, account_id, currency, amount_minor_units, purpose, state,
       idempotency_key, created_at, updated_at, expires_at, capture_journal_id, epoch
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO UPDATE SET
       state = EXCLUDED.state,
       amount_minor_units = EXCLUDED.amount_minor_units,
       updated_at = EXCLUDED.updated_at,
       expires_at = EXCLUDED.expires_at,
       capture_journal_id = EXCLUDED.capture_journal_id,
       epoch = EXCLUDED.epoch`,
    [
      hold.id,
      hold.accountId,
      hold.currency,
      hold.amountMinorUnits.toString(),
      hold.purpose,
      hold.state,
      hold.idempotencyKey,
      hold.createdAt,
      hold.updatedAt,
      hold.expiresAt,
      hold.captureJournalId,
      hold.epoch,
    ],
  );
}

export async function upsertPendingSettlement(
  client: PoolClient,
  record: PendingSettlementRecord,
): Promise<void> {
  await client.query(
    `INSERT INTO ledger.pending_settlement (
       id, source_account_id, pending_account_id, currency, amount_minor_units, state,
       initiate_journal_id, settle_journal_id, return_journal_id, idempotency_key,
       created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO UPDATE SET
       state = EXCLUDED.state,
       settle_journal_id = EXCLUDED.settle_journal_id,
       return_journal_id = EXCLUDED.return_journal_id,
       updated_at = EXCLUDED.updated_at`,
    [
      record.id,
      record.sourceAccountId,
      record.pendingAccountId,
      record.currency,
      record.amountMinorUnits.toString(),
      record.state,
      record.initiateJournalId,
      record.settleJournalId,
      record.returnJournalId,
      record.idempotencyKey,
      record.createdAt,
      record.updatedAt,
    ],
  );
}

export async function insertFeeAssessment(client: PoolClient, fee: FeeAssessment): Promise<void> {
  await client.query(
    `INSERT INTO ledger.fee_assessment (
       id, account_id, fee_type, currency, assessed_minor_units, fixed_minor_units,
       basis_points_numerator, basis_points_denominator, journal_id, idempotency_key, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO NOTHING`,
    [
      fee.id,
      fee.accountId,
      fee.feeType,
      fee.currency,
      fee.assessedMinorUnits.toString(),
      fee.fixedMinorUnits?.toString() ?? null,
      fee.basisPointsNumerator?.toString() ?? null,
      fee.basisPointsDenominator?.toString() ?? null,
      fee.journalId,
      fee.idempotencyKey,
      fee.createdAt,
    ],
  );
}

export async function insertReversal(client: PoolClient, record: ReversalRecord): Promise<void> {
  await client.query(
    `INSERT INTO ledger.reversal_record (
       id, original_journal_id, compensating_journal_id, reason, idempotency_key, created_at,
       kind, original_scaled_units, reversed_scaled_units
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO NOTHING`,
    [
      record.id,
      record.originalJournalId,
      record.compensatingJournalId,
      record.reason,
      record.idempotencyKey,
      record.createdAt,
      record.kind,
      record.originalScaledUnits.toString(),
      record.reversedScaledUnits.toString(),
    ],
  );
}

export async function insertStatement(client: PoolClient, statement: CustomerStatement): Promise<void> {
  await client.query(
    `INSERT INTO ledger.customer_statement (
       id, account_id, customer_id, currency, period_start, period_end,
       opening_minor_units, closing_minor_units, credits_minor_units, debits_minor_units, generated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO NOTHING`,
    [
      statement.id,
      statement.accountId,
      statement.customerId,
      statement.currency,
      statement.periodStart,
      statement.periodEnd,
      statement.openingMinorUnits.toString(),
      statement.closingMinorUnits.toString(),
      statement.creditsMinorUnits.toString(),
      statement.debitsMinorUnits.toString(),
      statement.generatedAt,
    ],
  );
}

export async function upsertReconciliation(
  client: PoolClient,
  item: ReconciliationItem,
): Promise<void> {
  await client.query(
    `INSERT INTO ledger.reconciliation_item (
       id, account_id, currency, internal_minor_units, external_minor_units,
       difference_minor_units, status, external_statement_ref, note, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       updated_at = EXCLUDED.updated_at`,
    [
      item.id,
      item.accountId,
      item.currency,
      item.internalMinorUnits.toString(),
      item.externalMinorUnits.toString(),
      item.differenceMinorUnits.toString(),
      item.status,
      item.externalStatementRef,
      item.note,
      item.createdAt,
      item.updatedAt,
    ],
  );
}

export async function insertCoordinate(
  client: PoolClient,
  coordinate: ExternalAccountCoordinate,
): Promise<void> {
  await client.query(
    `INSERT INTO ledger.account_coordinate (
       id, account_id, scheme, value, synthetic, live_assignable
     ) VALUES ($1, $2, $3, $4, TRUE, FALSE)
     ON CONFLICT (id) DO NOTHING`,
    [coordinate.id, coordinate.accountId, coordinate.scheme, coordinate.value],
  );
}
