/**
 * Productive Value Function engine result and immutable history.
 *
 * A result is a simulation valuation in GPUV. It is not a MoonRey
 * quantity, mint authority, or Execution Authority. Historic results
 * are never overwritten.
 */

import { sha256Hex } from '../../../../../security/src/hash.ts';
import {
  PRODUCTIVE_VALUE_ENGINE_SCHEMA_VERSION,
  PRODUCTIVE_VALUE_FUNCTION_DOMAIN,
} from './constitution.ts';
import {
  PRODUCTIVE_VALUE_UNIT_ID,
  valueFunctionOk,
  valueFunctionRefuse,
  type ExactRational,
  type RealizationState,
  type ValueFactorType,
  type ValueFunctionResult,
  type ValuePipelineStage,
  type ValueResultState,
} from './types.ts';
import type { ClaimType, ProductiveCategory } from '../../types.ts';

export const PRODUCTIVE_VALUE_RESULT_SCHEMA_VERSION = PRODUCTIVE_VALUE_ENGINE_SCHEMA_VERSION;

export type FactorApplicationRecord = {
  readonly factorType: ValueFactorType;
  readonly value: bigint;
  readonly treatment: 'EVALUATED' | 'DISABLED_NEUTRAL' | 'NOT_REQUIRED_NEUTRAL';
  readonly evidenceRefs: readonly string[];
};

export type ProductiveValueResult = {
  readonly valueId: string;
  readonly schemaVersion: typeof PRODUCTIVE_VALUE_RESULT_SCHEMA_VERSION;
  readonly contributionId: string;
  readonly contributionFingerprint: string;
  readonly claimId: string;
  readonly eventId: string;
  readonly eventFingerprint: string;
  readonly objectId: string;
  readonly category: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly realizationState: RealizationState;
  readonly normalizationReceiptId: string;
  readonly normalizationConstitutionVersion: string;
  readonly canonicalMeasurementUnit: string;
  readonly canonicalMeasurementQuantity: bigint;
  readonly baseValueScheduleId: string;
  readonly baseValueScheduleVersion: number;
  readonly baseProductiveValue: bigint;
  readonly factorApplications: readonly FactorApplicationRecord[];
  readonly aggregateFactor: bigint;
  readonly attributionDecisionId: string;
  readonly attributionPolicyVersion: string;
  readonly attributionShare: ExactRational;
  readonly preAttributionValue: bigint;
  readonly finalProductiveValue: bigint;
  readonly valueUnit: typeof PRODUCTIVE_VALUE_UNIT_ID;
  readonly valueFunctionPolicyId: string;
  readonly valueFunctionPolicyVersion: number;
  readonly referenceFactIds: readonly string[];
  readonly jurisdiction: string;
  readonly geography: { readonly geographyId: string; readonly jurisdiction: string };
  readonly valueDigest: string;
  readonly evaluatedAt: string;
  readonly state: ValueResultState;
  readonly isPhysicalUnit: false;
  readonly isFiatValue: false;
  readonly isMarketPrice: false;
  readonly isMoonReyQuantity: false;
  readonly createsMintAuthority: false;
  readonly createsExecutionAuthority: false;
  readonly productionEligible: false;
  readonly supersedesValueId?: string;
  readonly revaluationReason?: string;
  readonly priorPolicyVersion?: number;
  readonly newPolicyVersion?: number;
};

export type ProductiveValueOutcome = {
  readonly state: ValueResultState;
  readonly result: ProductiveValueResult | null;
  readonly code?: string;
  readonly detail?: string;
  readonly pipeline: readonly PipelineTrace[];
};

export type PipelineTrace = {
  readonly stage: ValuePipelineStage;
  readonly status: 'PASSED' | 'REVIEW' | 'REJECTED';
  readonly note: string;
};

export function digestProductiveValueResult(
  result: Omit<ProductiveValueResult, 'valueDigest' | 'valueId'> | ProductiveValueResult,
): string {
  const { valueDigest: _ignoredDigest, valueId: _ignoredId, ...rest } = result as ProductiveValueResult;
  void _ignoredDigest;
  void _ignoredId;
  return sha256Hex(`${PRODUCTIVE_VALUE_FUNCTION_DOMAIN}|value|${stable(rest)}`);
}

export function valueIdFromDigest(digest: string): string {
  return `gpv.${digest.slice(0, 32)}`;
}

export function sealProductiveValueResult(
  draft: Omit<ProductiveValueResult, 'valueDigest' | 'valueId'>,
): ProductiveValueResult {
  const valueDigest = digestProductiveValueResult(draft);
  return Object.freeze({
    ...draft,
    valueId: valueIdFromDigest(valueDigest),
    valueDigest,
  });
}

export class ProductiveValueResultStore {
  private readonly results: ProductiveValueResult[] = [];

  get(valueId: string): ProductiveValueResult | undefined {
    return this.results.find((item) => item.valueId === valueId);
  }

  list(): readonly ProductiveValueResult[] {
    return [...this.results];
  }

  append(result: ProductiveValueResult): ValueFunctionResult<ProductiveValueResult> {
    const existing = this.get(result.valueId);
    if (existing) {
      if (existing.valueDigest !== result.valueDigest) {
        return valueFunctionRefuse('VALUE_RESULT_IMMUTABLE', `historic value ${result.valueId} cannot be overwritten`);
      }
      return valueFunctionOk(existing);
    }
    this.results.push(result);
    return valueFunctionOk(result);
  }
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
