import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { CostEstimate, TransactionCostAnalysis, TransactionCostAnalysisInput, TransactionCostModel } from './types.ts';

function clampBps(value: number): number {
  return Math.max(0, Math.min(50_000, Math.floor(value)));
}

export function buildCostEstimate(input: {
  readonly notionalMinor: bigint;
  readonly bps: number | null;
  readonly fixedMinor: bigint | null;
  readonly certainty: TransactionCostModel['spreadCertainty'];
  readonly explanation: string;
}): CostEstimate {
  if (input.certainty === 'INSUFFICIENT_DATA') {
    return Object.freeze({
      valueMinor: null,
      valueBps: null,
      certainty: 'INSUFFICIENT_DATA',
      explanation: input.explanation,
    });
  }
  let valueMinor: bigint | null = null;
  let valueBps: number | null = null;
  if (input.bps != null && input.notionalMinor > 0n) {
    valueBps = clampBps(input.bps);
    valueMinor = (input.notionalMinor * BigInt(valueBps)) / 10_000n;
  }
  if (input.fixedMinor != null) {
    valueMinor = valueMinor == null ? input.fixedMinor : valueMinor + input.fixedMinor;
  }
  return Object.freeze({
    valueMinor,
    valueBps,
    certainty: input.certainty,
    explanation: input.explanation,
  });
}

export function computeTransactionCostAnalysis(
  input: TransactionCostAnalysisInput,
  computedAt: UtcInstant,
): TransactionCostAnalysis {
  const notional =
    input.arrivalPriceMinor > 0n && input.quantityUnits > 0n
      ? input.arrivalPriceMinor * input.quantityUnits
      : 0n;

  const bpsFromMinor = (minor: bigint | null): number | null => {
    if (minor == null || notional <= 0n) {
      return null;
    }
    return clampBps(Number((minor * 10_000n) / notional));
  };

  const executionShortfallMinor =
    input.executionPriceMinor != null
      ? (input.executionPriceMinor - input.arrivalPriceMinor) * input.quantityUnits
      : null;

  const dataComplete =
    input.executionPriceMinor != null &&
    input.spreadCostMinor != null &&
    input.estimatedSlippageMinor != null &&
    input.feesMinor != null;

  const material = `${input.expectedPriceMinor}:${input.arrivalPriceMinor}:${input.executionPriceMinor}:${input.quantityUnits}`;
  const analysisId = `tca_${createHash('sha256').update(material).digest('hex').slice(0, 20)}`;

  return Object.freeze({
    analysisId,
    expectedPriceMinor: input.expectedPriceMinor,
    arrivalPriceMinor: input.arrivalPriceMinor,
    executionPriceMinor: input.executionPriceMinor,
    spreadCostMinor: input.spreadCostMinor,
    spreadCostBps: bpsFromMinor(input.spreadCostMinor),
    estimatedSlippageMinor: input.estimatedSlippageMinor,
    estimatedSlippageBps: bpsFromMinor(input.estimatedSlippageMinor),
    realizedSlippageMinor: input.realizedSlippageMinor,
    realizedSlippageBps: bpsFromMinor(input.realizedSlippageMinor),
    feesMinor: input.feesMinor,
    executionShortfallMinor,
    executionShortfallBps: bpsFromMinor(executionShortfallMinor),
    dataComplete,
    computedAt,
  });
}
