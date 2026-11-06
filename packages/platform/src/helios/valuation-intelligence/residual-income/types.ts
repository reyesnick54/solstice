import type { UtcInstant } from '@solstice/domain';

import type {
  EconomicValueCreationLabel,
  ResidualIncomeStageKind,
  VAL07_RESIDUAL_INCOME_MODULE,
  VAL07_RESIDUAL_INCOME_SCHEMA,
} from './taxonomy.ts';
import type {
  HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED,
  RESIDUAL_CASH_FLOW_RESEARCH_DISCLAIMER,
} from './taxonomy.ts';
import {
  HELIOS_VALUATION_INTELLIGENCE_AUTHORITY,
  HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
} from '../taxonomy.ts';

export type CleanSurplusAdjustment = {
  readonly periodIndex: number;
  readonly beginningBookEquity: number;
  readonly impliedEndingBookEquity: number;
  readonly reportedEndingBookEquity: number | null;
  readonly adjustmentAmount: number;
  readonly cleanSurplusHolds: boolean;
  readonly ociAmount: number;
  readonly fxTranslationAmount: number;
  readonly restatementAmount: number;
  readonly dividends: number;
  readonly shareIssuance: number;
  readonly shareRepurchases: number;
};

export type ResidualIncomeState = {
  readonly periodIndex: number;
  readonly beginningBookEquity: number;
  readonly netIncome: number;
  readonly costOfEquityBps: number;
  readonly equityCharge: number;
  readonly residualIncome: number;
  readonly roeDecimal: number | null;
};

export type ResidualIncomeForecastPeriod = {
  readonly periodIndex: number;
  readonly netIncome?: number;
  readonly beginningBookEquity?: number;
  readonly costOfEquityBps?: number;
  readonly dividends?: number;
  readonly shareIssuance?: number;
  readonly shareRepurchases?: number;
  readonly otherComprehensiveIncome?: number;
  readonly fxTranslation?: number;
  readonly restatementAdjustment?: number;
  readonly reportedEndingBookEquity?: number | null;
};

export type ResidualIncomeContinuingSpec =
  | {
      readonly kind: 'PERPETUAL_RESIDUAL_INCOME';
      readonly terminalResidualIncome: number;
      readonly terminalGrowthBps?: number;
    }
  | {
      readonly kind: 'FADE_TO_COST_OF_EQUITY';
      readonly fadeYears: number;
      readonly terminalRoeBps: number;
    };

export type ResidualIncomeForecast = {
  readonly stageKind: ResidualIncomeStageKind;
  readonly currency: string;
  readonly explicitPeriods: readonly ResidualIncomeForecastPeriod[];
  readonly continuing?: ResidualIncomeContinuingSpec;
  readonly assumeCleanSurplus: boolean;
};

export type ResidualIncomeDistribution = {
  readonly pointIntrinsicEquity: number;
  readonly pvExplicitResidualIncome: number;
  readonly pvContinuingResidualIncome: number;
  readonly lowIntrinsicEquity: number | null;
  readonly highIntrinsicEquity: number | null;
};

export type ResidualIncomeValuation = {
  readonly schema: typeof VAL07_RESIDUAL_INCOME_SCHEMA;
  readonly module: typeof VAL07_RESIDUAL_INCOME_MODULE;
  readonly parentSchema: typeof HELIOS_VALUATION_INTELLIGENCE_SCHEMA;
  readonly authority: typeof HELIOS_VALUATION_INTELLIGENCE_AUTHORITY;
  readonly valuationId: string;
  readonly entityLabel: string;
  readonly evaluationTime: UtcInstant;
  readonly currentBookEquity: number;
  readonly costOfEquityBps: number;
  readonly forecast: ResidualIncomeForecast;
  readonly path: readonly ResidualIncomeState[];
  readonly cleanSurplusAdjustments: readonly CleanSurplusAdjustment[];
  readonly distribution: ResidualIncomeDistribution;
  readonly intrinsicEquityValue: number;
  readonly priceFree: true;
  readonly researchOnly: true;
  readonly grantsExecutionAuthority: false;
};

export type EconomicProfitState = {
  readonly periodIndex: number;
  readonly nopat: number;
  readonly investedCapital: number;
  readonly roicBps: number;
  readonly waccBps: number;
  readonly economicProfit: number;
  readonly spreadBps: number;
};

export type EconomicValueCreationState = {
  readonly label: EconomicValueCreationLabel;
  readonly roicBps: number;
  readonly waccBps: number;
  readonly spreadBps: number;
  readonly investedCapital: number;
  readonly economicProfit: number;
  readonly researchClassificationOnly: true;
};

export type ExcessReturnState = {
  readonly periodIndex: number;
  readonly bookEquity: number;
  readonly roeBps: number;
  readonly costOfEquityBps: number;
  readonly excessReturn: number;
  readonly regulatoryCapitalRequired: number | null;
  readonly financialInstitution: boolean;
};

export type ResidualCashFlowState = {
  readonly periodIndex: number;
  readonly operatingCashFlow: number;
  readonly capitalCharge: number;
  readonly residualOperatingCashFlow: number;
  readonly experimentalDisclaimer: typeof RESIDUAL_CASH_FLOW_RESEARCH_DISCLAIMER;
};

export type ResidualIncomeEngineInput = {
  readonly valuationId: string;
  readonly entityLabel: string;
  readonly evaluationTime: UtcInstant;
  readonly currentBookEquity: number;
  readonly costOfEquityBps: number;
  readonly costOfEquityLowBps?: number;
  readonly costOfEquityHighBps?: number;
  readonly forecast: ResidualIncomeForecast;
  /** Must remain absent for price-free intrinsic residual-income valuation. */
  readonly marketPriceMinor?: never;
};

export type EconomicProfitInput = {
  readonly periodIndex: number;
  readonly nopat: number;
  readonly investedCapital: number;
  readonly waccBps: number;
  readonly spreadNeutralToleranceBps?: number;
};

export type ExcessReturnInput = {
  readonly periodIndex: number;
  readonly bookEquity: number;
  readonly roeBps: number;
  readonly costOfEquityBps: number;
  readonly regulatoryCapitalRequired?: number | null;
  readonly isFinancialInstitution?: boolean;
};

export type ResidualCashFlowInput = {
  readonly periodIndex: number;
  readonly operatingCashFlow: number;
  readonly waccBps: number;
  readonly investedCapital: number;
};

export type Val07AnalysisResult = {
  readonly schema: typeof VAL07_RESIDUAL_INCOME_SCHEMA;
  readonly residualIncome: ResidualIncomeValuation;
  readonly economicProfit: readonly EconomicProfitState[];
  readonly economicValueCreation: EconomicValueCreationState | null;
  readonly excessReturn: readonly ExcessReturnState[];
  readonly residualCashFlowResearch: readonly ResidualCashFlowState[];
  readonly qualificationMarker: typeof HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED;
  readonly researchOnly: true;
  readonly grantsExecutionAuthority: false;
};

export type PostHocPriceComparison = {
  readonly intrinsicEquityValue: number;
  readonly marketPriceMinor: bigint;
  readonly premiumToIntrinsicRatio: number;
  readonly computedAfterIntrinsic: true;
  readonly notUsedInIntrinsicCalculation: true;
};
