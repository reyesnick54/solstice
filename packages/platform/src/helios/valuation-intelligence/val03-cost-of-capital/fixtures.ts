/**
 * VAL03 simulation fixtures — government curve and representative inputs.
 */

import { asUtcInstant } from '@solstice/domain';
import type { CostOfCapitalInput, GovernmentYieldCurve } from './types.ts';

export const VAL03_DEFAULT_AS_OF = asUtcInstant('2026-06-30T16:00:00.000Z');

export function fixtureUsTreasuryYieldCurve(asOf = VAL03_DEFAULT_AS_OF): GovernmentYieldCurve {
  return Object.freeze({
    currency: 'USD',
    jurisdiction: 'US',
    asOf,
    points: Object.freeze([
      Object.freeze({ tenorYears: 0.25, yieldBps: 480, sourceRef: 'fixture:ust:3m' }),
      Object.freeze({ tenorYears: 2, yieldBps: 430, sourceRef: 'fixture:ust:2y' }),
      Object.freeze({ tenorYears: 5, yieldBps: 410, sourceRef: 'fixture:ust:5y' }),
      Object.freeze({ tenorYears: 10, yieldBps: 420, sourceRef: 'fixture:ust:10y' }),
      Object.freeze({ tenorYears: 30, yieldBps: 450, sourceRef: 'fixture:ust:30y' }),
    ]),
  });
}

export function fixtureVal03CostOfCapitalInput(
  overrides: Partial<CostOfCapitalInput> = {},
): CostOfCapitalInput {
  const base: CostOfCapitalInput = {
    evaluationTime: VAL03_DEFAULT_AS_OF,
    yieldCurve: fixtureUsTreasuryYieldCurve(),
    cashFlowCurrency: 'USD',
    discountCurrency: 'USD',
    inflationBasis: 'NOMINAL',
    jurisdiction: 'US',
    creditSpreadBps: 180,
    sector: 'TECHNOLOGY',
    taxRateBps: 2_100,
    marketRiskPremiumBps: 550,
    rawBetaBps: 13_500,
    sectorBetaBps: 11_800,
    bottomUpBetaBps: 12_200,
    shrinkageTargetBetaBps: 11_800,
    shrinkageIntensityBps: 3_500,
    marketValueEquityMinor: 850_000_000_000n,
    marketValueDebtMinor: 150_000_000_000n,
    projectionYears: 5,
    sourceRefs: Object.freeze(['fixture:val03:demo']),
  };
  return Object.freeze({ ...base, ...overrides });
}
