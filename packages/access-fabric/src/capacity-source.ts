import type { UtcInstant } from '../../domain/src/time.ts';
import type { CapacityPoolId, CapacityResourceId } from './ids.ts';
import type { CapacityPool } from './types.ts';

/**
 * ACCESS-06: reads existing productive capacity from authoritative sources.
 * The Access Fabric must not create or mint capacity through this port.
 */
export type CapacitySourcePort = {
  /**
   * Returns the pool if it still exists. A missing pool means the capacity
   * source disappeared; callers must fail closed and release any soft holds.
   */
  getPool(poolId: CapacityPoolId): CapacityPool | undefined;

  listPools(resourceId?: CapacityResourceId): readonly CapacityPool[];

  /**
   * Optional freshness signal. When the source revokes a pool, reservations
   * against it must not proceed to confirmation.
   */
  poolValidAt?(poolId: CapacityPoolId, at: UtcInstant): boolean;
};

export function availableUnits(pool: CapacityPool): number {
  const used = pool.reservedUnits + pool.heldUnits;
  return Math.max(0, pool.totalUnits - used);
}

export function quotableUnits(pool: CapacityPool, requested: number, partialAllowed: boolean): number {
  const available = availableUnits(pool);
  if (available <= 0) {
    return 0;
  }
  if (partialAllowed) {
    return Math.min(requested, available);
  }
  return requested <= available ? requested : 0;
}

export class InMemoryCapacitySource implements CapacitySourcePort {
  private readonly pools = new Map<string, CapacityPool>();
  private readonly revoked = new Set<string>();

  put(pool: CapacityPool): void {
    this.pools.set(pool.poolId as string, pool);
  }

  remove(poolId: CapacityPoolId): void {
    this.pools.delete(poolId as string);
    this.revoke(poolId);
  }

  revoke(poolId: CapacityPoolId): void {
    this.revoked.add(poolId as string);
  }

  getPool(poolId: CapacityPoolId): CapacityPool | undefined {
    return this.pools.get(poolId as string);
  }

  listPools(resourceId?: CapacityResourceId): readonly CapacityPool[] {
    const rows = [...this.pools.values()];
    if (!resourceId) {
      return rows;
    }
    return rows.filter((row) => row.resourceId === resourceId);
  }

  poolValidAt(poolId: CapacityPoolId, _at: UtcInstant): boolean {
    return !this.revoked.has(poolId as string);
  }
}
