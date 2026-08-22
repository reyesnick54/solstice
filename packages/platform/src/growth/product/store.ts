import type { FinancialProposalId, GrowMoneyPlanId } from './ids.ts';
import type { FinancialProposal, ProductGrowthPlan } from './types.ts';

export type ProductGrowthStoreSnapshot = {
  readonly plans: readonly ProductGrowthPlan[];
  readonly proposals: readonly FinancialProposal[];
};

export class InMemoryProductGrowthStore {
  private readonly plans = new Map<string, ProductGrowthPlan>();
  private readonly proposals = new Map<string, FinancialProposal>();

  putPlan(plan: ProductGrowthPlan): ProductGrowthPlan {
    this.plans.set(`${plan.planId}:${String(plan.version)}`, plan);
    return plan;
  }

  putProposal(proposal: FinancialProposal): FinancialProposal {
    this.proposals.set(proposal.proposalId, proposal);
    return proposal;
  }

  getPlan(planId: GrowMoneyPlanId, version?: number): ProductGrowthPlan | undefined {
    if (version !== undefined) {
      return this.plans.get(`${planId}:${String(version)}`);
    }
    return this.plansForId(planId)[0];
  }

  plansForId(planId: GrowMoneyPlanId): readonly ProductGrowthPlan[] {
    return Object.freeze(
      [...this.plans.values()]
        .filter((item) => item.planId === planId)
        .sort((a, b) => b.version - a.version),
    );
  }

  latestPlanForOwner(ownerId: string): ProductGrowthPlan | undefined {
    return this.plansForOwner(ownerId)[0];
  }

  plansForOwner(ownerId: string): readonly ProductGrowthPlan[] {
    return Object.freeze(
      [...this.plans.values()]
        .filter((item) => item.ownerId === ownerId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    );
  }

  getProposal(proposalId: FinancialProposalId | string): FinancialProposal | undefined {
    return this.proposals.get(proposalId);
  }

  proposalsForOwner(ownerId: string, planId?: GrowMoneyPlanId): readonly FinancialProposal[] {
    return Object.freeze(
      [...this.proposals.values()]
        .filter((item) => item.ownerId === ownerId && (planId === undefined || item.planId === planId))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    );
  }

  hasProposal(proposalId: string): boolean {
    return this.proposals.has(proposalId);
  }

  exportState(): ProductGrowthStoreSnapshot {
    return {
      plans: Object.freeze([...this.plans.values()]),
      proposals: Object.freeze([...this.proposals.values()]),
    };
  }

  loadState(state: ProductGrowthStoreSnapshot): void {
    this.plans.clear();
    this.proposals.clear();
    for (const plan of state.plans) {
      this.putPlan(plan);
    }
    for (const proposal of state.proposals) {
      this.putProposal(proposal);
    }
  }
}
