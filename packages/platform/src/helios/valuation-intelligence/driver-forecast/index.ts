export {
  HELIOS_VAL02_DRIVER_FORECAST_SCHEMA,
  HELIOS_VAL02_DRIVER_FORECAST_AUTHORITY,
  FORECAST_HORIZON_BANDS,
  DRIVER_NODE_KINDS,
  DRIVER_ROLLUP_DIMENSIONS,
  CASH_FLOW_LINE_ITEMS,
  CORRELATED_DRIVER_FACTORS,
  HELIOS_VAL02_DRIVER_FORECAST_QUALIFIED,
  HELIOS_VAL02_DRIVER_FORECAST_BLOCKED,
  type ForecastHorizonBand,
  type DriverNodeKind,
  type DriverRollupDimension,
  type CashFlowLineItem,
  type CorrelatedDriverFactor,
} from './taxonomy.ts';

export type {
  DriverLeafNode,
  DriverProductNode,
  DriverSumNode,
  DriverMarketShareNode,
  DriverCapacityBindNode,
  DriverTreeNode,
  DriverTreeEvaluation,
  HorizonBlendWeights,
  CorrelationSpec,
  TerminalAssumptions,
  BusinessDriverModel,
  AnalystRevenueExpectation,
  BuildDriverForecastInput,
  PeriodCashFlowSample,
  LineItemDistribution,
  PeriodCashFlowDistribution,
  DriverForecastResult,
} from './types.ts';

export { DEFAULT_VAL02_CORRELATION, drawCorrelatedFactors, type CorrelatedFactorDraw } from './correlations.ts';
export { evaluateDriverTree } from './driver-tree.ts';
export { assessEconomicFeasibility, type FeasibilityRejection } from './constraints.ts';
export { buildDriverCashFlowForecast } from './engine.ts';
export {
  createHeliosVal02DriverForecastService,
  type HeliosVal02DriverForecastService,
} from './service.ts';
export {
  evaluateVal02DriverForecastQualification,
  qualificationChecksFromForecast,
  type Val02DriverForecastQualificationChecks,
  type Val02DriverForecastQualificationResult,
} from './qualification.ts';
export {
  FIXTURE_VAL02_AS_OF,
  fixtureVal02Fundamentals,
  fixtureVal02DriverModel,
  FIXTURE_VAL02_ANALYST_REVENUE,
} from './fixtures.ts';

export const VAL02_DRIVER_FORECAST_MODULE =
  'packages/platform/src/helios/valuation-intelligence/driver-forecast/index.ts' as const;
