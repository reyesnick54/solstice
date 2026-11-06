import { VAL07_RATE_BPS_SCALE } from './taxonomy.ts';

export function bpsToDecimal(bps: number): number {
  return bps / VAL07_RATE_BPS_SCALE;
}

export function presentValue(amount: number, rateBps: number, periodIndex: number): number {
  if (periodIndex <= 0) {
    return amount;
  }
  const rate = bpsToDecimal(rateBps);
  return amount / (1 + rate) ** periodIndex;
}

export function perpetuityPresentValue(
  firstCashFlow: number,
  rateBps: number,
  growthBps: number,
  discountFromPeriod: number,
): number {
  const rate = bpsToDecimal(rateBps);
  const growth = bpsToDecimal(growthBps);
  if (rate <= growth) {
    throw new Error('cost of equity must exceed terminal growth for Gordon residual-income terminal');
  }
  const terminal = firstCashFlow / (rate - growth);
  return presentValue(terminal, rateBps, discountFromPeriod);
}

export function residualIncomeForPeriod(input: {
  readonly netIncome: number;
  readonly beginningBookEquity: number;
  readonly costOfEquityBps: number;
}): { readonly equityCharge: number; readonly residualIncome: number } {
  const equityCharge = bpsToDecimal(input.costOfEquityBps) * input.beginningBookEquity;
  return Object.freeze({
    equityCharge,
    residualIncome: input.netIncome - equityCharge,
  });
}

export function roeDecimalFrom(netIncome: number, beginningBookEquity: number): number | null {
  if (beginningBookEquity === 0) {
    return null;
  }
  return netIncome / beginningBookEquity;
}

export function roeToBps(roeDecimal: number): number {
  return Math.round(roeDecimal * VAL07_RATE_BPS_SCALE);
}
