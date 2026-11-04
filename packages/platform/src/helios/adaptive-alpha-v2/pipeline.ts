import type { UtcInstant } from '@solstice/domain';
import type { EvidenceVault } from '@solstice/evidence';
import { assessCoverageBias, type CoverageBiasAssessment } from '../feature-fabric/aaf06/index.ts';
import {
  compileFeatureVector,
  compilePointInTimeDatasetManifest,
  reproduceVectorsFromManifest,
  type FeatureCompilerContext,
} from '../feature-fabric/compiler/compile.ts';
import type {
  TemporalFeatureDefinition,
  TemporalObservation,
} from '../feature-fabric/temporal-types.ts';
import type { PointInTimeDatasetManifest } from '../feature-fabric/compiler/manifest.ts';
import {
  assessCoverageManifestQualification,
  buildCoverageManifest,
  buildCoverageTensor,
  sealCoverageSnapshot,
  type CoverageManifest,
  type EligibleUniverseMember,
  type FeatureCoverageProbe,
} from '../feature-fabric/feature-coverage/index.ts';
import { featureContentFingerprint } from '../feature-fabric/lineage.ts';
import type { AdaptiveAlphaActorKind } from './authority.ts';
import type { AdaptiveAlphaGateEvaluationInput } from './gates.ts';
import { DEFAULT_ADAPTIVE_ALPHA_QUALIFICATION_POLICY } from './policy.ts';
import { qualifyAdaptiveAlphaForStrategy } from './qualification.ts';
import type { AdaptiveAlphaQualification } from './types.ts';
import type { AdaptiveAlphaControlledWarningReview } from './types.ts';

export type AdaptiveAlphaResearchPipelineInput = {
  readonly hypothesisRef: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly strategyEvaluationId: string;
  readonly featureRequirements: readonly string[];
  readonly featureDefinitions: readonly TemporalFeatureDefinition[];
  readonly entityId: string;
  readonly instrumentId: string;
  readonly decisionTimes: readonly UtcInstant[];
  readonly compilerContext: FeatureCompilerContext;
  readonly universeVersion: string;
  readonly eligibleMembers: readonly EligibleUniverseMember[];
  readonly coverageProbes: readonly FeatureCoverageProbe[];
  readonly biasAssessmentInput: Parameters<typeof assessCoverageBias>[0] | null;
  readonly actorKind: AdaptiveAlphaActorKind;
  readonly qualifiedAt: UtcInstant;
  readonly warningReview?: AdaptiveAlphaControlledWarningReview | null;
  readonly evidenceVault?: EvidenceVault | null;
  /** When true, expect compileFeatureVector to fail (leakage probe). */
  readonly expectCompileRejection?: boolean;
};

export type AdaptiveAlphaResearchPipelineResult =
  | {
      readonly ok: true;
      readonly qualification: AdaptiveAlphaQualification;
      readonly pitManifest: PointInTimeDatasetManifest;
      readonly coverageManifest: CoverageManifest | null;
      readonly biasAssessment: CoverageBiasAssessment | null;
    }
  | { readonly ok: false; readonly stage: string; readonly message: string };

function missingnessRateBps(probes: readonly FeatureCoverageProbe[]): number {
  if (probes.length === 0) {
    return 10_000;
  }
  const missing = probes.filter((p) => !p.signal.valuePresent).length;
  return Math.round((missing * 10_000) / probes.length);
}

function entitlementUsableRatioBps(probes: readonly FeatureCoverageProbe[]): number {
  if (probes.length === 0) {
    return 0;
  }
  const usable = probes.filter((p) => p.signal.entitlementState === 'USABLE').length;
  return Math.round((usable * 10_000) / probes.length);
}

