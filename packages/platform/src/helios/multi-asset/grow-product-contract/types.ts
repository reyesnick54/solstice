import type { UtcInstant } from '@solstice/domain';
import type { GrowMoneyDto, PaperDisclosureContract } from '../../paper-grow/types.ts';

export type { GrowMoneyDto };
import type { ConsumerGrowStatus } from '../../paper-grow/status-semantics.ts';
import type { GrowCycleStatus } from '../../paper-grow/taxonomy.ts';

export const GROW_OPERATING_MODES = ['SIMULATION', 'PAPER', 'SANDBOX', 'LIVE'] as const;
export type GrowOperatingMode = (typeof GROW_OPERATING_MODES)[number];

export const GROW_PRODUCT_RISK_STATES = ['NORMAL', 'ELEVATED', 'RESTRICTED', 'PAUSED', 'BLOCKED'] as const;
export type GrowProductRiskState = (typeof GROW_PRODUCT_RISK_STATES)[number];

export const GROW_PRODUCT_ACTIVITY_KINDS = [
  'OPPORTUNITY_FOUND',
  'OPPORTUNITY_REJECTED',
  'STRATEGY_EVALUATED',
  'CAPITAL_ALLOCATED',
  'TRADE_SUBMITTED',
  'FILL',
  'EXIT',
  'SETTLEMENT',
  'RECONCILIATION',
  'RISK_INTERVENTION',
  'USER_PAUSE',
  'USER_RESUME',
] as const;
export type GrowProductActivityKind = (typeof GROW_PRODUCT_ACTIVITY_KINDS)[number];

export const GROW_PERFORMANCE_PERIODS = ['daily', 'weekly', 'monthly', 'since_inception'] as const;
export type GrowPerformancePeriod = (typeof GROW_PERFORMANCE_PERIODS)[number];

export const GROW_POSITION_EXIT_STATES = ['OPEN', 'EXIT_PENDING', 'CLOSED', 'NONE'] as const;
export type GrowPositionExitState = (typeof GROW_POSITION_EXIT_STATES)[number];

export type GrowEconomicImprovementBreakdown = {
  readonly deposits: GrowMoneyDto;
  readonly withdrawals: GrowMoneyDto;
  readonly realizedInvestmentPnl: GrowMoneyDto;
  readonly unrealizedInvestmentPnl: GrowMoneyDto;
  readonly fees: GrowMoneyDto;
  readonly cashYield: GrowMoneyDto;
  readonly rewards: GrowMoneyDto;
  readonly savings: GrowMoneyDto;
  readonly otherEconomicImprovement: GrowMoneyDto;
  readonly principalDepositsAreNotGrowth: true;
  readonly unrealizedIsNotWithdrawable: true;
};

export type GrowProductSummaryResponse = {
  readonly schema: 'sunrey.consumer.grow.summary.v1';
  readonly customerId: string;
  readonly subjectId: string;
  readonly operatingMode: GrowOperatingMode;
  readonly operatingState: ConsumerGrowStatus;
  readonly cycleStatus: GrowCycleStatus;
  readonly riskState: GrowProductRiskState;
  readonly totalAuthorizedGrowCapital: GrowMoneyDto;
  readonly activeDeployedCapital: GrowMoneyDto;
  readonly reservedCapital: GrowMoneyDto;
  readonly settledCash: GrowMoneyDto;
  readonly availableCapital: GrowMoneyDto;
  readonly withdrawableCash: GrowMoneyDto;
  readonly portfolioEquity: GrowMoneyDto;
  readonly realizedPnl: GrowMoneyDto;
  readonly unrealizedPnl: GrowMoneyDto;
  readonly totalVerifiedInvestmentReturn: GrowMoneyDto;
  readonly economicImprovement: GrowEconomicImprovementBreakdown;
  readonly disclosure: PaperDisclosureContract;
  readonly valuationFreshness: UtcInstant | null;
  readonly frontendMathAuthoritative: false;
  readonly serverOwned: true;
};

