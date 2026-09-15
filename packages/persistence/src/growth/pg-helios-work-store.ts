import type { Pool } from 'pg';

import type { HeliosStoreSnapshot } from '../../../platform/src/helios/store.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistHeliosWorkState(pool: Pool, state: HeliosStoreSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const order of state.workOrders) {
        await client.query(
          `INSERT INTO growth.economic_work_order
             (work_order_id, program_id, customer_id, subject_id, state, objective,
              body_canonical, version, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (work_order_id) DO UPDATE SET
             state = EXCLUDED.state,
             body_canonical = EXCLUDED.body_canonical,
             version = EXCLUDED.version,
             updated_at = EXCLUDED.updated_at`,
          [
            order.workOrderId,
            order.programId,
            order.customerId,
            order.subjectId,
            order.state,
            order.objective,
            JSON.stringify(order),
            order.version,
            order.createdAt,
            order.updatedAt,
          ],
        );
      }
      for (const task of state.tasks) {
        await client.query(
          `INSERT INTO growth.helios_work_task
             (task_id, work_order_id, customer_id, operation_identity, state, body_canonical,
              locked_by, locked_at, lease_expires_at, lease_generation, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (task_id) DO UPDATE SET
             state = EXCLUDED.state,
             body_canonical = EXCLUDED.body_canonical,
             locked_by = EXCLUDED.locked_by,
             locked_at = EXCLUDED.locked_at,
             lease_expires_at = EXCLUDED.lease_expires_at,
             lease_generation = EXCLUDED.lease_generation,
             updated_at = EXCLUDED.updated_at`,
          [
            task.taskId,
            task.workOrderId,
            task.customerId,
            task.operationIdentity,
            task.state,
            JSON.stringify(task),
            task.lease?.workerId ?? null,
            task.lease?.acquiredAt ?? null,
            task.lease?.expiresAt ?? null,
            task.lease?.leaseGeneration ?? 0,
            task.createdAt,
            task.updatedAt,
          ],
        );
      }
      for (const reservation of state.reservations) {
        await client.query(
          `INSERT INTO growth.research_budget_reservation
             (reservation_id, work_order_id, task_id, customer_id, unit_kind,
              reserved_amount, reconciled_amount, released_amount, state, body_canonical,
              created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (reservation_id) DO UPDATE SET
             reconciled_amount = EXCLUDED.reconciled_amount,
             released_amount = EXCLUDED.released_amount,
             state = EXCLUDED.state,
             body_canonical = EXCLUDED.body_canonical,
             updated_at = EXCLUDED.updated_at`,
          [
            reservation.reservationId,
            reservation.workOrderId,
            reservation.taskId,
            reservation.customerId,
            reservation.unitKind,
            reservation.reservedAmount,
            reservation.reconciledAmount,
            reservation.releasedAmount,
            reservation.state,
            JSON.stringify(reservation),
            reservation.createdAt,
            reservation.updatedAt,
          ],
        );
      }
      for (const spend of state.spendRecords) {
        await client.query(
          `INSERT INTO growth.research_spend_record
             (spend_id, work_order_id, task_id, customer_id, program_id, budget_category,
              reserved_amount, actual_amount, estimated_amount, cost_status, attempt_number,
              retry_caused_additional_cost, succeeded, body_canonical, recorded_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (spend_id) DO NOTHING`,
          [
            spend.spendId,
            spend.workOrderId,
            spend.taskId,
            spend.customerId,
            spend.programId,
            spend.budgetCategory,
            spend.reservedAmount,
            spend.actualAmount,
            spend.estimatedAmount,
            spend.costStatus,
            spend.attemptNumber,
            spend.retryCausedAdditionalCost,
            spend.succeeded,
            JSON.stringify(spend),
            spend.recordedAt,
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

export async function loadHeliosWorkState(pool: Pool): Promise<HeliosStoreSnapshot> {
  return withClient(pool, async (client) => {
    const orders = await client.query(`SELECT body_canonical FROM growth.economic_work_order ORDER BY created_at`);
    const tasks = await client.query(`SELECT body_canonical FROM growth.helios_work_task ORDER BY created_at`);
    const reservations = await client.query(
      `SELECT body_canonical FROM growth.research_budget_reservation ORDER BY created_at`,
    );
    const spend = await client.query(`SELECT body_canonical FROM growth.research_spend_record ORDER BY recorded_at`);
    return Object.freeze({
      workOrders: Object.freeze(orders.rows.map((row) => JSON.parse(row.body_canonical))),
      tasks: Object.freeze(tasks.rows.map((row) => JSON.parse(row.body_canonical))),
      reservations: Object.freeze(reservations.rows.map((row) => JSON.parse(row.body_canonical))),
      spendRecords: Object.freeze(spend.rows.map((row) => JSON.parse(row.body_canonical))),
      auditEvents: Object.freeze([]),
    });
  });
}
