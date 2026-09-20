import type { UtcInstant } from '@solstice/domain';

export const M09_MARKET_REGIMES = ['TRENDING', 'MEAN_REVERTING', 'HIGH_VOL', 'LOW_VOL', 'UNKNOWN'] as const;
export type M09MarketRegime = (typeof M09_MARKET_REGIMES)[number];

export const M09_SESSION_STATES = ['OPEN', 'CLOSED', 'PRE_MARKET', 'POST_MARKET', 'UNKNOWN'] as const;
export type M09SessionState = (typeof M09_SESSION_STATES)[number];

export const M09_MARKET_STATES = ['NORMAL', 'DEGRADED', 'HALTED', 'STALE', 'UNAVAILABLE'] as const;
export type M09MarketState = (typeof M09_MARKET_STATES)[number];

export const M09_LIQUIDITY_STATES = ['NORMAL', 'WIDE', 'THIN', 'UNAVAILABLE'] as const;
export type M09LiquidityState = (typeof M09_LIQUIDITY_STATES)[number];

export type M09BarObservation = {
  readonly instrumentId: string;
  readonly barInterval: '15m';
  readonly sourceEventTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly closeMinor: bigint;
  readonly openMinor: bigint;
  readonly highMinor: bigint;
  readonly lowMinor: bigint;
  readonly bidMinor: bigint | null;
  readonly askMinor: bigint | null;
  readonly spreadBps: bigint | null;
  readonly available: boolean;
  readonly sessionState: M09SessionState;
  readonly marketState: M09MarketState;
  readonly liquidityState: M09LiquidityState;
  readonly marketRegime: M09MarketRegime;
  readonly providerId: string;
  readonly providerSequence: number;
  readonly observationId: string;
};

export type M09FeatureSnapshot = {
  readonly instrumentId: string;
  readonly asOf: UtcInstant;
  readonly closeMinor: bigint;
  readonly rollingMeanMinor: bigint | null;
  readonly realizedVolBps: bigint | null;
  readonly zScoreScaled: bigint | null;
  readonly spreadBps: bigint | null;
  readonly liquidityState: M09LiquidityState;
  readonly marketState: M09MarketState;
  readonly marketRegime: M09MarketRegime;
  readonly sessionState: M09SessionState;
  readonly historyBars: number;
  readonly stale: boolean;
};

export const M09_DECISION_ACTIONS = ['BUY', 'SELL', 'NO_ACTION', 'HOLD'] as const;
export type M09DecisionAction = (typeof M09_DECISION_ACTIONS)[number];

export const M09_EXIT_REASONS = [
  'MEAN_REVERSION_TARGET',
  'TIME_STOP',
  'VOLATILITY_STOP',
  'END_OF_SESSION',
  'STRATEGY_INVALIDATION',
  'EMERGENCY_CLOSE',
  'RISK_ENGINE_FORCED_CLOSE',
  'NONE',
] as const;
export type M09ExitReason = (typeof M09_EXIT_REASONS)[number];

export const M09_ENTRY_BLOCK_REASONS = [
  'OK',
  'INSUFFICIENT_HISTORY',
  'STALE_OBSERVATION',
  'MARKET_CLOSED',
  'INSTRUMENT_INELIGIBLE',
  'SPREAD_TOO_WIDE',
  'VOLATILITY_TOO_HIGH',
  'DEVIATION_BELOW_THRESHOLD',
  'WORK_ORDER_INACTIVE',
  'MANDATE_INACTIVE',
  'ENVELOPE_INVALID',
  'STRATEGY_INVALIDATED',
] as const;
export type M09EntryBlockReason = (typeof M09_ENTRY_BLOCK_REASONS)[number];

export type M09StrategyDecision = {
  readonly action: M09DecisionAction;
  readonly instrumentId: string;
  readonly recommendedExposureBps: number;
  readonly zScoreScaled: bigint | null;
  readonly entryBlockReason: M09EntryBlockReason;
  readonly exitReason: M09ExitReason;
  readonly rationale: string;
  readonly decidedAt: UtcInstant;
  readonly parameterVersion: string;
};

export type M09OpenPosition = {
  readonly instrumentId: string;
  readonly entryBarIndex: number;
  readonly entryZScoreScaled: bigint;
  readonly openedAt: UtcInstant;
};

export type M09EvaluationContext = {
  readonly workOrderActive: boolean;
  readonly mandateActive: boolean;
  readonly envelopeValid: boolean;
  readonly instrumentEligible: boolean;
  readonly forceClose: boolean;
  readonly riskEngineForcedClose: boolean;
  readonly strategyInvalidated: boolean;
};
