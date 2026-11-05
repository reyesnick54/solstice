import { VAL05_BPS_SCALE, VAL05_DEFAULT_EXPLICIT_YEARS } from '../taxonomy.ts';

export function bpsToRatio(bps: number): number {
  return bps / VAL05_BPS_SCALE;
}

export function ratioToBps(ratio: number): number {
  return Math.round(ratio * VAL05_BPS_SCALE);
}

export function equityValueMinor(input: {
  readonly pricePerShareMinor: bigint;
  readonly sharesOutstanding: bigint;
  readonly netDebtMinor: bigint;
  readonly cashMinor: bigint;
  readonly minorityInterestMinor: bigint;
}): bigint {
  const marketCap = input.pricePerShareMinor * input.sharesOutstanding;
  return marketCap + input.netDebtMinor - input.cashMinor + input.minorityInterestMinor;
}

/**
 * Two-stage DCF enterprise value (explicit FCF stream + Gordon terminal).
 * Money in minor units; rates in basis points. Research-layer float PV only.
 */
export function enterpriseValueMinorFromPath(input: {
  readonly baseRevenueMinor: bigint;
  readonly revenueCagrBps: number;
  readonly fcfMarginBps: number;
  readonly terminalGrowthBps: number;
  readonly discountRateBps: number;
  readonly explicitYears?: number;
}): bigint {
  const years = input.explicitYears ?? VAL05_DEFAULT_EXPLICIT_YEARS;
  const wacc = bpsToRatio(input.discountRateBps);
  const g = bpsToRatio(input.revenueCagrBps);
  const fcfMargin = bpsToRatio(input.fcfMarginBps);
  const gTerm = bpsToRatio(input.terminalGrowthBps);

  if (wacc <= gTerm || wacc <= -0.99) {
    return 0n;
  }

  let revenue = Number(input.baseRevenueMinor);
  let pv = 0;
  for (let t = 1; t <= years; t += 1) {
    revenue *= 1 + g;
    const fcf = revenue * fcfMargin;
    pv += fcf / (1 + wacc) ** t;
  }
  revenue *= 1 + g;
  const terminalFcf = revenue * fcfMargin;
  const tv = (terminalFcf * (1 + gTerm)) / (wacc - gTerm);
  pv += tv / (1 + wacc) ** years;
  if (!Number.isFinite(pv) || pv < 0) {
    return 0n;
  }
  return BigInt(Math.round(pv));
}

export function impliedOperatingMarginBps(input: {
  readonly fcfMarginBps: number;
  readonly effectiveTaxRateBps: number;
  readonly reinvestmentBps: number;
}): number {
  const tax = bpsToRatio(input.effectiveTaxRateBps);
  const reinvest = bpsToRatio(input.reinvestmentBps);
  const fcfMargin = bpsToRatio(input.fcfMarginBps);
  const denominator = (1 - tax) * (1 - reinvest);
  if (denominator <= 0.01) {
    return input.fcfMarginBps;
  }
  return ratioToBps(fcfMargin / denominator);
}

export function impliedReinvestmentFromGrowthRoic(revenueCagrBps: number, roicBps: number): number {
  const roic = bpsToRatio(roicBps);
  if (roic <= 0.0001) {
    return 0;
  }
  const g = bpsToRatio(revenueCagrBps);
  return ratioToBps(g / roic);
}

/** Bisect revenue CAGR (bps) so EV matches target within tolerance. */
export function solveRevenueCagrBps(input: {
  readonly baseRevenueMinor: bigint;
  readonly fcfMarginBps: number;
  readonly terminalGrowthBps: number;
  readonly discountRateBps: number;
  readonly targetEnterpriseMinor: bigint;
  readonly lowBps?: number;
  readonly highBps?: number;
}): { readonly cagrBps: number; readonly residualMinor: bigint } | null {
  let lo = input.lowBps ?? -3_000;
  let hi = input.highBps ?? 15_000;
  const target = Number(input.targetEnterpriseMinor);
  if (target <= 0) {
    return null;
  }

  const evalAt = (cagrBps: number): number => {
    const ev = enterpriseValueMinorFromPath({
      baseRevenueMinor: input.baseRevenueMinor,
      revenueCagrBps: cagrBps,
      fcfMarginBps: input.fcfMarginBps,
      terminalGrowthBps: input.terminalGrowthBps,
      discountRateBps: input.discountRateBps,
    });
    return Number(ev) - target;
  };

  let fLo = evalAt(lo);
  let fHi = evalAt(hi);
  if (fLo * fHi > 0) {
    return null;
  }

  let bestCagr = lo;
  for (let i = 0; i < 48; i += 1) {
    const mid = Math.round((lo + hi) / 2);
    const fMid = evalAt(mid);
    bestCagr = mid;
    if (Math.abs(fMid) < Math.max(1, target * 0.0001)) {
      break;
    }
    if (fLo * fMid <= 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }

  const ev = enterpriseValueMinorFromPath({
    baseRevenueMinor: input.baseRevenueMinor,
    revenueCagrBps: bestCagr,
    fcfMarginBps: input.fcfMarginBps,
    terminalGrowthBps: input.terminalGrowthBps,
    discountRateBps: input.discountRateBps,
  });
  return Object.freeze({
    cagrBps: bestCagr,
    residualMinor: ev - input.targetEnterpriseMinor,
  });
}

export function medianBps(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]!;
  }
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export function percentileBps(values: readonly number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx]!;
}
