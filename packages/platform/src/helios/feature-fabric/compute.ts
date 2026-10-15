/**
 * Feature computation from HELIOS observation contributions.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { deriveFeatureEntitlement } from './entitlement.ts';
import { maxKnowableAt, rejectAnyFutureContribution } from './knowable-at.ts';
import { buildFeatureLineage } from './lineage.ts';
import { deriveFeatureQuality, deriveSourceIndependence } from './quality.ts';
import {
  HELIOS_FEATURE_FABRIC_SCHEMA,
  type ComputeFeatureInput,
  type ComputeFeatureResult,
  type FeatureObservation,
  type FeatureSourceRef,
  type FeatureValue,
} from './types.ts';

function featureObservationId(
  featureId: string,
  revisionId: string,
  lineageId: string,
): string {
  return `featobs.${featureId}.${revisionId}.${lineageId}`;
}

function valueFromContributions(
  definition: ComputeFeatureInput['definition'],
  contributions: ComputeFeatureInput['contributions'],
): FeatureValue {
  if (definition.valueKind === 'integer_minor') {
    const total = contributions.reduce(
      (sum, row) => sum + (row.numericValueMinor ?? 0n),
      0n,
    );
    return Object.freeze({
      kind: 'integer_minor',
      unit: definition.unit,
      decimal: null,
      integerMinor: total.toString(),
      boolean: null,
      text: null,
    });
  }
  if (definition.valueKind === 'decimal') {
    const total = contributions.reduce(
      (sum, row) => sum + (row.numericValueMinor ?? 0n),
      0n,
    );
    return Object.freeze({
      kind: 'decimal',
      unit: definition.unit,
      decimal: (Number(total) / 100).toFixed(4),
      integerMinor: null,
      boolean: null,
      text: null,
    });
  }
  return Object.freeze({
    kind: definition.valueKind,
    unit: definition.unit,
    decimal: null,
    integerMinor: null,
    boolean: null,
    text: null,
  });
}

function valueCanonical(value: FeatureValue): string {
  return JSON.stringify(value);
}

export function computeFeatureObservation(input: ComputeFeatureInput): ComputeFeatureResult {
  const { definition, contributions } = input;
  if (contributions.length === 0) {
    return { ok: false, code: 'NO_CONTRIBUTIONS', message: 'at least one source observation required' };
  }

  if (input.evaluationTimeForVisibility) {
    const future = rejectAnyFutureContribution(input.evaluationTimeForVisibility, contributions);
    if (!future.ok) {
      return future;
    }
  }

  const knowableAt = maxKnowableAt(contributions);
  const sourceIndependence = deriveSourceIndependence(contributions);
  const qualityState = deriveFeatureQuality(contributions, sourceIndependence);
  const { state: entitlementState, entitlementClass } = deriveFeatureEntitlement(contributions);
  const value = valueFromContributions(definition, contributions);
  const valueCanon = valueCanonical(value);

  const sourceObservationRefs: FeatureSourceRef[] = contributions.map((row) =>
    Object.freeze({
      observationId: row.observationId,
      knowableAt: row.informationTime.knowableAt,
      evidenceRef: row.evidenceRef,
    }),
  );

  const lineage = buildFeatureLineage({
    definition,
    parentLineageIds: Object.freeze([]),
    revisionId: input.revisionId,
    sourceObservationIds: contributions.map((row) => row.observationId),
    valueCanonical: valueCanon,
  });

  const observation: FeatureObservation = Object.freeze({
    schemaVersion: HELIOS_FEATURE_FABRIC_SCHEMA,
    featureObservationId: featureObservationId(definition.featureId, input.revisionId, lineage.lineageId),
    featureId: definition.featureId,
    featureVersion: definition.featureVersion,
    canonicalEntityId: input.canonicalEntityId,
    canonicalInstrumentId: input.canonicalInstrumentId ?? null,
    value,
    sourceObservationRefs: Object.freeze(sourceObservationRefs),
    evidenceRefs: Object.freeze(
      contributions.map((row) => row.evidenceRef).filter((ref): ref is string => ref !== null),
    ),
    eventTime: input.eventTime,
    knowableAt,
    computedAt: input.computedAt,
    validFrom: input.validFrom,
    validTo: input.validTo ?? null,
    revisionId: input.revisionId,
    qualityState,
    entitlementState,
    entitlementClass,
    lineage,
    transformationVersion: definition.transformationVersion,
    transformationParameters: definition.transformationParameters,
    sourceIndependenceState: sourceIndependence,
    grantsExecutionAuthority: false,
  });

  return { ok: true, observation };
}

export function recomputeFeatureObservation(
  input: ComputeFeatureInput,
  prior: FeatureObservation,
): ComputeFeatureResult {
  const next = computeFeatureObservation(input);
  if (!next.ok) {
    return next;
  }
  if (
    prior.lineage.contentFingerprint === next.observation.lineage.contentFingerprint &&
    prior.transformationVersion === next.observation.transformationVersion
  ) {
    return Object.freeze({
      ok: true,
      observation: Object.freeze({
        ...next.observation,
        featureObservationId: prior.featureObservationId,
        lineage: prior.lineage,
      }),
    });
  }
  return next;
}

export function selectFeatureRevisionAt(
  observations: readonly FeatureObservation[],
  evaluationTime: UtcInstant,
  featureId: string,
): FeatureObservation | undefined {
  const visible = observations
    .filter(
      (row) =>
        row.featureId === featureId && Date.parse(row.knowableAt) <= Date.parse(evaluationTime),
    )
    .sort((a, b) => Date.parse(b.knowableAt) - Date.parse(a.knowableAt));
  return visible[0];
}
