/**
 * HELIOS OS03 — deterministic slippage / market-impact approximation.
 */

import { SLIPPAGE_MODEL_VERSION } from './taxonomy.ts';

export type SlippageModelConfig = {
  readonly impactBpsPerUnit: number;
  readonly maxImpactBps: number;
};

export const DEFAULT_SLIPPAGE_MODEL: SlippageModelConfig = Object.freeze({
  impactBpsPerUnit: 1,
  maxImpactBps: 500,
});

export function slippageAssumptionLabel(config: SlippageModelConfig): string {
  return `${SLIPPAGE_MODEL_VERSION}:impactPerUnit=${config.impactBpsPerUnit}bps;max=${config.maxImpactBps}bps`;
}

export function applySlippageToPrice(
  side: 'BUY' | 'SELL',
  basePriceMinorUnits: bigint,
  quantityUnits: bigint,
  config: SlippageModelConfig,
): bigint {
  const rawImpact = Number(quantityUnits) * config.impactBpsPerUnit;
  const impactBps = Math.min(config.maxImpactBps, Math.max(0, rawImpact));
  if (impactBps === 0) {
    return basePriceMinorUnits;
  }
  const delta = (basePriceMinorUnits * BigInt(impactBps)) / 10_000n;
  return side === 'BUY' ? basePriceMinorUnits + delta : basePriceMinorUnits - delta;
}
