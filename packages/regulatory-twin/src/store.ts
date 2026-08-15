import type {
  CandidatePolicySet,
  ReadinessReviewRecord,
  RegulatoryAssumption,
  RegulatoryImpactReport,
  RegulatoryProductReadiness,
  RegulatoryScenario,
  RegulatoryScenarioSuite,
  RegulatorySnapshot,
  RegulatoryTwinRecord,
} from './types.ts';
import type {
  CandidatePolicySetId,
  ImpactReportId,
  RegulatoryAssumptionId,
  RegulatoryReadinessAssessmentId,
  RegulatoryScenarioId,
  RegulatoryScenarioSuiteId,
  RegulatorySnapshotId,
  RegulatoryTwinId,
} from './ids.ts';

export type RegulatoryTwinStoreSnapshot = {
  readonly twins: readonly RegulatoryTwinRecord[];
  readonly snapshots: readonly RegulatorySnapshot[];
  readonly scenarios: readonly RegulatoryScenario[];
  readonly suites: readonly RegulatoryScenarioSuite[];
  readonly candidates: readonly CandidatePolicySet[];
  readonly assumptions: readonly RegulatoryAssumption[];
  readonly reports: readonly RegulatoryImpactReport[];
  readonly assessments: readonly RegulatoryProductReadiness[];
  readonly dispositions: readonly ReadinessReviewRecord[];
};

export class RegulatoryTwinStore {
  private readonly twins = new Map<RegulatoryTwinId, RegulatoryTwinRecord>();
  private readonly snapshots = new Map<RegulatorySnapshotId, RegulatorySnapshot>();
  private readonly scenarios = new Map<RegulatoryScenarioId, RegulatoryScenario>();
  private readonly suites = new Map<RegulatoryScenarioSuiteId, RegulatoryScenarioSuite>();
  private readonly candidates = new Map<CandidatePolicySetId, CandidatePolicySet>();
  private readonly assumptions = new Map<RegulatoryAssumptionId, RegulatoryAssumption>();
  private readonly reports = new Map<ImpactReportId, RegulatoryImpactReport>();
  private readonly assessments = new Map<
    RegulatoryReadinessAssessmentId,
    RegulatoryProductReadiness
  >();
  private readonly dispositions: ReadinessReviewRecord[] = [];

  putTwin(row: RegulatoryTwinRecord): void {
    this.twins.set(row.twinId, row);
  }

  putSnapshot(row: RegulatorySnapshot): void {
    this.snapshots.set(row.snapshotId, row);
  }

  putScenario(row: RegulatoryScenario): void {
    this.scenarios.set(row.scenarioId, row);
  }

  putSuite(row: RegulatoryScenarioSuite): void {
    this.suites.set(row.suiteId, row);
  }

  putCandidate(row: CandidatePolicySet): void {
    this.candidates.set(row.candidateSetId, row);
  }

  putAssumption(row: RegulatoryAssumption): void {
    this.assumptions.set(row.assumptionId, row);
  }

  putReport(row: RegulatoryImpactReport): void {
    this.reports.set(row.reportId, row);
  }

  putAssessment(row: RegulatoryProductReadiness): void {
    this.assessments.set(row.assessmentId, row);
  }

  putDisposition(row: ReadinessReviewRecord): void {
    this.dispositions.push(row);
  }

  getTwin(id: RegulatoryTwinId): RegulatoryTwinRecord | undefined {
    return this.twins.get(id);
  }

  getSnapshot(id: RegulatorySnapshotId): RegulatorySnapshot | undefined {
    return this.snapshots.get(id);
  }

  getScenario(id: RegulatoryScenarioId): RegulatoryScenario | undefined {
    return this.scenarios.get(id);
  }

  getSuite(id: RegulatoryScenarioSuiteId): RegulatoryScenarioSuite | undefined {
    return this.suites.get(id);
  }

  getCandidate(id: CandidatePolicySetId): CandidatePolicySet | undefined {
    return this.candidates.get(id);
  }

  getAssumption(id: RegulatoryAssumptionId): RegulatoryAssumption | undefined {
    return this.assumptions.get(id);
  }

  getReport(id: ImpactReportId): RegulatoryImpactReport | undefined {
    return this.reports.get(id);
  }

  listScenarios(suiteId?: RegulatoryScenarioSuiteId): readonly RegulatoryScenario[] {
    const rows = [...this.scenarios.values()];
    return suiteId ? rows.filter((row) => row.suiteId === suiteId) : rows;
  }

  snapshot(): RegulatoryTwinStoreSnapshot {
    return Object.freeze({
      twins: Object.freeze([...this.twins.values()]),
      snapshots: Object.freeze([...this.snapshots.values()]),
      scenarios: Object.freeze([...this.scenarios.values()]),
      suites: Object.freeze([...this.suites.values()]),
      candidates: Object.freeze([...this.candidates.values()]),
      assumptions: Object.freeze([...this.assumptions.values()]),
      reports: Object.freeze([...this.reports.values()]),
      assessments: Object.freeze([...this.assessments.values()]),
      dispositions: Object.freeze([...this.dispositions]),
    });
  }

  hydrate(state: RegulatoryTwinStoreSnapshot): void {
    for (const row of state.twins) this.putTwin(row);
    for (const row of state.snapshots) this.putSnapshot(row);
    for (const row of state.scenarios) this.putScenario(row);
    for (const row of state.suites) this.putSuite(row);
    for (const row of state.candidates) this.putCandidate(row);
    for (const row of state.assumptions) this.putAssumption(row);
    for (const row of state.reports) this.putReport(row);
    for (const row of state.assessments) this.putAssessment(row);
    for (const row of state.dispositions) this.putDisposition(row);
  }
}
