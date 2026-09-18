import type { CustomerId } from '../../../../domain/src/customer.ts';
import type {
  EconomicEvaluationReport,
  EvaluationRunRecord,
  FrozenExperimentSpec,
  MicrocapitalChallengeSpec,
} from './types.ts';
import type { HeliosExperimentId } from './ids.ts';
import { listRunsForCustomer, listRunsForExperiment } from './run-registry.ts';

export type EconomicEvaluationStoreSnapshot = {
  readonly experiments: Readonly<Record<string, FrozenExperimentSpec>>;
  readonly challenges: Readonly<Record<string, MicrocapitalChallengeSpec>>;
  readonly runs: readonly EvaluationRunRecord[];
  readonly reports: readonly EconomicEvaluationReport[];
};

export class InMemoryHeliosEconomicEvaluationStore {
  private readonly experiments = new Map<string, FrozenExperimentSpec>();
  private readonly challenges = new Map<string, MicrocapitalChallengeSpec>();
  private readonly runs: EvaluationRunRecord[] = [];
  private readonly reports: EconomicEvaluationReport[] = [];

  putExperiment(spec: FrozenExperimentSpec): void {
    this.experiments.set(spec.experimentId, spec);
  }

  getExperiment(experimentId: HeliosExperimentId): FrozenExperimentSpec | undefined {
    return this.experiments.get(experimentId);
  }

  putChallenge(spec: MicrocapitalChallengeSpec): void {
    this.challenges.set(spec.challengeId, spec);
  }

  getChallenge(challengeId: string): MicrocapitalChallengeSpec | undefined {
    return this.challenges.get(challengeId);
  }

  appendRun(run: EvaluationRunRecord): void {
    this.runs.push(run);
  }

  listRuns(experimentId?: HeliosExperimentId, customerId?: CustomerId): readonly EvaluationRunRecord[] {
    if (experimentId) {
      return listRunsForExperiment(this.runs, experimentId);
    }
    if (customerId) {
      return listRunsForCustomer(this.runs, customerId);
    }
    return Object.freeze([...this.runs]);
  }

  appendReport(report: EconomicEvaluationReport): void {
    this.reports.push(report);
  }

  latestReport(experimentId: HeliosExperimentId): EconomicEvaluationReport | undefined {
    return [...this.reports].reverse().find((row) => row.experiment.experimentId === experimentId);
  }

  snapshot(): EconomicEvaluationStoreSnapshot {
    return Object.freeze({
      experiments: Object.freeze(Object.fromEntries(this.experiments.entries())),
      challenges: Object.freeze(Object.fromEntries(this.challenges.entries())),
      runs: Object.freeze([...this.runs]),
      reports: Object.freeze([...this.reports]),
    });
  }

  load(snapshot: EconomicEvaluationStoreSnapshot): void {
    this.experiments.clear();
    this.challenges.clear();
    this.runs.length = 0;
    this.reports.length = 0;
    for (const [id, row] of Object.entries(snapshot.experiments)) {
      this.experiments.set(id, row);
    }
    for (const [id, row] of Object.entries(snapshot.challenges)) {
      this.challenges.set(id, row);
    }
    this.runs.push(...snapshot.runs);
    this.reports.push(...snapshot.reports);
  }

  clear(): void {
    this.experiments.clear();
    this.challenges.clear();
    this.runs.length = 0;
    this.reports.length = 0;
  }
}
