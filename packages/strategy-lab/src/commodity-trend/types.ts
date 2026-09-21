import type { UtcInstant } from '@solstice/domain';

import type { CommodityTrendFollowingConfig, HELIOS_M11_RULE_ID } from './constants.ts';

export type CommodityFreshnessStatus = 'fresh' | 'aging' | 'stale' | 'expired' | 'unknown';
export type CommodityProviderHealth = 'healthy' | 'degraded' | 'unavailable';
export type CommodityTrendDirection = 'UP' | 'DOWN' | 'NEUTRAL';
export type CommodityBreakoutState = 'BULLISH' | 'BEARISH' | 'NONE';
export type CommoditySessionState = 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'POST_MARKET';
export type CommodityInstrumentKind =
  | 'etf_proxy'
  | 'commodity_reference'
  | 'futures_contract'
  | 'futures_continuous'
  | 'other';
export type CommodityRollState = 'FRONT' | 'BACK' | 'ROLLING' | 'POST_ROLL';
export type CommodityMarketStateLabel = 'NORMAL' | 'STALE' | 'UNAVAILABLE' | 'DEGRADED';
export type CommodityPositionSide = 'LONG' | 'SHORT';

export type CommodityTrendBar = {
  readonly instrumentId: string;
  readonly periodStart: UtcInstant;
  readonly openMinor: bigint;
  readonly highMinor: bigint;
  readonly lowMinor: bigint;
  readonly closeMinor: bigint;
  readonly volumeMinor: bigint;
  readonly bidMinor: bigint | null;
  readonly askMinor: bigint | null;
};

export type CommodityTrendMarketState = {
  readonly regime: string | null;
  readonly freshnessStatus: CommodityFreshnessStatus;
  readonly observationAgeMs: number;
  readonly providerHealth: CommodityProviderHealth;
  readonly spreadBps: number;
  readonly liquidityScore: number;
  readonly relativeVolumeRatio: number | null;
  readonly realizedVolatilityBps: number;
  readonly fastMaMinor: bigint;
  readonly slowMaMinor: bigint;
  readonly trendDirection1h: CommodityTrendDirection;
  readonly trendDirection4h: CommodityTrendDirection;
  readonly contextTrend1d: CommodityTrendDirection | null;
  readonly rateOfChangeBps: number;
  readonly breakoutState: CommodityBreakoutState;
  readonly sessionState: CommoditySessionState;
  readonly instrumentKind: CommodityInstrumentKind;
  readonly rollState: CommodityRollState | null;
  readonly contractExpired: boolean;
  readonly historyBars: number;
  readonly marketState: CommodityMarketStateLabel;
};

export type CommodityTrendGovernance = {
  readonly workOrderActive: boolean;
  readonly customerMandateValid: boolean;
  readonly decisionValidityEnvelopeValid: boolean;
  readonly longPermitted: boolean;
  readonly shortPermitted: boolean;
};

export type CommodityTrendPosition = {
  readonly hasOpenPosition: boolean;
  readonly side: CommodityPositionSide | null;
  readonly entryAt: UtcInstant | null;
  readonly entryPriceMinor: bigint | null;
  readonly highWaterMarkMinor: bigint | null;
  readonly lowWaterMarkMinor: bigint | null;
  readonly adverseExcursionBps: number;
};

export type CommodityTrendForcedExit = {
  readonly emergencyClose?: boolean;
  readonly riskForcedExit?: boolean;
  readonly customerPauseOrClose?: boolean;
};

export type CommodityTrendDecisionAction = 'ENTER_LONG' | 'ENTER_SHORT' | 'EXIT' | 'HOLD' | 'NO_ACTION';

export type CommodityTrendDecision = {
  readonly strategyId: typeof HELIOS_M11_RULE_ID;
  readonly action: CommodityTrendDecisionAction;
  readonly instrumentId: string;
  readonly side: CommodityPositionSide | null;
  readonly recommendedConfidenceBps: number;
  readonly rationale: string;
  readonly ruleVersion: string;
  readonly invalidationReason: string | null;
  readonly exitReason: string | null;
  readonly closeMinor: string;
  readonly trendDirection1h: CommodityTrendDirection;
  readonly spreadBps: number;
  readonly realizedVolatilityBps: number;
  readonly decidedAt: UtcInstant;
};

export type CommodityTrendEvaluateInput = {
  readonly strategyId: typeof HELIOS_M11_RULE_ID;
  readonly instrumentId: string;
  readonly bar: CommodityTrendBar;
  readonly market: CommodityTrendMarketState;
  readonly governance: CommodityTrendGovernance;
  readonly position: CommodityTrendPosition;
  readonly forced?: CommodityTrendForcedExit;
  readonly now: UtcInstant;
  readonly config?: Partial<CommodityTrendFollowingConfig>;
};

export type { CommodityTrendFollowingConfig };
