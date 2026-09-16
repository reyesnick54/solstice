import type { Pool } from 'pg';

import type { ExecutableOpportunityStoreSnapshot } from '../../../platform/src/helios/executable-opportunity/store.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistExecutableOpportunityState(
  pool: Pool,
  state: ExecutableOpportunityStoreSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const candidate of state.candidates) {
        await client.query(
          `INSERT INTO growth.helios_opportunity_candidate
             (candidate_id, work_order_id, customer_id, subject_id, body_canonical, discovered_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (candidate_id) DO UPDATE SET
             body_canonical = EXCLUDED.body_canonical`,
          [
            candidate.candidateId,
            candidate.workOrderId,
            candidate.customerId,
            candidate.subjectId,
            JSON.stringify(candidate),
            candidate.discoveredAt,
          ],
        );
      }
      for (const opportunity of state.executableOpportunities) {
        await client.query(
          `INSERT INTO growth.helios_executable_opportunity
             (executable_opportunity_id, candidate_id, work_order_id, customer_id, subject_id,
              state, body_canonical, qualification_expires_at, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (executable_opportunity_id) DO UPDATE SET
             state = EXCLUDED.state,
             body_canonical = EXCLUDED.body_canonical,
             qualification_expires_at = EXCLUDED.qualification_expires_at,
             updated_at = EXCLUDED.updated_at`,
          [
            opportunity.executableOpportunityId,
            opportunity.candidateId,
            opportunity.workOrderId,
            opportunity.customerId,
            opportunity.subjectId,
            opportunity.state,
            JSON.stringify(opportunity),
            opportunity.qualificationExpiresAt,
            opportunity.createdAt,
            opportunity.updatedAt,
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

export async function loadExecutableOpportunityState(pool: Pool): Promise<ExecutableOpportunityStoreSnapshot> {
  return withClient(pool, async (client) => {
    const candidates = await client.query(
      `SELECT body_canonical FROM growth.helios_opportunity_candidate ORDER BY discovered_at ASC`,
    );
    const opportunities = await client.query(
      `SELECT body_canonical FROM growth.helios_executable_opportunity ORDER BY created_at ASC`,
    );
    return Object.freeze({
      candidates: Object.freeze(candidates.rows.map((row) => JSON.parse(row.body_canonical))),
      executableOpportunities: Object.freeze(opportunities.rows.map((row) => JSON.parse(row.body_canonical))),
    });
  });
}
