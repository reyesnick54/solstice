/**
 * HELIOS VAL03 — point-in-time dynamic cost of capital engine.
 */

import { HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA } from './taxonomy.ts';
import { blendBetaEstimates, buildBetaEstimates } from './beta-estimators.ts';
import { resolveCapitalStructure } from './capital-structure.ts';
import { assertCurrencyConsistency } from './currency.ts';
import {
  applyTaxShield,
  capmCostOfEquityUncertainty,
  clampBps,
  spreadUncertainty,
  waccFromComponents,
} from './numeric.ts';
import { buildTermStructure } from './term-structure.ts';
import { riskFreeFromCurve } from './yield-curve.ts';
import type {
  CostOfCapitalInput,
  CostOfCapitalSnapshot,
  CostOfDebtState,
  CostOfEquityState,
  CreditSpreadState,
  EquityRiskPremiumState,
  RiskFreeRateState,
  WaccState,
} from './types.ts';

export function buildCostOfCapitalSnapshot(input: CostOfCapitalInput): CostOfCapitalSnapshot {
  const currencyCheck = assertCurrencyConsistency(input);
  if (!currencyCheck.ok) {
    throw new Error(currencyCheck.reason);
  }
  if (input.projectionYears < 1) {
    throw new Error('projectionYears must be at least 1');
  }

  const horizonYears = 1;
  const riskFreeRate = riskFreeFromCurve(input.yieldCurve, horizonYears, 30);
  const sourceRefs = Object.freeze([...input.sourceRefs, 'helios:val03:engine']);

  const riskFree: RiskFreeRateState = Object.freeze({
    schemaVersion: HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA,
    evaluationTime: input.evaluationTime,
    currency: input.discountCurrency,
    jurisdiction: input.jurisdiction,
    horizonYears,
    rate: riskFreeRate,
    curveInterpolation: 'LINEAR_TENOR',
    sourceRefs,
    simulationOnly: true,
  });

  const erpMid = clampBps(input.marketRiskPremiumBps);
  const equityRiskPremium: EquityRiskPremiumState = Object.freeze({
    schemaVersion: HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA,
    evaluationTime: input.evaluationTime,
    currency: input.discountCurrency,
    jurisdiction: input.jurisdiction,
    premium: spreadUncertainty(erpMid, 120),
    sourceRefs,
    simulationOnly: true,
  });

  const spreadMid = clampBps(input.creditSpreadBps);
  const creditSpread: CreditSpreadState = Object.freeze({
    schemaVersion: HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA,
    evaluationTime: input.evaluationTime,
    currency: input.discountCurrency,
    sector: input.sector,
    spread: spreadUncertainty(spreadMid, 80),
    sourceRefs,
    simulationOnly: true,
  });

  const preTaxDebt = spreadUncertainty(
    clampBps(riskFreeRate.midBps + spreadMid),
    100,
  );
  const costOfDebt: CostOfDebtState = Object.freeze({
    schemaVersion: HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA,
    evaluationTime: input.evaluationTime,
    currency: input.discountCurrency,
    preTax: preTaxDebt,
    afterTax: applyTaxShield(preTaxDebt, input.taxRateBps),
    taxRateBps: clampBps(input.taxRateBps, 0, 10_000),
    sourceRefs,
    simulationOnly: true,
  });

  const betaEstimates = buildBetaEstimates(input);
  const { blendedBetaBps, blendedBetaUncertainty } = blendBetaEstimates(betaEstimates);
  const capm = capmCostOfEquityUncertainty(riskFreeRate, blendedBetaUncertainty, equityRiskPremium.premium);
  const costOfEquity: CostOfEquityState = Object.freeze({
    schemaVersion: HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA,
    evaluationTime: input.evaluationTime,
    currency: input.discountCurrency,
    betaEstimates,
    blendedBetaBps,
    blendedBetaUncertainty,
    capm,
    sourceRefs,
    simulationOnly: true,
  });

  const structure = resolveCapitalStructure(input);
  const waccRate = waccFromComponents({
    equityWeightBps: structure.equityWeightBps,
    debtWeightBps: structure.debtWeightBps,
    costOfEquity: capm,
    costOfDebtAfterTax: costOfDebt.afterTax,
  });
  const wacc: WaccState = Object.freeze({
    schemaVersion: HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA,
    evaluationTime: input.evaluationTime,
    currency: input.discountCurrency,
    inflationBasis: input.inflationBasis,
    capitalStructureBasis: structure.basis,
    equityWeightBps: structure.equityWeightBps,
    debtWeightBps: structure.debtWeightBps,
    wacc: waccRate,
    sourceRefs,
    simulationOnly: true,
  });

  const termStructure = buildTermStructure({
    input,
    blendedBetaUncertainty,
    equityRiskPremium: equityRiskPremium.premium,
    creditSpread: creditSpread.spread,
    taxRateBps: costOfDebt.taxRateBps,
    structure,
  });

  return Object.freeze({
    riskFree,
    equityRiskPremium,
    creditSpread,
    costOfDebt,
    costOfEquity,
    wacc,
    termStructure,
  });
}
