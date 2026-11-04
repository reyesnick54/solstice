/**
 * Strategy Lab integration bridge (platform-owned; strategy-lab must not import platform).
 */

import { err, ok, type Result } from '@solstice/domain';
import type { UtcInstant } from '@solstice/domain';
import { reproduceVectorsFromManifest, type CompiledFeatureVector, type FeatureCompilerContext } from './compile.ts';
import type { PointInTimeDatasetManifest } from './manifest.ts';
import type { TemporalFeatureDefinition } from '../temporal-types.ts';
import { AAFV2_03_COMPILER_VERSION } from './v2-version.ts';

export const STRATEGY_GENOME_PIT_COMPILER_REQUIRED = true as const;

export type StrategyGenomeDatasetGateFailure = {
  readonly code: 'PIT_COMPILER_BYPASS' | 'PIT_MANIFEST_MISMATCH';
  readonly message: string;
};

export type PointInTimeFeatureEvaluationAttachment = {
  readonly manifest: PointInTimeDatasetManifest;
  readonly featureDefinitions: readonly TemporalFeatureDefinition[];
  readonly context: FeatureCompilerContext;
  readonly entityId: string;
  readonly instrumentId: string;
  readonly decisionTimes: readonly UtcInstant[];
};

export function isAafv203PointInTimeManifest(manifest: PointInTimeDatasetManifest): boolean {
  return (
    manifest.compilerVersion === AAFV2_03_COMPILER_VERSION &&
    Boolean(manifest.strategyGenomeId) &&
    Boolean(manifest.datasetId)
  );
}

export function requireCompiledPointInTimeDataset(input: {
  readonly strategyGenomeId: string;
  readonly manifest: PointInTimeDatasetManifest | undefined;
  readonly legacyCapsuleHarness?: boolean;
}): Result<PointInTimeDatasetManifest, StrategyGenomeDatasetGateFailure> {
  if (input.legacyCapsuleHarness) {
    if (!input.manifest) {
      return err({
        code: 'PIT_COMPILER_BYPASS',
        message: 'legacy harness still requires explicit manifest attachment',
      });
    }
    return ok(input.manifest);
  }
  if (!input.manifest) {
    return err({
      code: 'PIT_COMPILER_BYPASS',
      message: `strategy genome ${input.strategyGenomeId} must compile features through PointInTimeDatasetCompiler`,
    });
  }
  if (!isAafv203PointInTimeManifest(input.manifest)) {
    return err({
      code: 'PIT_COMPILER_BYPASS',
      message: 'manifest is not an AAFV2.3 point-in-time dataset seal',
    });
  }
  if (input.manifest.strategyGenomeId !== input.strategyGenomeId) {
    return err({
      code: 'PIT_MANIFEST_MISMATCH',
      message: 'manifest strategyGenomeId does not match evaluation genome',
    });
  }
  return ok(input.manifest);
}

export function resolvePointInTimeVectorsForEvaluation(
  attachment: PointInTimeFeatureEvaluationAttachment,
): readonly CompiledFeatureVector[] {
  const reproduced = reproduceVectorsFromManifest({
    manifest: attachment.manifest,
    entityId: attachment.entityId,
    instrumentId: attachment.instrumentId,
    decisionTimes: attachment.decisionTimes,
    featureDefinitions: attachment.featureDefinitions,
    context: attachment.context,
  });
  if (!reproduced.ok) {
    throw new Error(reproduced.error.message);
  }
  return reproduced.value;
}

export function pitManifestMatchesStrategyGenome(
  manifest: PointInTimeDatasetManifest,
  strategyGenomeId: string,
): boolean {
  return (manifest.strategyGenomeId ?? manifest.strategyEvaluationId) === strategyGenomeId;
}

export function pitManifestMatchesEvaluationId(
  manifest: PointInTimeDatasetManifest,
  evaluationId: string,
): boolean {
  return manifest.strategyEvaluationId === evaluationId;
}

export function acceptPointInTimeDatasetManifest(
  manifest: PointInTimeDatasetManifest,
): PointInTimeDatasetManifest {
  if (manifest.contentHash.length === 0) {
    throw new Error('PointInTimeDatasetManifest missing contentHash');
  }
  return manifest;
}

/** Controlled compatibility hook for M09–M12 capsule harnesses (identity passthrough). */
export function legacyCapsuleEvaluationDatasetAdapter<T>(manifest: T): T {
  return manifest;
}
