import type { CompiledEconomicMandate, MandateConfirmation, MandateDraft } from './mandate/types.ts';
import type { FeasibilityResult, GrowthCycle, GrowthPlan } from './growth/types.ts';
import type { EconomicMandateId, GrowthCycleId, GrowthPlanId } from './ids.ts';

export type GrowthStoreSnapshot = {
  readonly drafts: readonly MandateDraft[];
  readonly mandates: readonly CompiledEconomicMandate[];
  readonly confirmations: readonly MandateConfirmation[];
  readonly cycles: readonly GrowthCycle[];
  readonly plans: readonly GrowthPlan[];
  readonly feasibility: readonly FeasibilityResult[];
};

export class InMemoryGrowthStore {
  private readonly drafts = new Map<string, MandateDraft>();
  private readonly mandates = new Map<string, CompiledEconomicMandate>();
  private readonly confirmations = new Map<string, MandateConfirmation>();
  private readonly cycles = new Map<string, GrowthCycle>();
  private readonly plans = new Map<string, GrowthPlan>();
  private readonly feasibility = new Map<string, FeasibilityResult>();

  putDraft(draft: MandateDraft): MandateDraft {
    this.drafts.set(draft.draftId, draft);
    return draft;
  }

  putMandate(mandate: CompiledEconomicMandate): CompiledEconomicMandate {
    this.mandates.set(`${mandate.mandateId}:${String(mandate.version)}`, mandate);
    return mandate;
  }

  putConfirmation(confirmation: MandateConfirmation): MandateConfirmation {
    this.confirmations.set(confirmation.confirmationId, confirmation);
    return confirmation;
  }

  putCycle(cycle: GrowthCycle): GrowthCycle {
    this.cycles.set(cycle.cycleId, cycle);
    return cycle;
  }

  putPlan(plan: GrowthPlan): GrowthPlan {
    this.plans.set(`${plan.planId}:${String(plan.version)}`, plan);
    return plan;
  }

  putFeasibility(result: FeasibilityResult): FeasibilityResult {
    this.feasibility.set(result.actionId, result);
    return result;
  }

  getMandate(mandateId: EconomicMandateId, version: number): CompiledEconomicMandate | undefined {
    return this.mandates.get(`${mandateId}:${String(version)}`);
  }

  latestMandateFor(subjectId: string): CompiledEconomicMandate | undefined {
    const matches = [...this.mandates.values()].filter((item) => item.subjectId === subjectId);
    return matches.sort((a, b) => b.version - a.version)[0];
  }

  activeMandateFor(subjectId: string): CompiledEconomicMandate | undefined {
    return [...this.mandates.values()].find((item) => item.subjectId === subjectId && item.state === 'ACTIVE');
  }

  getCycle(cycleId: GrowthCycleId): GrowthCycle | undefined {
    return this.cycles.get(cycleId);
  }

  latestPlanFor(subjectId: string): GrowthPlan | undefined {
    const matches = [...this.plans.values()].filter((item) => item.subjectId === subjectId);
    return matches.sort((a, b) => {
      if (a.generatedAt === b.generatedAt) {
        return b.version - a.version;
      }
      return a.generatedAt < b.generatedAt ? 1 : -1;
    })[0];
  }

  getPlan(planId: GrowthPlanId, version: number): GrowthPlan | undefined {
    return this.plans.get(`${planId}:${String(version)}`);
  }

  plansFor(subjectId: string): readonly GrowthPlan[] {
    return Object.freeze([...this.plans.values()].filter((item) => item.subjectId === subjectId));
  }

  exportState(): GrowthStoreSnapshot {
    return {
      drafts: Object.freeze([...this.drafts.values()]),
      mandates: Object.freeze([...this.mandates.values()]),
      confirmations: Object.freeze([...this.confirmations.values()]),
      cycles: Object.freeze([...this.cycles.values()]),
      plans: Object.freeze([...this.plans.values()]),
      feasibility: Object.freeze([...this.feasibility.values()]),
    };
  }

  loadState(state: GrowthStoreSnapshot): void {
    this.drafts.clear();
    this.mandates.clear();
    this.confirmations.clear();
    this.cycles.clear();
    this.plans.clear();
    this.feasibility.clear();
    for (const draft of state.drafts) {
      this.putDraft(draft);
    }
    for (const mandate of state.mandates) {
      this.putMandate(mandate);
    }
    for (const confirmation of state.confirmations) {
      this.putConfirmation(confirmation);
    }
    for (const cycle of state.cycles) {
      this.putCycle(cycle);
    }
    for (const plan of state.plans) {
      this.putPlan(plan);
    }
    for (const result of state.feasibility) {
      this.putFeasibility(result);
    }
  }
}
