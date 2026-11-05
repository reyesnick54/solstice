/**
 * HELIOS VAL02 — driver-tree cash-flow forecast types.
 */

import type { UtcInstant } from '@solstice/domain';
import type { PointInTimeFundamentalSnapshot } from '../../feature-fabric/fundamental-types.ts';
import type { ProbabilisticEarningsState } from '../../earnings-intelligence/state-estimator/types.ts';
import type {
  CashFlowLineItem,
  CorrelatedDriverFactor,
  DriverNodeKind,
  DriverRollupDimension,
  ForecastHorizonBand,
  HELIOS_VAL02_DRIVER_FORECAST_AUTHORITY,
  HELIOS_VAL02_DRIVER_FORECAST_SCHEMA,
} from './taxonomy.ts';

export type DriverLeafNode = {
  readonly kind: 'LEAF';
  readonly driverId: string;
  readonly label: string;
  readonly dimension: DriverRollupDimension;
  readonly segmentId: string | null;
  readonly geographyId: string | null;
  readonly baseValue: number;
  readonly unit: string;
  readonly growthShockFactor: CorrelatedDriverFactor | null;
};

export type DriverProductNode = {
  readonly kind: 'PRODUCT';
  readonly driverId: string;
  readonly label: string;
  readonly volume: DriverTreeNode;
  readonly price: DriverTreeNode;
};

export type DriverSumNode = {
  readonly kind: 'SUM';
  readonly driverId: string;
  readonly label: string;
  readonly children: readonly DriverTreeNode[];
};

export type DriverMarketShareNode = {
  readonly kind: 'MARKET_SHARE';
  readonly driverId: string;
  readonly label: string;
  readonly addressableMarket: number;
  readonly marketUnit: string;
  readonly shareBase: number;
  readonly shareGrowthFactor: CorrelatedDriverFactor | null;
};

export type DriverCapacityBindNode = {
  readonly kind: 'CAPACITY_BIND';
  readonly driverId: string;
  readonly label: string;
  readonly demand: DriverTreeNode;
  readonly capacityUnits: number;
  readonly utilizationCap: number;
};

export type DriverTreeNode =
  | DriverLeafNode
  | DriverProductNode
  | DriverSumNode
  | DriverMarketShareNode
  | DriverCapacityBindNode;

export type DriverTreeEvaluation = {
  readonly driverId: string;
  readonly label: string;
  readonly nodeKind: DriverNodeKind;
  readonly value: number;
  readonly unit: string;
  readonly children: readonly DriverTreeEvaluation[];
};

export type HorizonBlendWeights = Readonly<Record<ForecastHorizonBand, number>>;

export type CorrelationSpec = {
  readonly factors: readonly CorrelatedDriverFactor[];
  readonly correlationMatrix: readonly (readonly number[])[];
};

export type TerminalAssumptions = {
  readonly convergenceYears: number;
  readonly terminalRevenueGrowth: number;
  readonly terminalOperatingMargin: number;
  readonly terminalCapexToRevenue: number;
  readonly terminalWorkingCapitalToRevenueDelta: number;
};

export type BusinessDriverModel = {
  readonly modelId: string;
  readonly revenueDriverTree: DriverTreeNode;
  readonly segmentTrees: readonly DriverTreeNode[];
  readonly geographyTrees: readonly DriverTreeNode[];
  readonly horizonWeights: HorizonBlendWeights;
  readonly terminal: TerminalAssumptions;
  readonly correlation: CorrelationSpec;
  readonly forecastYears: number;
  readonly nearTermQuarters: number;
};

export type AnalystRevenueExpectation = {
  readonly fiscalYear: number;
  readonly revenuePoint: number;
  readonly revenueDispersion: number;
};

export type BuildDriverForecastInput = {
  readonly instrumentId: string;
  readonly asOf: UtcInstant;
  readonly fundamentals: PointInTimeFundamentalSnapshot;
  readonly driverModel: BusinessDriverModel;
  readonly nearTermEarnings?: ProbabilisticEarningsState;
  readonly analystRevenueExpectations?: readonly AnalystRevenueExpectation[];
  readonly sampleCount: number;
  readonly randomSeed: number;
};

export type PeriodCashFlowSample = {
  readonly fiscalYear: number;
  readonly horizonBand: ForecastHorizonBand;
  readonly revenue: number;
  readonly grossMargin: number;
  readonly operatingMargin: number;
  readonly taxRate: number;
  readonly da: number;
  readonly capex: number;
  readonly workingCapitalChange: number;
  readonly fcff: number;
  readonly fcfe: number;
  readonly shareCount: number;
  readonly netDebt: number;
  readonly driverTreeRoot: DriverTreeEvaluation;
  readonly economicallyFeasible: true;
};

export type LineItemDistribution = {
  readonly lineItem: CashFlowLineItem;
  readonly mean: number;
  readonly p10: number;
  readonly p50: number;
  readonly p90: number;
  readonly stdDev: number;
};

export type PeriodCashFlowDistribution = {
  readonly fiscalYear: number;
  readonly horizonBand: ForecastHorizonBand;
  readonly lineItems: Readonly<Record<CashFlowLineItem, LineItemDistribution>>;
  readonly feasiblePathCount: number;
  readonly rejectedPathCount: number;
};

export type DriverForecastResult = {
  readonly schema: typeof HELIOS_VAL02_DRIVER_FORECAST_SCHEMA;
  readonly authority: typeof HELIOS_VAL02_DRIVER_FORECAST_AUTHORITY;
  readonly instrumentId: string;
  readonly asOf: UtcInstant;
  readonly modelId: string;
  readonly researchOnly: true;
  readonly grantsExecutionAuthority: false;
  readonly epsExtrapolationOnly: false;
  readonly driverTreesUsed: boolean;
  readonly horizonBands: readonly ForecastHorizonBand[];
  readonly periods: readonly PeriodCashFlowDistribution[];
  readonly consolidatedDriverTree: DriverTreeEvaluation;
  readonly correlationFactors: readonly CorrelatedDriverFactor[];
  readonly nearTermEarn09Anchored: boolean;
  readonly sampleCount: number;
  readonly disclaimer: 'NOT_INVESTMENT_ADVICE_NOT_EXECUTION_AUTHORITY';
};
