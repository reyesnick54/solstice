/**
 * Integer-safe rate arithmetic for VAL03 (basis points and discount factors).
 */

import { VAL03_BETA_BPS_SCALE, VAL03_RATE_BPS_SCALE } from './taxonomy.ts';
import type { RateUncertaintyBps } from './types.ts';

export function clampBps(value: number, min = 0, max = 50_000): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function spreadUncertainty(midBps: number, halfWidthBps: number): RateUncertaintyBps {
  const mid = clampBps(midBps);
  const half = Math.max(0, Math.round(halfWidthBps));
  return Object.freeze({
    lowBps: clampBps(mid - half),
    midBps: mid,
    highBps: clampBps(mid + half),
  });
}

export function applyTaxShield(preTax: RateUncertaintyBps, taxRateBps: number): RateUncertaintyBps {
  const shield = clampBps(taxRateBps, 0, VAL03_RATE_BPS_SCALE);
  const factor = VAL03_RATE_BPS_SCALE - shield;
  return Object.freeze({
    lowBps: clampBps((preTax.lowBps * factor) / VAL03_RATE_BPS_SCALE),
    midBps: clampBps((preTax.midBps * factor) / VAL03_RATE_BPS_SCALE),
    highBps: clampBps((preTax.highBps * factor) / VAL03_RATE_BPS_SCALE),
  });
}

export function capmCostOfEquity(
  riskFreeMidBps: number,
  betaBps: number,
  erpMidBps: number,
): number {
  const beta = betaBps / VAL03_BETA_BPS_SCALE;
  return clampBps(riskFreeMidBps + beta * erpMidBps);
}

export function capmCostOfEquityUncertainty(
  riskFree: RateUncertaintyBps,
  beta: RateUncertaintyBps,
  erp: RateUncertaintyBps,
): RateUncertaintyBps {
  return Object.freeze({
    lowBps: capmCostOfEquity(riskFree.lowBps, beta.lowBps, erp.lowBps),
    midBps: capmCostOfEquity(riskFree.midBps, beta.midBps, erp.midBps),
    highBps: capmCostOfEquity(riskFree.highBps, beta.highBps, erp.highBps),
  });
}

export function waccFromComponents(input: {
  readonly equityWeightBps: number;
  readonly debtWeightBps: number;
  readonly costOfEquity: RateUncertaintyBps;
  readonly costOfDebtAfterTax: RateUncertaintyBps;
}): RateUncertaintyBps {
  const weightSum = input.equityWeightBps + input.debtWeightBps;
  if (weightSum !== VAL03_RATE_BPS_SCALE) {
    throw new Error(`capital structure weights must sum to ${VAL03_RATE_BPS_SCALE} bps`);
  }
  const blend = (equityBps: number, debtBps: number): number =>
    clampBps(
      (input.equityWeightBps * equityBps + input.debtWeightBps * debtBps) / VAL03_RATE_BPS_SCALE,
    );
  return Object.freeze({
    lowBps: blend(input.costOfEquity.lowBps, input.costOfDebtAfterTax.lowBps),
    midBps: blend(input.costOfEquity.midBps, input.costOfDebtAfterTax.midBps),
    highBps: blend(input.costOfEquity.highBps, input.costOfDebtAfterTax.highBps),
  });
}

const DISCOUNT_FACTOR_MICRO_SCALE = 1_000_000;

export function annualDiscountStepMicro(rateBps: number): number {
  const rate = rateBps / VAL03_RATE_BPS_SCALE;
  return Math.round(DISCOUNT_FACTOR_MICRO_SCALE / (1 + rate));
}

export function compoundDiscountFactorMicro(rateBpsSeries: readonly number[]): number {
  let factor = DISCOUNT_FACTOR_MICRO_SCALE;
  for (const rateBps of rateBpsSeries) {
    factor = Math.round((factor * annualDiscountStepMicro(rateBps)) / DISCOUNT_FACTOR_MICRO_SCALE);
  }
  return factor;
}

export function medianOf(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error('medianOf requires at least one value');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? sorted[0]!;
  }
  return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
}
