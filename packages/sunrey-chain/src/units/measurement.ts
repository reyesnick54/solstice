/**
 * Chunk 119 — CanonicalProductiveMeasurement.
 *
 * Physical measurement normalization only. This type never carries
 * economic category weights, quality multipliers, or MoonRey quantity.
 *
 * PHYSICAL MEASUREMENT NORMALIZATION
 *   != ECONOMIC VALUE WEIGHTING
 *   != MOONREY ISSUANCE
 */

import { err, ok, type Result } from '../../../domain/src/result.ts';
import { sha256Hex } from '../../../security/src/hash.ts';
import type { FactType } from '../oracle/types.ts';
import type { ClaimType, ProductiveCategory } from '../productive/types.ts';
import { measurementRefusal, type CanonicalMeasurementRefusal } from './codes.ts';
import {
  NORMALIZATION_CONSTITUTION_VERSION,
  TOKEN_INFERENCE_QUALIFIER,
  type MeasurementDimension,
  type ResourceClass,
  type SemanticQualifier,
} from './constitution.ts';
import { convertExact, lookupUnit, reproduceReceipt, resolveDurationSeconds } from './convert.ts';
import { exactQuantity, integerMantissaOf, quantitiesEqual } from './quantity.ts';
import type {
  ExactQuantity,
  NormalizationClock,
  NormalizationContext,
  NormalizationReceipt,
} from './types.ts';

export const CANONICAL_UNIT_AUTHORITY = 'packages/sunrey-chain/src/units' as const;
export const PHYSICAL_NORMALIZATION_INCLUDES_ECONOMIC_WEIGHTING = false;
export const NORMALIZATION_AUTHORIZES_MOONREY = false;
export const CANONICAL_MEASUREMENT_SCHEMA_VERSION = 1 as const;

export type CanonicalMeasurementPeriod = {
  readonly startUnix: bigint;
  readonly endUnix: bigint;
};

export type CanonicalProductiveMeasurement = {
  readonly schemaVersion: typeof CANONICAL_MEASUREMENT_SCHEMA_VERSION;
  readonly sourceQuantity: ExactQuantity;
  readonly sourceUnit: string;
  readonly canonicalQuantity: ExactQuantity;
  readonly canonicalUnit: string;
  readonly measurementDimension: MeasurementDimension;
  readonly semanticQualifier: SemanticQualifier;
  readonly productiveCategory: ProductiveCategory;
  readonly factType: FactType;
  readonly claimType: ClaimType | null;
  readonly normalizationReceiptId: string;
  readonly normalizationReceiptDigest: string;
  readonly normalizationConstitutionVersion: typeof NORMALIZATION_CONSTITUTION_VERSION;
  readonly measurementPeriod: CanonicalMeasurementPeriod | null;
  readonly contextRefs: readonly string[];
  readonly exact: true;
  readonly roundingApplied: false;
  readonly lossy: false;
  readonly receipt: NormalizationReceipt;
  readonly mappingId: string | null;
  readonly mappingVersion: number | null;
};

export type MeasureCanonicalInput = {
  readonly sourceQuantity: ExactQuantity;
  readonly productiveCategory: ProductiveCategory;
  readonly factType: FactType;
  readonly claimType?: ClaimType | null | undefined;
  readonly targetUnit?: string | undefined;
  readonly context?: NormalizationContext | undefined;
  readonly measurementPeriod?: CanonicalMeasurementPeriod | null | undefined;
  readonly extraContextRefs?: readonly string[] | undefined;
  readonly mappingId?: string | null | undefined;
  readonly mappingVersion?: number | null | undefined;
  readonly providedReceipt?: NormalizationReceipt | undefined;
  readonly substitutedCanonicalQuantity?: ExactQuantity | undefined;
  readonly clock?: NormalizationClock | undefined;
};

const DEFAULT_CLOCK: NormalizationClock = Object.freeze({
  nowIso: () => '2026-08-19T00:00:00.000Z',
});

