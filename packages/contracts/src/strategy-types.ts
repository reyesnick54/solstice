import type { UtcInstant } from './time.ts';

export const STRATEGY_CLASSES = [
  'MEAN_REVERSION',
  'MOMENTUM',
  'MARKET_NEUTRAL_PAIR',
] as const;
export type StrategyClass = (typeof STRATEGY_CLASSES)[number];

export const STRATEGY_LIFECYCLE = [
  'RESEARCH',
  'BACKTEST',
  'OUT_OF_SAMPLE',
  'ADVERSARIAL',
  'SHADOW',
  'PAPER',
] as const;
export type StrategyLifecycleStage = (typeof STRATEGY_LIFECYCLE)[number];

export type StrategyProposal = {
  readonly proposalId: string;
  readonly strategyId: string;
  readonly strategyClass: StrategyClass;
  readonly instrumentId: string;
  readonly pairInstrumentId?: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantityMicros: bigint;
  readonly limitPriceMinorUnits: bigint;
  readonly currency: string;
  readonly asOf: UtcInstant;
  readonly seed: bigint;
  readonly guaranteed: false;
  readonly expected: false;
  readonly projected: false;
};

export type LifecycleApproval = {
  readonly strategyId: string;
  readonly from: StrategyLifecycleStage;
  readonly to: StrategyLifecycleStage;
  readonly approvedBy: string;
  readonly approvedAt: UtcInstant;
  readonly reason: string;
};

export type TournamentMetrics = {
  readonly strategyId: string;
  readonly scopeLabel: 'INVESTMENT_ACCOUNT_ONLY';
  readonly periodPnlMinorUnits: bigint;
  readonly currency: string;
  readonly volatilityMadBps: bigint;
  readonly drawdownMinorUnits: bigint;
  readonly sharpeLikeRatio: {
    readonly numerator: bigint;
    readonly denominator: bigint;
  } | null;
  readonly turnoverMicros: bigint;
  readonly capacityMicros: bigint;
  readonly correlationBps: bigint;
  readonly slippageBps: bigint;
  readonly liveBacktestDivergenceBps: bigint;
};

export type WeightRecommendation = {
  readonly strategyId: string;
  readonly weightNumerator: bigint;
  readonly weightDenominator: bigint;
  readonly binding: false;
  readonly note: 'RECOMMENDATION_ONLY_RISK_LIMITS_REMAIN_AUTHORITATIVE';
};
