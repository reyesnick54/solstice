import type { Pool } from 'pg';

import type { PaperStrategyStoreSnapshot } from '../../../platform/src/helios/paper-strategy/types.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistHeliosPaperStrategyState(
  pool: Pool,
  state: PaperStrategyStoreSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const proposal of state.proposals) {
        await client.query(
          `INSERT INTO growth.helios_paper_strategy_proposal
             (proposal_id, work_order_id, customer_id, subject_id, state, body_canonical, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (proposal_id) DO UPDATE SET
             state = EXCLUDED.state,
             body_canonical = EXCLUDED.body_canonical,
             updated_at = EXCLUDED.updated_at`,
          [
            proposal.proposalId,
            proposal.workOrderId,
            proposal.customerId,
            proposal.subjectId,
            proposal.state,
            JSON.stringify(proposal),
            proposal.createdAt,
            proposal.updatedAt,
          ],
        );
      }
      for (const position of state.positions) {
        await client.query(
          `INSERT INTO growth.helios_paper_strategy_position
             (position_id, work_order_id, customer_id, strategy_id, status, body_canonical, opened_at, closed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (position_id) DO UPDATE SET
             status = EXCLUDED.status,
             body_canonical = EXCLUDED.body_canonical,
             closed_at = EXCLUDED.closed_at`,
          [
            position.positionId,
            position.workOrderId,
            position.customerId,
            position.strategyId,
            position.status,
            JSON.stringify(position),
            position.openedAt,
            position.closedAt,
          ],
        );
      }
      for (const cycle of state.cycles) {
        const customerId =
          state.proposals.find((row) => row.proposalId === cycle.proposalId)?.customerId ??
          state.positions.find((row) => row.positionId === cycle.positionId)?.customerId ??
          'unknown';
        const workOrderId =
          state.proposals.find((row) => row.proposalId === cycle.proposalId)?.workOrderId ??
          state.positions.find((row) => row.positionId === cycle.positionId)?.workOrderId ??
          'ewo_unknown';
        await client.query(
          `INSERT INTO growth.helios_paper_strategy_cycle
             (cycle_id, work_order_id, customer_id, outcome, body_canonical, completed_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (cycle_id) DO UPDATE SET
             outcome = EXCLUDED.outcome,
             body_canonical = EXCLUDED.body_canonical,
             completed_at = EXCLUDED.completed_at`,
          [cycle.cycleId, workOrderId, customerId, cycle.outcome, JSON.stringify(cycle), cycle.completedAt],
        );
      }
      for (const taskId of state.completedTaskIds) {
        await client.query(
          `INSERT INTO growth.helios_paper_strategy_completed_task (task_id, work_order_id, completed_at)
           VALUES ($1,$2,$3)
           ON CONFLICT (task_id) DO NOTHING`,
          [taskId, 'ewo_unknown', new Date().toISOString()],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function loadHeliosPaperStrategyState(pool: Pool): Promise<PaperStrategyStoreSnapshot> {
  return withClient(pool, async (client) => {
    const proposals = await client.query(
      `SELECT body_canonical FROM growth.helios_paper_strategy_proposal ORDER BY created_at ASC`,
    );
    const positions = await client.query(
      `SELECT body_canonical FROM growth.helios_paper_strategy_position ORDER BY opened_at ASC`,
    );
    const cycles = await client.query(
      `SELECT body_canonical FROM growth.helios_paper_strategy_cycle ORDER BY completed_at ASC`,
    );
    const tasks = await client.query(`SELECT task_id FROM growth.helios_paper_strategy_completed_task`);
    return Object.freeze({
      proposals: Object.freeze(proposals.rows.map((row) => JSON.parse(row.body_canonical))),
      positions: Object.freeze(positions.rows.map((row) => JSON.parse(row.body_canonical))),
      cycles: Object.freeze(cycles.rows.map((row) => JSON.parse(row.body_canonical))),
      completedTaskIds: Object.freeze(tasks.rows.map((row) => row.task_id as string)),
    });
  });
}
