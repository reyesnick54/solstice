import type { CustomerId } from '../../../domain/src/customer.ts';
import type { EconomicWorkOrderId } from './ids.ts';
import type { AuthorityBindingDecision, EconomicWorkOrder, ToolModelCapabilityGrant } from './types.ts';

export class InMemoryHeliosWorkOrderStore {
  private readonly workOrders = new Map<string, EconomicWorkOrder>();
  private readonly decisions = new Map<string, AuthorityBindingDecision[]>();
  private readonly grants = new Map<string, ToolModelCapabilityGrant>();

  putWorkOrder(workOrder: EconomicWorkOrder): void {
    this.workOrders.set(workOrder.workOrderId, workOrder);
  }

  getWorkOrder(workOrderId: EconomicWorkOrderId): EconomicWorkOrder | undefined {
    return this.workOrders.get(workOrderId);
  }

  listWorkOrdersForCustomer(customerId: CustomerId): readonly EconomicWorkOrder[] {
    return Object.freeze(
      [...this.workOrders.values()].filter((item) => item.customerId === customerId),
    );
  }

  appendDecision(decision: AuthorityBindingDecision): void {
    const key = decision.workOrderId;
    const existing = this.decisions.get(key) ?? [];
    this.decisions.set(key, [...existing, decision]);
  }

  decisionsForWorkOrder(workOrderId: EconomicWorkOrderId): readonly AuthorityBindingDecision[] {
    return Object.freeze(this.decisions.get(workOrderId) ?? []);
  }

  putGrant(grant: ToolModelCapabilityGrant): void {
    this.grants.set(grant.grantId, grant);
  }

  getGrant(grantId: string): ToolModelCapabilityGrant | undefined {
    return this.grants.get(grantId);
  }

  revokeGrant(grantId: string, revokedAt: ToolModelCapabilityGrant['revokedAt']): void {
    const grant = this.grants.get(grantId);
    if (!grant || grant.revokedAt) {
      return;
    }
    this.grants.set(grantId, Object.freeze({ ...grant, revokedAt }));
  }

  hydrate(input: {
    readonly workOrders?: readonly EconomicWorkOrder[];
    readonly decisions?: readonly AuthorityBindingDecision[];
    readonly grants?: readonly ToolModelCapabilityGrant[];
  }): void {
    for (const workOrder of input.workOrders ?? []) {
      this.putWorkOrder(workOrder);
    }
    for (const decision of input.decisions ?? []) {
      this.appendDecision(decision);
    }
    for (const grant of input.grants ?? []) {
      this.putGrant(grant);
    }
  }
}
