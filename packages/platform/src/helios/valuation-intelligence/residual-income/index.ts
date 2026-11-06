export {
  VAL07_RESIDUAL_INCOME_MODULE,
  VAL07_RESIDUAL_INCOME_SCHEMA,
  VAL07_RATE_BPS_SCALE,
  HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED,
  HELIOS_VAL07_RESIDUAL_INCOME_BLOCKED,
  RESIDUAL_INCOME_STAGE_KINDS,
  ECONOMIC_VALUE_CREATION_LABELS,
  RESIDUAL_CASH_FLOW_RESEARCH_DISCLAIMER,
  type ResidualIncomeStageKind,
  type EconomicValueCreationLabel,
} from './taxonomy.ts';

export type {
  CleanSurplusAdjustment,
  ResidualIncomeState,
  ResidualIncomeForecastPeriod,
  ResidualIncomeContinuingSpec,
  ResidualIncomeForecast,
  ResidualIncomeDistribution,
  ResidualIncomeValuation,
  EconomicProfitState,
  EconomicValueCreationState,
  ExcessReturnState,
  ResidualCashFlowState,
  ResidualIncomeEngineInput,
  EconomicProfitInput,
  ExcessReturnInput,
  ResidualCashFlowInput,
  Val07AnalysisResult,
  PostHocPriceComparison,
} from './types.ts';

export {
  bpsToDecimal,
  presentValue,
  perpetuityPresentValue,
  residualIncomeForPeriod,
  roeDecimalFrom,
  roeToBps,
} from './numeric.ts';

export { reconcileCleanSurplus } from './clean-surplus.ts';

export {
  VAL07_VAL03_BRIDGE_VERSION,
  costOfEquityMidBpsFromVal03,
  costOfEquityUncertaintyBpsFromVal03,
} from './val03-bridge.ts';

export {
  VAL07_EARN09_BRIDGE_VERSION,
  forwardNetIncomeFromEarn09,
  forwardRoeFromEarn09AndBook,
  buildEarn09ForwardEquityAnchor,
  type Earn09ForwardEquityAnchor,
} from './earn09-bridge.ts';

export { computeEconomicProfitState, classifyEconomicValueCreation } from './economic-profit.ts';
export { computeExcessReturnState, intrinsicEquityFromExcessReturnStream } from './excess-return.ts';
export { computeResidualCashFlowState } from './residual-cash-flow.ts';

export {
  runResidualIncomeValuation,
  compareIntrinsicToMarketPrice,
  singleStageIntrinsicFromConstantRi,
} from './residual-income-engine.ts';

export { runVal07ResidualIncomeAnalysis, type Val07AnalysisOptions } from './engine.ts';

export {
  evaluateVal07ResidualIncomeQualification,
  val07EngineeringQualificationChecks,
  type Val07ResidualIncomeQualificationChecks,
  type Val07ResidualIncomeQualificationResult,
} from './qualification.ts';

export {
  VAL07_FIXTURE_AS_OF,
  VAL07_FIXTURE_ENTITY_ID,
  fixturePositiveResidualIncomeInput,
  fixtureRoeEqualsKeInput,
} from './fixtures.ts';
