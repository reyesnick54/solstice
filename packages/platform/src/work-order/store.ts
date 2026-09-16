import type { WorkOrderRevision } from './ids.ts';
import type { EconomicWorkOrder } from './types.ts';

export type WorkOrderStoreSnapshot = {
  readonly workOrders: readonly EconomicWorkOrder[];
};

export type WorkOrderStorePutFailure = {
  readonly code: 'VERSION_CONFLICT';
  readonly message: string;
};

export class InMemoryWorkOrderStore {
  private readonly workOrders = new Map<string, EconomicWorkOrder>();
  private readonly idempotencyIndex = new Map<string, string>();

  private idempotencyKey(customerId: string, key: string): string {
    return `${customerId}:${key}`;
  }

  put(
    workOrder: EconomicWorkOrder,
    expectedRevision?: WorkOrderRevision,
  ): EconomicWorkOrder | WorkOrderStorePutFailure {
    const existing = this.workOrders.get(workOrder.workOrderId);
    if (existing && expectedRevision !== undefined && existing.revision !== expectedRevision) {
      return {
        code: 'VERSION_CONFLICT',
        message: `expected revision ${String(expectedRevision)} but current is ${String(existing.revision)}`,
      };
    }
    this.workOrders.set(workOrder.workOrderId, workOrder);
    this.idempotencyIndex.set(
      this.idempotencyKey(workOrder.customerId, workOrder.idempotencyKey),
      workOrder.workOrderId,
    );
    return workOrder;
  }

  get(workOrderId: string): EconomicWorkOrder | undefined {
    return this.workOrders.get(workOrderId);
  }

  getByIdempotency(customerId: string, idempotencyKey: string): EconomicWorkOrder | undefined {
    const id = this.idempotencyIndex.get(this.idempotencyKey(customerId, idempotencyKey));
    return id ? this.workOrders.get(id) : undefined;
  }

  listByCustomer(customerId: string): readonly EconomicWorkOrder[] {
    return Object.freeze(
      [...this.workOrders.values()]
        .filter((row) => row.customerId === customerId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    );
  }

  listBySubject(subjectId: string): readonly EconomicWorkOrder[] {
    return Object.freeze(
      [...this.workOrders.values()]
        .filter((row) => row.subjectId === subjectId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    );
  }

  snapshot(): WorkOrderStoreSnapshot {
    return Object.freeze({
      workOrders: Object.freeze([...this.workOrders.values()]),
    });
  }

  loadState(state: WorkOrderStoreSnapshot): void {
    this.workOrders.clear();
    this.idempotencyIndex.clear();
    for (const workOrder of state.workOrders) {
      this.put(workOrder);
    }
  }
}
