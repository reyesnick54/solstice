/**
 * Production-candidate evaluation receipt.
 *
 * A receipt is explainability only. It is not a mint, Execution
 * Authority, or production activation.
 */

import { encodeString, sha256Hex } from '../../../../validators/canonical.ts';
import { applyCandidateBaseValue } from './schedule.ts';
import { validateProductionValueInput } from './validation.ts';
import {
  GPUV_DOES_NOT_GUARANTEE_ECONOMIC_VALUE,
  GPUV_EQUALS_MOONREY_BY_DEFINITION,
  GPUV_IS_NOT_FIAT,
  GPUV_IS_NOT_MARKET_PRICE,
  GPUV_IS_NOT_MOONREY,
  GPUV_IS_NOT_PHYSICAL_UNIT,
  PRODUCTION_ACTIVATED,
  PRODUCTION_CANDIDATE_DOMAIN,
  type MoonReyProductiveValuePolicyCandidate,
  type ProductionCandidateResult,
  type ProductionCandidateValueInput,
  type ProductiveBaseValueScheduleCandidate,
} from './types.ts';

export type ProductionCandidateValueReceipt = {
  readonly receiptId: string;
  readonly policyId: string;
  readonly policyHash: string;
  readonly scheduleId: string | null;
  readonly eventId: string;
  readonly contributionId: string;
  readonly gpuvQuantity: bigint | null;
  readonly gpuvUnit: 'GPUV';
  readonly valued: boolean;
  readonly fixture: boolean;
  readonly productionActivated: false;
  readonly canMint: false;
  readonly gpuvEqualsMoonReyByDefinition: false;
  readonly gpuvIsNotPhysicalUnit: true;
  readonly gpuvIsNotFiat: true;
  readonly gpuvIsNotMarketPrice: true;
  readonly gpuvIsNotMoonRey: true;
  readonly gpuvDoesNotGuaranteeEconomicValue: true;
};

export function evaluateProductionCandidateValue(
  input: ProductionCandidateValueInput,
  policy: MoonReyProductiveValuePolicyCandidate,
  schedule?: ProductiveBaseValueScheduleCandidate,
): ProductionCandidateResult<ProductionCandidateValueReceipt> {
  const validated = validateProductionValueInput(input, schedule);
  if (!validated.ok) {
    return validated;
  }
  const applied = applyCandidateBaseValue(input.canonicalQuantity, schedule!);
  if (!applied.ok) {
    return applied;
  }
  const share = input.availableAttributionShare!;
  const attributed = (applied.value * share.numerator) / share.denominator;
  const receipt = sealReceipt({
    policyId: policy.policyId,
    policyHash: policy.policyHash,
    scheduleId: schedule!.scheduleId,
    eventId: input.eventId,
    contributionId: input.contributionId,
    gpuvQuantity: attributed,
    fixture: policy.fixture || schedule!.fixture,
  });
  return { ok: true, value: receipt };
}

export function sealReceipt(input: {
  readonly policyId: string;
  readonly policyHash: string;
  readonly scheduleId: string | null;
  readonly eventId: string;
  readonly contributionId: string;
  readonly gpuvQuantity: bigint | null;
  readonly fixture: boolean;
}): ProductionCandidateValueReceipt {
  const body = {
    ...input,
    productionActivated: PRODUCTION_ACTIVATED,
    canMint: false as const,
    gpuvEqualsMoonReyByDefinition: GPUV_EQUALS_MOONREY_BY_DEFINITION,
    gpuvUnit: 'GPUV' as const,
    valued: input.gpuvQuantity !== null,
  };
  return Object.freeze({
    receiptId: sha256Hex(encodeString(`${PRODUCTION_CANDIDATE_DOMAIN}|receipt|${stable(body)}`)),
    policyId: input.policyId,
    policyHash: input.policyHash,
    scheduleId: input.scheduleId,
    eventId: input.eventId,
    contributionId: input.contributionId,
    gpuvQuantity: input.gpuvQuantity,
    gpuvUnit: 'GPUV',
    valued: input.gpuvQuantity !== null,
    fixture: input.fixture,
    productionActivated: false,
    canMint: false,
    gpuvEqualsMoonReyByDefinition: false,
    gpuvIsNotPhysicalUnit: GPUV_IS_NOT_PHYSICAL_UNIT,
    gpuvIsNotFiat: GPUV_IS_NOT_FIAT,
    gpuvIsNotMarketPrice: GPUV_IS_NOT_MARKET_PRICE,
    gpuvIsNotMoonRey: GPUV_IS_NOT_MOONREY,
    gpuvDoesNotGuaranteeEconomicValue: GPUV_DOES_NOT_GUARANTEE_ECONOMIC_VALUE,
  });
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
