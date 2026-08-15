import type {
  PortfolioRiskSnapshot,
  RiskBudget,
  RiskDecision,
  RiskLimit,
  RiskStoreSnapshot,
  StressRun,
  StressScenario,
} from './types.ts';

export class RiskStore {
  private readonly budgets = new Map<string, RiskBudget>();
  private readonly limits = new Map<string, RiskLimit>();
  private readonly snapshots = new Map<string, PortfolioRiskSnapshot>();
  private readonly assessments = new Map<string, RiskDecision>();
  private readonly scenarios = new Map<string, StressScenario>();
  private readonly runs = new Map<string, StressRun>();

  putBudget(budget: RiskBudget): void {
    this.budgets.set(budget.budgetId, budget);
  }

  getBudget(budgetId: string): RiskBudget | undefined {
    return this.budgets.get(budgetId);
  }

  listBudgets(): readonly RiskBudget[] {
    return Object.freeze([...this.budgets.values()]);
  }

  putLimit(limit: RiskLimit): void {
    this.limits.set(limit.limitId, limit);
  }

  putSnapshot(snapshot: PortfolioRiskSnapshot): void {
    this.snapshots.set(snapshot.snapshotId, snapshot);
  }

  latestSnapshot(portfolioId: string): PortfolioRiskSnapshot | undefined {
    return [...this.snapshots.values()].reverse().find((row) => row.portfolioId === portfolioId);
  }

  putAssessment(decision: RiskDecision): void {
    this.assessments.set(decision.assessmentId, decision);
  }

  getAssessment(assessmentId: string): RiskDecision | undefined {
    return this.assessments.get(assessmentId);
  }

  putScenario(scenario: StressScenario): void {
    this.scenarios.set(scenario.scenarioId, scenario);
  }

  getScenario(scenarioId: string): StressScenario | undefined {
    return this.scenarios.get(scenarioId);
  }

  putRun(run: StressRun): void {
    this.runs.set(run.runId, run);
  }

  snapshot(): RiskStoreSnapshot {
    return Object.freeze({
      budgets: this.listBudgets(),
      limits: Object.freeze([...this.limits.values()]),
      snapshots: Object.freeze([...this.snapshots.values()]),
      assessments: Object.freeze([...this.assessments.values()]),
      scenarios: Object.freeze([...this.scenarios.values()]),
      runs: Object.freeze([...this.runs.values()]),
    });
  }

  restore(state: RiskStoreSnapshot): void {
    this.budgets.clear();
    this.limits.clear();
    this.snapshots.clear();
    this.assessments.clear();
    this.scenarios.clear();
    this.runs.clear();
    for (const row of state.budgets) {
      this.budgets.set(row.budgetId, row);
    }
    for (const row of state.limits) {
      this.limits.set(row.limitId, row);
    }
    for (const row of state.snapshots) {
      this.snapshots.set(row.snapshotId, row);
    }
    for (const row of state.assessments) {
      this.assessments.set(row.assessmentId, row);
    }
    for (const row of state.scenarios) {
      this.scenarios.set(row.scenarioId, row);
    }
    for (const row of state.runs) {
      this.runs.set(row.runId, row);
    }
  }
}
