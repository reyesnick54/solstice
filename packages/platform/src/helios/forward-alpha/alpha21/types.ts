import type { UtcInstant } from '@solstice/domain';

import type { ShadowCapitalAccountSnapshot, ShadowTrade } from '../alpha04-shadow-capital/types.ts';
import type {
  ALPHA21_CONTINUOUS_SHADOW_RUNTIME_SCHEMA,
  DAILY_SNAPSHOT_SCHEMA,
  PortfolioRuntimeMode,
  StrategyTickStage,
} from './taxonomy.ts';
import type { MarketState } from '../../multi-asset/market-calendar/taxonomy.ts';

/** Research-only continuous runtime; no customer ledger, live broker, or financial effects. */
export type PortfolioRuntimePosture = {
  readonly financialEffectCreated: false;
  readonly liveBroker: false;
  readonly customerMoneyUsed: false;
};

export const PORTFOLIO_RUNTIME_POSTURE: PortfolioRuntimePosture = Object.freeze({
  financialEffectCreated: false,
  liveBroker: false,
  customerMoneyUsed: false,
});

export type CertifiedMarketState = {
  readonly instrumentId: string;
  readonly at: UtcInstant;
  readonly marketState: MarketState;
  readonly sessionOpen: boolean;
  readonly extendedHoursPermitted: boolean;
  readonly executable: boolean;
  readonly calendarId: string | null;
};

export type PortfolioCashState = {
  readonly currency: string;
  readonly settledMinor: string;
  readonly unsettledMinor: string;
  readonly reservedMinor: string;
};

export type PortfolioExposureState = {
  readonly grossExposureMinor: string;
  readonly netExposureMinor: string;
};

export type PortfolioPnLState = {
  readonly realizedMinor: string;
  readonly unrealizedMinor: string;
  readonly feesMinor: string;
  readonly navMinor: string;
};

export type PortfolioDrawdownState = {
  readonly peakNavMinor: string;
  readonly drawdownMinor: string;
  readonly drawdownBps: number;
};

export type BenchmarkNavState = {
  readonly benchmarkId: string;
  readonly navMinor: string;
  readonly asOf: UtcInstant;
};

export type PortfolioRuntimeState = {
  readonly schema: typeof ALPHA21_CONTINUOUS_SHADOW_RUNTIME_SCHEMA;
  readonly runtimeId: string;
  readonly mode: PortfolioRuntimeMode;
  readonly posture: PortfolioRuntimePosture;
  readonly asOf: UtcInstant;
  readonly cash: PortfolioCashState;
  readonly pnl: PortfolioPnLState;
  readonly exposure: PortfolioExposureState;
  readonly drawdown: PortfolioDrawdownState;
  readonly benchmark: BenchmarkNavState;
  readonly positionCount: number;
  readonly activeStrategyIds: readonly string[];
  readonly marketSessions: readonly CertifiedMarketState[];
  readonly pendingOutcomes: readonly ScheduledOutcome[];
  readonly sequence: number;
};

export type ScheduledOutcome = {
  readonly outcomeId: string;
  readonly strategyId: string;
  readonly kind: 'SETTLEMENT' | 'RECONCILE' | 'MARK';
  readonly dueAt: UtcInstant;
  readonly instrumentId: string | null;
};

export type PaperFillRecord = {
  readonly fillId: string;
  readonly strategyId: string;
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantityMinor: string;
  readonly priceMinor: string;
  readonly feeMinor: string;
  readonly routedVia: 'EXECUTION_TWIN' | 'PAPER_BROKER';
  readonly externalBrokerSubmitted: false;
  readonly filledAt: UtcInstant;
};

export type StrategyTickRecord = {
  readonly tickId: string;
  readonly strategyId: string;
  readonly at: UtcInstant;
  readonly stagesCompleted: readonly StrategyTickStage[];
  readonly marketClosed: boolean;
  readonly riskBlocked: boolean;
  readonly fill: PaperFillRecord | null;
  readonly shadowTrade: ShadowTrade | null;
};

export type ActiveStrategyConfig = {
  readonly strategyId: string;
  readonly instrumentIds: readonly string[];
  /** When true, PRE_MARKET and POST_MARKET permit ticks for equity calendars. */
  readonly extendedHoursPermitted: boolean;
};

export type PortfolioRuntimePorts = {
  readonly produceStrategyDecision: (input: {
    readonly strategyId: string;
    readonly certifiedStates: readonly CertifiedMarketState[];
    readonly at: UtcInstant;
  }) =>
    | { readonly action: 'NO_ACTION' }
    | {
        readonly action: 'TRADE';
        readonly instrumentId: string;
        readonly side: 'BUY' | 'SELL';
        readonly quantityMinor: bigint;
        readonly priceMinor: bigint;
        readonly feeMinor: bigint;
      };
  readonly riskPermits: (input: { readonly strategyId: string; readonly at: UtcInstant }) => boolean;
  readonly capitalAllocationMinor: (input: {
    readonly strategyId: string;
    readonly instrumentId: string;
    readonly at: UtcInstant;
  }) => bigint | null;
  readonly executionPlanId: (input: { readonly strategyId: string; readonly instrumentId: string }) => string;
  readonly routePaperFill: (input: {
    readonly strategyId: string;
    readonly instrumentId: string;
    readonly side: 'BUY' | 'SELL';
    readonly quantityMinor: bigint;
    readonly priceMinor: bigint;
    readonly feeMinor: bigint;
    readonly executionPlanId: string;
    readonly at: UtcInstant;
  }) => PaperFillRecord;
};

export type ImmutableDailyPortfolioSnapshot = {
  readonly schema: typeof DAILY_SNAPSHOT_SCHEMA;
  readonly tradingDay: string;
  readonly sealedAt: UtcInstant;
  readonly digest: string;
  readonly runtime: PortfolioRuntimeState;
  readonly shadowSnapshot: ShadowCapitalAccountSnapshot;
  readonly fills: readonly PaperFillRecord[];
  readonly ticks: readonly StrategyTickRecord[];
};
