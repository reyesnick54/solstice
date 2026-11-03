/**
 * Derived and cross-asset feature computation with monotonic knowability.
 */

import type { FeatureValue } from './types.ts';
import {
  assertDerivedKnowableNotBeforeInputs,
  maxKnowableAtObservations,
  rejectFutureInputObservation,
} from './knowable-at.ts';
import { buildFeatureLineage } from './lineage.ts';
import { deriveFeatureEntitlementFromInputs } from './entitlement.ts';
import {
  deriveFeatureQualityFromInputs,
  featureQualityRecord,
} from './quality.ts';
import {
  HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA,
  type ComputeDerivedFeatureInput,
  type ComputeFeatureResult,
  type FeatureObservation,
} from './types.ts';

function featureObservationId(featureId: string, revisionId: string, lineageId: string): string {
  return `featobs.${featureId}.${revisionId}.${lineageId}`;
}

function defaultCombineValue(inputs: readonly FeatureObservation[]): FeatureValue {
  const first = inputs[0]!;
  return Object.freeze({ ...first.value });
}

function valueCanonical(value: FeatureValue): string {
  return JSON.stringify(value);
}

export function computeDerivedFeatureObservation(input: ComputeDerivedFeatureInput): ComputeFeatureResult {
  if (input.inputObservations.length === 0) {
    return { ok: false, code: 'NO_INPUTS', message: 'derived feature requires input observations' };
  }

  if (input.evaluationTimeForVisibility) {
    for (const row of input.inputObservations) {
      const future = rejectFutureInputObservation(input.evaluationTimeForVisibility, row);
      if (!future.ok) {
        return future;
      }
    }
  }

  const knowableAt = maxKnowableAtObservations(input.inputObservations);
  const monotonic = assertDerivedKnowableNotBeforeInputs(knowableAt, input.inputObservations);
  if (!monotonic.ok) {
    return monotonic;
  }

  const combine = input.combineValue ?? defaultCombineValue;
  const value = combine(input.inputObservations);
  const valueCanon = valueCanonical(value);

  const parentLineageIds = input.inputObservations.map((row) => row.lineage.lineageId);
  const parentLineageHashes = input.inputObservations.map((row) => row.lineageHash);
  const sourceObservationIds = input.inputObservations.flatMap((row) =>
    row.sourceRefs.map((ref) => ref.observationId),
  );

  const lineage = buildFeatureLineage({
    definition: input.definition,
    parentLineageIds,
    parentLineageHashes,
    revisionId: input.revisionId,
    sourceObservationIds,
    valueCanonical: valueCanon,
  });

  const qualityState = deriveFeatureQualityFromInputs(input.inputObservations);
  const { state: entitlementState, entitlementClass } = deriveFeatureEntitlementFromInputs(input.inputObservations);

  const sourceRefs = Object.freeze(
    input.inputObservations.flatMap((row) => row.sourceRefs),
  );

  let sourcePublishedTime = input.inputObservations[0]!.sourcePublishedTime;
  let providerAvailabilityTime = input.inputObservations[0]!.providerAvailabilityTime;
  let sunreyArrivalTime = input.inputObservations[0]!.sunreyArrivalTime;
  for (const row of input.inputObservations) {
    if (row.sourcePublishedTime) {
      if (!sourcePublishedTime || Date.parse(row.sourcePublishedTime) > Date.parse(sourcePublishedTime)) {
        sourcePublishedTime = row.sourcePublishedTime;
      }
    }
    if (row.providerAvailabilityTime) {
      if (
        !providerAvailabilityTime ||
        Date.parse(row.providerAvailabilityTime) > Date.parse(providerAvailabilityTime)
      ) {
        providerAvailabilityTime = row.providerAvailabilityTime;
      }
    }
    if (Date.parse(row.sunreyArrivalTime) > Date.parse(sunreyArrivalTime)) {
      sunreyArrivalTime = row.sunreyArrivalTime;
    }
  }

  const observation: FeatureObservation = Object.freeze({
    schemaVersion: HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA,
    featureObservationId: featureObservationId(input.definition.featureId, input.revisionId, lineage.lineageId),
    featureId: input.definition.featureId,
    featureVersion: input.definition.featureVersion,
    canonicalEntityId: input.canonicalEntityId,
    canonicalInstrumentId: input.canonicalInstrumentId ?? null,
    value,
    valueType: input.definition.valueKind,
    unit: input.definition.unit,
    eventTime: input.eventTime,
    sourcePublishedTime,
    providerAvailabilityTime,
    sunreyArrivalTime,
    knowableAt,
    computedAt: input.computedAt,
    validFrom: input.validFrom,
    validTo: input.validTo ?? null,
    revisionId: input.revisionId,
    sourceRefs,
    evidenceRefs: Object.freeze(input.inputObservations.flatMap((row) => [...row.evidenceRefs])),
    entitlementState,
    entitlementClass,
    qualityState,
    quality: featureQualityRecord(qualityState),
    confidence: (
      input.inputObservations.reduce((sum, row) => sum + Number(row.confidence), 0) / input.inputObservations.length
    ).toFixed(4),
    transformationVersion: input.definition.transformationVersion,
    transformationParameters: input.definition.transformationParameters,
    sourceIndependenceState: input.inputObservations[0]!.sourceIndependenceState,
    lineage,
    lineageHash: lineage.contentFingerprint,
    computation: Object.freeze({
      computationId: `${input.definition.featureId}.derived`,
      computeKind: input.definition.featureFamily === 'CROSS_ASSET' ? 'CROSS_ASSET' : 'DERIVED',
      inputFeatureIds: Object.freeze(input.inputObservations.map((row) => row.featureId)),
      inputLineageHashes: Object.freeze(parentLineageHashes),
      transformationVersion: input.definition.transformationVersion,
    }),
    grantsExecutionAuthority: false,
  });

  return { ok: true, observation };
}
