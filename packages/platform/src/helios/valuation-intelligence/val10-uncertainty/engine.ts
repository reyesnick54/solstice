import type { UtcInstant } from '@solstice/domain';

import { VAL10_UNCERTAINTY_SCHEMA } from './taxonomy.ts';

export type ValuationUncertaintyInput = {
  readonly modelMedians: readonly number[];
  readonly waccShockBps: number;
  readonly baselineMedian: number;
  readonly shockedMedian: number;
};

export type ValuationUncertaintySurface = {
  readonly schema: typeof VAL10_UNCERTAINTY_SCHEMA;
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly crossModelDispersion: number;
  readonly valuationUncertainty: number;
  readonly fragility: number;
  readonly evidenceRef: string;
  readonly grantsExecutionAuthority: false;
  readonly researchOnly: true;
};

function coefficientOfVariation(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((acc, row) => acc + row, 0) / values.length;
  if (mean === 0) return 0;
  const variance =
    values.reduce((acc, row) => acc + (row - mean) ** 2, 0) / Math.max(values.length - 1, 1);
  return Math.sqrt(variance) / Math.abs(mean);
}

export function computeValuationUncertainty(input: {
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly surface: ValuationUncertaintyInput;
  readonly evidenceRef: string;
}): ValuationUncertaintySurface {
  const dispersion = coefficientOfVariation(input.surface.modelMedians);
  const waccSensitivity =
    input.surface.baselineMedian === 0
      ? 0
      : Math.abs(input.surface.shockedMedian - input.surface.baselineMedian) /
        Math.abs(input.surface.baselineMedian);
  const uncertainty = Math.min(1, dispersion * 0.65 + waccSensitivity * 0.35);
  const fragility = Math.min(1, waccSensitivity * 0.7 + dispersion * 0.3);
  return Object.freeze({
    schema: VAL10_UNCERTAINTY_SCHEMA,
    entityId: input.entityId,
    asOf: input.asOf,
    crossModelDispersion: dispersion,
    valuationUncertainty: uncertainty,
    fragility,
    evidenceRef: input.evidenceRef,
    grantsExecutionAuthority: false,
    researchOnly: true,
  });
}
