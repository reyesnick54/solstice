/**
 * HELIOS Valuation Intelligence VAL03 — cost of capital state types.
 */

import type {
  BetaEstimatorKind,
  CapitalStructureBasis,
  HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA,
  InflationBasisKind,
} from './taxonomy.ts';
import type { UtcInstant } from '@solstice/domain';

export type RateUncertaintyBps = {
  readonly lowBps: number;
  readonly midBps: number;
  readonly highBps: number;
};

export type GovernmentYieldCurvePoint = {
  readonly tenorYears: number;
  readonly yieldBps: number;
  readonly sourceRef: string;
};

export type GovernmentYieldCurve = {
  readonly currency: string;
  readonly jurisdiction: string;
  readonly asOf: UtcInstant;
  readonly points: readonly GovernmentYieldCurvePoint[];
};

export type BetaEstimate = {
  readonly kind: BetaEstimatorKind;
  readonly betaBps: number;
  readonly uncertainty: RateUncertaintyBps;
  readonly sourceRefs: readonly string[];
};

export type CostOfCapitalInput = {
  readonly evaluationTime: UtcInstant;
  readonly yieldCurve: GovernmentYieldCurve;
  readonly cashFlowCurrency: string;
  readonly discountCurrency: string;
  readonly inflationBasis: InflationBasisKind;
  readonly jurisdiction: string;
  readonly creditSpreadBps: number;
  readonly sector: string;
  readonly taxRateBps: number;
  readonly marketRiskPremiumBps: number;
  readonly rawBetaBps: number;
  readonly sectorBetaBps: number;
  readonly bottomUpBetaBps: number;
  readonly shrinkageTargetBetaBps?: number;
  readonly shrinkageIntensityBps?: number;
  readonly marketValueEquityMinor?: bigint;
  readonly marketValueDebtMinor?: bigint;
  readonly bookLeverageDebtToEquityBps?: number;
  readonly projectionYears: number;
  readonly sourceRefs: readonly string[];
};

export type RiskFreeRateState = {
  readonly schemaVersion: typeof HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA;
  readonly evaluationTime: UtcInstant;
  readonly currency: string;
  readonly jurisdiction: string;
  readonly horizonYears: number;
  readonly rate: RateUncertaintyBps;
  readonly curveInterpolation: 'LINEAR_TENOR';
  readonly sourceRefs: readonly string[];
  readonly simulationOnly: true;
};

export type EquityRiskPremiumState = {
  readonly schemaVersion: typeof HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA;
  readonly evaluationTime: UtcInstant;
  readonly currency: string;
  readonly jurisdiction: string;
  readonly premium: RateUncertaintyBps;
  readonly sourceRefs: readonly string[];
  readonly simulationOnly: true;
};

export type CreditSpreadState = {
  readonly schemaVersion: typeof HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA;
  readonly evaluationTime: UtcInstant;
  readonly currency: string;
  readonly sector: string;
  readonly spread: RateUncertaintyBps;
  readonly sourceRefs: readonly string[];
  readonly simulationOnly: true;
};

export type CostOfDebtState = {
  readonly schemaVersion: typeof HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA;
  readonly evaluationTime: UtcInstant;
  readonly currency: string;
  readonly preTax: RateUncertaintyBps;
  readonly afterTax: RateUncertaintyBps;
  readonly taxRateBps: number;
  readonly sourceRefs: readonly string[];
  readonly simulationOnly: true;
};

export type CostOfEquityState = {
  readonly schemaVersion: typeof HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA;
  readonly evaluationTime: UtcInstant;
  readonly currency: string;
  readonly betaEstimates: readonly BetaEstimate[];
  readonly blendedBetaBps: number;
  readonly blendedBetaUncertainty: RateUncertaintyBps;
  readonly capm: RateUncertaintyBps;
  readonly sourceRefs: readonly string[];
  readonly simulationOnly: true;
};

export type WaccState = {
  readonly schemaVersion: typeof HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA;
  readonly evaluationTime: UtcInstant;
  readonly currency: string;
  readonly inflationBasis: InflationBasisKind;
  readonly capitalStructureBasis: CapitalStructureBasis;
  readonly equityWeightBps: number;
  readonly debtWeightBps: number;
  readonly wacc: RateUncertaintyBps;
  readonly sourceRefs: readonly string[];
  readonly simulationOnly: true;
};

export type TermStructureYear = {
  readonly year: number;
  readonly riskFreeBps: number;
  readonly costOfEquityBps: number;
  readonly costOfDebtPreTaxBps: number;
  readonly waccBps: number;
  /** Cumulative discount factor scaled by 1_000_000 (1.0 = 1_000_000). */
  readonly cumulativeDiscountFactorMicro: number;
};

export type CostOfCapitalTermStructure = {
  readonly schemaVersion: typeof HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA;
  readonly evaluationTime: UtcInstant;
  readonly currency: string;
  readonly inflationBasis: InflationBasisKind;
  readonly years: readonly TermStructureYear[];
  readonly simulationOnly: true;
};

export type CostOfCapitalSnapshot = {
  readonly riskFree: RiskFreeRateState;
  readonly equityRiskPremium: EquityRiskPremiumState;
  readonly creditSpread: CreditSpreadState;
  readonly costOfDebt: CostOfDebtState;
  readonly costOfEquity: CostOfEquityState;
  readonly wacc: WaccState;
  readonly termStructure: CostOfCapitalTermStructure;
};
