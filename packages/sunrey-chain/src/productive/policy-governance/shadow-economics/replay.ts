/**
 * Historical receipts. Future policy changes must not rewrite history.
 */

import { createHash } from 'node:crypto';

import { evaluateIssuanceFormula } from '../../formula.ts';
import { V1_RECEIPT_SCHEMA, SHADOW_VALUE_RECEIPT_SCHEMA } from './identities.ts';
import type { HistoricV1Receipt, HistoricV2Receipt, MoonReyValuePathComparison } from './types.ts';
import { evaluateGovernedV2 } from './v2.ts';
import type { MoonReyShadowScenario } from './types.ts';

export function sealV1Receipt(input: Omit<HistoricV1Receipt, 'schema' | 'pathClass' | 'contentHash' | 'moonreyQuantity' | 'formulaVersion'>): HistoricV1Receipt {
  const evaluated = evaluateIssuanceFormula({
    eligibleQuantity: input.eligibleQuantity,
    categoryWeight: input.categoryWeight,
    claimTypeWeight: input.claimTypeWeight,
    qualityFactor: input.qualityFactor,
    roundingMode: input.roundingMode,
    maximumIssuance: input.maximumIssuance,
  });
  const draft: Omit<HistoricV1Receipt, 'contentHash'> = {
    schema: V1_RECEIPT_SCHEMA,
    pathClass: 'LEGACY_ENGINEERING_SIMULATION_V1',
    formulaVersion: 'moonrey.issuance.formula.v1',
    ...input,
    moonreyQuantity: evaluated.moonreyQuantity,
  };
  return Object.freeze({ ...draft, contentHash: hash(draft) });
}

export function replayV1Receipt(receipt: HistoricV1Receipt): HistoricV1Receipt {
  const replayed = sealV1Receipt({
    eligibleQuantity: receipt.eligibleQuantity,
    categoryWeight: receipt.categoryWeight,
    claimTypeWeight: receipt.claimTypeWeight,
    qualityFactor: receipt.qualityFactor,
    roundingMode: receipt.roundingMode,
    maximumIssuance: receipt.maximumIssuance,
  });
  if (replayed.moonreyQuantity !== receipt.moonreyQuantity || replayed.contentHash !== receipt.contentHash) {
    throw new Error('historic V1 receipt is not reproducible');
  }
  return replayed;
}

export function sealV2Receipt(scenario: MoonReyShadowScenario, comparison?: MoonReyValuePathComparison): HistoricV2Receipt {
  const evaluated = comparison ?? null;
  const v2 = evaluated
    ? {
        gpuv: evaluated.v2GpuvValue,
        quantity: evaluated.v2MoonReyCandidateQuantity,
      }
    : (() => {
        const result = evaluateGovernedV2(scenario);
        return { gpuv: result.gpuvValue, quantity: result.quantity };
      })();
  if (v2.gpuv === null || v2.quantity === null) {
    throw new TypeError('cannot seal a V2 receipt for an unvalued event');
  }
  const draft: Omit<HistoricV2Receipt, 'contentHash'> = {
    schema: SHADOW_VALUE_RECEIPT_SCHEMA,
    pathClass: 'GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2',
    normalizationVersion: scenario.normalizationVersion,
    eventIdentityVersion: scenario.eventIdentityVersion,
    attributionPolicyId: scenario.attributionPolicyId,
    attributionPolicyVersion: scenario.attributionPolicyVersion,
    valuePolicyId: scenario.valuePolicyId,
    valuePolicyVersion: scenario.valuePolicyVersion,
    conversionPolicyId: scenario.conversionPolicyId,
    conversionPolicyVersion: scenario.conversionPolicyVersion,
    gpuvValue: v2.gpuv,
    moonreyCandidateQuantity: v2.quantity,
  };
  return Object.freeze({ ...draft, contentHash: hash(draft) });
}

export function replayV2Receipt(scenario: MoonReyShadowScenario, receipt: HistoricV2Receipt): HistoricV2Receipt {
  const replayed = sealV2Receipt(scenario);
  if (
    replayed.normalizationVersion !== receipt.normalizationVersion ||
    replayed.eventIdentityVersion !== receipt.eventIdentityVersion ||
    replayed.attributionPolicyId !== receipt.attributionPolicyId ||
    replayed.valuePolicyId !== receipt.valuePolicyId ||
    replayed.conversionPolicyId !== receipt.conversionPolicyId ||
    replayed.moonreyCandidateQuantity !== receipt.moonreyCandidateQuantity ||
    replayed.contentHash !== receipt.contentHash
  ) {
    throw new Error('historic V2 receipt is not reproducible under the sealed policy versions');
  }
  return replayed;
}

function hash(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex');
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
