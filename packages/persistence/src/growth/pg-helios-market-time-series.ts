import type { Pool } from 'pg';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { HeliosMarketObservationEnvelope } from '../../../platform/src/helios/observation/types.ts';
import type { BarTimeframe } from '../../../platform/src/helios/market-observation/types.ts';
import { withClient } from '../postgres/pools.ts';

export type HeliosMarketObservationQuery = {
  readonly canonicalInstrumentId: string;
  readonly knowableAt: UtcInstant;
  readonly observationType?: string;
  readonly providerId?: string;
  readonly fromKnowableAt?: UtcInstant;
  readonly toKnowableAt?: UtcInstant;
  readonly limit?: number;
};

export async function queryHeliosMarketObservations(
  pool: Pool,
  query: HeliosMarketObservationQuery,
): Promise<readonly HeliosMarketObservationEnvelope[]> {
  return withClient(pool, async (client) => {
    const conditions = ['canonical_instrument_id = $1', 'knowable_at <= $2'];
    const params: unknown[] = [query.canonicalInstrumentId, query.knowableAt];
    let paramIndex = 3;

    if (query.observationType) {
      conditions.push(`observation_type = $${paramIndex++}`);
      params.push(query.observationType);
    }
    if (query.providerId) {
      conditions.push(`provider_id = $${paramIndex++}`);
      params.push(query.providerId);
    }
    if (query.fromKnowableAt) {
      conditions.push(`knowable_at >= $${paramIndex++}`);
      params.push(query.fromKnowableAt);
    }
    if (query.toKnowableAt) {
      conditions.push(`knowable_at <= $${paramIndex++}`);
      params.push(query.toKnowableAt);
    }

    const limitClause = query.limit ? ` LIMIT ${Math.max(1, query.limit)}` : '';
    const sql = `SELECT body_canonical FROM growth.helios_market_observation
      WHERE ${conditions.join(' AND ')}
      ORDER BY knowable_at ASC${limitClause}`;

    const result = await client.query(sql, params);
    return Object.freeze(
      result.rows.map((row) => JSON.parse(row.body_canonical) as HeliosMarketObservationEnvelope),
    );
  });
}

export async function queryLatestHeliosMarketObservation(
  pool: Pool,
  input: {
    readonly canonicalInstrumentId: string;
    readonly knowableAt: UtcInstant;
    readonly observationType?: string;
    readonly providerId?: string;
  },
): Promise<HeliosMarketObservationEnvelope | null> {
  return withClient(pool, async (client) => {
    const conditions = ['canonical_instrument_id = $1', 'knowable_at <= $2'];
    const params: unknown[] = [input.canonicalInstrumentId, input.knowableAt];
    let paramIndex = 3;

    if (input.observationType) {
      conditions.push(`observation_type = $${paramIndex++}`);
      params.push(input.observationType);
    }
    if (input.providerId) {
      conditions.push(`provider_id = $${paramIndex++}`);
      params.push(input.providerId);
    }

    const sql = `SELECT body_canonical FROM growth.helios_market_observation
      WHERE ${conditions.join(' AND ')}
      ORDER BY knowable_at DESC
      LIMIT 1`;

    const result = await client.query(sql, params);
    const row = result.rows[0];
    return row ? (JSON.parse(row.body_canonical) as HeliosMarketObservationEnvelope) : null;
  });
}

export type HeliosBarQuery = {
  readonly canonicalInstrumentId: string;
  readonly timeframe: BarTimeframe;
  readonly knowableAt: UtcInstant;
  readonly providerId?: string;
  readonly limit?: number;
};

export async function queryHeliosMarketBars(
  pool: Pool,
  query: HeliosBarQuery,
): Promise<readonly HeliosMarketObservationEnvelope[]> {
  const rows = await queryHeliosMarketObservations(pool, {
    canonicalInstrumentId: query.canonicalInstrumentId,
    knowableAt: query.knowableAt,
    observationType: 'daily_price',
    ...(query.providerId ? { providerId: query.providerId } : {}),
    ...(query.limit ? { limit: query.limit } : {}),
  });
  return Object.freeze(
    rows.filter((row) => {
      const payload = row.observation.data as { timeframe?: string; observationType?: string };
      return payload?.timeframe === query.timeframe || payload?.observationType === 'ohlcv_bar';
    }),
  );
}
