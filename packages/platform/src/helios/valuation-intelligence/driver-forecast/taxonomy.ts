/**
 * HELIOS VAL02 — business driver and cash-flow forecast engine taxonomy.
 */

export const HELIOS_VAL02_DRIVER_FORECAST_SCHEMA =
  'sunrey.helios.valuation-intelligence.driver-forecast.v1' as const;
export const HELIOS_VAL02_DRIVER_FORECAST_AUTHORITY = 'RESEARCH_AND_VALUATION_MODELING' as const;

export const FORECAST_HORIZON_BANDS = ['NEAR', 'MEDIUM', 'LONG'] as const;
export type ForecastHorizonBand = (typeof FORECAST_HORIZON_BANDS)[number];

export const DRIVER_NODE_KINDS = [
  'LEAF',
  'PRODUCT',
  'SUM',
  'MARKET_SHARE',
  'CAPACITY_BIND',
] as const;
export type DriverNodeKind = (typeof DRIVER_NODE_KINDS)[number];

export const DRIVER_ROLLUP_DIMENSIONS = ['SEGMENT', 'GEOGRAPHY', 'CONSOLIDATED'] as const;
export type DriverRollupDimension = (typeof DRIVER_ROLLUP_DIMENSIONS)[number];

export const CASH_FLOW_LINE_ITEMS = [
  'revenue',
  'grossMargin',
  'operatingMargin',
  'tax',
  'da',
  'capex',
  'workingCapital',
  'fcff',
  'fcfe',
  'shareCount',
  'netDebt',
] as const;
export type CashFlowLineItem = (typeof CASH_FLOW_LINE_ITEMS)[number];

export const CORRELATED_DRIVER_FACTORS = [
  'revenueGrowth',
  'grossMargin',
  'operatingMargin',
  'capexIntensity',
  'workingCapitalIntensity',
  'reinvestment',
] as const;
export type CorrelatedDriverFactor = (typeof CORRELATED_DRIVER_FACTORS)[number];

export const HELIOS_VAL02_DRIVER_FORECAST_QUALIFIED = 'HELIOS_VAL02_DRIVER_FORECAST_QUALIFIED' as const;
export const HELIOS_VAL02_DRIVER_FORECAST_BLOCKED = 'HELIOS_VAL02_DRIVER_FORECAST_BLOCKED' as const;
