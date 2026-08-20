/**
 * Production-candidate base GPUV schedule schema.
 *
 * No default production GPUV values are populated. A schedule exists
 * only when an externally supplied governed candidate is passed.
 * Test fixtures are REHEARSAL_ONLY.
 */

import { encodeString, sha256Hex } from '../../../../validators/canonical.ts';
import type { ClaimType, ProductiveCategory } from '../../../types.ts';
import type { RealizationState } from '../types.ts';
import { CATEGORY_UNIT_BINDINGS } from './bindings.ts';
import {
  PRODUCTION_CANDIDATE_DOMAIN,
  VALUE_UNCONFIGURED,
  productionCandidateOk,
  productionCandidateRefuse,
  type ProductiveBaseValueScheduleCandidate,
  type ProductionCandidateResult,
  type ProductionCandidateSourceClass,
} from './types.ts';

export const PRODUCTION_BASE_VALUE_SCHEDULE_CANDIDATE_ID = 'moonrey.productive-base-value.production-candidate.v1' as const;

export function hashBaseValueScheduleCandidate(
  schedule: Omit<ProductiveBaseValueScheduleCandidate, 'scheduleHash'> | ProductiveBaseValueScheduleCandidate,
): string {
  const { scheduleHash: _ignored, ...rest } = schedule as ProductiveBaseValueScheduleCandidate;
  void _ignored;
  return sha256Hex(encodeString(`${PRODUCTION_CANDIDATE_DOMAIN}|schedule|${stable(rest)}`));
}

export function emptyProductionBaseValueSchedules(): readonly ProductiveBaseValueScheduleCandidate[] {
  return Object.freeze([]);
}

export function productionBaseGpuvStatus(): typeof VALUE_UNCONFIGURED {
  return VALUE_UNCONFIGURED;
}

export function createBaseValueScheduleCandidate(input: {
  readonly scheduleId?: string;
  readonly version?: number;
  readonly productiveCategory: ProductiveCategory;
  readonly factType?: ProductiveBaseValueScheduleCandidate['factType'];
  readonly canonicalUnit: string;
  readonly semanticQualifier: string;
  readonly claimType: ClaimType;
  readonly realizationState: RealizationState;
  readonly baseGpuvNumerator: bigint;
  readonly baseGpuvDenominator: bigint;
  readonly jurisdictionPolicyRef?: string;
  readonly referenceMethodologyRef: string;
  readonly governanceReference: string;
  readonly sourceClass: ProductionCandidateSourceClass;
  readonly fixture: boolean;
  readonly effectiveHeightCandidate?: number;
  readonly supersededHeightCandidate?: number | null;
}): ProductionCandidateResult<ProductiveBaseValueScheduleCandidate> {
  if (typeof input.baseGpuvNumerator !== 'bigint' || typeof input.baseGpuvDenominator !== 'bigint') {
    return productionCandidateRefuse('FLOAT_MATH_FORBIDDEN', 'base GPUV values must be exact bigint rationals');
  }
  if (input.baseGpuvDenominator === 0n) {
    return productionCandidateRefuse('DENOMINATOR_ZERO', 'base GPUV denominator cannot be zero');
  }
  if (input.baseGpuvDenominator < 0n || input.baseGpuvNumerator < 0n) {
    return productionCandidateRefuse('FLOAT_MATH_FORBIDDEN', 'base GPUV rational must be non-negative');
  }
  const binding = CATEGORY_UNIT_BINDINGS[input.productiveCategory];
  if (!binding.acceptedUnitAliases.includes(input.canonicalUnit)) {
    return productionCandidateRefuse(
      'INCOMPATIBLE_UNIT',
      `${input.canonicalUnit} is not a governed unit for ${input.productiveCategory}`,
    );
  }
  if (binding.semanticQualifier !== input.semanticQualifier) {
    return productionCandidateRefuse(
      'SEMANTIC_MISMATCH',
      `${input.semanticQualifier} does not match ${binding.semanticQualifier} for ${input.productiveCategory}`,
    );
  }
  if (input.productionActivated as unknown) {
    return productionCandidateRefuse('PRODUCTION_CANDIDATE_CANNOT_ACTIVATE', 'schedules cannot activate production');
  }
  const draft: Omit<ProductiveBaseValueScheduleCandidate, 'scheduleHash'> = {
    scheduleId: input.scheduleId ?? `${PRODUCTION_BASE_VALUE_SCHEDULE_CANDIDATE_ID}.${input.productiveCategory}`,
    version: input.version ?? 1,
    productiveCategory: input.productiveCategory,
    ...(input.factType === undefined ? {} : { factType: input.factType }),
    canonicalUnit: input.canonicalUnit,
    semanticQualifier: input.semanticQualifier,
    claimType: input.claimType,
    realizationState: input.realizationState,
    baseGpuvNumerator: input.baseGpuvNumerator,
    baseGpuvDenominator: input.baseGpuvDenominator,
    ...(input.jurisdictionPolicyRef === undefined ? {} : { jurisdictionPolicyRef: input.jurisdictionPolicyRef }),
    referenceMethodologyRef: input.referenceMethodologyRef,
    governanceReference: input.governanceReference,
    sourceClass: input.sourceClass,
    fixture: input.fixture,
    effectiveHeightCandidate: input.effectiveHeightCandidate ?? 1,
    supersededHeightCandidate: input.supersededHeightCandidate ?? null,
    productionActivated: false,
  };
  return productionCandidateOk(
    Object.freeze({
      ...draft,
      scheduleHash: hashBaseValueScheduleCandidate(draft),
    }),
  );
}

export function applyCandidateBaseValue(
  quantity: bigint,
  schedule: ProductiveBaseValueScheduleCandidate,
): ProductionCandidateResult<bigint> {
  if (typeof quantity !== 'bigint') {
    return productionCandidateRefuse('FLOAT_MATH_FORBIDDEN', 'canonical quantity must be bigint');
  }
  if (schedule.baseGpuvDenominator === 0n) {
    return productionCandidateRefuse('DENOMINATOR_ZERO', 'base GPUV denominator cannot be zero');
  }
  if (schedule.productionActivated) {
    return productionCandidateRefuse('PRODUCTION_CANDIDATE_CANNOT_ACTIVATE', 'schedule must remain unactivated');
  }
  return productionCandidateOk((quantity * schedule.baseGpuvNumerator) / schedule.baseGpuvDenominator);
}

function stable(value: unknown): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stable(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
