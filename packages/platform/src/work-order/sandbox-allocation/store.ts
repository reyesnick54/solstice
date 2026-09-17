import type { GrowSandboxAllocation } from './types.ts';
import type { GrowSandboxAllocationId } from './ids.ts';
import type { EconomicWorkOrderId } from '../ids.ts';

export type GrowSandboxAllocationStoreSnapshot = {
  readonly allocations: readonly GrowSandboxAllocation[];
};

export class InMemoryGrowSandboxAllocationStore {
  private readonly byId = new Map<string, GrowSandboxAllocation>();
  private readonly byIdempotency = new Map<string, GrowSandboxAllocation>();
  private readonly byWorkOrder = new Map<string, GrowSandboxAllocation[]>();

  put(allocation: GrowSandboxAllocation): void {
    this.byId.set(allocation.allocationId, allocation);
    const idempotencyKey = `${allocation.customerId}:${allocation.idempotencyKey}`;
    this.byIdempotency.set(idempotencyKey, allocation);
    const existing = this.byWorkOrder.get(allocation.workOrderId) ?? [];
    const next = existing.filter((row) => row.allocationId !== allocation.allocationId);
    next.push(allocation);
    this.byWorkOrder.set(allocation.workOrderId, next);
  }

  get(allocationId: GrowSandboxAllocationId, customerId: string): GrowSandboxAllocation | undefined {
    const row = this.byId.get(allocationId);
    if (!row || row.customerId !== customerId) {
      return undefined;
    }
    return row;
  }

  getByIdempotency(customerId: string, idempotencyKey: string): GrowSandboxAllocation | undefined {
    return this.byIdempotency.get(`${customerId}:${idempotencyKey}`);
  }

  listByWorkOrder(workOrderId: EconomicWorkOrderId, customerId: string): readonly GrowSandboxAllocation[] {
    return (this.byWorkOrder.get(workOrderId) ?? []).filter((row) => row.customerId === customerId);
  }

  listActiveByAccount(accountId: string, customerId: string): readonly GrowSandboxAllocation[] {
    return this.list().filter(
      (row) =>
        row.customerId === customerId &&
        row.accountId === accountId &&
        (row.status === 'RESERVED' || row.status === 'PARTIALLY_RESERVED'),
    );
  }

  list(): readonly GrowSandboxAllocation[] {
    return [...this.byId.values()];
  }

  snapshot(): GrowSandboxAllocationStoreSnapshot {
    return Object.freeze({
      allocations: Object.freeze([...this.byId.values()]),
    });
  }

  hydrate(snapshot: GrowSandboxAllocationStoreSnapshot): void {
    this.byId.clear();
    this.byIdempotency.clear();
    this.byWorkOrder.clear();
    for (const allocation of snapshot.allocations) {
      this.put(allocation);
    }
  }
}
