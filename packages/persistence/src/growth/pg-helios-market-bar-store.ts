import type { Pool } from 'pg';

import type { CapitalMarketBarStoreSnapshot } from '../../../sunrey-exchange/src/capital-market/bar-store.ts';
import { persistenceJsonStringify } from '../json.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistHeliosMarketBarState(
  pool: Pool,
  snapshot: CapitalMarketBarStoreSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const bar of snapshot.bars) {
        await client.query(
          `INSERT INTO growth.helios_market_bar
             (bar_id, provider_id, canonical_instrument_id, timeframe, period_start, period_end,
              body_canonical, provenance_hash, duplicate_detected, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (bar_id) DO UPDATE SET
             body_canonical = EXCLUDED.body_canonical,
             duplicate_detected = EXCLUDED.duplicate_detected`,
          [
            bar.barId,
            bar.providerId,
            bar.instrument.instrumentId,
            bar.timeframe,
            bar.periodStart,
            bar.periodEnd,
            persistenceJsonStringify(bar),
            bar.provenance.rawPayloadHash,
            snapshot.duplicateBarIds.includes(bar.barId),
            bar.arrivalTimestamp,
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

export async function loadHeliosMarketBarState(pool: Pool): Promise<CapitalMarketBarStoreSnapshot> {
  return withClient(pool, async (client) => {
    const result = await client.query(
      `SELECT body_canonical, duplicate_detected FROM growth.helios_market_bar ORDER BY period_start ASC`,
    );
    const bars = result.rows.map((row) => JSON.parse(row.body_canonical));
    const duplicateBarIds = result.rows
      .filter((row) => row.duplicate_detected === true)
      .map((row) => JSON.parse(row.body_canonical).barId as string);
    return Object.freeze({
      bars: Object.freeze(bars),
      barIds: Object.freeze(bars.map((bar) => bar.barId as string)),
      duplicateBarIds: Object.freeze(duplicateBarIds),
    });
  });
}
