/**
 * Adapters from domain-specific feature producers into universal observations.
 */

import type { UtcInstant } from '@solstice/domain';
import { HELIOS_OS14_FEATURE_FABRIC_SCHEMA } from '../../open-source/os14-prediction-market/taxonomy.ts';
import type { PredictionMarketFeatureSnapshot } from '../../open-source/os14-prediction-market/types.ts';
import { HELIOS_TECHNICAL_FEATURE_MANIFEST_VERSION } from '../technical/types.ts';
import type { IndicatorSeriesSnapshot } from '../technical/types.ts';
import {
  HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA,
  type FeatureDefinition,
  type FeatureObservation,
} from './types.ts';

export function technicalIndicatorToUniversalObservation(input: {
  readonly entityId: string;
  readonly instrumentId: string;
  readonly indicator: IndicatorSeriesSnapshot;
  readonly barIndex: number;
  readonly knowableAt: UtcInstant;
  readonly eventTime: UtcInstant;
}): FeatureObservation | null {
  const valueScaled = input.indicator.values[input.barIndex];
  if (valueScaled == null) {
    return null;
  }
  const featureId = `technical.${input.indicator.indicatorId}.${input.indicator.port}`;
  const definition: FeatureDefinition = Object.freeze({
    schemaVersion: HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA,
    featureId,
    featureVersion: HELIOS_TECHNICAL_FEATURE_MANIFEST_VERSION,
    featureFamily: 'TECHNICAL',
    displayName: featureId,
    description: 'OpenChart/BYTEX technical indicator port',
    valueKind: 'decimal',
    unit: 'scaled_1e4',
    transformationId: 'native06.indicator',
    transformationVersion: '1',
    transformationParameters: Object.freeze({ port: input.indicator.port }),
    grantsExecutionAuthority: false,
  });

  const decimal = (valueScaled / 10_000).toFixed(4);
  const lineageHash = `${featureId}.${input.barIndex}.${decimal}`;

  return Object.freeze({
    schemaVersion: HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA,
    featureObservationId: `featobs.${featureId}.${input.barIndex}`,
    featureId: definition.featureId,
    featureVersion: definition.featureVersion,
    canonicalEntityId: input.entityId,
    canonicalInstrumentId: input.instrumentId,
    value: Object.freeze({
      kind: 'decimal',
      unit: definition.unit,
      decimal,
      integerMinor: null,
      boolean: null,
      text: null,
    }),
    valueType: 'decimal',
    unit: definition.unit,
    eventTime: input.eventTime,
    sourcePublishedTime: input.knowableAt,
    providerAvailabilityTime: input.knowableAt,
    sunreyArrivalTime: input.knowableAt,
    knowableAt: input.knowableAt,
    computedAt: input.knowableAt,
    validFrom: input.knowableAt,
    validTo: null,
    revisionId: `bar.${input.barIndex}`,
    sourceRefs: Object.freeze([
      Object.freeze({
        observationId: `bar.${input.instrumentId}.${input.barIndex}`,
        knowableAt: input.knowableAt,
        evidenceRef: null,
        revisionId: `bar.${input.barIndex}`,
      }),
    ]),
    evidenceRefs: Object.freeze([]),
    entitlementState: 'USABLE',
    entitlementClass: 'internal_use',
    qualityState: 'VALID',
    quality: Object.freeze({ state: 'VALID', degradedReason: null }),
    confidence: '1.0000',
    transformationVersion: definition.transformationVersion,
    transformationParameters: definition.transformationParameters,
    sourceIndependenceState: 'INDEPENDENT',
    lineage: Object.freeze({
      lineageId: lineageHash.slice(0, 32),
      parentLineageIds: Object.freeze([]),
      transformationId: definition.transformationId,
      transformationVersion: definition.transformationVersion,
      contentFingerprint: lineageHash,
    }),
    lineageHash,
    computation: null,
    grantsExecutionAuthority: false,
  });
}

export function predictionMarketSnapshotToUniversalObservation(
  snapshot: PredictionMarketFeatureSnapshot,
  entityId: string,
): FeatureObservation {
  const featureId = 'prediction_market.implied_mid_ppm';
  const ppm = snapshot.impliedMarketMidPpm?.toString() ?? '0';
  const lineageHash = `${featureId}.${snapshot.instrumentId}.${snapshot.knowableAt}`;

  return Object.freeze({
    schemaVersion: HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA,
    featureObservationId: `featobs.${featureId}.${snapshot.instrumentId}`,
    featureId,
    featureVersion: '1.0.0',
    canonicalEntityId: entityId,
    canonicalInstrumentId: snapshot.instrumentId,
    value: Object.freeze({
      kind: 'integer_minor',
      unit: 'ppm',
      decimal: null,
      integerMinor: ppm,
      boolean: null,
      text: null,
    }),
    valueType: 'integer_minor',
    unit: 'ppm',
    eventTime: snapshot.knowableAt,
    sourcePublishedTime: snapshot.knowableAt,
    providerAvailabilityTime: snapshot.knowableAt,
    sunreyArrivalTime: snapshot.knowableAt,
    knowableAt: snapshot.knowableAt,
    computedAt: snapshot.knowableAt,
    validFrom: snapshot.knowableAt,
    validTo: null,
    revisionId: `pm.${snapshot.instrumentId}`,
    sourceRefs: Object.freeze([
      Object.freeze({
        observationId: `pm.obs.${snapshot.instrumentId}`,
        knowableAt: snapshot.knowableAt,
        evidenceRef: null,
        revisionId: `pm.${snapshot.instrumentId}`,
      }),
    ]),
    evidenceRefs: Object.freeze([]),
    entitlementState: 'USABLE',
    entitlementClass: 'sandbox_test',
    qualityState: 'VALID',
    quality: Object.freeze({ state: 'VALID', degradedReason: null }),
    confidence: '1.0000',
    transformationVersion: '1',
    transformationParameters: Object.freeze({ schema: HELIOS_OS14_FEATURE_FABRIC_SCHEMA }),
    sourceIndependenceState: 'INDEPENDENT',
    lineage: Object.freeze({
      lineageId: lineageHash.slice(0, 32),
      parentLineageIds: Object.freeze([]),
      transformationId: 'os14.prediction_market',
      transformationVersion: '1',
      contentFingerprint: lineageHash,
    }),
    lineageHash,
    computation: null,
    grantsExecutionAuthority: false,
  });
}
