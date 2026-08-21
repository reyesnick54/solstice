import type { Pool } from 'pg';

import { asUtcInstant } from '../../../domain/src/time.ts';
import {
  asDailyCloseId,
  asOperationalAlertId,
  asProviderBalanceId,
  asReconciliationBreakId,
  asReconciliationRunId,
  asSettlementRecordId,
  asSuspenseItemId,
} from '../../../treasury/src/ids.ts';
import { freezeDailyCloseReport, type DailyCloseReport } from '../../../treasury/src/product/daily-close.ts';
import { freezeOperationalAlert } from '../../../treasury/src/product/alerts.ts';
import { freezeProviderReportedBalance } from '../../../treasury/src/product/provider-balance.ts';
import { freezeReconciliationBreak } from '../../../treasury/src/product/breaks.ts';
import { freezeReconciliationRun } from '../../../treasury/src/product/replay.ts';
import { freezeSettlementRecord } from '../../../treasury/src/product/settlement.ts';
import { freezeSuspenseItem } from '../../../treasury/src/product/suspense.ts';
import type { FinancialControlSnapshot } from '../../../treasury/src/product/store.ts';
import { withClient } from '../postgres/pools.ts';

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

export async function persistFinancialControlSnapshot(pool: Pool, snapshot: FinancialControlSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const row of snapshot.providerBalances) {
        await client.query(
          `INSERT INTO treasury.provider_balance
             (provider_balance_id, provider, external_account, currency, reported_minor,
              available_minor, reported_at, statement_ref, evidence_source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (provider_balance_id) DO UPDATE SET
             reported_minor = EXCLUDED.reported_minor,
             available_minor = EXCLUDED.available_minor`,
          [
            row.providerBalanceId,
            row.provider,
            row.externalAccount,
            row.currency,
            row.reportedMinor.toString(),
            row.availableMinor?.toString() ?? null,
            row.reportedAt,
            row.statementRef,
            row.evidenceSource,
          ],
        );
      }
      for (const row of snapshot.settlements) {
        await client.query(
          `INSERT INTO treasury.settlement_record
             (settlement_id, domain, provider, currency, gross_minor, fees_minor, net_minor,
              expected_date, actual_date, status, provider_references, ledger_references)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (settlement_id) DO UPDATE SET
             status = EXCLUDED.status,
             actual_date = EXCLUDED.actual_date`,
          [
            row.settlementId,
            row.domain,
            row.provider,
            row.currency,
            row.grossMinor.toString(),
            row.feesMinor.toString(),
            row.netMinor.toString(),
            row.expectedDate,
            row.actualDate,
            row.status,
            [...row.providerReferences],
            [...row.ledgerReferences],
          ],
        );
      }
      for (const row of snapshot.runs) {
        await client.query(
          `INSERT INTO treasury.reconciliation_run
             (run_id, period_start, period_end, provider, source_version, input_hash,
              matched_count, break_count, break_ids, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (run_id) DO NOTHING`,
          [
            row.runId,
            row.periodStart,
            row.periodEnd,
            row.provider,
            row.sourceVersion,
            row.inputHash,
            row.matchedCount,
            row.breakCount,
            [...row.breakIds],
            row.createdAt,
          ],
        );
      }
      for (const row of snapshot.breaks) {
        await client.query(
          `INSERT INTO treasury.reconciliation_break
             (break_id, run_id, type, severity, domain, amount_minor, currency, provider,
              internal_references, external_references, status, owner, created_at, resolved_at, resolution_evidence)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (break_id) DO UPDATE SET
             status = EXCLUDED.status,
             resolved_at = EXCLUDED.resolved_at,
             resolution_evidence = EXCLUDED.resolution_evidence`,
          [
            row.breakId,
            row.runId,
            row.type,
            row.severity,
            row.domain,
            row.amountMinor?.toString() ?? null,
            row.currency,
            row.provider,
            [...row.internalReferences],
            [...row.externalReferences],
            row.status,
            row.owner,
            row.createdAt,
            row.resolvedAt,
            row.resolutionEvidence,
          ],
        );
      }
      for (const row of snapshot.suspense) {
        await client.query(
          `INSERT INTO treasury.suspense_item
             (suspense_id, treasury_account_id, currency, amount_minor, reason, domain, provider,
              internal_references, external_references, status, created_at, reviewed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (suspense_id) DO UPDATE SET
             status = EXCLUDED.status,
             reviewed_at = EXCLUDED.reviewed_at`,
          [
            row.suspenseId,
            row.treasuryAccountId,
            row.currency,
            row.amountMinor.toString(),
            row.reason,
            row.domain,
            row.provider,
            [...row.internalReferences],
            [...row.externalReferences],
            row.status,
            row.createdAt,
            row.reviewedAt,
          ],
        );
      }
      for (const row of snapshot.closes) {
        await client.query(
          `INSERT INTO treasury.daily_close
             (close_id, period_start, period_end, generated_at, legal_sufficiency, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (close_id) DO NOTHING`,
          [row.closeId, row.periodStart, row.periodEnd, row.generatedAt, row.legalSufficiency, canonicalJson(row)],
        );
      }
      for (const row of snapshot.alerts) {
        await client.query(
          `INSERT INTO treasury.operational_alert
             (alert_id, kind, severity, domain, provider, currency, amount_minor, message, reference_ids, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (alert_id) DO UPDATE SET status = EXCLUDED.status`,
          [
            row.alertId,
            row.kind,
            row.severity,
            row.domain,
            row.provider,
            row.currency,
            row.amountMinor?.toString() ?? null,
            row.message,
            [...row.references],
            row.status,
            row.createdAt,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function loadFinancialControlSnapshot(pool: Pool): Promise<FinancialControlSnapshot> {
  return withClient(pool, async (client) => {
    const balances = await client.query('SELECT * FROM treasury.provider_balance');
    const settlements = await client.query('SELECT * FROM treasury.settlement_record');
    const runs = await client.query('SELECT * FROM treasury.reconciliation_run');
    const breaks = await client.query('SELECT * FROM treasury.reconciliation_break');
    const suspense = await client.query('SELECT * FROM treasury.suspense_item');
    const closes = await client.query('SELECT * FROM treasury.daily_close');
    const alerts = await client.query('SELECT * FROM treasury.operational_alert');
    return {
      providerBalances: balances.rows.map((row) =>
        freezeProviderReportedBalance({
          providerBalanceId: asProviderBalanceId(String(row.provider_balance_id)),
          provider: String(row.provider),
          externalAccount: String(row.external_account),
          currency: String(row.currency),
          reportedMinor: BigInt(String(row.reported_minor)),
          availableMinor: row.available_minor === null ? null : BigInt(String(row.available_minor)),
          reportedAt: asUtcInstant(new Date(String(row.reported_at)).toISOString()),
          statementRef: row.statement_ref === null ? null : String(row.statement_ref),
          evidenceSource: String(row.evidence_source),
        }),
      ),
      settlements: settlements.rows.map((row) =>
        freezeSettlementRecord({
          settlementId: asSettlementRecordId(String(row.settlement_id)),
          domain: row.domain,
          provider: String(row.provider),
          currency: String(row.currency),
          grossMinor: BigInt(String(row.gross_minor)),
          feesMinor: BigInt(String(row.fees_minor)),
          netMinor: BigInt(String(row.net_minor)),
          expectedDate: asUtcInstant(new Date(String(row.expected_date)).toISOString()),
          actualDate: row.actual_date === null ? null : asUtcInstant(new Date(String(row.actual_date)).toISOString()),
          status: row.status,
          providerReferences: row.provider_references,
          ledgerReferences: row.ledger_references,
        }),
      ),
      runs: runs.rows.map((row) =>
        freezeReconciliationRun({
          runId: asReconciliationRunId(String(row.run_id)),
          periodStart: asUtcInstant(new Date(String(row.period_start)).toISOString()),
          periodEnd: asUtcInstant(new Date(String(row.period_end)).toISOString()),
          provider: String(row.provider),
          sourceVersion: String(row.source_version),
          inputHash: String(row.input_hash),
          matchedCount: Number(row.matched_count),
          breakCount: Number(row.break_count),
          breakIds: row.break_ids,
          createdAt: asUtcInstant(new Date(String(row.created_at)).toISOString()),
        }),
      ),
      breaks: breaks.rows.map((row) =>
        freezeReconciliationBreak({
          breakId: asReconciliationBreakId(String(row.break_id)),
          runId: String(row.run_id),
          type: row.type,
          severity: row.severity,
          domain: row.domain,
          amountMinor: row.amount_minor === null ? null : BigInt(String(row.amount_minor)),
          currency: row.currency === null ? null : String(row.currency),
          provider: String(row.provider),
          internalReferences: row.internal_references,
          externalReferences: row.external_references,
          status: row.status,
          owner: row.owner === null ? null : String(row.owner),
          createdAt: asUtcInstant(new Date(String(row.created_at)).toISOString()),
          resolvedAt: row.resolved_at === null ? null : asUtcInstant(new Date(String(row.resolved_at)).toISOString()),
          resolutionEvidence: row.resolution_evidence === null ? null : String(row.resolution_evidence),
        }),
      ),
      suspense: suspense.rows.map((row) =>
        freezeSuspenseItem({
          suspenseId: asSuspenseItemId(String(row.suspense_id)),
          treasuryAccountId: String(row.treasury_account_id),
          currency: String(row.currency),
          amountMinor: BigInt(String(row.amount_minor)),
          reason: String(row.reason),
          domain: String(row.domain),
          provider: row.provider === null ? null : String(row.provider),
          internalReferences: row.internal_references,
          externalReferences: row.external_references,
          status: row.status,
          createdAt: asUtcInstant(new Date(String(row.created_at)).toISOString()),
          reviewedAt: row.reviewed_at === null ? null : asUtcInstant(new Date(String(row.reviewed_at)).toISOString()),
        }),
      ),
      closes: closes.rows.map((row) => freezeDailyCloseReport(JSON.parse(String(row.body_canonical)) as DailyCloseReport)),
      alerts: alerts.rows.map((row) =>
        freezeOperationalAlert({
          alertId: asOperationalAlertId(String(row.alert_id)),
          kind: row.kind,
          severity: row.severity,
          domain: String(row.domain),
          provider: row.provider === null ? null : String(row.provider),
          currency: row.currency === null ? null : String(row.currency),
          amountMinor: row.amount_minor === null ? null : BigInt(String(row.amount_minor)),
          message: String(row.message),
          references: row.reference_ids,
          status: row.status,
          createdAt: asUtcInstant(new Date(String(row.created_at)).toISOString()),
        }),
      ),
      liquidity: [],
    };
  });
}
