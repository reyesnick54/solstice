import type { Pool } from 'pg';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { MacroEventStoreSnapshot } from '../../../platform/src/helios/multi-asset/event-intelligence/types.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistMacroEventIntelligenceState(
  pool: Pool,
  state: MacroEventStoreSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const sealed of state.events) {
        const artifact = sealed.artifact;
        await client.query(
          `INSERT INTO growth.helios_macro_event_intelligence
             (event_id, event_type, domain, jurisdiction, scheduled_time,
              knowable_at, expires_at, body_canonical, sealed_at, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (event_id) DO NOTHING`,
          [
            artifact.eventId,
            artifact.eventType,
            artifact.domain,
            artifact.jurisdiction,
            artifact.scheduledTime,
            artifact.knowableAt,
            artifact.relevanceWindow.expiresAt,
            JSON.stringify(sealed),
            sealed.sealedAt,
            sealed.sealedAt,
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

export async function loadMacroEventIntelligenceState(pool: Pool): Promise<MacroEventStoreSnapshot> {
  return withClient(pool, async (client) => {
    const rows = await client.query(
      `SELECT body_canonical FROM growth.helios_macro_event_intelligence ORDER BY knowable_at ASC`,
    );
    const events = Object.freeze(
      rows.rows.map((row) => JSON.parse(row.body_canonical)),
    );
    return Object.freeze({
      events,
      impacts: Object.freeze([]),
      proposals: Object.freeze([]),
      blackouts: Object.freeze([]),
    });
  });
}

export async function queryHeliosMacroEvents(
  pool: Pool,
  input: {
    readonly knowableAt: UtcInstant;
    readonly domain?: string;
    readonly limit?: number;
  },
): Promise<MacroEventStoreSnapshot['events']> {
  return withClient(pool, async (client) => {
    const conditions = ['knowable_at <= $1', 'expires_at >= $1'];
    const params: unknown[] = [input.knowableAt];
    let paramIndex = 2;

    if (input.domain) {
      conditions.push(`domain = $${paramIndex++}`);
      params.push(input.domain);
    }

    const limitClause = input.limit ? ` LIMIT ${Math.max(1, input.limit)}` : '';
    const sql = `SELECT body_canonical FROM growth.helios_macro_event_intelligence
      WHERE ${conditions.join(' AND ')}
      ORDER BY scheduled_time ASC NULLS LAST${limitClause}`;

    const result = await client.query(sql, params);
    return Object.freeze(result.rows.map((row) => JSON.parse(row.body_canonical)));
  });
}
