import type { Pool, PoolClient } from 'pg';

import type { GrowSandboxAllocationStoreSnapshot } from '../../../platform/src/work-order/sandbox-allocation/store.ts';
import type { GrowSandboxAllocation } from '../../../platform/src/work-order/sandbox-allocation/types.ts';
import { withClient } from '../postgres/pools.ts';

export class GrowSandboxAllocationPersistenceError extends Error {
  readonly code: 'VERSION_CONFLICT' | 'PERSISTENCE_FAILED';

  constructor(code: 'VERSION_CONFLICT' | 'PERSISTENCE_FAILED', message: string) {
    super(message);
    this.code = code;
    this.name = 'GrowSandboxAllocationPersistenceError';
  }
}

async function upsertAllocation(
  client: PoolClient,
  allocation: GrowSandboxAllocation,
  expectedVersion?: number,
): Promise<void> {
  if (expectedVersion !== undefined) {
    const existing = await client.query<{ version: number }>(
      'SELECT version FROM growth.grow_sandbox_allocation WHERE allocation_id = $1',
      [allocation.allocationId],
    );
    const row = existing.rows[0];
    if (existing.rowCount && row && row.version !== expectedVersion) {
      throw new GrowSandboxAllocationPersistenceError(
        'VERSION_CONFLICT',
        `expected version ${String(expectedVersion)} but current is ${String(row.version)}`,
      );
    }
  }
  await client.query(
    `INSERT INTO growth.grow_sandbox_allocation
       (allocation_id, work_order_id, customer_id, account_id, state, idempotency_key,
        body_canonical, version, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (allocation_id) DO UPDATE SET
       state = EXCLUDED.state,
       body_canonical = EXCLUDED.body_canonical,
       version = EXCLUDED.version,
       updated_at = EXCLUDED.updated_at`,
    [
      allocation.allocationId,
      allocation.workOrderId,
      allocation.customerId,
      allocation.accountId,
      allocation.status,
      allocation.idempotencyKey,
      JSON.stringify(allocation),
      allocation.version,
      allocation.createdAt,
      allocation.updatedAt,
    ],
  );
}

export async function persistGrowSandboxAllocation(
  pool: Pool,
  allocation: GrowSandboxAllocation,
  expectedVersion?: number,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      await upsertAllocation(client, allocation, expectedVersion);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof GrowSandboxAllocationPersistenceError) {
        throw error;
      }
      throw new GrowSandboxAllocationPersistenceError(
        'PERSISTENCE_FAILED',
        error instanceof Error ? error.message : 'grow sandbox allocation persistence failed',
      );
    }
  });
}

export async function persistGrowSandboxAllocationState(
  pool: Pool,
  snapshot: GrowSandboxAllocationStoreSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const allocation of snapshot.allocations) {
        await upsertAllocation(client, allocation);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new GrowSandboxAllocationPersistenceError(
        'PERSISTENCE_FAILED',
        error instanceof Error ? error.message : 'grow sandbox allocation state persistence failed',
      );
    }
  });
}

export async function loadGrowSandboxAllocationState(
  pool: Pool,
): Promise<GrowSandboxAllocationStoreSnapshot> {
  return withClient(pool, async (client) => {
    const result = await client.query<{ body_canonical: string }>(
      'SELECT body_canonical FROM growth.grow_sandbox_allocation ORDER BY created_at',
    );
    const allocations = result.rows.map((row) => JSON.parse(row.body_canonical) as GrowSandboxAllocation);
    return Object.freeze({
      allocations: Object.freeze(allocations),
    });
  });
}
