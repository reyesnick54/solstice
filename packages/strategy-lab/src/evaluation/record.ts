import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { StrategyCapsule } from './capsule.ts';
import type { EvaluationDatasetManifest } from './manifest.ts';
import { asStrategyEvaluationId, type StrategyEvaluationId } from './ids.ts';
import type {
  BenchmarkComparison,
  ChronologicalEvaluationConfig,
  EvaluationLimitation,
  EvaluationMode,
  EvaluationRunKind,
  ExtendedEvaluationMetrics,
  QualificationOutcome,
  RegimeSlice,
} from './types.ts';
import { EVALUATION_ENGINE_VERSION, FILL_MODEL_VERSION } from './types.ts';

export type StrategyEvaluationRecord = {
  readonly evaluationId: StrategyEvaluationId;
  readonly capsuleId: string;
  readonly capsuleVersion: string;
  readonly capsuleFingerprint: string;
  readonly datasetManifestId: string;
  readonly datasetManifestHash: string;
  readonly evaluationEngineVersion: typeof EVALUATION_ENGINE_VERSION;
  readonly fillModelVersion: typeof FILL_MODEL_VERSION;
  readonly latencyModelVersion: string;
  readonly mode: EvaluationMode;
  readonly runKind: EvaluationRunKind;
  readonly customerId: string | null;
  readonly timeRange: { readonly start: UtcInstant; readonly end: UtcInstant };
  readonly partition: ChronologicalEvaluationConfig['partition'];
  readonly metrics: ExtendedEvaluationMetrics;
  readonly benchmarks: readonly BenchmarkComparison[];
  readonly regimeSlices: readonly RegimeSlice[];
  readonly limitations: readonly EvaluationLimitation[];
  readonly qualificationOutcome: QualificationOutcome;
  readonly outputHash: string;
  readonly seed: string | null;
  readonly succeeded: boolean;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly artifactRefs: readonly string[];
  readonly createdAt: UtcInstant;
  readonly immutable: true;
};

export function sealEvaluationRecord(input: {
  readonly capsule: StrategyCapsule;
  readonly manifest: EvaluationDatasetManifest;
  readonly config: ChronologicalEvaluationConfig;
  readonly metrics: ExtendedEvaluationMetrics;
  readonly benchmarks: readonly BenchmarkComparison[];
  readonly regimeSlices: readonly RegimeSlice[];
  readonly limitations: readonly EvaluationLimitation[];
  readonly qualificationOutcome: QualificationOutcome;
  readonly succeeded: boolean;
  readonly failureCode?: string | null;
  readonly failureMessage?: string | null;
  readonly artifactRefs?: readonly string[];
  readonly createdAt: UtcInstant;
}): StrategyEvaluationRecord {
  const material = JSON.stringify(
    {
      engine: EVALUATION_ENGINE_VERSION,
      capsule: input.capsule.fingerprint,
      manifest: input.manifest.hash,
      mode: input.config.mode,
      runKind: input.config.runKind,
      partition: input.config.partition,
      period: input.config.period,
      seed: input.config.seed,
      customerId: input.config.customerId,
      ending: input.metrics.endingCapitalMinor.toString(),
      net: input.metrics.netEconomicsMinor.toString(),
      outcome: input.qualificationOutcome,
      succeeded: input.succeeded,
    },
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
  );
  const outputHash = createHash('sha256').update(material).digest('hex');
  return Object.freeze({
    evaluationId: asStrategyEvaluationId(`seval_${outputHash.slice(0, 24)}`),
    capsuleId: input.capsule.capsuleId,
    capsuleVersion: input.capsule.version,
    capsuleFingerprint: input.capsule.fingerprint,
    datasetManifestId: input.manifest.manifestId,
    datasetManifestHash: input.manifest.hash,
    evaluationEngineVersion: EVALUATION_ENGINE_VERSION,
    fillModelVersion: FILL_MODEL_VERSION,
    latencyModelVersion: input.config.latency.version,
    mode: input.config.mode,
    runKind: input.config.runKind,
    customerId: input.config.customerId,
    timeRange: input.config.period,
    partition: input.config.partition,
    metrics: input.metrics,
    benchmarks: Object.freeze([...input.benchmarks]),
    regimeSlices: Object.freeze([...input.regimeSlices]),
    limitations: Object.freeze([...input.limitations]),
    qualificationOutcome: input.qualificationOutcome,
    outputHash,
    seed: input.config.seed,
    succeeded: input.succeeded,
    failureCode: input.failureCode ?? null,
    failureMessage: input.failureMessage ?? null,
    artifactRefs: Object.freeze([...(input.artifactRefs ?? [])]),
    createdAt: input.createdAt,
    immutable: true,
  });
}
