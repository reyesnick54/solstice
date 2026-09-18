import type { Pool } from 'pg';

import type { ProviderOrchestrationStoreSnapshot } from '../../../platform/src/helios/provider-orchestration/types.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistProviderOrchestrationState(
  pool: Pool,
  state: ProviderOrchestrationStoreSnapshot,
  updatedAt: string,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query(
      `INSERT INTO growth.helios_provider_orchestration_snapshot
         (snapshot_id, body_canonical, updated_at)
       VALUES ('current', $1, $2)
       ON CONFLICT (snapshot_id) DO UPDATE
         SET body_canonical = EXCLUDED.body_canonical,
             updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(state), updatedAt],
    );
  });
}

export async function loadProviderOrchestrationState(
  pool: Pool,
): Promise<ProviderOrchestrationStoreSnapshot | null> {
  return withClient(pool, async (client) => {
    const result = await client.query(
      `SELECT body_canonical FROM growth.helios_provider_orchestration_snapshot WHERE snapshot_id = 'current'`,
    );
    if (result.rowCount === 0) {
      return null;
    }
    return JSON.parse(result.rows[0].body_canonical) as ProviderOrchestrationStoreSnapshot;
  });
}
