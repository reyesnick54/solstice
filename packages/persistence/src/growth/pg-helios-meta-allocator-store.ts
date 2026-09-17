import type { Pool } from 'pg';

import type { MetaAllocatorStoreSnapshot } from '@solstice/platform';
import { withClient } from '../postgres/pools.ts';

export async function persistHeliosMetaAllocatorState(
  pool: Pool,
  state: MetaAllocatorStoreSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const run of state.runs) {
        await client.query(
          `INSERT INTO growth.helios_meta_allocator_run
             (run_id, work_order_id, customer_id, hold_cash, body_canonical, decided_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (run_id) DO UPDATE SET
             hold_cash = EXCLUDED.hold_cash,
             body_canonical = EXCLUDED.body_canonical,
             decided_at = EXCLUDED.decided_at`,
          [
            run.runId,
            run.workOrderId,
            run.customerId,
            run.holdCash,
            JSON.stringify(run),
            run.decidedAt,
          ],
        );
      }
      for (const decision of state.decisions) {
        await client.query(
          `INSERT INTO growth.helios_meta_allocator_decision
             (decision_id, run_id, work_order_id, customer_id, disposition, body_canonical, decided_at, expires_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (decision_id) DO UPDATE SET
             disposition = EXCLUDED.disposition,
             body_canonical = EXCLUDED.body_canonical,
             expires_at = EXCLUDED.expires_at`,
          [
            decision.decisionId,
            decision.runId,
            decision.workOrderId,
            decision.customerId,
            decision.disposition,
            JSON.stringify(decision),
            decision.decidedAt,
            decision.expiresAt,
          ],
        );
      }
      for (const record of state.calibrationRecords) {
        const customerId =
          state.decisions.find((row) => row.candidateId === record.candidateId)?.customerId ?? 'unknown';
        await client.query(
          `INSERT INTO growth.helios_meta_allocator_calibration
             (record_id, customer_id, candidate_id, body_canonical, recorded_at)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (record_id) DO UPDATE SET
             body_canonical = EXCLUDED.body_canonical`,
          [record.recordId, customerId, record.candidateId, JSON.stringify(record), record.recordedAt],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function loadHeliosMetaAllocatorState(pool: Pool): Promise<MetaAllocatorStoreSnapshot> {
  return withClient(pool, async (client) => {
    const runs = await client.query(
      `SELECT body_canonical FROM growth.helios_meta_allocator_run ORDER BY decided_at ASC`,
    );
    const decisions = await client.query(
      `SELECT body_canonical FROM growth.helios_meta_allocator_decision ORDER BY decided_at ASC`,
    );
    const calibration = await client.query(
      `SELECT body_canonical FROM growth.helios_meta_allocator_calibration ORDER BY recorded_at ASC`,
    );
    return Object.freeze({
      runs: Object.freeze(runs.rows.map((row) => JSON.parse(row.body_canonical))),
      decisions: Object.freeze(decisions.rows.map((row) => JSON.parse(row.body_canonical))),
      calibrationRecords: Object.freeze(calibration.rows.map((row) => JSON.parse(row.body_canonical))),
      costRecords: Object.freeze([]),
    });
  });
}