export type GrowProductPosition = {
  readonly positionId: string;
  readonly instrumentId: string;
  readonly instrumentLabel: string;
  readonly strategyRef: string;
  readonly strategyLabel: string;
  readonly assetClass: string;
  readonly quantity: string;
  readonly entryPrice: GrowMoneyDto | null;
  readonly currentReferencePrice: GrowMoneyDto | null;
  readonly unrealizedPnl: GrowMoneyDto | null;
  readonly realizedPnl: GrowMoneyDto | null;
  readonly positionAgeDays: number | null;
  readonly openedAt: UtcInstant | null;
  readonly riskState: GrowProductRiskState;
  readonly exitState: GrowPositionExitState;
  readonly positionStatus: 'OPEN' | 'CLOSED' | 'PENDING';
};

export type GrowProductPositionsResponse = {
  readonly schema: 'sunrey.consumer.grow.positions.v1';
  readonly customerId: string;
  readonly items: readonly GrowProductPosition[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly disclosure: PaperDisclosureContract;
  readonly frontendMathAuthoritative: false;
  readonly serverOwned: true;
};

export type GrowProductActivityEvent = {
  readonly eventId: string;
  readonly kind: GrowProductActivityKind;
  readonly occurredAt: UtcInstant;
  readonly summary: string;
  readonly instrumentId: string | null;
  readonly instrumentLabel: string | null;
  readonly amount: GrowMoneyDto | null;
  readonly operatingMode: GrowOperatingMode;
  readonly evidenceRefs: readonly string[];
  readonly proposalId: string | null;
  readonly executionId: string | null;
};

export type GrowProductActivityResponse = {
  readonly schema: 'sunrey.consumer.grow.events.v1';
  readonly customerId: string;
  readonly items: readonly GrowProductActivityEvent[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly disclosure: PaperDisclosureContract;
  readonly frontendMathAuthoritative: false;
  readonly serverOwned: true;
};

export type GrowProductStrategySummary = {
  readonly strategyRef: string;
  readonly strategyFamily: string;
  readonly strategyVersion: string;
  readonly displayName: string;
  readonly status: ConsumerGrowStatus;
  readonly instruments: readonly string[];
  readonly paperEligible: true;
  readonly liveEligible: false;
  readonly allocation: GrowMoneyDto;
  readonly performanceAttribution: {
    readonly realized: GrowMoneyDto;
    readonly unrealized: GrowMoneyDto;
    readonly fees: GrowMoneyDto;
    readonly netVerifiedReturn: GrowMoneyDto;
  };
  readonly riskContribution: GrowProductRiskState;
  readonly strategyCapsuleId: string | null;
};

export type GrowProductStrategiesResponse = {
  readonly schema: 'sunrey.consumer.grow.strategies.v1';
  readonly customerId: string;
  readonly items: readonly GrowProductStrategySummary[];
  readonly disclosure: PaperDisclosureContract;
  readonly frontendMathAuthoritative: false;
  readonly serverOwned: true;
};

export type GrowProductPerformanceSlice = {
  readonly period: GrowPerformancePeriod;
  readonly startAt: UtcInstant | null;
  readonly endAt: UtcInstant;
  readonly netContributions: GrowMoneyDto;
  readonly portfolioValue: GrowMoneyDto;
  readonly realizedInvestmentPnl: GrowMoneyDto;
  readonly unrealizedInvestmentPnl: GrowMoneyDto;
  readonly fees: GrowMoneyDto;
  readonly cashYield: GrowMoneyDto;
  readonly rewards: GrowMoneyDto;
  readonly savings: GrowMoneyDto;
  readonly otherEconomicImprovement: GrowMoneyDto;
  readonly totalVerifiedInvestmentReturn: GrowMoneyDto;
  readonly depositsAreNotPerformance: true;
  readonly unrealizedIsNotWithdrawable: true;
};

export type GrowProductPerformanceResponse = {
  readonly schema: 'sunrey.consumer.grow.product-performance.v1';
  readonly customerId: string;
  readonly period: GrowPerformancePeriod;
  readonly slice: GrowProductPerformanceSlice;
  readonly disclosure: PaperDisclosureContract;
  readonly frontendMathAuthoritative: false;
  readonly serverOwned: true;
};