export function receiptDigestOf(receipt: NormalizationReceipt): string {
  return sha256Hex(
    [
      'sunrey.normalization.receipt-digest.v1',
      receipt.receiptId,
      receipt.conversionVersion,
      receipt.sourceUnit,
      receipt.targetUnit,
      receipt.sourceQuantity.mantissa.toString(),
      receipt.sourceQuantity.denominator.toString(),
      receipt.targetQuantity.mantissa.toString(),
      receipt.targetQuantity.denominator.toString(),
      receipt.dimension,
      receipt.conversionRuleId,
    ].join('|'),
  );
}

export function resolveCanonicalTarget(
  sourceUnit: string,
  context: NormalizationContext,
): Result<string, CanonicalMeasurementRefusal> {
  const source = lookupUnit(sourceUnit);
  if (!source) {
    return err(measurementRefusal('CANONICAL_UNIT_REQUIRED', `unknown source unit ${sourceUnit}`));
  }
  if (context.factType === 'REFERENCE_PRICE') {
    return err(
      measurementRefusal(
        'FACT_UNIT_MISMATCH',
        'REFERENCE_PRICE cannot be normalized into a productive-output quantity',
      ),
    );
  }
  if (source.dimension === 'MACHINE_TIME' && context.productiveCategory === 'AUTOMATED_MACHINE_OUTPUT') {
    return err(
      measurementRefusal(
        'CLAIM_UNIT_MISMATCH',
        'machine_h is usage/capacity time and cannot become UNIT output',
      ),
    );
  }
  if (source.dimension === 'GENERIC_COMPUTE_TIME') {
    if (context.resourceClass === undefined) {
      return err(
        measurementRefusal(
          'NORMALIZATION_CONTEXT_REQUIRED',
          'compute_s requires resource classification before it can become CPU or GPU time',
        ),
      );
    }
    return ok(context.resourceClass === 'GPU' ? 'gpu_s' : 'cpu_s');
  }
  if (source.dimension === 'AREA') {
    const duration = resolveDurationSeconds(context);
    if (!duration.ok) {
      return err(
        measurementRefusal('NORMALIZATION_CONTEXT_REQUIRED', 'm2 → real-estate area-time requires duration'),
      );
    }
    return ok(source.canonicalBaseUnit === 'm2' ? 'm2_s' : source.canonicalBaseUnit);
  }
  if (source.dimension === 'VOLUME' && context.productiveCategory === 'STORAGE') {
    const duration = resolveDurationSeconds(context);
    if (!duration.ok) {
      return err(
        measurementRefusal('NORMALIZATION_CONTEXT_REQUIRED', 'm3 → storage volume-time requires duration'),
      );
    }
    return ok('L_s');
  }
  if (source.dimension === 'DATA_RATE') {
    const duration = resolveDurationSeconds(context);
    if (!duration.ok) {
      return err(
        measurementRefusal('NORMALIZATION_CONTEXT_REQUIRED', 'GB_s → transferred data volume requires duration'),
      );
    }
    return ok('B');
  }
  return ok(source.canonicalBaseUnit);
}

function bindSemantics(
  sourceUnit: string,
  targetUnit: string,
  context: NormalizationContext,
  claimType: ClaimType | null,
): Result<true, CanonicalMeasurementRefusal> {
  const source = lookupUnit(sourceUnit);
  const target = lookupUnit(targetUnit);
  if (!source || !target) {
    return err(measurementRefusal('CANONICAL_UNIT_REQUIRED', `unit is not in the Chunk 118 catalog`));
  }
  if (context.factType === 'REFERENCE_PRICE') {
    return err(
      measurementRefusal('FACT_UNIT_MISMATCH', 'REFERENCE_PRICE is not a productive measurement'),
    );
  }
  if (source.dimension === 'MACHINE_TIME' && target.dimension === 'ITEM_COUNT') {
    return err(
      measurementRefusal('CLAIM_UNIT_MISMATCH', 'machine_h cannot become UNIT output'),
    );
  }
  if (claimType === 'OUTPUT' && source.dimension === 'MACHINE_TIME' && target.dimension === 'ITEM_COUNT') {
    return err(measurementRefusal('CLAIM_UNIT_MISMATCH', 'machine time is not an item-output count'));
  }
  if (source.allowedFactTypes.length > 0 && context.factType !== undefined) {
    if (!source.allowedFactTypes.includes(context.factType)) {
      return err(
        measurementRefusal(
          'FACT_UNIT_MISMATCH',
          `${source.unitId} is not allowed for fact type ${context.factType}`,
        ),
      );
    }
  }
  if (source.allowedProductiveCategories.length > 0 && context.productiveCategory !== undefined) {
    if (!source.allowedProductiveCategories.includes(context.productiveCategory)) {
      return err(
        measurementRefusal(
          'CLAIM_UNIT_MISMATCH',
          `${source.unitId} is not allowed for productive category ${context.productiveCategory}`,
        ),
      );
    }
  }
  if (source.dimension === 'AI_TOKEN_COUNT') {
    const qualifier = context.semanticQualifier ?? source.semanticQualifier;
    if (qualifier !== TOKEN_INFERENCE_QUALIFIER) {
      return err(
        measurementRefusal(
          'NORMALIZATION_SEMANTIC_MISMATCH',
          `token_inference requires ${TOKEN_INFERENCE_QUALIFIER}`,
        ),
      );
    }
  }
  return ok(true);
}

