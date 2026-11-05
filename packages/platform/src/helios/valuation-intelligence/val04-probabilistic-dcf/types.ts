import type { TerminalValueMethod } from './taxonomy.ts';

export type DcfDistributionPercentiles = {
  readonly p05: number;
  readonly p10: number;
  readonly p25: number;
  readonly median: number;
  readonly p75: number;
  readonly p90: number;
  readonly p95: number;
};

export type ResolvedAssumptionDraw = {
  readonly revenueGrowth: number;
  readonly margin: number;
  readonly reinvestmentRate: number;
  readonly wacc: number;
  readonly terminalGrowth: number;
  readonly terminalMultiple: number;
};

export type GaussianAssumptionSpec = {
  readonly mean: number;
  readonly stdDev: number;
  readonly min?: number;
  readonly max?: number;
};

export type CorrelatedAssumptionBundle = {
  readonly revenueGrowth: GaussianAssumptionSpec;
  readonly margin: GaussianAssumptionSpec;
  readonly reinvestmentRate: GaussianAssumptionSpec;
  readonly wacc: GaussianAssumptionSpec;
  readonly terminalGrowth: GaussianAssumptionSpec;
  readonly terminalMultiple: GaussianAssumptionSpec;
  /** Row-major 6×6 correlation matrix aligned with DCF_ASSUMPTION_KEYS order. Diagonal must be 1. */
  readonly correlationMatrix: readonly (readonly number[])[];
};

export type ExplicitYearForecast = {
  readonly yearIndex: number;
  readonly revenue?: number;
  readonly margin?: number;
  readonly reinvestmentRate?: number;
  readonly nopat?: number;
  readonly reinvestment?: number;
  readonly fcff?: number;
  readonly fcfe?: number;
};

export type FadeToMaturitySpec = {
  readonly fadeYears: number;
  readonly terminalGrowth: number;
  readonly terminalMargin?: number;
  readonly terminalReinvestmentRate?: number;
  readonly terminalRoic?: number;
};

export type TerminalValueSpec =
  | {
      readonly method: 'TERMINAL_GROWTH';
      readonly terminalGrowth?: number;
    }
  | {
      readonly method: 'EXIT_MULTIPLE';
      readonly terminalMultiple?: number;
      readonly metric: 'NOPAT' | 'FCFF';
    }
  | {
      readonly method: 'FADE_TO_MATURITY';
      readonly fade: FadeToMaturitySpec;
      readonly terminalMethod: 'TERMINAL_GROWTH' | 'EXIT_MULTIPLE';
      readonly terminalGrowth?: number;
      readonly terminalMultiple?: number;
      readonly exitMetric?: 'NOPAT' | 'FCFF';
    };

export type DcfCapitalStructure = {
  readonly netDebt: number;
  readonly cash?: number;
  readonly sharesOutstanding: number;
  readonly interestRate?: number;
  readonly netDebtChangePerYear?: number;
};

export type DcfCoherencePolicy = {
  readonly enforceRoicReinvestmentIdentity: boolean;
  readonly roic?: number;
  readonly nominalEconomicGrowthCap?: number;
  readonly exceptionalTerminalGrowthJustification?: string;
};

export type ProbabilisticDcfInput = {
  readonly valuationId: string;
  readonly entityLabel: string;
  readonly baseRevenue: number;
  readonly forecastYears: number;
  readonly taxRate: number;
  readonly explicitForecasts?: readonly ExplicitYearForecast[];
  readonly terminal: TerminalValueSpec;
  readonly capitalStructure: DcfCapitalStructure;
  readonly assumptions: CorrelatedAssumptionBundle;
  readonly coherence: DcfCoherencePolicy;
  readonly monteCarloPaths?: number;
  readonly seed?: number;
  readonly sensitivityGridSteps?: number;
};

export type YearlyDcfPathRow = {
  readonly yearIndex: number;
  readonly revenue: number;
  readonly margin: number;
  readonly nopat: number;
  readonly reinvestmentRate: number;
  readonly reinvestment: number;
  readonly roicImplied: number | null;
  readonly fcff: number;
  readonly fcfe: number;
};

export type SinglePathDcfResult = {
  readonly yearly: readonly YearlyDcfPathRow[];
  readonly terminalValue: number;
  readonly enterpriseValue: number;
  readonly equityValue: number;
  readonly valuePerShare: number;
  readonly sampled: {
    readonly revenueGrowth: number;
    readonly margin: number;
    readonly reinvestmentRate: number;
    readonly wacc: number;
    readonly terminalGrowth: number;
    readonly terminalMultiple: number;
  };
  readonly constraintNotes: readonly string[];
};

export type SensitivitySurface = {
  readonly id: string;
  readonly xLabel: string;
  readonly yLabel: string;
  readonly xValues: readonly number[];
  readonly yValues: readonly number[];
  /** Row-major grid of median enterprise value (or equity when noted). */
  readonly values: readonly (readonly number[])[];
  readonly metric: 'ENTERPRISE_VALUE' | 'EQUITY_VALUE';
};

export type ProbabilisticDcfResult = {
  readonly schema: 'sunrey.helios.valuation-intelligence.val04-probabilistic-dcf.v1';
  readonly valuationId: string;
  readonly entityLabel: string;
  readonly grantsExecutionAuthority: false;
  readonly researchOnly: true;
  readonly seed: number;
  readonly pathCount: number;
  readonly terminalMethod: TerminalValueMethod;
  readonly representativePath: SinglePathDcfResult;
  readonly enterpriseValue: DcfDistributionPercentiles;
  readonly equityValue: DcfDistributionPercentiles;
  readonly valuePerShare: DcfDistributionPercentiles;
  readonly fcffTerminalYear: DcfDistributionPercentiles;
  readonly fcfeTerminalYear: DcfDistributionPercentiles;
  readonly sensitivitySurfaces: readonly SensitivitySurface[];
  readonly constraintViolations: readonly string[];
  readonly qualificationMarker: 'HELIOS_VAL04_PROBABILISTIC_DCF_QUALIFIED';
};
