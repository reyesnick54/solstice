/**
 * Wave 5 — ProductiveValuationResult and auditable ProductiveValueReceipt.
 */

import { sha256Hex } from '../../../../../../security/src/hash.ts';
import { PRODUCTIVE_VALUE_FUNCTION_DOMAIN } from '../constitution.ts';
import { PRODUCTIVE_VALUE_UNIT_ID, type ProductiveValueResult, type ValueResultState } from '../types.ts';
import type { ProductiveEconomicContribution } from './contribution.ts';
import { GPUV_DEFINITION, gpuvQuantityFromProductiveValue } from './gpuv.ts';
import type { MethodologyReference } from './methodology.ts';

export const PRODUCTIVE_VALUATION_RESULT_SCHEMA_VERSION = 'sunrey.productive-valuation-result.v1' as const;
export const PRODUCTIVE_VALUE_RECEIPT_SCHEMA_VERSION = 'sunrey.productive-value-receipt.v1' as const;

export type ProductiveValuationResult = {
  readonly schemaVersion: typeof PRODUCTIVE_VALUATION_RESULT_SCHEMA_VERSION;
  readonly valuationId: string;
  readonly productiveContributionId: string;
  readonly contributionFingerprint: string;
  readonly economicClaimId: string;
  readonly methodology: MethodologyReference;
  readonly inputQuantities: {
    readonly sourceQuantity: bigint;
    readonly sourceUnit: string;
    readonly normalizedQuantity: bigint;
    readonly canonicalUnit: string;
  };
  readonly normalizedProductiveValue: bigint;
  readonly gpuvQuantity: bigint;
  readonly gpuvUnit: typeof PRODUCTIVE_VALUE_UNIT_ID;
  readonly policyReference: {
    readonly policyId: string;
    readonly policyVersion: number;
    readonly policyContentHash: string;
  };
  readonly evidenceReferences: readonly string[];
  readonly resultHash: string;
  readonly simulationStatus: true;
  readonly productionStatus: false;
  readonly state: ValueResultState;
  readonly engineResult: ProductiveValueResult;
};

export type ProductiveValueReceipt = {
  readonly schemaVersion: typeof PRODUCTIVE_VALUE_RECEIPT_SCHEMA_VERSION;
  readonly valuationId: string;
  readonly productiveContribution: {
    readonly contributionId: string;
    readonly contributionFingerprint: string;
    readonly eventId: string;
    readonly eventFingerprint: string;
    readonly category: string;
  };
  readonly economicClaim: {
    readonly economicClaimId: string;
    readonly claimFingerprint: string;
  };
  readonly methodologyId: string;
  readonly methodologyVersion: number;
  readonly inputQuantities: ProductiveValuationResult['inputQuantities'];
  readonly normalizedProductiveValue: bigint;
  readonly gpuvQuantity: bigint;
  readonly gpuvDefinitionVersion: string;
  readonly policyReference: ProductiveValuationResult['policyReference'];
  readonly evidenceReferences: readonly string[];
  readonly resultHash: string;
  readonly simulationStatus: true;
  readonly productionStatus: false;
  readonly calculatedAtUtc: string;
};

export function valuationIdFromDigest(digest: string): string {
  return `pval.${digest.slice(0, 32)}`;
}

export function digestValuationResult(
  material: Omit<ProductiveValuationResult, 'valuationId' | 'resultHash'>,
): string {
  return sha256Hex(`${PRODUCTIVE_VALUE_FUNCTION_DOMAIN}|wave5-valuation|${stable(material)}`);
}

export function buildProductiveValuationResult(input: {
  readonly contribution: ProductiveEconomicContribution;
  readonly methodology: MethodologyReference;
  readonly engineResult: ProductiveValueResult;
  readonly evidenceReferences: readonly string[];
  readonly calculatedAtUtc: string;
}): ProductiveValuationResult {
  const draft: Omit<ProductiveValuationResult, 'valuationId' | 'resultHash'> = {
    schemaVersion: PRODUCTIVE_VALUATION_RESULT_SCHEMA_VERSION,
    productiveContributionId: input.contribution.contributionId,
    contributionFingerprint: input.contribution.contributionFingerprint,
    economicClaimId: input.contribution.economicClaim.economicClaimId,
    methodology: input.methodology,
    inputQuantities: Object.freeze({
      sourceQuantity: input.contribution.quantity,
      sourceUnit: input.contribution.unit,
      normalizedQuantity: input.contribution.normalizedQuantity,
      canonicalUnit: input.contribution.canonicalUnit,
    }),
    normalizedProductiveValue: input.engineResult.preAttributionValue,
    gpuvQuantity: gpuvQuantityFromProductiveValue(input.engineResult.finalProductiveValue),
    gpuvUnit: PRODUCTIVE_VALUE_UNIT_ID,
    policyReference: Object.freeze({
      policyId: input.methodology.policyId,
      policyVersion: input.methodology.policyVersion,
      policyContentHash: input.methodology.policyContentHash,
    }),
    evidenceReferences: Object.freeze([...input.evidenceReferences]),
    simulationStatus: true,
    productionStatus: false,
    state: input.engineResult.state,
    engineResult: input.engineResult,
  };
  const resultHash = digestValuationResult(draft);
  return Object.freeze({
    ...draft,
    valuationId: valuationIdFromDigest(resultHash),
    resultHash,
  });
}

export function buildProductiveValueReceipt(
  valuation: ProductiveValuationResult,
  contribution: ProductiveEconomicContribution,
  calculatedAtUtc: string,
): ProductiveValueReceipt {
  return Object.freeze({
    schemaVersion: PRODUCTIVE_VALUE_RECEIPT_SCHEMA_VERSION,
    valuationId: valuation.valuationId,
    productiveContribution: Object.freeze({
      contributionId: contribution.contributionId,
      contributionFingerprint: contribution.contributionFingerprint,
      eventId: contribution.canonicalEvent.eventId,
      eventFingerprint: contribution.canonicalEvent.eventFingerprint,
      category: contribution.category,
    }),
    economicClaim: Object.freeze({
      economicClaimId: contribution.economicClaim.economicClaimId,
      claimFingerprint: contribution.economicClaim.claimFingerprint,
    }),
    methodologyId: valuation.methodology.methodologyId,
    methodologyVersion: valuation.methodology.methodologyVersion,
    inputQuantities: valuation.inputQuantities,
    normalizedProductiveValue: valuation.normalizedProductiveValue,
    gpuvQuantity: valuation.gpuvQuantity,
    policyReference: valuation.policyReference,
    evidenceReferences: valuation.evidenceReferences,
    resultHash: valuation.resultHash,
    simulationStatus: true,
    productionStatus: false,
    calculatedAtUtc,
    gpuvDefinitionVersion: GPUV_DEFINITION.definitionVersion,
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
