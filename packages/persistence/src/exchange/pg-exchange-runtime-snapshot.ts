/**
 * PostgreSQL exact runtime snapshot for the canonical SunRey Exchange core.
 * Append-only application metadata. Not a ledger, chain store, mint, or live venue.
 */

import type { Pool } from 'pg';

import {
  decodeSnapshot,
  encodeSnapshot,
  type ExchangeCoreSnapshot,
} from '../../../sunrey-exchange/src/production-core/snapshot.ts';
import { withClient } from '../postgres/pools.ts';

const SNAPSHOT_LOCK_KEY = 0x53524559;

export async function persistExchangeRuntimeSnapshot(
  pool: Pool,
  snapshot: ExchangeCoreSnapshot,
): Promise<number> {
  if (snapshot.productionActive !== false || snapshot.liveTradingEnabled !== false) {
    throw new Error('refusing to persist live Exchange runtime state');
  }

  return withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      await client.query('SELECT pg_advisory_xact_lock($1)', [SNAPSHOT_LOCK_KEY]);
      const revision = await client.query<{ next_revision: string }>(
        `SELECT (COALESCE(MAX(snapshot_revision), 0) + 1)::TEXT AS next_revision
           FROM sunrey_exchange.runtime_snapshot`,
      );
      const nextRevision = Number(revision.rows[0]?.next_revision ?? '1');
      await client.query(
        `INSERT INTO sunrey_exchange.runtime_snapshot
           (snapshot_revision, body_canonical, production_active, live_trading_enabled, not_a_ledger)
         VALUES ($1,$2,FALSE,FALSE,TRUE)`,
        [nextRevision, encodeSnapshot(snapshot)],
      );
      await client.query('COMMIT');
      return nextRevision;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function loadLatestExchangeRuntimeSnapshot(
  pool: Pool,
): Promise<ExchangeCoreSnapshot | null> {
  return withClient(pool, async (client) => {
    const result = await client.query<{ body_canonical: string }>(
      `SELECT body_canonical
         FROM sunrey_exchange.runtime_snapshot
        WHERE production_active = FALSE
          AND live_trading_enabled = FALSE
        ORDER BY snapshot_revision DESC
        LIMIT 1`,
    );
    const raw = result.rows[0]?.body_canonical;
    return raw ? decodeSnapshot(raw) : null;
  });
}
