import { caseResult } from './result.ts';
import type { BenchCaseResult } from './types.ts';
import { CAPACITY_LABEL } from './types.ts';

/**
 * Engineering capacity estimates only. Not production guarantees.
 */
export const BYTES_PER = Object.freeze({
  block: 1_024,
  transaction: 320,
  oracleFact: 256,
  productiveContribution: 384,
});

export function estimateDiskGrowth(input: {
  readonly blocks: number;
  readonly transactions: number;
  readonly oracleFacts: number;
  readonly contributions: number;
}): {
  readonly cases: readonly BenchCaseResult[];
  readonly totalBytes: number;
} {
  const total =
    input.blocks * BYTES_PER.block +
    input.transactions * BYTES_PER.transaction +
    input.oracleFacts * BYTES_PER.oracleFact +
    input.contributions * BYTES_PER.productiveContribution;
  return {
    totalBytes: total,
    cases: [
      caseResult('disk', 'capacity_estimate', {
        extras: {
          label: CAPACITY_LABEL,
          bytesPerBlock: BYTES_PER.block,
          bytesPerTransaction: BYTES_PER.transaction,
          bytesPerOracleFact: BYTES_PER.oracleFact,
          bytesPerContribution: BYTES_PER.productiveContribution,
          estimatedTotalBytes: total,
          notAProductionGuarantee: true,
        },
      }),
    ],
  };
}
