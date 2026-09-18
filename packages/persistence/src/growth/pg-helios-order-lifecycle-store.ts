import type { Pool } from 'pg';

import type { HeliosOrderLifecycleStoreSnapshot } from '../../../platform/src/helios/order-lifecycle/types.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistHeliosOrderLifecycleState(
  pool: Pool,
  state: HeliosOrderLifecycleStoreSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const order of state.orders) {
        await client.query(
          `INSERT INTO growth.helios_order
             (order_id, operation_id, customer_id, work_order_id, status, body_canonical, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (order_id) DO UPDATE SET
             status = EXCLUDED.status,
             body_canonical = EXCLUDED.body_canonical,
             updated_at = EXCLUDED.updated_at`,
          [
            order.orderId,
            order.operationId,
            order.customerId,
            order.workOrderId,
            order.status,
            JSON.stringify(order),
            order.createdAt,
            order.updatedAt,
          ],
        );
      }
      for (const fill of state.fills) {
        await client.query(
          `INSERT INTO growth.helios_order_fill
             (fill_id, order_id, provider_fill_id, body_canonical, arrived_at)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (order_id, provider_fill_id) DO NOTHING`,
          [fill.fillId, fill.orderId, fill.providerFillId, JSON.stringify(fill), fill.arrivedAt],
        );
      }
      for (const settlement of state.settlements) {
        await client.query(
          `INSERT INTO growth.helios_order_settlement
             (settlement_id, order_id, fill_id, status, body_canonical)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (settlement_id) DO NOTHING`,
          [
            settlement.settlementId,
            settlement.orderId,
            settlement.fillId,
            settlement.status,
            JSON.stringify(settlement),
          ],
        );
      }
      for (const event of state.providerEvents) {
        await client.query(
          `INSERT INTO growth.helios_provider_event
             (event_id, order_id, customer_id, verification, body_canonical, received_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (event_id) DO NOTHING`,
          [
            event.eventId,
            event.orderId,
            event.customerId,
            event.verification,
            JSON.stringify(event),
            event.processedAt ?? new Date().toISOString(),
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

export async function loadHeliosOrderLifecycleState(pool: Pool): Promise<HeliosOrderLifecycleStoreSnapshot> {
  return withClient(pool, async (client) => {
    const orders = await client.query(`SELECT body_canonical FROM growth.helios_order ORDER BY created_at ASC`);
    const fills = await client.query(`SELECT body_canonical FROM growth.helios_order_fill ORDER BY arrived_at ASC`);
    const settlements = await client.query(`SELECT body_canonical FROM growth.helios_order_settlement`);
    const events = await client.query(`SELECT body_canonical FROM growth.helios_provider_event ORDER BY received_at ASC`);
    return Object.freeze({
      orders: Object.freeze(orders.rows.map((row) => JSON.parse(row.body_canonical))),
      fills: Object.freeze(fills.rows.map((row) => JSON.parse(row.body_canonical))),
      settlements: Object.freeze(settlements.rows.map((row) => JSON.parse(row.body_canonical))),
      providerEvents: Object.freeze(events.rows.map((row) => JSON.parse(row.body_canonical))),
      reconciliations: Object.freeze([]),
      processedEventIds: Object.freeze(
        events.rows.map((row) => JSON.parse(row.body_canonical).eventId),
      ),
    });
  });
}
