/**
 * Chunk 119 — oracle / fact / claim measurement adapters.
 *
 * Original source quantities are preserved. These helpers only attach a
 * derived CanonicalProductiveMeasurement and its receipt.
 */

import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { FactType, OracleObservation, VerifiedEconomicFact } from '../oracle/types.ts';
import type { CanonicalCollectedObservation } from '../oracle/production/types.ts';
import type { ClaimType, MeasurementPeriod, ProductiveCategory } from '../productive/types.ts';
import { measurementRefusal, type CanonicalMeasurementRefusal } from './codes.ts';
import {
  exactFromFixed,
  measureCanonical,
  type CanonicalProductiveMeasurement,
} from './measurement.ts';
import type { ResourceClass } from './constitution.ts';
import type { NormalizationClock, NormalizationContext } from './types.ts';

export type ObservationMeasurementInput = {
  readonly sourceUnit: string;
  readonly sourceMantissa: bigint;
  readonly sourceScale?: number;
  readonly productiveCategory: ProductiveCategory;
  readonly factType: FactType;
  readonly claimType?: ClaimType | null;
  readonly measurementStart?: bigint;
  readonly measurementEnd?: bigint;
  readonly durationSeconds?: bigint;
  readonly resourceClass?: ResourceClass;
  readonly mappingId?: string | null;
  readonly mappingVersion?: number | null;
  readonly clock?: NormalizationClock;
};

export function measureSourceObservation(
  input: ObservationMeasurementInput,
): Result<CanonicalProductiveMeasurement, CanonicalMeasurementRefusal> {
  const source = exactFromFixed({
    mantissa: input.sourceMantissa,
    scale: input.sourceScale,
    unitId: input.sourceUnit,
  });
  if (!source.ok) {
    return source;
  }
  const context: NormalizationContext = Object.freeze({
    measurementStart: input.measurementStart,
    measurementEnd: input.measurementEnd,
    durationSeconds: input.durationSeconds,
    resourceClass: input.resourceClass,
    factType: input.factType,
    productiveCategory: input.productiveCategory,
  });
  return measureCanonical({
    sourceQuantity: source.value,
    productiveCategory: input.productiveCategory,
    factType: input.factType,
    claimType: input.claimType,
    context,
    measurementPeriod:
      input.measurementStart !== undefined && input.measurementEnd !== undefined
        ? { startUnix: input.measurementStart, endUnix: input.measurementEnd }
        : null,
    mappingId: input.mappingId,
    mappingVersion: input.mappingVersion,
    clock: input.clock,
  });
}

export function measureOracleObservation(
  observation: OracleObservation,
  input: {
    readonly productiveCategory: ProductiveCategory;
    readonly factType: FactType;
    readonly claimType?: ClaimType | null;
    readonly resourceClass?: ResourceClass;
    readonly mappingId?: string | null;
    readonly mappingVersion?: number | null;
    readonly clock?: NormalizationClock;
  },
): Result<CanonicalProductiveMeasurement, CanonicalMeasurementRefusal> {
  return measureSourceObservation({
    sourceUnit: observation.value.unit,
    sourceMantissa: observation.value.mantissa,
    sourceScale: observation.value.scale,
    productiveCategory: input.productiveCategory,
    factType: input.factType,
    claimType: input.claimType,
    measurementStart: observation.measurementStartUnix,
    measurementEnd: observation.measurementEndUnix,
    resourceClass: input.resourceClass,
    mappingId: input.mappingId,
    mappingVersion: input.mappingVersion,
    clock: input.clock,
  });
}

export function measureVerifiedFact(
  fact: VerifiedEconomicFact,
  input: {
    readonly productiveCategory: ProductiveCategory;
    readonly factType: FactType;
    readonly claimType?: ClaimType | null;
    readonly resourceClass?: ResourceClass;
    readonly mappingId?: string | null;
    readonly mappingVersion?: number | null;
    readonly period?: MeasurementPeriod | null;
    readonly clock?: NormalizationClock;
  },
): Result<CanonicalProductiveMeasurement, CanonicalMeasurementRefusal> {
  return measureSourceObservation({
    sourceUnit: fact.aggregatedValue.unit,
    sourceMantissa: fact.aggregatedValue.mantissa,
    sourceScale: fact.aggregatedValue.scale,
    productiveCategory: input.productiveCategory,
    factType: input.factType,
    claimType: input.claimType,
    measurementStart: input.period?.validFromUnixSeconds ?? fact.observationWindow.startUnix,
    measurementEnd: input.period?.validUntilUnixSeconds ?? fact.observationWindow.endUnix,
    resourceClass: input.resourceClass,
    mappingId: input.mappingId,
    mappingVersion: input.mappingVersion,
    clock: input.clock,
  });
}

export function attachMeasurementToCollected(
  collected: CanonicalCollectedObservation,
  measurement: CanonicalProductiveMeasurement,
): CanonicalCollectedObservation & {
  readonly sourceValue: CanonicalCollectedObservation['value'];
  readonly canonicalMeasurement: CanonicalProductiveMeasurement;
} {
  return Object.freeze({
    ...collected,
    sourceValue: collected.value,
    canonicalMeasurement: measurement,
  });
}

export function originalObservationPreserved(
  original: { readonly mantissa: bigint; readonly unit: string },
  measurement: CanonicalProductiveMeasurement,
): boolean {
  return (
    measurement.sourceQuantity.mantissa === original.mantissa &&
    measurement.sourceUnit === original.unit
  );
}

export function requireMeasurement(
  measurement: CanonicalProductiveMeasurement | undefined | null,
): Result<CanonicalProductiveMeasurement, CanonicalMeasurementRefusal> {
  if (!measurement) {
    return err(measurementRefusal('CANONICAL_UNIT_REQUIRED', 'canonical productive measurement is required'));
  }
  return ok(measurement);
}
