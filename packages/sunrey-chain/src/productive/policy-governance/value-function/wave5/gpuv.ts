/**
 * Wave 5 — Formal GPUV (Governed Productive Value Unit) definition.
 *
 * GPUV measures governed productive economic value under a versioned
 * methodology. It is not MoonRey quantity, not market price, and not
 * fiat value unless a future governed policy explicitly says otherwise.
 */

import {
  PRODUCTIVE_VALUE_UNIT,
  PRODUCTIVE_VALUE_UNIT_ID,
  VALUE_FACTOR_SCALE,
} from '../types.ts';
import { PRODUCTIVE_VALUE_ENGINE_SCHEMA_VERSION } from '../constitution.ts';

export const GPUV_DEFINITION_ID = 'sunrey.gpuv.definition.v1' as const;
export const GPUV_DEFINITION_VERSION = '1' as const;
export const GPUV_PRECISION_SCALE = VALUE_FACTOR_SCALE;
export const GPUV_OUTPUT_UNIT = 'integer_minor_gpuv' as const;

/**
 * What GPUV measures: governed productive economic value derived from
 * verified physical production, normalized measurement, attribution,
 * and versioned factor composition under Chunk 123–124 policy.
 */
export const GPUV_MEASURES = Object.freeze({
  governedProductiveEconomicValue: true,
  verifiedPhysicalProduction: true,
  normalizedCanonicalMeasurement: true,
  attributedShareOfEventBasis: true,
  versionedFactorComposition: true,
});

/**
 * What GPUV does not measure.
 */
export const GPUV_DOES_NOT_MEASURE = Object.freeze({
  moonReyQuantity: true,
  exchangeMarketPrice: true,
  fiatValue: true,
  physicalUnitIdentity: true,
  guaranteedEconomicValue: true,
  peveHumanContributionScore: true,
  aiGeneratedOpinion: true,
});

export type GpuvDefinition = {
  readonly definitionId: typeof GPUV_DEFINITION_ID;
  readonly definitionVersion: typeof GPUV_DEFINITION_VERSION;
  readonly unitId: typeof PRODUCTIVE_VALUE_UNIT_ID;
  readonly unit: typeof PRODUCTIVE_VALUE_UNIT;
  readonly precision: {
    readonly scale: typeof GPUV_PRECISION_SCALE;
    readonly outputUnit: typeof GPUV_OUTPUT_UNIT;
    readonly math: 'bigint_exact_rational';
    readonly floatForbidden: true;
  };
  readonly measures: typeof GPUV_MEASURES;
  readonly doesNotMeasure: typeof GPUV_DOES_NOT_MEASURE;
  readonly engineSchemaVersion: typeof PRODUCTIVE_VALUE_ENGINE_SCHEMA_VERSION;
  readonly simulationOnly: true;
  readonly productionActivated: false;
};

export const GPUV_DEFINITION: GpuvDefinition = Object.freeze({
  definitionId: GPUV_DEFINITION_ID,
  definitionVersion: GPUV_DEFINITION_VERSION,
  unitId: PRODUCTIVE_VALUE_UNIT_ID,
  unit: PRODUCTIVE_VALUE_UNIT,
  precision: Object.freeze({
    scale: GPUV_PRECISION_SCALE,
    outputUnit: GPUV_OUTPUT_UNIT,
    math: 'bigint_exact_rational',
    floatForbidden: true,
  }),
  measures: GPUV_MEASURES,
  doesNotMeasure: GPUV_DOES_NOT_MEASURE,
  engineSchemaVersion: PRODUCTIVE_VALUE_ENGINE_SCHEMA_VERSION,
  simulationOnly: true,
  productionActivated: false,
});

export function gpuvQuantityFromProductiveValue(finalProductiveValue: bigint): bigint {
  return finalProductiveValue;
}
