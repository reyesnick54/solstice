import type { Pool } from 'pg';

import type { WorkOrderStoreSnapshot } from '../../../platform/src/work-order/store.ts';
import type { EconomicWorkOrder } from '../../../platform/src/work-order/types.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistWorkOrderState(pool: Pool, state: WorkOrderStoreSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const workOrder of state.workOrders) {
        await client.query(
          `INSERT INTO growth.economic_work_order_coordination
             (work_order_id, subject_id, customer_id, state, revision, idempotency_key,
              environment, body_canonical, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (work_order_id) DO UPDATE SET
             state = EXCLUDED.state,
             revision = EXCLUDED.revision,
             body_canonical = EXCLUDED.body_canonical,
             updated_at = EXCLUDED.updated_at`,
          [
            workOrder.workOrderId,
            workOrder.subjectId,
            workOrder.customerId,
            workOrder.state,
            workOrder.revision,
            workOrder.idempotencyKey,
            workOrder.environment,
            JSON.stringify(workOrder),
            workOrder.createdAt,
            workOrder.updatedAt,
          ],
        );
        for (const transition of workOrder.transitions) {
          await client.query(
            `INSERT INTO growth.economic_work_order_transition
               (transition_id, work_order_id, revision, previous_state, next_state,
                actor_id, actor_source, reason, occurred_at, event_reference, body_canonical)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             ON CONFLICT (transition_id) DO NOTHING`,
            [
              transition.transitionId,
              transition.workOrderId,
              transition.revision,
              transition.previousState,
              transition.nextState,
              transition.actorId,
              transition.actorSource,
              transition.reason,
              transition.occurredAt,
              transition.eventReference,
              JSON.stringify(transition),
            ],
          );
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function loadWorkOrderState(pool: Pool): Promise<WorkOrderStoreSnapshot> {
  return withClient(pool, async (client) => {
    const result = await client.query<{ body_canonical: string }>(
      'SELECT body_canonical FROM growth.economic_work_order_coordination ORDER BY work_order_id',
    );
    const workOrders = result.rows.map((row) => JSON.parse(row.body_canonical) as EconomicWorkOrder);
    return Object.freeze({
      workOrders: Object.freeze(workOrders),
    });
  });
}
