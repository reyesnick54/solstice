/**
 * Market-value weights when observable; book leverage proxy otherwise.
 */

import { VAL03_RATE_BPS_SCALE } from './taxonomy.ts';
import type { CapitalStructureBasis } from './taxonomy.ts';
import type { CostOfCapitalInput } from './types.ts';

export type CapitalStructureWeights = {
  readonly basis: CapitalStructureBasis;
  readonly equityWeightBps: number;
  readonly debtWeightBps: number;
};

export function resolveCapitalStructure(input: CostOfCapitalInput): CapitalStructureWeights {
  const equity = input.marketValueEquityMinor;
  const debt = input.marketValueDebtMinor;
  if (equity !== undefined && debt !== undefined && equity + debt > 0n) {
    const total = equity + debt;
    const equityWeightBps = Number((equity * BigInt(VAL03_RATE_BPS_SCALE)) / total);
    const debtWeightBps = VAL03_RATE_BPS_SCALE - equityWeightBps;
    return Object.freeze({
      basis: 'MARKET_VALUE',
      equityWeightBps,
      debtWeightBps,
    });
  }

  const leverageBps = input.bookLeverageDebtToEquityBps ?? 5_000;
  const debtWeightBps = Math.min(
    VAL03_RATE_BPS_SCALE,
    Math.max(0, Math.round((leverageBps * VAL03_RATE_BPS_SCALE) / (VAL03_RATE_BPS_SCALE + leverageBps))),
  );
  return Object.freeze({
    basis: 'BOOK_LEVERAGE_PROXY',
    equityWeightBps: VAL03_RATE_BPS_SCALE - debtWeightBps,
    debtWeightBps,
  });
}
