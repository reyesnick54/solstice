/**
 * Bridge OS10 point-in-time fundamentals into the universal feature fabric.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import {
  FUNDAMENTAL_FEATURE_IDS,
  HELIOS_FUNDAMENTAL_FEATURE_SCHEMA,
  type FundamentalFeatureId,
  type PointInTimeFundamentalSnapshot,
} from '../types.ts';
import {
  HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA,
  type FeatureDefinition,
  type FeatureObservation,
  type FeatureVector,
} from './types.ts';

export const FUNDAMENTAL_UNIVERSAL_COMPILER_VERSION = 'helios-aafv2-fundamental-bridge-v1' as const;

export function fundamentalFeatureDefinition(featureId: FundamentalFeatureId): FeatureDefinition {
  return Object.freeze({
    schemaVersion: HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA,
    featureId: `fundamental.${featureId}`,
    featureVersion: '1.0.0',
    featureFamily: 'FUNDAMENTAL',
    displayName: featureId,
    description: `OS10 fundamental feature ${featureId}`,
    valueKind: featureId.includes('margin') || featureId.includes('growth') || featureId === 'roic_proxy' ? 'ratio' : 'integer_minor',
    unit: null,
    transformationId: 'os10.fundamental_snapshot',
    transformationVersion: '1',
    transformationParameters: Object.freeze({ schema: HELIOS_FUNDAMENTAL_FEATURE_SCHEMA }),
    grantsExecutionAuthority: false,
  });
}

export function pointInTimeFundamentalSnapshotToObservations(
  snapshot: PointInTimeFundamentalSnapshot,
): readonly FeatureObservation[] {
  const observations: FeatureObservation[] = [];
  for (const featureId of FUNDAMENTAL_FEATURE_IDS) {
    const row = snapshot.features[featureId];
    if (!row.supported || !row.knowableAt) {
      continue;
    }
    const definition = fundamentalFeatureDefinition(featureId);
    const value =
      row.ratio != null
        ? Object.freeze({
            kind: 'ratio' as const,
            unit: row.unit,
            decimal: row.ratio,
            integerMinor: null,
            boolean: null,
            text: null,
          })
        : Object.freeze({
            kind: 'integer_minor' as const,
            unit: row.unit,
            decimal: null,
            integerMinor: row.valueMinor?.toString() ?? null,
            boolean: null,
            text: null,
          });

    observations.push(
      Object.freeze({
        schemaVersion: HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA,
        featureObservationId: `featobs.fundamental.${featureId}.${snapshot.evaluationTimeUtc}`,
        featureId: definition.featureId,
        featureVersion: definition.featureVersion,
        canonicalEntityId: snapshot.canonicalEntityId,
        canonicalInstrumentId: null,
        value,
        valueType: value.kind,
        unit: row.unit,
        eventTime: row.knowableAt,
        sourcePublishedTime: row.knowableAt,
        providerAvailabilityTime: row.knowableAt,
        sunreyArrivalTime: row.knowableAt,
        knowableAt: row.knowableAt,
        computedAt: snapshot.evaluationTimeUtc,
        validFrom: row.knowableAt,
        validTo: null,
        revisionId: row.sourceFilingId ?? `rev.${featureId}`,
        sourceRefs: Object.freeze([
          Object.freeze({
            observationId: row.sourceFilingId ?? `filing.${featureId}`,
            knowableAt: row.knowableAt,
            evidenceRef: row.evidenceRef,
            revisionId: row.sourceFilingId,
          }),
        ]),
        evidenceRefs: Object.freeze(row.evidenceRef ? [row.evidenceRef] : []),
        entitlementState: 'USABLE',
        entitlementClass: 'internal_use',
        qualityState: 'VALID',
        quality: Object.freeze({ state: 'VALID', degradedReason: null }),
        confidence: '1.0000',
        transformationVersion: definition.transformationVersion,
        transformationParameters: definition.transformationParameters,
        sourceIndependenceState: 'INDEPENDENT',
        lineage: Object.freeze({
          lineageId: `lineage.fundamental.${featureId}`,
          parentLineageIds: Object.freeze([]),
          transformationId: definition.transformationId,
          transformationVersion: definition.transformationVersion,
          contentFingerprint: `fundamental.${featureId}.${row.knowableAt}`,
        }),
        lineageHash: `fundamental.${featureId}.${row.knowableAt}`,
        computation: null,
        grantsExecutionAuthority: false,
      }),
    );
  }
  return Object.freeze(observations);
}

export function pointInTimeFundamentalSnapshotToVector(snapshot: PointInTimeFundamentalSnapshot): FeatureVector {
  const observations = pointInTimeFundamentalSnapshotToObservations(snapshot);
  const orderedFeatureIds = observations.map((o) => o.featureId);
  return Object.freeze({
    vectorId: `vector.fundamental.${snapshot.canonicalEntityId}.${snapshot.evaluationTimeUtc}`,
    evaluationTime: snapshot.evaluationTimeUtc,
    orderedFeatureIds,
    slots: observations,
    grantsExecutionAuthority: false,
  });
}
