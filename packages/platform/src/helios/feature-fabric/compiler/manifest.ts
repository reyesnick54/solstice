import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { MissingnessPolicy, RevisionPolicy } from '../temporal-types.ts';
import { AAF04_COMPILER_VERSION } from './version.ts';

export type PointInTimeDatasetManifestId = string & { readonly __brand: 'PointInTimeDatasetManifestId' };

export function asPointInTimeDatasetManifestId(value: string): PointInTimeDatasetManifestId {
  return value as PointInTimeDatasetManifestId;
}

export type PointInTimeDatasetManifest = {
  readonly manifestId: PointInTimeDatasetManifestId;
  readonly strategyEvaluationId: string;
  readonly decisionTimeRange: { readonly start: UtcInstant; readonly end: UtcInstant };
  readonly universeVersion: string;
  readonly featureVersions: Readonly<Record<string, string>>;
  readonly observationRefs: readonly string[];
  readonly entityResolutionVersion: string;
  readonly revisionPolicy: RevisionPolicy;
  readonly missingnessPolicy: MissingnessPolicy;
  readonly compilerVersion: typeof AAF04_COMPILER_VERSION;
  readonly contentHash: string;
};

export type CompilerFailure = {
  readonly code:
    | 'LEAKAGE_DETECTED'
    | 'MISSING_FEATURE'
    | 'INVALID_MANIFEST'
    | 'REPRODUCTION_MISMATCH';
  readonly message: string;
  readonly leakageCode?: string;
};

function canonicalManifest(
  input: Omit<PointInTimeDatasetManifest, 'manifestId' | 'contentHash'>,
): string {
  return JSON.stringify(input, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
}

export function freezePointInTimeDatasetManifest(
  input: Omit<PointInTimeDatasetManifest, 'manifestId' | 'contentHash' | 'compilerVersion'> & {
    readonly manifestId?: PointInTimeDatasetManifestId;
    readonly compilerVersion?: typeof AAF04_COMPILER_VERSION;
  },
): Result<PointInTimeDatasetManifest, CompilerFailure> {
  if (input.strategyEvaluationId.length === 0) {
    return err({ code: 'INVALID_MANIFEST', message: 'strategyEvaluationId is required' });
  }
  if (Date.parse(input.decisionTimeRange.start) > Date.parse(input.decisionTimeRange.end)) {
    return err({ code: 'INVALID_MANIFEST', message: 'decision time range start must be <= end' });
  }
  const body = {
    strategyEvaluationId: input.strategyEvaluationId,
    decisionTimeRange: input.decisionTimeRange,
    universeVersion: input.universeVersion,
    featureVersions: input.featureVersions,
    observationRefs: [...input.observationRefs].sort((a, b) => a.localeCompare(b)),
    entityResolutionVersion: input.entityResolutionVersion,
    revisionPolicy: input.revisionPolicy,
    missingnessPolicy: input.missingnessPolicy,
    compilerVersion: input.compilerVersion ?? AAF04_COMPILER_VERSION,
  };
  const contentHash = createHash('sha256').update(canonicalManifest(body)).digest('hex');
  return ok(
    Object.freeze({
      ...body,
      manifestId: input.manifestId ?? asPointInTimeDatasetManifestId(`pitmf_${contentHash.slice(0, 20)}`),
      observationRefs: Object.freeze(body.observationRefs),
      contentHash,
    }),
  );
}

export function assertManifestReproducible(
  manifest: PointInTimeDatasetManifest,
  recomputedHash: string,
): Result<PointInTimeDatasetManifest, CompilerFailure> {
  if (manifest.contentHash !== recomputedHash) {
    return err({
      code: 'REPRODUCTION_MISMATCH',
      message: `manifest hash ${manifest.contentHash} does not match recomputed ${recomputedHash}`,
    });
  }
  return ok(manifest);
}