function mapConversionRefusal(
  outcome: string,
  detail: string,
): CanonicalMeasurementRefusal {
  if (outcome === 'REQUIRE_CONTEXT') {
    return measurementRefusal('NORMALIZATION_CONTEXT_REQUIRED', detail);
  }
  if (outcome === 'INCOMPATIBLE_DIMENSION') {
    if (detail.includes('semantic') || detail.includes('qualifier') || detail.includes('token')) {
      return measurementRefusal('NORMALIZATION_SEMANTIC_MISMATCH', detail);
    }
    if (detail.includes('REFERENCE_PRICE')) {
      return measurementRefusal('FACT_UNIT_MISMATCH', detail);
    }
    if (detail.includes('machine_h') || detail.includes('UNIT') || detail.includes('item')) {
      return measurementRefusal('CLAIM_UNIT_MISMATCH', detail);
    }
    return measurementRefusal('NORMALIZATION_DIMENSION_MISMATCH', detail);
  }
  if (outcome === 'LOSSY_CONVERSION_FORBIDDEN') {
    return measurementRefusal('LOSSY_NORMALIZATION_FORBIDDEN', detail);
  }
  if (outcome === 'UNKNOWN_UNIT') {
    return measurementRefusal('CANONICAL_UNIT_REQUIRED', detail);
  }
  return measurementRefusal('CANONICAL_UNIT_REQUIRED', detail);
}

