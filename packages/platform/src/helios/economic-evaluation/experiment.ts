import { createHash } from 'node:crypto';

import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { experimentIdFor, type HeliosExperimentId } from './ids.ts';
import type {
  ExecutionAssumptionSpec,
  ExperimentSuccessCriteria,
  FrozenExperimentSpec,
  RiskLimitSpec,
} from './types.ts';
import type { BenchmarkKind } from './taxonomy.ts';
import { evaluationMoney } from './money.ts';

export type DraftExperimentInput = {
  readonly hypothesis: string;
  readonly strategyCapsuleId?: string | null;
  readonly modelVersions: readonly string[];
  readonly policyVersions: readonly string[];
  readonly datasetRef: string;
  readonly forwardStart: UtcInstant;
  readonly forwardEnd: UtcInstant;
  readonly capitalMinor: string;
  readonly currency: string;
  readonly researchBudgetMinor: string;
  readonly riskLimits: RiskLimitSpec;
  readonly executionAssumptions: ExecutionAssumptionSpec;
  readonly benchmarkKind: BenchmarkKind;
  readonly benchmarkMethodology: string;
  readonly costTreatment: string;
  readonly successCriteria: ExperimentSuccessCriteria;
  readonly failureCriteria: readonly string[];
  readonly customerId: CustomerId;
  readonly now: UtcInstant;
  readonly experimentId?: HeliosExperimentId;
};

export function canonicalExperimentBody(input: DraftExperimentInput): string {
  return JSON.stringify({
    hypothesis: input.hypothesis,
    strategyCapsuleId: input.strategyCapsuleId ?? null,
    modelVersions: input.modelVersions,
    policyVersions: input.policyVersions,
    datasetRef: input.datasetRef,
    forwardStart: input.forwardStart,
    forwardEnd: input.forwardEnd,
    capitalMinor: input.capitalMinor,
    currency: input.currency,
    researchBudgetMinor: input.researchBudgetMinor,
    riskLimits: input.riskLimits,
    executionAssumptions: input.executionAssumptions,
    benchmarkKind: input.benchmarkKind,
    benchmarkMethodology: input.benchmarkMethodology,
    costTreatment: input.costTreatment,
    successCriteria: input.successCriteria,
    failureCriteria: input.failureCriteria,
    customerId: input.customerId,
  });
}

export function freezeExperiment(input: DraftExperimentInput): FrozenExperimentSpec {
  const experimentId = input.experimentId ?? experimentIdFor();
  const body = canonicalExperimentBody(input);
  const frozenHash = createHash('sha256').update(body).digest('hex');
  return Object.freeze({
    schema: 'sunrey.helios.economic-experiment.v1',
    experimentId,
    hypothesis: input.hypothesis,
    strategyCapsuleId: input.strategyCapsuleId ?? null,
    modelVersions: Object.freeze([...input.modelVersions]),
    policyVersions: Object.freeze([...input.policyVersions]),
    datasetRef: input.datasetRef,
    forwardPeriod: Object.freeze({ start: input.forwardStart, end: input.forwardEnd }),
    capital: evaluationMoney(input.capitalMinor, input.currency),
    researchBudget: evaluationMoney(input.researchBudgetMinor, input.currency),
    riskLimits: input.riskLimits,
    executionAssumptions: input.executionAssumptions,
    benchmark: Object.freeze({
      kind: input.benchmarkKind,
      methodology: input.benchmarkMethodology,
    }),
    costTreatment: input.costTreatment,
    successCriteria: input.successCriteria,
    failureCriteria: Object.freeze([...input.failureCriteria]),
    frozenAt: input.now,
    frozenHash,
    state: 'FROZEN',
    customerId: input.customerId,
    microcapitalChallengeId: null,
  });
}

export function assertExperimentFrozen(spec: FrozenExperimentSpec): Result<true, string> {
  if (spec.state !== 'FROZEN' && spec.state !== 'RUNNING' && spec.state !== 'PAUSED') {
    return err(`experiment ${spec.experimentId} is not frozen (${spec.state})`);
  }
  return ok(true);
}

export function rejectRetroactiveTargetChange(input: {
  readonly original: FrozenExperimentSpec;
  readonly updatedSuccessCriteria: ExperimentSuccessCriteria;
}): Result<true, string> {
  const original = JSON.stringify(input.original.successCriteria);
  const updated = JSON.stringify(input.updatedSuccessCriteria);
  if (original !== updated) {
    return err('retroactive success-criteria change rejected; experiment was frozen before start');
  }
  return ok(true);
}

export function resumeExperiment(spec: FrozenExperimentSpec, now: UtcInstant): FrozenExperimentSpec {
  if (spec.state !== 'PAUSED' && spec.state !== 'FROZEN') {
    throw new Error(`cannot resume experiment in state ${spec.state}`);
  }
  return Object.freeze({
    ...spec,
    state: 'RUNNING',
    frozenAt: spec.frozenAt,
  });
}

export function pauseExperiment(spec: FrozenExperimentSpec): FrozenExperimentSpec {
  if (spec.state !== 'RUNNING') {
    throw new Error(`cannot pause experiment in state ${spec.state}`);
  }
  return Object.freeze({ ...spec, state: 'PAUSED' });
}
