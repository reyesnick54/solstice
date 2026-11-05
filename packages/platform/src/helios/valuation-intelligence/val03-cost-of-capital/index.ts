/**
 * HELIOS Valuation Intelligence VAL03 — Dynamic Cost of Capital Engine.
 */

export {
  HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA,
  HELIOS_VAL03_COST_OF_CAPITAL_QUALIFIED,
  HELIOS_VAL03_COST_OF_CAPITAL_BLOCKED,
  VAL03_RATE_BPS_SCALE,
  VAL03_BETA_BPS_SCALE,
  BETA_ESTIMATOR_KINDS,
  INFLATION_BASIS_KINDS,
  CAPITAL_STRUCTURE_BASIS,
  type BetaEstimatorKind,
  type InflationBasisKind,
  type CapitalStructureBasis,
} from './taxonomy.ts';

export type {
  RateUncertaintyBps,
  GovernmentYieldCurvePoint,
  GovernmentYieldCurve,
  BetaEstimate,
  CostOfCapitalInput,
  RiskFreeRateState,
  EquityRiskPremiumState,
  CreditSpreadState,
  CostOfDebtState,
  CostOfEquityState,
  WaccState,
  TermStructureYear,
  CostOfCapitalTermStructure,
  CostOfCapitalSnapshot,
} from './types.ts';

export { buildCostOfCapitalSnapshot } from './engine.ts';
export { buildBetaEstimates, blendBetaEstimates } from './beta-estimators.ts';
export { interpolateYieldBps, riskFreeFromCurve } from './yield-curve.ts';
export { resolveCapitalStructure, type CapitalStructureWeights } from './capital-structure.ts';
export { assertCurrencyConsistency, type CurrencyConsistencyResult } from './currency.ts';
export { buildTermStructure } from './term-structure.ts';
export {
  evaluateVal03CostOfCapitalQualification,
  type Val03CostOfCapitalQualificationChecks,
  type Val03CostOfCapitalQualificationResult,
} from './qualification.ts';
export {
  VAL03_DEFAULT_AS_OF,
  fixtureUsTreasuryYieldCurve,
  fixtureVal03CostOfCapitalInput,
} from './fixtures.ts';
