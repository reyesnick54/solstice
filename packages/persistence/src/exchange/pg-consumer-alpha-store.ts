import type { Pool } from 'pg';

import {
  decodeConsumerAlphaSnapshot,
  encodeConsumerAlphaSnapshot,
  type ConsumerAlphaIdempotencyRecord,
  type ConsumerAlphaSnapshot,
} from '@solstice/sunrey-exchange';
import { withClient } from '../postgres/pools.ts';
import { isUniqueViolation } from '../postgres/write.ts';

type StateRow = {
  body_canonical: string;
  revision: string;
};

type IdempotencyRow = {
  idempotency_key: string;
  customer_id: string;
  resource_type: ConsumerAlphaIdempotencyRecord['resourceType'];
  resource_id: string;
  response_canonical: string;
  created_at: Date | string;
};

export async function persistConsumerAlphaState(
  pool: Pool,
  customerId: string,
  mode: string,
  snapshot: ConsumerAlphaSnapshot,
): Promise<void> {
  if (snapshot.productionActive !== false || snapshot.liveTradingEnabled !== false) {
    throw new Error('refusing to persist live consumer alpha exchange state');
  }
  await withClient(pool, async (client) => {
    await client.query(
      `INSERT INTO sunrey_exchange.consumer_alpha_state (
         customer_id, lifecycle_mode, body_canonical, revision, updated_at,
         production_active, live_trading_enabled, not_a_ledger
       ) VALUES ($1,$2,$3,1,NOW(),FALSE,FALSE,TRUE)
       ON CONFLICT (customer_id, lifecycle_mode) DO UPDATE SET
         body_canonical = EXCLUDED.body_canonical,
         revision = sunrey_exchange.consumer_alpha_state.revision + 1,
         updated_at = NOW()`,
      [customerId, mode, encodeConsumerAlphaSnapshot(snapshot)],
    );
  });
}

export async function loadConsumerAlphaState(
  pool: Pool,
  customerId: string,
  mode: string,
): Promise<ConsumerAlphaSnapshot | null> {
  const result = await pool.query<StateRow>(
    `SELECT body_canonical, revision
       FROM sunrey_exchange.consumer_alpha_state
      WHERE customer_id = $1
        AND lifecycle_mode = $2
        AND production_active = FALSE
        AND live_trading_enabled = FALSE`,
    [customerId, mode],
  );
  const row = result.rows[0];
  return row ? decodeConsumerAlphaSnapshot(row.body_canonical) : null;
}

export async function persistConsumerAlphaIdempotency(
  pool: Pool,
  record: ConsumerAlphaIdempotencyRecord,
): Promise<void> {
  try {
    await withClient(pool, async (client) => {
      await client.query(
        `INSERT INTO sunrey_exchange.consumer_alpha_idempotency (
           idempotency_key, customer_id, resource_type, resource_id, response_canonical,
           created_at, production_active, live_trading_enabled, not_a_ledger
         ) VALUES ($1,$2,$3,$4,$5,$6,FALSE,FALSE,TRUE)`,
        [
          record.idempotencyKey,
          record.customerId,
          record.resourceType,
          record.resourceId,
          record.responseCanonical,
          record.createdAt,
        ],
      );
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
  }
}

export async function loadConsumerAlphaIdempotency(
  pool: Pool,
  idempotencyKey: string,
): Promise<ConsumerAlphaIdempotencyRecord | null> {
  const result = await pool.query<IdempotencyRow>(
    `SELECT idempotency_key, customer_id, resource_type, resource_id, response_canonical, created_at
       FROM sunrey_exchange.consumer_alpha_idempotency
      WHERE idempotency_key = $1
        AND production_active = FALSE
        AND live_trading_enabled = FALSE`,
    [idempotencyKey],
  );
  const row = result.rows[0];
  return row ? rowToIdempotency(row) : null;
}

function rowToIdempotency(row: IdempotencyRow): ConsumerAlphaIdempotencyRecord {
  return Object.freeze({
    idempotencyKey: row.idempotency_key,
    customerId: row.customer_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    responseCanonical: row.response_canonical,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  });
}
