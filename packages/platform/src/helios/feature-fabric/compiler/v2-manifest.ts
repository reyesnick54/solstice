import { createHash } from 'node:crypto';

import { err, ok, type Result } from '@solstice/domain';
import type { UtcInstant } from '@solstice/domain';
import type { MissingnessPolicy, RevisionPolicy } from '../temporal-types.ts';
import {
  asPointInTimeDatasetManifestId,
  type CompilerFailure,
  type PointInTimeDatasetManifest,
} from './manifest.ts';
import type { InformationTimePolicy } from './v2-types.ts';
import { AAFV2_03_COMPILER_VERSION } from './v2-version.ts';

export type FreezeAafv203ManifestInput = {
  readonly datasetId?: string;
  readonly strategyGenomeId: string;
  readonly decisionTimeRange: { readonly start: UtcInstant; readonly end: UtcInstant };
  readonly universeVersion: string;
  readonly universeDefinition: string;
  readonly entityGraphVersion: string;
  readonly featureVersions: Readonly<Record<string, string>>;
  readonly featureDefinitionRefs: readonly string[];
  readonly observationRefs: readonly string[];
  readonly revisionRefs: readonly string[];
  readonly sourceProviders: readonly string[];
  readonly qualityPolicies: readonly string[];
  readonly entitlementState: string;
  readonly transformVersions: Readonly<Record<string, string>>;
  readonly informationTimePolicy: InformationTimePolicy;
  readonly revisionPolicy: RevisionPolicy;
  readonly missingnessPolicy: MissingnessPolicy;
};

function canonicalManifest(body: Record<string, unknown>): string {
  return JSON.stringify(body, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
}

export function freezeAafv203PointInTimeDatasetManifest(
  input: FreezeAafv203ManifestInput,
): Result<PointInTimeDatasetManifest, CompilerFailure> {
  if (input.strategyGenomeId.length === 0) {
    return err({ code: 'INVALID_MANIFEST', message: 'strategyGenomeId is required' });
  }
  if (Date.parse(input.decisionTimeRange.start) > Date.parse(input.decisionTimeRange.end)) {
    return err({ code: 'INVALID_MANIFEST', message: 'decision time range start must be <= end' });
  }

  const observationRefs = [...input.observationRefs].sort((a, b) => a.localeCompare(b));
  const revisionRefs = [...input.revisionRefs].sort((a, b) => a.localeCompare(b));
  const sourceProviders = [...input.sourceProviders].sort((a, b) => a.localeCompare(b));
  const featureDefinitionRefs = [...input.featureDefinitionRefs].sort((a, b) => a.localeCompare(b));

  const manifestIdSeed = createHash('sha256')
    .update(
      canonicalManifest({
        strategyGenomeId: input.strategyGenomeId,
        observationRefs,
        featureDefinitionRefs,
      }),
    )
    .digest('hex');
  const manifestId = asPointInTimeDatasetManifestId(`pitds_${manifestIdSeed.slice(0, 20)}`);
  const datasetId = input.datasetId ?? manifestId;

  const body = {
    datasetId,
    strategyEvaluationId: input.strategyGenomeId,
    strategyGenomeId: input.strategyGenomeId,
    decisionTimeRange: input.decisionTimeRange,
    universeVersion: input.universeVersion,
    universeDefinition: input.universeDefinition,
    entityResolutionVersion: input.entityGraphVersion,
    entityGraphVersion: input.entityGraphVersion,
    featureVersions: input.featureVersions,
    featureDefinitionRefs,
    observationRefs,
    revisionRefs,
    sourceProviders,
    qualityPolicies: [...input.qualityPolicies],
    entitlementState: input.entitlementState,
    transformVersions: input.transformVersions,
    temporalJoinPolicy: input.informationTimePolicy.temporalJoinPolicy,
    revisionSelectionPolicy: input.informationTimePolicy.revisionSelectionPolicy,
    revisionPolicy: input.revisionPolicy,
    missingnessPolicy: input.missingnessPolicy,
    compilerVersion: AAFV2_03_COMPILER_VERSION,
  };

  const contentHash = createHash('sha256').update(canonicalManifest(body)).digest('hex');

  return ok(
    Object.freeze({
      ...body,
      datasetId,
      manifestId,
      observationRefs: Object.freeze(observationRefs),
      revisionRefs: Object.freeze(revisionRefs),
      sourceProviders: Object.freeze(sourceProviders),
      featureDefinitionRefs: Object.freeze(featureDefinitionRefs),
      contentHash,
    }),
  );
}

export function recomputeAafv203ManifestHash(manifest: PointInTimeDatasetManifest): string {
  const body = {
    datasetId: manifest.datasetId ?? manifest.manifestId,
    strategyEvaluationId: manifest.strategyEvaluationId,
    strategyGenomeId: manifest.strategyGenomeId ?? manifest.strategyEvaluationId,
    decisionTimeRange: manifest.decisionTimeRange,
    universeVersion: manifest.universeVersion,
    universeDefinition: manifest.universeDefinition ?? '',
    entityResolutionVersion: manifest.entityResolutionVersion,
    entityGraphVersion: manifest.entityGraphVersion ?? manifest.entityResolutionVersion,
    featureVersions: manifest.featureVersions,
    featureDefinitionRefs: [...(manifest.featureDefinitionRefs ?? [])].sort((a, b) => a.localeCompare(b)),
    observationRefs: [...manifest.observationRefs].sort((a, b) => a.localeCompare(b)),
    revisionRefs: [...(manifest.revisionRefs ?? [])].sort((a, b) => a.localeCompare(b)),
    sourceProviders: [...(manifest.sourceProviders ?? [])].sort((a, b) => a.localeCompare(b)),
    qualityPolicies: manifest.qualityPolicies ?? [],
    entitlementState: manifest.entitlementState ?? 'UNKNOWN',
    transformVersions: manifest.transformVersions ?? {},
    temporalJoinPolicy: manifest.temporalJoinPolicy ?? 'AS_OF_KNOWABLE',
    revisionSelectionPolicy: manifest.revisionSelectionPolicy ?? manifest.revisionPolicy,
    revisionPolicy: manifest.revisionPolicy,
    missingnessPolicy: manifest.missingnessPolicy,
    compilerVersion: manifest.compilerVersion,
  };
  return createHash('sha256').update(canonicalManifest(body)).digest('hex');
}
