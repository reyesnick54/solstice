import type { Clock } from '../../../../config/src/clock.ts';
import type { CustomerId } from '../../../../domain/src/customer.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { allocateResearchCost } from './cost-accounting.ts';
import {
  assertExperimentFrozen,
  freezeExperiment,
  pauseExperiment,
  rejectRetroactiveTargetChange,
  resumeExperiment,
  type DraftExperimentInput,
} from './experiment.ts';
import type { HeliosExperimentId } from './ids.ts';
import {
  assertRiskLimitsImmutable,
  bindChallengeToExperiment,
  buildMicrocapitalChallenge,
} from './microcapital-challenge.ts';
import { buildEconomicEvaluationReport, type BuildReportInput } from './report.ts';
import { recordEvaluationRun } from './run-registry.ts';
import { InMemoryHeliosEconomicEvaluationStore } from './store.ts';
import type {
  EconomicEvaluationReport,
  EvaluationRunInput,
  EvaluationRunRecord,
  FrozenExperimentSpec,
  MicrocapitalChallengeSpec,
  TrackBEconomicActivity,
} from './types.ts';

export type HeliosEconomicEvaluationPorts = {
  readonly clock: Clock;
  readonly store?: InMemoryHeliosEconomicEvaluationStore;
};

export class HeliosEconomicEvaluationService {
  private readonly clock: Clock;
  readonly store: InMemoryHeliosEconomicEvaluationStore;

  constructor(ports: HeliosEconomicEvaluationPorts) {
    this.clock = ports.clock;
    this.store = ports.store ?? new InMemoryHeliosEconomicEvaluationStore();
  }

  createExperiment(input: DraftExperimentInput): FrozenExperimentSpec {
    const spec = freezeExperiment(input);
    this.store.putExperiment(spec);
    return spec;
  }

  startExperiment(experimentId: HeliosExperimentId): Result<FrozenExperimentSpec, string> {
    const spec = this.store.getExperiment(experimentId);
    if (!spec) {
      return err(`experiment not found: ${experimentId}`);
    }
    const frozen = assertExperimentFrozen(spec);
    if (!frozen.ok) {
      return frozen;
    }
    const running = Object.freeze({ ...spec, state: 'RUNNING' as const });
    this.store.putExperiment(running);
    return ok(running);
  }

  pauseExperiment(experimentId: HeliosExperimentId): Result<FrozenExperimentSpec, string> {
    const spec = this.store.getExperiment(experimentId);
    if (!spec) {
      return err(`experiment not found: ${experimentId}`);
    }
    const paused = pauseExperiment(spec);
    this.store.putExperiment(paused);
    return ok(paused);
  }

  resumeExperiment(experimentId: HeliosExperimentId): Result<FrozenExperimentSpec, string> {
    const spec = this.store.getExperiment(experimentId);
    if (!spec) {
      return err(`experiment not found: ${experimentId}`);
    }
    const resumed = resumeExperiment(spec, this.clock.now());
    this.store.putExperiment(resumed);
    return ok(resumed);
  }

  createMicrocapitalChallenge(input: {
    readonly experimentId: HeliosExperimentId;
    readonly startingCapitalMinor?: string;
    readonly targetCapitalMinor?: string;
  }): Result<MicrocapitalChallengeSpec, string> {
    const experiment = this.store.getExperiment(input.experimentId);
    if (!experiment) {
      return err(`experiment not found: ${input.experimentId}`);
    }
    const challenge = buildMicrocapitalChallenge({
      experiment,
      now: this.clock.now(),
      ...(input.startingCapitalMinor !== undefined
        ? { startingCapitalMinor: input.startingCapitalMinor }
        : {}),
      ...(input.targetCapitalMinor !== undefined ? { targetCapitalMinor: input.targetCapitalMinor } : {}),
    });
    this.store.putChallenge(challenge);
    this.store.putExperiment(bindChallengeToExperiment(experiment, challenge.challengeId));
    return ok(challenge);
  }

  assertRiskLimitsUnchanged(input: {
    readonly challengeId: string;
    readonly proposedRiskLimits: FrozenExperimentSpec['riskLimits'];
    readonly challengeBehindSchedule: boolean;
  }): Result<true, string> {
    const challenge = this.store.getChallenge(input.challengeId);
    if (!challenge) {
      return err(`challenge not found: ${input.challengeId}`);
    }
    return assertRiskLimitsImmutable({
      original: challenge.riskLimits,
      proposed: input.proposedRiskLimits,
      challengeBehindSchedule: input.challengeBehindSchedule,
    });
  }

  recordRun(input: EvaluationRunInput): EvaluationRunRecord {
    const experiment = this.store.getExperiment(input.experimentId);
    if (!experiment) {
      throw new Error(`experiment not found: ${input.experimentId}`);
    }
    if (experiment.customerId !== input.customerId) {
      throw new Error('customer isolation violation: run customerId does not match experiment');
    }
    const run = recordEvaluationRun({ ...input, now: this.clock.now() });
    this.store.appendRun(run);
    return run;
  }

  recordTrackBActivity(input: TrackBEconomicActivity): TrackBEconomicActivity {
    if (input.labeledAsInvestmentPnl !== false) {
      throw new Error('Track B activity must not be labeled as investment P&L');
    }
    return input;
  }

  generateReport(input: Omit<BuildReportInput, 'now'>): EconomicEvaluationReport {
    const report = buildEconomicEvaluationReport({ ...input, now: this.clock.now() });
    this.store.appendReport(report);
    return report;
  }

  rejectTargetMutation(
    experimentId: HeliosExperimentId,
    updatedSuccessCriteria: FrozenExperimentSpec['successCriteria'],
  ): Result<true, string> {
    const spec = this.store.getExperiment(experimentId);
    if (!spec) {
      return err(`experiment not found: ${experimentId}`);
    }
    return rejectRetroactiveTargetChange({ original: spec, updatedSuccessCriteria });
  }

  listRunsForCustomer(customerId: CustomerId): readonly EvaluationRunRecord[] {
    return this.store.listRuns(undefined, customerId);
  }

  defaultResearchCosts(experiment: FrozenExperimentSpec): ReturnType<typeof allocateResearchCost>[] {
    const currency = experiment.capital.currency;
    return [
      allocateResearchCost({
        currency,
        source: 'S3M',
        amountMinor: '100',
        label: 'OPERATING_COST',
        reference: 'default-s3m-inference',
      }),
      allocateResearchCost({
        currency,
        source: 'GROK',
        amountMinor: '250',
        label: 'ECONOMICALLY_ALLOCATED_COST',
        reference: 'default-grok-research',
      }),
      allocateResearchCost({
        currency,
        source: 'DATA',
        amountMinor: '50',
        label: 'OPERATING_COST',
        reference: 'default-market-data',
      }),
    ];
  }
}
