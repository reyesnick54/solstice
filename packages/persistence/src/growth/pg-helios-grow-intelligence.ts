import type { Pool } from 'pg';

import type { GrowIntelligenceStoreSnapshot } from '@solstice/platform';
import { persistenceJsonStringify } from '../json.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistGrowIntelligenceState(
  pool: Pool,
  state: GrowIntelligenceStoreSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const report of state.reports) {
        await client.query(
          `INSERT INTO growth.helios_grow_intelligence_report
             (report_id, customer_id, subject_id, report_type, reporting_date,
              time_zone, body_canonical, facts_hash, generated_at, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (report_id) DO NOTHING`,
          [
            report.reportId,
            report.customerId,
            report.subjectId,
            report.reportType,
            report.reportingDate,
            report.structured.timeZone,
            persistenceJsonStringify(report),
            report.factsHash,
            report.generatedAt,
            report.generatedAt,
          ],
        );
      }
      for (const delivery of state.deliveries) {
        await client.query(
          `INSERT INTO growth.helios_grow_notification_delivery
             (delivery_id, customer_id, event_id, deduplication_key, channel, delivered_at, body_canonical, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (delivery_id) DO NOTHING`,
          [
            delivery.deliveryId,
            delivery.customerId,
            delivery.eventId,
            delivery.deduplicationKey,
            delivery.channel,
            delivery.deliveredAt,
            persistenceJsonStringify(delivery),
            delivery.deliveredAt,
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

export async function loadGrowIntelligenceState(pool: Pool): Promise<GrowIntelligenceStoreSnapshot> {
  return withClient(pool, async (client) => {
    const reportRows = await client.query(
      `SELECT body_canonical FROM growth.helios_grow_intelligence_report ORDER BY generated_at ASC`,
    );
    const deliveryRows = await client.query(
      `SELECT body_canonical FROM growth.helios_grow_notification_delivery ORDER BY delivered_at ASC`,
    );
    const reports = Object.freeze(reportRows.rows.map((row) => JSON.parse(String(row.body_canonical))));
    const deliveries = Object.freeze(deliveryRows.rows.map((row) => JSON.parse(String(row.body_canonical))));
    const deliveredKeys = Object.freeze(deliveries.map((row: { deduplicationKey: string }) => row.deduplicationKey));
    return Object.freeze({
      reports,
      events: Object.freeze([]),
      deliveries,
      preferences: Object.freeze({}),
      deliveredKeys,
    });
  });
}
