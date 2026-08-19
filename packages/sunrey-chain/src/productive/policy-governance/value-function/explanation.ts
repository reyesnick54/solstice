/**
 * Explainability receipt for a Productive Value evaluation.
 *
 * A reviewer can reconstruct why a GPUV figure was produced without
 * seeing provider secrets or raw payloads.
 */

import { sha256Hex } from '../../../../../security/src/hash.ts';
import { PRODUCTIVE_VALUE_FUNCTION_DOMAIN } from './constitution.ts';
import type { ProductiveBaseValueScheduleEntry } from './basis.ts';
import type { FactorApplicationRecord, PipelineTrace, ProductiveValueResult } from './result.ts';
import type { ExactRational, ValueFactorType } from './types.ts';
import type { RoundingMode } from '../../types.ts';

export type ProductiveValueExplanationReceipt = {
  readonly receiptId: string;
  readonly valueId: string;
  readonly physicalMeasurement: {
    readonly sourceUnit: string;
    readonly canonicalUnit: string;
    readonly canonicalQuantity: string;
    readonly normalizationReceiptId: string;
    readonly normalizationConstitutionVersion: string;
  };
  readonly economicEvent: {
    readonly eventId: string;
    readonly eventFingerprint: string;
    readonly category: string;
    readonly objectId: string;
  };
  readonly attribution: {
    readonly decisionId: string;
    readonly shareNumerator: string;
    readonly shareDenominator: string;
    readonly policyVersion: string;
  };
  readonly baseValueSchedule: {
    readonly scheduleId: string;
    readonly scheduleVersion: number;
    readonly entryId: string;
    readonly numerator: string;
    readonly denominator: string;
    readonly notes: string;
  };
  readonly factors: readonly {
    readonly factorType: ValueFactorType;
    readonly value: string;
    readonly treatment: FactorApplicationRecord['treatment'];
    readonly evidenceRefs: readonly string[];
  }[];
  readonly referenceFactIds: readonly string[];
  readonly rounding: {
    readonly mode: RoundingMode;
    readonly documented: string;
  };
  readonly floorCeiling: {
    readonly aggregateFloor: string;
    readonly aggregateCeiling: string;
    readonly factorCapsApplied: true;
    readonly scarcityCeilingApplied: boolean;
  };
  readonly pipeline: readonly PipelineTrace[];
  readonly why: string;
  readonly secretsRedacted: true;
  readonly rawPayloadsExcluded: true;
};

export function buildExplanationReceipt(input: {
  readonly result: ProductiveValueResult;
  readonly sourceUnit: string;
  readonly scheduleEntry: ProductiveBaseValueScheduleEntry;
  readonly scheduleId: string;
  readonly scheduleVersion: number;
  readonly attributionShare: ExactRational;
  readonly rounding: RoundingMode;
  readonly aggregateFloor: bigint;
  readonly aggregateCeiling: bigint;
  readonly scarcityCeilingApplied: boolean;
  readonly pipeline: readonly PipelineTrace[];
  readonly why: string;
}): ProductiveValueExplanationReceipt {
  const factors = input.result.factorApplications.map((factor) =>
    Object.freeze({
      factorType: factor.factorType,
      value: factor.value.toString(),
      treatment: factor.treatment,
      evidenceRefs: factor.evidenceRefs,
    }),
  );
  const draft = {
    valueId: input.result.valueId,
    physicalMeasurement: Object.freeze({
      sourceUnit: input.sourceUnit,
      canonicalUnit: input.result.canonicalMeasurementUnit,
      canonicalQuantity: input.result.canonicalMeasurementQuantity.toString(),
      normalizationReceiptId: input.result.normalizationReceiptId,
      normalizationConstitutionVersion: input.result.normalizationConstitutionVersion,
    }),
    economicEvent: Object.freeze({
      eventId: input.result.eventId,
      eventFingerprint: input.result.eventFingerprint,
      category: input.result.category,
      objectId: input.result.objectId,
    }),
    attribution: Object.freeze({
      decisionId: input.result.attributionDecisionId,
      shareNumerator: input.attributionShare.numerator.toString(),
      shareDenominator: input.attributionShare.denominator.toString(),
      policyVersion: input.result.attributionPolicyVersion,
    }),
    baseValueSchedule: Object.freeze({
      scheduleId: input.scheduleId,
      scheduleVersion: input.scheduleVersion,
      entryId: input.scheduleEntry.entryId,
      numerator: input.scheduleEntry.baseValueNumerator.toString(),
      denominator: input.scheduleEntry.baseValueDenominator.toString(),
      notes: input.scheduleEntry.notes,
    }),
    factors: Object.freeze(factors),
    referenceFactIds: input.result.referenceFactIds,
    rounding: Object.freeze({
      mode: input.rounding,
      documented:
        'All economic arithmetic is bigint / exact rational. mulDiv applies the policy rounding mode at each scale division. Floor is the simulation default. No Number conversion is used for quantities, factors, or GPUV.',
    }),
    floorCeiling: Object.freeze({
      aggregateFloor: input.aggregateFloor.toString(),
      aggregateCeiling: input.aggregateCeiling.toString(),
      factorCapsApplied: true as const,
      scarcityCeilingApplied: input.scarcityCeilingApplied,
    }),
    pipeline: input.pipeline,
    why: input.why,
    secretsRedacted: true as const,
    rawPayloadsExcluded: true as const,
  };
  const receiptId = `gpx.${sha256Hex(`${PRODUCTIVE_VALUE_FUNCTION_DOMAIN}|explain|${input.result.valueDigest}`).slice(0, 32)}`;
  return Object.freeze({ receiptId, ...draft });
}