export function runAdaptiveAlphaResearchPipeline(
  input: AdaptiveAlphaResearchPipelineInput,
): AdaptiveAlphaResearchPipelineResult {
  const compileAttempts = input.decisionTimes.map((decisionTime) =>
    compileFeatureVector({
      entityId: input.entityId,
      instrumentId: input.instrumentId,
      decisionTime,
      universeVersion: input.universeVersion,
      featureDefinitions: input.featureDefinitions,
      context: input.compilerContext,
    }),
  );
  const compileRejected = compileAttempts.some((row) => !row.ok);
  if (input.expectCompileRejection) {
    if (!compileRejected) {
      return Object.freeze({
        ok: false,
        stage: 'POINT_IN_TIME_COMPILE',
        message: 'expected leakage rejection did not occur',
      });
    }
  } else if (compileRejected) {
    const first = compileAttempts.find((row) => !row.ok);
    return Object.freeze({
      ok: false,
      stage: 'POINT_IN_TIME_COMPILE',
      message: first && !first.ok ? first.error.message : 'compile failed',
    });
  }

  const sortedTimes = [...input.decisionTimes].sort((a, b) => Date.parse(a) - Date.parse(b));
  const manifestResult = compilePointInTimeDatasetManifest({
    strategyEvaluationId: input.strategyEvaluationId,
    decisionTimeRange: {
      start: sortedTimes[0]!,
      end: sortedTimes[sortedTimes.length - 1]!,
    },
    entityId: input.entityId,
    instrumentId: input.instrumentId,
    decisionTimes: input.decisionTimes,
    universeVersion: input.universeVersion,
    featureDefinitions: input.featureDefinitions,
    context: input.compilerContext,
  });
  if (!manifestResult.ok) {
    return Object.freeze({
      ok: false,
      stage: 'DATASET_MANIFEST',
      message: manifestResult.error.message,
    });
  }
  const pitManifest = manifestResult.value.manifest;

  const reproduced = reproduceVectorsFromManifest({
    manifest: pitManifest,
    entityId: input.entityId,
    instrumentId: input.instrumentId,
    decisionTimes: input.decisionTimes,
    featureDefinitions: input.featureDefinitions,
    context: input.compilerContext,
  });
  const reproductionVerified = reproduced.ok;

  let coverageManifest: CoverageManifest | null = null;
  if (input.coverageProbes.length > 0 && input.decisionTimes.length > 0) {
    const evaluationTimestamp = input.decisionTimes[input.decisionTimes.length - 1]!;
    const tensor = buildCoverageTensor({
      universeId: input.universeVersion,
      universeDefinition: `aaf-v2:${input.hypothesisRef}`,
      evaluationTimestamp,
      eligibleMembers: input.eligibleMembers,
      featureIds: input.featureRequirements,
      probes: input.coverageProbes,
      baselineCoverageRatioBps: null,
    });
    const evaluationSnapshot = sealCoverageSnapshot({ tensor, capturedAt: evaluationTimestamp });
    coverageManifest = buildCoverageManifest({
      evaluationId: input.strategyEvaluationId,
      universeDefinition: tensor.universeDefinition,
      universeId: input.universeVersion,
      featureIds: input.featureRequirements,
      evaluationTensor: tensor,
      evaluationSnapshot,
      trainingSnapshot: null,
    });
    const coverageVerdict = assessCoverageManifestQualification({
      manifest: coverageManifest,
      thresholds: Object.freeze({ minimumCoverageRatioBps: 5000, maximumCoverageDriftBps: 2000 }),
      trainingManifest: null,
    });
    if (!coverageVerdict.passed) {
      return Object.freeze({
        ok: false,
        stage: 'COVERAGE',
        message: coverageVerdict.blockers.join(','),
      });
    }
  }

  const biasAssessment =
    input.biasAssessmentInput === null ? null : assessCoverageBias(input.biasAssessmentInput);

  const primaryFeature = input.featureDefinitions[0];
  const lineageFingerprint =
    primaryFeature === undefined
      ? null
      : featureContentFingerprint({
          featureId: primaryFeature.featureId,
          featureVersion: primaryFeature.version,
          transformationVersion: pitManifest.compilerVersion,
          transformationParameters: Object.freeze({}),
          revisionId: 'aaf-v2-pipeline',
          sourceObservationIds: pitManifest.observationRefs,
          valueCanonical: pitManifest.contentHash,
        });

  const pitIntegrityProven =
    input.expectCompileRejection === true
      ? compileRejected
      : !compileRejected && reproductionVerified;

  const gateInput: AdaptiveAlphaGateEvaluationInput = Object.freeze({
    pitManifest,
    coverageManifest,
    biasAssessment,
    entityResolutionVersion: input.compilerContext.entityResolutionVersion,
    pitIntegrityProven,
    lineageFingerprint,
    entitlementUsableRatioBps: entitlementUsableRatioBps(input.coverageProbes),
    reproductionVerified,
    missingnessPolicy: input.compilerContext.missingnessPolicy,
    missingnessRateBps: missingnessRateBps(input.coverageProbes),
  });

  const qualification = qualifyAdaptiveAlphaForStrategy({
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    pitManifest,
    coverageManifest,
    biasAssessment,
    gateInput,
    policy: DEFAULT_ADAPTIVE_ALPHA_QUALIFICATION_POLICY,
    qualifiedAt: input.qualifiedAt,
    actorKind: input.actorKind,
    warningReview: input.warningReview ?? null,
    evidenceVault: input.evidenceVault ?? null,
  });

  return Object.freeze({
    ok: true,
    qualification,
    pitManifest,
    coverageManifest,
    biasAssessment,
  });
}

/** Build compiler context from heterogeneous observation planes (market, SEC, macro, alt-data). */
export function buildAdaptiveAlphaCompilerContext(input: {
  readonly observations: readonly TemporalObservation[];
  readonly entityResolutionVersion: string;
}): FeatureCompilerContext {
  return Object.freeze({
    observations: input.observations,
    universeMembership: Object.freeze([]),
    tickerHistory: Object.freeze([]),
    corporateActionRevisions: Object.freeze([]),
    entityResolutionVersion: input.entityResolutionVersion,
    revisionPolicy: 'LATEST_KNOWABLE_REVISION',
    missingnessPolicy: 'FAIL_CLOSED',
  });
}
