/**
 * Universal feature computation from HELIOS observation contributions.
 */

import type { UtcInstant } from '@solstice/domain';
import { deriveFeatureEntitlement } from './entitlement.ts';
import {
  maxKnowableAt,
  rejectAnyFutureContribution,
} from './knowable-at.ts';
import { buildFeatureLineage } from './lineage.ts';
import {
  deriveFeatureQuality,
  deriveSourceIndependence,
  featureQualityRecord,
} from './quality.ts';
import { applyAlt02FeatureEntitlementGate } from '../alt02-entitlement-gate.ts';
import {
  HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA,
  type ComputeFeatureInput,
  type ComputeFeatureResult,
  type FeatureContributionInput,
  type FeatureObservation,
  type FeatureSourceReference,
  type FeatureValue,
} from './types.ts';

function featureObservationId(featureId: string, revisionId: string, lineageId: string): string {
  return `featobs.${featureId}.${revisionId}.${lineageId}`;
}

function valueFromContributions(
  definition: ComputeFeatureInput['definition'],
  contributions: ComputeFeatureInput['contributions'],
): FeatureValue {
  if (definition.valueKind === 'integer_minor') {
    const total = contributions.reduce((sum, row) => sum + (row.numericValueMinor ?? 0n), 0n);
    return Object.freeze({
      kind: 'integer_minor',
      unit: definition.unit,
      decimal: null,
      integerMinor: total.toString(),
      boolean: null,
      text: null,
    });
  }
  if (definition.valueKind === 'decimal' || definition.valueKind === 'ratio') {
    const total = contributions.reduce((sum, row) => sum + (row.numericValueMinor ?? 0n), 0n);
    return Object.freeze({
      kind: definition.valueKind,
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

function informationTimeBounds(contributions: readonly FeatureContributionInput[]): {
  readonly sourcePublishedTime: UtcInstant | null;
  readonly providerAvailabilityTime: UtcInstant | null;
  readonly sunreyArrivalTime: UtcInstant;
} {
  let published: UtcInstant | null = null;
  let availability: UtcInstant | null = null;
  let arrival = contributions[0]!.informationTime.sunreyArrivalTime;
  for (const row of contributions) {
    const info = row.informationTime;
    if (info.sourcePublishedTime) {
      if (!published || Date.parse(info.sourcePublishedTime) > Date.parse(published)) {
        published = info.sourcePublishedTime;
      }
    }
    if (info.providerAvailabilityTime) {
      if (!availability || Date.parse(info.providerAvailabilityTime) > Date.parse(availability)) {
        availability = info.providerAvailabilityTime;
      }
    }
    if (Date.parse(info.sunreyArrivalTime) > Date.parse(arrival)) {
      arrival = info.sunreyArrivalTime;
    }
  }
  return Object.freeze({ sourcePublishedTime: published, providerAvailabilityTime: availability, sunreyArrivalTime: arrival });
}

function sourceRefsFromContributions(contributions: readonly FeatureContributionInput[]): readonly FeatureSourceReference[] {
  return Object.freeze(
    contributions.map((row) =>
      Object.freeze({
        observationId: row.observationId,
        knowableAt: row.informationTime.knowableAt,
        evidenceRef: row.evidenceRef,
        revisionId: row.revisionId ?? null,
      }),
    ),
  );
}

function averageConfidence(contributions: readonly FeatureContributionInput[]): string {
  if (contributions.length === 0) {
    return '0';
  }
  let sum = 0;
  for (const row of contributions) {
    sum += Number(row.confidence ?? '1');
  }
  return (sum / contributions.length).toFixed(4);
}

export function buildFeatureObservationFromParts(input: {
  readonly definition: ComputeFeatureInput['definition'];
  readonly canonicalEntityId: string;
  readonly canonicalInstrumentId: string | null;
  readonly eventTime: UtcInstant;
  readonly computedAt: UtcInstant;
  readonly revisionId: string;
  readonly validFrom: UtcInstant;
  readonly validTo: UtcInstant | null;
  readonly contributions: readonly FeatureContributionInput[];
  readonly knowableAt: UtcInstant;
  readonly value: FeatureValue;
  readonly parentLineageIds?: readonly string[];
  readonly parentLineageHashes?: readonly string[];
  readonly computation?: ComputeFeatureInput['computation'];
}): FeatureObservation {
  const sourceIndependence = deriveSourceIndependence(input.contributions);
  const qualityState = deriveFeatureQuality(input.contributions, sourceIndependence);
  const { state: entitlementState, entitlementClass } = deriveFeatureEntitlement(input.contributions);
  const valueCanon = valueCanonical(input.value);
  const sourceRefs = sourceRefsFromContributions(input.contributions);
  const timeBounds = informationTimeBounds(input.contributions);

  const lineage = buildFeatureLineage({
    definition: input.definition,
    parentLineageIds: input.parentLineageIds ?? Object.freeze([]),
    ...(input.parentLineageHashes !== undefined ? { parentLineageHashes: input.parentLineageHashes } : {}),
    revisionId: input.revisionId,
    sourceObservationIds: input.contributions.map((row) => row.observationId),
    valueCanonical: valueCanon,
  });

  return Object.freeze({
    schemaVersion: HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA,
    featureObservationId: featureObservationId(input.definition.featureId, input.revisionId, lineage.lineageId),
    featureId: input.definition.featureId,
    featureVersion: input.definition.featureVersion,
    canonicalEntityId: input.canonicalEntityId,
    canonicalInstrumentId: input.canonicalInstrumentId,
    value: input.value,
    valueType: input.definition.valueKind,
    unit: input.definition.unit,
    eventTime: input.eventTime,
    sourcePublishedTime: timeBounds.sourcePublishedTime,
    providerAvailabilityTime: timeBounds.providerAvailabilityTime,
    sunreyArrivalTime: timeBounds.sunreyArrivalTime,
    knowableAt: input.knowableAt,
    computedAt: input.computedAt,
    validFrom: input.validFrom,
    validTo: input.validTo,
    revisionId: input.revisionId,
    sourceRefs,
    evidenceRefs: Object.freeze(
      input.contributions.map((row) => row.evidenceRef).filter((ref): ref is string => ref !== null),
    ),
    entitlementState,
    entitlementClass,
    qualityState,
    quality: featureQualityRecord(qualityState),
    confidence: averageConfidence(input.contributions),
    transformationVersion: input.definition.transformationVersion,
    transformationParameters: input.definition.transformationParameters,
    sourceIndependenceState: sourceIndependence,
    lineage,
    lineageHash: lineage.contentFingerprint,
    computation: input.computation ?? null,
    grantsExecutionAuthority: false,
  });
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

  if (input.alt02Gate) {
    const gate = applyAlt02FeatureEntitlementGate(input.alt02Gate);
    if (gate.blocked) {
      return Object.freeze({
        ok: false,
        code: 'ALT02_ENTITLEMENT_BLOCKED',
        message: `alternative-data feature blocked: ${gate.outcome}`,
      });
    }
  }

  const knowableAt = maxKnowableAt(contributions);
  const value = valueFromContributions(definition, contributions);

  const observation = buildFeatureObservationFromParts({
    definition,
    canonicalEntityId: input.canonicalEntityId,
    canonicalInstrumentId: input.canonicalInstrumentId ?? null,
    eventTime: input.eventTime,
    computedAt: input.computedAt,
    revisionId: input.revisionId,
    validFrom: input.validFrom,
    validTo: input.validTo ?? null,
    contributions,
    knowableAt,
    value,
    computation: input.computation ?? null,
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
        lineageHash: prior.lineageHash,
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
    .filter((row) => row.featureId === featureId && Date.parse(row.knowableAt) <= Date.parse(evaluationTime))
    .sort((a, b) => Date.parse(b.knowableAt) - Date.parse(a.knowableAt));
  return visible[0];
}
