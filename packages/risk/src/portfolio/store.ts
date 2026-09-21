import type {
  MandateRiskPolicy,
  PortfolioRiskStateRecord,
  PortfolioRiskStoreSnapshot,
  RiskInterventionEvidence,
} from './types.ts';

export class PortfolioRiskStore {
  private readonly policies = new Map<string, MandateRiskPolicy>();
  private readonly states = new Map<string, PortfolioRiskStateRecord>();
  private readonly interventions = new Map<string, RiskInterventionEvidence>();

  putPolicy(policy: MandateRiskPolicy): void {
    this.policies.set(`${policy.mandateId}:${policy.version}`, policy);
  }

  getPolicy(mandateId: string, version: string): MandateRiskPolicy | undefined {
    return this.policies.get(`${mandateId}:${version}`);
  }

  latestPolicy(mandateId: string): MandateRiskPolicy | undefined {
    return [...this.policies.values()]
      .filter((row) => row.mandateId === mandateId)
      .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
      .at(-1);
  }

  putState(state: PortfolioRiskStateRecord): void {
    this.states.set(state.mandateId, state);
  }

  getState(mandateId: string): PortfolioRiskStateRecord | undefined {
    return this.states.get(mandateId);
  }

  putIntervention(intervention: RiskInterventionEvidence): void {
    this.interventions.set(intervention.interventionId, intervention);
  }

  listInterventions(mandateId: string): readonly RiskInterventionEvidence[] {
    return Object.freeze([...this.interventions.values()].filter((row) => row.mandateId === mandateId));
  }

  snapshot(): PortfolioRiskStoreSnapshot {
    return Object.freeze({
      policies: Object.freeze([...this.policies.values()]),
      states: Object.freeze([...this.states.values()]),
      interventions: Object.freeze([...this.interventions.values()]),
    });
  }

  restore(state: PortfolioRiskStoreSnapshot): void {
    this.policies.clear();
    this.states.clear();
    this.interventions.clear();
    for (const row of state.policies) {
      this.putPolicy(row);
    }
    for (const row of state.states) {
      this.putState(row);
    }
    for (const row of state.interventions) {
      this.putIntervention(row);
    }
  }
}
