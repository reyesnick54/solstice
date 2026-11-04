/**
 * Strategy Lab feature manifests — reproducible, hash-stable evaluation context.
 */

import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import { entitlementsFromContributions } from './entitlement.ts';
import {
  HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA,
  type FeatureContributionInput,
  type FeatureDefinition,
  type FeatureManifest,
  type FeatureObservation,
  type FeatureSourceReference,
  type MissingValuePolicy,
  type SourceObservationRange,
} from './types.ts';

export function buildSourceObservationRanges(
  observations: readonly FeatureObservation[],
): readonly SourceObservationRange[] {
  const byId = new Map<string, { min: UtcInstant; max: UtcInstant }>();
  for (const feature of observations) {
    for (const ref of feature.sourceRefs) {
      const existing = byId.get(ref.observationId);
      if (!existing) {
        byId.set(ref.observationId, { min: ref.knowableAt, max: ref.knowableAt });
        continue;
      }
      if (Date.parse(ref.knowableAt) < Date.parse(existing.min)) {
        existing.min = ref.knowableAt;
      }
      if (Date.parse(ref.knowableAt) > Date.parse(existing.max)) {
        existing.max = ref.knowableAt;
      }
    }
  }
  return Object.freeze(
    [...byId.entries()].map(([observationId, range]) =>
      Object.freeze({
        observationId,
        minKnowableAt: range.min,
        maxKnowableAt: range.max,
      }),
    ),
  );
}

function canonicalManifestPayload(input: {
  readonly decisionTime: UtcInstant;
  readonly definitions: readonly FeatureDefinition[];
  readonly observations: readonly FeatureObservation[];
  readonly contributions: readonly FeatureContributionInput[];
  readonly entityUniverse: readonly string[];
  readonly instrumentUniverse: readonly string[];
  readonly missingDataPolicy: MissingValuePolicy;
  readonly compilerVersion: string;
  readonly sourceDatasets: readonly string[];
}): string {
  return JSON.stringify({
    schemaVersion: HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA,
    decisionTime: input.decisionTime,
    entityUniverse: [...input.entityUniverse].sort(),
    instrumentUniverse: [...input.instrumentUniverse].sort(),
    definitions: input.definitions
      .map((d) => ({
        featureId: d.featureId,
        featureVersion: d.featureVersion,
        featureFamily: d.featureFamily,
        transformationVersion: d.transformationVersion,
        transformationParameters: d.transformationParameters,
      }))
      .sort((a, b) => a.featureId.localeCompare(b.featureId)),
    observations: input.observations
      .map((o) => ({
        featureObservationId: o.featureObservationId,
        featureId: o.featureId,
        revisionId: o.revisionId,
        knowableAt: o.knowableAt,
        lineageHash: o.lineageHash,
      }))
      .sort((a, b) => a.featureObservationId.localeCompare(b.featureObservationId)),
    sourceRevisions: [...new Set(input.observations.map((o) => o.revisionId))].sort(),
    transformationVersions: [...new Set(input.definitions.map((d) => d.transformationVersion))].sort(),
    lineageHashes: [...input.observations.map((o) => o.lineageHash)].sort(),
    missingDataPolicy: input.missingDataPolicy,
    qualityPolicy: 'propagate_worst_upstream',
    compilerVersion: input.compilerVersion,
    sourceDatasets: [...input.sourceDatasets].sort(),
    entitlements: entitlementsFromContributions(input.contributions).map((e) => ({
      entitlementClass: e.entitlementClass,
      commercialUseStatus: e.commercialUseStatus,
      redistributionStatus: e.redistributionStatus,
    })),
  });
}

export function computeManifestHash(canonicalPayload: string): string {
  return createHash('sha256').update(canonicalPayload).digest('hex');
}

export function buildFeatureManifest(input: {
  readonly createdAt: UtcInstant;
  readonly decisionTime: UtcInstant;
  readonly definitions: readonly FeatureDefinition[];
  readonly observations: readonly FeatureObservation[];
  readonly contributions: readonly FeatureContributionInput[];
  readonly entityUniverse: readonly string[];
  readonly instrumentUniverse: readonly string[];
  readonly sourceDatasets: readonly string[];
  readonly missingDataPolicy: MissingValuePolicy;
  readonly compilerVersion: string;
}): FeatureManifest {
  const canonicalPayload = canonicalManifestPayload(input);
  const manifestHash = computeManifestHash(canonicalPayload);
  const manifestId = `manifest.${manifestHash.slice(0, 32)}`;

  const featureVersions = Object.freeze(
    Object.fromEntries(input.definitions.map((d) => [d.featureId, d.featureVersion])),
  );

  const sourceObservations: FeatureSourceReference[] = [];
  const seen = new Set<string>();
  for (const obs of input.observations) {
    for (const ref of obs.sourceRefs) {
      const key = `${ref.observationId}:${ref.revisionId ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sourceObservations.push(ref);
    }
  }

  return Object.freeze({
    schemaVersion: HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA,
    manifestId,
    manifestHash,
    createdAt: input.createdAt,
    decisionTime: input.decisionTime,
    entityUniverse: Object.freeze([...input.entityUniverse]),
    instrumentUniverse: Object.freeze([...input.instrumentUniverse]),
    featureDefinitions: Object.freeze([...input.definitions]),
    featureVersions,
    sourceObservations: Object.freeze(sourceObservations),
    sourceRevisions: Object.freeze([...new Set(input.observations.map((o) => o.revisionId))].sort()),
    transformationVersions: Object.freeze([...new Set(input.definitions.map((d) => d.transformationVersion))].sort()),
    entitlements: entitlementsFromContributions(input.contributions),
    missingDataPolicy: input.missingDataPolicy,
    qualityPolicy: 'propagate_worst_upstream',
    compilerVersion: input.compilerVersion,
    lineageHashes: Object.freeze([...input.observations.map((o) => o.lineageHash)].sort()),
    sourceDatasets: Object.freeze([...input.sourceDatasets]),
    sourceObservationRanges: buildSourceObservationRanges(input.observations),
    pointInTimeRule: 'knowable_at_lte_decision_time',
    featureSnapshotIds: Object.freeze(input.observations.map((row) => row.featureObservationId)),
    grantsExecutionAuthority: false,
  });
}
