import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { HeliosOperationId, HeliosOrderId, HeliosProviderEventId } from './ids.ts';
import type {
  HeliosFill,
  HeliosOrder,
  HeliosOrderLifecycleStoreSnapshot,
  HeliosProviderEvent,
  HeliosReconciliationRecord,
  HeliosSettlement,
} from './types.ts';

export class InMemoryHeliosOrderLifecycleStore {
  private readonly orders = new Map<HeliosOrderId, HeliosOrder>();
  private readonly fills = new Map<string, HeliosFill>();
  private readonly settlements = new Map<string, HeliosSettlement>();
  private readonly providerEvents = new Map<HeliosProviderEventId, HeliosProviderEvent>();
  private readonly reconciliations = new Map<HeliosOrderId, HeliosReconciliationRecord>();
  private readonly operationIndex = new Map<HeliosOperationId, HeliosOrderId>();
  private readonly processedEventIds = new Set<HeliosProviderEventId>();

  putOrder(order: HeliosOrder): void {
    if (this.operationIndex.has(order.operationId)) {
      const existing = this.operationIndex.get(order.operationId)!;
      if (existing !== order.orderId) {
        throw new Error(`operation identity collision: ${order.operationId}`);
      }
    } else {
      this.operationIndex.set(order.operationId, order.orderId);
    }
    this.orders.set(order.orderId, order);
  }

  updateOrder(order: HeliosOrder): void {
    if (!this.orders.has(order.orderId)) {
      throw new Error(`order not found: ${order.orderId}`);
    }
    this.orders.set(order.orderId, order);
  }

  getOrder(orderId: HeliosOrderId): HeliosOrder | null {
    return this.orders.get(orderId) ?? null;
  }

  getOrderByOperationId(operationId: HeliosOperationId): HeliosOrder | null {
    const orderId = this.operationIndex.get(operationId);
    if (!orderId) return null;
    return this.orders.get(orderId) ?? null;
  }

  forCustomer(customerId: CustomerId): readonly HeliosOrder[] {
    return Object.freeze([...this.orders.values()].filter((o) => o.customerId === customerId));
  }

  putFill(fill: HeliosFill): boolean {
    const key = `${fill.orderId}:${fill.providerFillId}`;
    if (this.fills.has(key)) {
      return false;
    }
    this.fills.set(key, fill);
    return true;
  }

  getFills(orderId: HeliosOrderId): readonly HeliosFill[] {
    return Object.freeze([...this.fills.values()].filter((f) => f.orderId === orderId));
  }

  putSettlement(settlement: HeliosSettlement): void {
    this.settlements.set(settlement.settlementId, settlement);
  }

  getSettlements(orderId: HeliosOrderId): readonly HeliosSettlement[] {
    return Object.freeze([...this.settlements.values()].filter((s) => s.orderId === orderId));
  }

  putProviderEvent(event: HeliosProviderEvent): void {
    this.providerEvents.set(event.eventId, event);
    if (event.processedAt) {
      this.processedEventIds.add(event.eventId);
    }
  }

  isEventProcessed(eventId: HeliosProviderEventId): boolean {
    return this.processedEventIds.has(eventId);
  }

  putReconciliation(record: HeliosReconciliationRecord): void {
    this.reconciliations.set(record.orderId, record);
  }

  getReconciliation(orderId: HeliosOrderId): HeliosReconciliationRecord | null {
    return this.reconciliations.get(orderId) ?? null;
  }

  snapshot(): HeliosOrderLifecycleStoreSnapshot {
    return Object.freeze({
      orders: Object.freeze([...this.orders.values()]),
      fills: Object.freeze([...this.fills.values()]),
      settlements: Object.freeze([...this.settlements.values()]),
      providerEvents: Object.freeze([...this.providerEvents.values()]),
      reconciliations: Object.freeze([...this.reconciliations.values()]),
      processedEventIds: Object.freeze([...this.processedEventIds]),
    });
  }

  restore(snapshot: HeliosOrderLifecycleStoreSnapshot): void {
    this.orders.clear();
    this.fills.clear();
    this.settlements.clear();
    this.providerEvents.clear();
    this.reconciliations.clear();
    this.operationIndex.clear();
    this.processedEventIds.clear();
    for (const order of snapshot.orders) {
      this.putOrder(order);
    }
    for (const fill of snapshot.fills) {
      this.putFill(fill);
    }
    for (const settlement of snapshot.settlements) {
      this.putSettlement(settlement);
    }
    for (const event of snapshot.providerEvents) {
      this.putProviderEvent(event);
    }
    for (const rec of snapshot.reconciliations) {
      this.putReconciliation(rec);
    }
    for (const eventId of snapshot.processedEventIds) {
      this.processedEventIds.add(eventId);
    }
  }
}
