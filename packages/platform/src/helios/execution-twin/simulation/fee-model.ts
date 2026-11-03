/**
 * HELIOS OS03 — maker/taker fee simulation.
 */

import { FEE_MODEL_VERSION } from './taxonomy.ts';
import type { LiquidityRole } from './taxonomy.ts';

export type FeeModelConfig = {
  readonly makerFeeRateBps: number;
  readonly takerFeeRateBps: number;
};

export const DEFAULT_FEE_MODEL: FeeModelConfig = Object.freeze({
  makerFeeRateBps: 2,
  takerFeeRateBps: 5,
});

export function feeAssumptionLabel(config: FeeModelConfig): string {
  return `${FEE_MODEL_VERSION}:maker=${config.makerFeeRateBps}bps;taker=${config.takerFeeRateBps}bps`;
}

export function computeFeeMinor(notionalMinorUnits: bigint, role: LiquidityRole, config: FeeModelConfig): bigint {
  const rateBps = role === 'MAKER' ? config.makerFeeRateBps : config.takerFeeRateBps;
  if (rateBps <= 0) {
    return 0n;
  }
  return (notionalMinorUnits * BigInt(rateBps)) / 10_000n;
}
