/**
 * Year-specific discount rates and cumulative discount factors (no flat WACC forcing).
 */

import { HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA } from './taxonomy.ts';
import type { CapitalStructureWeights } from './capital-structure.ts';
import type { CostOfCapitalInput, CostOfCapitalTermStructure, RateUncertaintyBps, TermStructureYear } from './types.ts';
import {
  capmCostOfEquity,
  clampBps,
  compoundDiscountFactorMicro,
  waccFromComponents,
  applyTaxShield,
  spreadUncertainty,
} from './numeric.ts';
import { riskFreeFromCurve } from './yield-curve.ts';

export function buildTermStructure(input: {
  readonly input: CostOfCapitalInput;
  readonly blendedBetaUncertainty: RateUncertaintyBps;
  readonly equityRiskPremium: RateUncertaintyBps;
  readonly creditSpread: RateUncertaintyBps;
  readonly taxRateBps: number;
  readonly structure: CapitalStructureWeights;
}): CostOfCapitalTermStructure {
  const waccSeries: number[] = [];
  const years: TermStructureYear[] = [];

  for (let year = 1; year <= input.input.projectionYears; year += 1) {
    const riskFreeBps = riskFreeFromCurve(input.input.yieldCurve, year, 25).midBps;
    const costOfEquityBps = capmCostOfEquity(
      riskFreeBps,
      input.blendedBetaUncertainty.midBps,
      input.equityRiskPremium.midBps,
    );
    const costOfDebtPreTaxBps = clampBps(riskFreeBps + input.creditSpread.midBps);
    const costOfDebtAfterTax = applyTaxShield(
      spreadUncertainty(costOfDebtPreTaxBps, 60),
      input.taxRateBps,
    );
    const waccBps = waccFromComponents({
      equityWeightBps: input.structure.equityWeightBps,
      debtWeightBps: input.structure.debtWeightBps,
      costOfEquity: spreadUncertainty(costOfEquityBps, 150),
      costOfDebtAfterTax: costOfDebtAfterTax,
    }).midBps;
    waccSeries.push(waccBps);
    years.push(
      Object.freeze({
        year,
        riskFreeBps,
        costOfEquityBps,
        costOfDebtPreTaxBps,
        waccBps,
        cumulativeDiscountFactorMicro: compoundDiscountFactorMicro(waccSeries),
      }),
    );
  }

  return Object.freeze({
    schemaVersion: HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA,
    evaluationTime: input.input.evaluationTime,
    currency: input.input.discountCurrency,
    inflationBasis: input.input.inflationBasis,
    years: Object.freeze(years),
    simulationOnly: true,
  });
}
