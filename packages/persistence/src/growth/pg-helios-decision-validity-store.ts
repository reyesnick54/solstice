import type { Pool } from 'pg';

import type { DecisionValidityStoreSnapshot } from '../../../platform/src/helios/decision-validity/types.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistDecisionValidityState(
  pool: Pool,
  state: DecisionValidityStoreSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const envelope of state.envelopes) {
        await client.query(
          `INSERT INTO growth.helios_decision_validity_envelope
             (envelope_id, candidate_id, work_order_id, customer_id, revision,
              overall_status, valid_until, body_canonical, evaluated_at, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (envelope_id) DO NOTHING`,
          [
            envelope.envelopeId,
            envelope.candidateId,
            envelope.workOrderId,
            envelope.customerId,
            envelope.revision,
            envelope.overallStatus,
            envelope.validUntil,
            JSON.stringify(envelope),
            envelope.evaluatedAt,
            envelope.createdAt,
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

export async function loadDecisionValidityState(pool: Pool): Promise<DecisionValidityStoreSnapshot> {
  return withClient(pool, async (client) => {
    const rows = await client.query(
      `SELECT body_canonical FROM growth.helios_decision_validity_envelope ORDER BY created_at ASC`,
    );
    return Object.freeze({
      envelopes: Object.freeze(rows.rows.map((row) => JSON.parse(row.body_canonical))),
    });
  });
}
