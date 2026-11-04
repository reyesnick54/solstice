/**
 * Standardized unexpected earnings (SUE) method implementations.
 */

import { isMarginOrRatioDimension, type EarningsSurpriseDimension } from './taxonomy.ts';
import type { ScaledSurprise } from './types.ts';

const SCALE = 10_000;

export function computeConsensusDispersionSue(input: {
  readonly actualMinor: bigint | null;
  readonly actualScaled: number | null;
  readonly expectedMinor: bigint | null;
  readonly expectedScaled: number | null;
  readonly dispersionMinor: bigint | null;
  readonly dispersionScaled: number | null;
  readonly dimension: EarningsSurpriseDimension;
}): { readonly standardizedScaled: ScaledSurprise | null; readonly rawDeltaMinor: bigint | null; readonly rawDeltaScaled: number | null } {
  if (isMarginOrRatioDimension(input.dimension)) {
    return scaledSue(
      input.actualScaled,
      input.expectedScaled,
      input.dispersionScaled,
      null,
      null,
    );
  }
  return minorSue(input.actualMinor, input.expectedMinor, input.dispersionMinor);
}

export function computePriceScaledSurprise(input: {
  readonly actualMinor: bigint | null;
  readonly expectedMinor: bigint | null;
  readonly preEventPriceMinor: bigint | null;
}): { readonly standardizedScaled: ScaledSurprise | null; readonly rawDeltaMinor: bigint | null } {
  if (
    input.actualMinor === null ||
    input.expectedMinor === null ||
    input.preEventPriceMinor === null ||
    input.preEventPriceMinor === 0n
  ) {
    return { standardizedScaled: null, rawDeltaMinor: null };
  }
  const delta = input.actualMinor - input.expectedMinor;
  const scaled = Number((delta * BigInt(SCALE)) / input.preEventPriceMinor);
  if (!Number.isFinite(scaled)) {
    return { standardizedScaled: null, rawDeltaMinor: delta };
  }
  return { standardizedScaled: scaled, rawDeltaMinor: delta };
}

export function computeHistoricalSeasonalSue(input: {
  readonly currentDeltaMinor: bigint | null;
  readonly historicalDeltasMinor: readonly bigint[];
}): { readonly standardizedScaled: ScaledSurprise | null; readonly rawDeltaMinor: bigint | null } {
  if (input.currentDeltaMinor === null || input.historicalDeltasMinor.length < 2) {
    return { standardizedScaled: null, rawDeltaMinor: input.currentDeltaMinor };
  }
  const values = input.historicalDeltasMinor.map((v) => Number(v));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / Math.max(values.length - 1, 1);
  const std = Math.sqrt(variance);
  if (!Number.isFinite(std) || std === 0) {
    return { standardizedScaled: null, rawDeltaMinor: input.currentDeltaMinor };
  }
  const z = (Number(input.currentDeltaMinor) - mean) / std;
  return { standardizedScaled: Math.round(z * SCALE), rawDeltaMinor: input.currentDeltaMinor };
}

export function computeRobustMedianSue(input: {
  readonly actualMinor: bigint | null;
  readonly actualScaled: number | null;
  readonly medianMinor: bigint | null;
  readonly medianScaled: number | null;
  readonly dispersionMinor: bigint | null;
  readonly dispersionScaled: number | null;
  readonly dimension: EarningsSurpriseDimension;
}): { readonly standardizedScaled: ScaledSurprise | null; readonly rawDeltaMinor: bigint | null; readonly rawDeltaScaled: number | null } {
  if (isMarginOrRatioDimension(input.dimension)) {
    return scaledSue(
      input.actualScaled,
      input.medianScaled,
      input.dispersionScaled,
      null,
      null,
    );
  }
  return minorSue(input.actualMinor, input.medianMinor, input.dispersionMinor);
}

export function computeGuidanceMidpointVsPrior(input: {
  readonly newMidMinor: bigint | null;
  readonly priorMidMinor: bigint | null;
}): { readonly standardizedScaled: ScaledSurprise | null; readonly rawDeltaMinor: bigint | null } {
  if (input.newMidMinor === null || input.priorMidMinor === null || input.priorMidMinor === 0n) {
    return { standardizedScaled: null, rawDeltaMinor: null };
  }
  const delta = input.newMidMinor - input.priorMidMinor;
  const scaled = Number((delta * BigInt(SCALE)) / absNonZero(input.priorMidMinor));
  return {
    standardizedScaled: Number.isFinite(scaled) ? scaled : null,
    rawDeltaMinor: delta,
  };
}

export function computeGuidanceMidpointVsConsensus(input: {
  readonly newMidMinor: bigint | null;
  readonly consensusMinor: bigint | null;
  readonly dispersionMinor: bigint | null;
}): ReturnType<typeof computeConsensusDispersionSue> {
  return computeConsensusDispersionSue({
    actualMinor: input.newMidMinor,
    actualScaled: null,
    expectedMinor: input.consensusMinor,
    expectedScaled: null,
    dispersionMinor: input.dispersionMinor,
    dispersionScaled: null,
    dimension: 'GUIDANCE',
  });
}

function minorSue(
  actualMinor: bigint | null,
  expectedMinor: bigint | null,
  dispersionMinor: bigint | null,
): { readonly standardizedScaled: ScaledSurprise | null; readonly rawDeltaMinor: bigint | null; readonly rawDeltaScaled: number | null } {
  if (actualMinor === null || expectedMinor === null || dispersionMinor === null || dispersionMinor === 0n) {
    return {
      standardizedScaled: null,
      rawDeltaMinor:
        actualMinor !== null && expectedMinor !== null ? actualMinor - expectedMinor : null,
      rawDeltaScaled: null,
    };
  }
  const delta = actualMinor - expectedMinor;
  const scaled = Number((delta * BigInt(SCALE)) / absNonZero(dispersionMinor));
  return {
    standardizedScaled: Number.isFinite(scaled) ? scaled : null,
    rawDeltaMinor: delta,
    rawDeltaScaled: null,
  };
}

function scaledSue(
  actualScaled: number | null,
  expectedScaled: number | null,
  dispersionScaled: number | null,
  rawDeltaMinor: bigint | null,
  rawDeltaScaled: number | null,
): { readonly standardizedScaled: ScaledSurprise | null; readonly rawDeltaMinor: bigint | null; readonly rawDeltaScaled: number | null } {
  if (
    actualScaled === null ||
    expectedScaled === null ||
    dispersionScaled === null ||
    dispersionScaled === 0
  ) {
    return {
      standardizedScaled: null,
      rawDeltaMinor,
      rawDeltaScaled:
        actualScaled !== null && expectedScaled !== null ? actualScaled - expectedScaled : rawDeltaScaled,
    };
  }
  const delta = actualScaled - expectedScaled;
  const z = delta / dispersionScaled;
  return {
    standardizedScaled: Number.isFinite(z) ? Math.round(z * SCALE) : null,
    rawDeltaMinor,
    rawDeltaScaled: delta,
  };
}

function absNonZero(value: bigint): bigint {
  const abs = value < 0n ? -value : value;
  return abs === 0n ? 1n : abs;
}
