import type { UtcInstant } from '../../../domain/src/time.ts';

export type PredictionStrategyBookView = {
  readonly contractInstrumentId: string;
  readonly bestBidMinor: bigint | null;
  readonly bestAskMinor: bigint | null;
  readonly midMinor: bigint | null;
  readonly spreadBps: number | null;
  readonly bidDepthContracts: bigint;
  readonly askDepthContracts: bigint;
  readonly volume24hContracts: bigint;
};

export type ProbabilityEdgeEvaluateInput = {
  readonly fairProbMinor: bigint;
  readonly yesBook: PredictionStrategyBookView;
  readonly asOf: UtcInstant;
  readonly minEdgeMinor: bigint;
};

export type ProbabilityEdgeDecision = {
  readonly ruleId: typeof import('./constants.ts').HELIOS_NATIVE13_PROBABILITY_EDGE_RULE_ID;
  readonly action: 'BUY_YES' | 'SELL_YES' | 'HOLD';
  readonly edgeMinor: bigint | null;
  readonly reason: string;
};

export type LiquidityEvaluateInput = {
  readonly book: PredictionStrategyBookView;
  readonly maxSpreadBps: number;
  readonly minBidDepth: bigint;
};

export type LiquidityDecision = {
  readonly ruleId: typeof import('./constants.ts').HELIOS_NATIVE13_LIQUIDITY_RULE_ID;
  readonly tradable: boolean;
  readonly reason: string;
};

export type CrossMarketPairView = {
  readonly yesMidMinor: bigint | null;
  readonly noMidMinor: bigint | null;
};

export type CrossMarketConsistencyInput = {
  readonly pair: CrossMarketPairView;
  readonly maxComplementGapMinor: bigint;
};

export type CrossMarketConsistencyResult = {
  readonly ruleId: typeof import('./constants.ts').HELIOS_NATIVE13_CROSS_MARKET_RULE_ID;
  readonly consistent: boolean;
  readonly complementGapMinor: bigint | null;
  readonly reason: string;
};
