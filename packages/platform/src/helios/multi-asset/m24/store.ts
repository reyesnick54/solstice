import type { CustomerId } from '@solstice/domain';
import type { HeliosFillId, HeliosOrderId } from '../../order-lifecycle/ids.ts';
import type { M24ExecutionPlanId, M24ExitPlanId } from './ids.ts';
import type {
  MultiAssetExecutionStoreSnapshot,
  MultiAssetExitPlan,
  MultiAssetFillRecord,
  MultiAssetOrderRecord,
  MultiAssetReconciliationException,
  MultiAssetReconciliationRun,
} from './types.ts';

export class InMemoryMultiAssetExecutionStore {
  private readonly orders = new Map<HeliosOrderId, MultiAssetOrderRecord>();
  private readonly ordersByPlan = new Map<M24ExecutionPlanId, MultiAssetOrderRecord>();
  private readonly fills = new Map<HeliosFillId, MultiAssetFillRecord>();
  private readonly fillsByOrder = new Map<HeliosOrderId, MultiAssetFillRecord[]>();
  private readonly exitPlans = new Map<M24ExitPlanId, MultiAssetExitPlan>();
  private readonly reconciliationRuns: MultiAssetReconciliationRun[] = [];
  private readonly exceptions: MultiAssetReconciliationException[] = [];

  putOrder(record: MultiAssetOrderRecord): void {
    this.orders.set(record.orderId, record);
    this.ordersByPlan.set(record.executionPlanId, record);
  }

  getOrder(orderId: HeliosOrderId): MultiAssetOrderRecord | null {
    return this.orders.get(orderId) ?? null;
  }

  getOrderByPlan(executionPlanId: M24ExecutionPlanId): MultiAssetOrderRecord | null {
    return this.ordersByPlan.get(executionPlanId) ?? null;
  }

  forCustomer(customerId: CustomerId): readonly MultiAssetOrderRecord[] {
    return Object.freeze([...this.orders.values()].filter((row) => row.customerId === customerId));
  }

  putFill(record: MultiAssetFillRecord): boolean {
    if (this.fills.has(record.fillId)) {
      return false;
    }
    this.fills.set(record.fillId, record);
    const existing = this.fillsByOrder.get(record.orderId) ?? [];
    this.fillsByOrder.set(record.orderId, [...existing, record]);
    return true;
  }

  getFills(orderId: HeliosOrderId): readonly MultiAssetFillRecord[] {
    return Object.freeze(this.fillsByOrder.get(orderId) ?? []);
  }

  putExitPlan(plan: MultiAssetExitPlan): void {
    this.exitPlans.set(plan.exitPlanId, plan);
  }

  getExitPlan(exitPlanId: M24ExitPlanId): MultiAssetExitPlan | null {
    return this.exitPlans.get(exitPlanId) ?? null;
  }

  putReconciliationRun(run: MultiAssetReconciliationRun): void {
    this.reconciliationRuns.push(run);
  }

  latestReconciliation(accountId: string): MultiAssetReconciliationRun | null {
    for (let i = this.reconciliationRuns.length - 1; i >= 0; i -= 1) {
      const run = this.reconciliationRuns[i]!;
      if (run.accountId === accountId) {
        return run;
      }
    }
    return null;
  }

  putException(exception: MultiAssetReconciliationException): void {
    this.exceptions.push(exception);
  }

  openExceptions(accountId: string): readonly MultiAssetReconciliationException[] {
    return Object.freeze(this.exceptions.filter((row) => row.accountId === accountId && !row.resolved));
  }

  snapshot(): MultiAssetExecutionStoreSnapshot {
    return Object.freeze({
      orders: Object.freeze([...this.orders.values()]),
      fills: Object.freeze([...this.fills.values()]),
      exitPlans: Object.freeze([...this.exitPlans.values()]),
      reconciliationRuns: Object.freeze([...this.reconciliationRuns]),
      exceptions: Object.freeze([...this.exceptions]),
    });
  }

  restore(snapshot: MultiAssetExecutionStoreSnapshot): void {
    this.orders.clear();
    this.ordersByPlan.clear();
    this.fills.clear();
    this.fillsByOrder.clear();
    this.exitPlans.clear();
    this.reconciliationRuns.length = 0;
    this.exceptions.length = 0;
    for (const order of snapshot.orders) {
      this.putOrder(order);
    }
    for (const fill of snapshot.fills) {
      this.putFill(fill);
    }
    for (const plan of snapshot.exitPlans) {
      this.putExitPlan(plan);
    }
    for (const run of snapshot.reconciliationRuns) {
      this.reconciliationRuns.push(run);
    }
    for (const exception of snapshot.exceptions) {
      this.exceptions.push(exception);
    }
  }
}