export function measureCanonical(
  input: MeasureCanonicalInput,
): Result<CanonicalProductiveMeasurement, CanonicalMeasurementRefusal> {
  if (input.substitutedCanonicalQuantity !== undefined && input.providedReceipt === undefined) {
    return err(
      measurementRefusal(
        'NORMALIZATION_RECEIPT_REQUIRED',
        'a caller-substituted canonical quantity requires the matching normalization receipt',
      ),
    );
  }
  const context: NormalizationContext = Object.freeze({
    ...input.context,
    factType: input.context?.factType ?? input.factType,
    productiveCategory: input.context?.productiveCategory ?? input.productiveCategory,
    semanticQualifier:
      input.context?.semanticQualifier ??
      lookupUnit(input.sourceQuantity.unitId)?.semanticQualifier,
  });
  const bound = bindSemantics(
    input.sourceQuantity.unitId,
    input.targetUnit ?? input.sourceQuantity.unitId,
    context,
    input.claimType ?? null,
  );
  if (!bound.ok && input.targetUnit !== undefined) {
    return bound;
  }
  const target =
    input.targetUnit !== undefined
      ? ok(input.targetUnit)
      : resolveCanonicalTarget(input.sourceQuantity.unitId, context);
  if (!target.ok) {
    return target;
  }
  const semantic = bindSemantics(input.sourceQuantity.unitId, target.value, context, input.claimType ?? null);
  if (!semantic.ok) {
    return semantic;
  }
  const converted = convertExact({
    source: input.sourceQuantity,
    targetUnitId: target.value,
    context,
    clock: input.clock ?? DEFAULT_CLOCK,
  });
  if (!converted.ok) {
    return err(mapConversionRefusal(converted.error.outcome, converted.error.detail));
  }
  const receipt = converted.value;
  if (input.providedReceipt) {
    if (input.providedReceipt.conversionVersion !== NORMALIZATION_CONSTITUTION_VERSION) {
      return err(
        measurementRefusal(
          'NORMALIZATION_VERSION_MISMATCH',
          `receipt ${input.providedReceipt.receiptId} uses ${input.providedReceipt.conversionVersion}`,
        ),
      );
    }
    const replayed = reproduceReceipt(input.providedReceipt, input.clock ?? DEFAULT_CLOCK);
    if (!replayed.ok) {
      return err(mapConversionRefusal(replayed.error.outcome, replayed.error.detail));
    }
    if (replayed.value.receiptId !== receipt.receiptId) {
      return err(
        measurementRefusal(
          'NORMALIZATION_RECEIPT_REQUIRED',
          'provided receipt does not match the source quantity and catalog conversion',
        ),
      );
    }
  }
  if (input.substitutedCanonicalQuantity !== undefined) {
    if (!quantitiesEqual(input.substitutedCanonicalQuantity, receipt.targetQuantity)) {
      return err(
        measurementRefusal(
          'NORMALIZATION_RECEIPT_REQUIRED',
          'substituted canonical quantity does not match the sealed receipt',
        ),
      );
    }
  }
  const period =
    input.measurementPeriod ??
    (context.measurementStart !== undefined && context.measurementEnd !== undefined
      ? { startUnix: context.measurementStart, endUnix: context.measurementEnd }
      : null);
  const extra = input.extraContextRefs ?? [];
  const contextRefs = Object.freeze([...receipt.contextRefs, ...extra]);
  const qualifier =
    context.semanticQualifier ?? lookupUnit(receipt.targetUnit)?.semanticQualifier ?? 'UNQUALIFIED';
  return ok(
    Object.freeze({
      schemaVersion: CANONICAL_MEASUREMENT_SCHEMA_VERSION,
      sourceQuantity: receipt.sourceQuantity,
      sourceUnit: receipt.sourceUnit,
      canonicalQuantity: receipt.targetQuantity,
      canonicalUnit: receipt.targetUnit,
      measurementDimension: receipt.dimension,
      semanticQualifier: qualifier,
      productiveCategory: input.productiveCategory,
      factType: input.factType,
      claimType: input.claimType ?? null,
      normalizationReceiptId: receipt.receiptId,
      normalizationReceiptDigest: receiptDigestOf(receipt),
      normalizationConstitutionVersion: receipt.conversionVersion,
      measurementPeriod: period,
      contextRefs,
      exact: true,
      roundingApplied: false,
      lossy: false,
      receipt,
      mappingId: input.mappingId ?? null,
      mappingVersion: input.mappingVersion ?? null,
    }),
  );
}

export function exactFromFixed(input: {
  readonly mantissa: bigint;
  readonly scale?: number;
  readonly unitId: string;
}): Result<ExactQuantity, CanonicalMeasurementRefusal> {
  const built = exactQuantity({
    mantissa: input.mantissa,
    scale: input.scale ?? 0,
    unitId: input.unitId,
  });
  if (!built.ok) {
    return err(mapConversionRefusal(built.error.outcome, built.error.detail));
  }
  return built;
}

export function integralCanonicalQuantity(
  measurement: CanonicalProductiveMeasurement,
): Result<bigint, CanonicalMeasurementRefusal> {
  const integer = integerMantissaOf(measurement.canonicalQuantity);
  if (!integer.ok) {
    return err(measurementRefusal('LOSSY_NORMALIZATION_FORBIDDEN', integer.error.detail));
  }
  return integer;
}

export function measurementHasNoEconomicWeighting(measurement: CanonicalProductiveMeasurement): true {
  void measurement;
  void PHYSICAL_NORMALIZATION_INCLUDES_ECONOMIC_WEIGHTING;
  return true;
}

export function measurementDoesNotAuthorizeMoonRey(measurement: CanonicalProductiveMeasurement): true {
  void measurement;
  void NORMALIZATION_AUTHORIZES_MOONREY;
  return true;
}

export function isResourceClass(value: string): value is ResourceClass {
  return value === 'CPU' || value === 'GPU';
}
