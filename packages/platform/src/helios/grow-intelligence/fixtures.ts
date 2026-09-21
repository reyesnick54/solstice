import type { UtcInstant } from '@solstice/domain';
import { asUtcInstant } from '@solstice/domain';
import { hashGrowIntelligenceFacts } from './facts-hash.ts';
import type {
  GrowIntelligenceFactsPort,
  GrowIntelligenceFactsSnapshot,
  GrowMoneyDto,
} from './types.ts';
import type { LocalDateKey } from '../multi-asset/market-calendar/types.ts';

const USD = (minorUnits: string): GrowMoneyDto => Object.freeze({ minorUnits, currency: 'USD' });

export type GrowIntelligenceScenario =
  | 'morning_default'
  | 'evening_profitable'
  | 'evening_losing'
  | 'evening_no_trade'
  | 'evening_with_deposit'
  | 'evening_with_withdrawal'
  | 'evening_unsettled'
  | 'evening_risk_block'
  | 'evening_provider_outage'
  | 'paper_mode';

function baseFacts(input: {
  readonly customerId: string;
  readonly subjectId: string;
  readonly reportingDate: LocalDateKey;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly timeZone: string;
  readonly now: UtcInstant;
  readonly scenario: GrowIntelligenceScenario;
}): Omit<GrowIntelligenceFactsSnapshot, 'factsHash' | 'assembledAt'> {
  const common = {
    customerId: input.customerId,
    subjectId: input.subjectId,
    reportingDate: input.reportingDate,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    timeZone: input.timeZone,
    executionMode: 'PAPER' as const,
    environment: 'simulation' as const,
    growCapital: USD('10000000'),
    availableCash: USD('2500000'),
    withdrawableCash: USD('2000000'),
    deployedCapital: USD('7500000'),
    unsettledCash: USD('0'),
    activePositions: Object.freeze([
      Object.freeze({
        instrumentId: 'CRYPTO:btc:USD',
        displayName: 'Bitcoin',
        quantityUnits: '100000000',
        marketValue: USD('5000000'),
        unrealized: USD('250000'),
        positionStatus: 'OPEN' as const,
        isPaper: true as const,
      }),
    ]),
    marketRegimes: Object.freeze([
      Object.freeze({
        scope: 'CRYPTO',
        dimension: 'TREND',
        label: 'TRENDING_UP',
        confidenceBand: 'MEDIUM',
        asOf: input.now,
      }),
    ]),
    scheduledMarketEvents: Object.freeze([
      Object.freeze({
        eventId: 'm14.cpi.us',
        title: 'US CPI release',
        domain: 'inflation_release',
        scheduledTime: asUtcInstant('2026-09-21T12:30:00.000Z'),
        relevance: 'HIGH',
      }),
    ]),
    monitoredMarkets: Object.freeze([
      Object.freeze({
        instrumentId: 'CRYPTO:btc:USD',
        displayName: 'Bitcoin',
        reason: 'Active Grow mandate coverage',
      }),
    ]),
    riskState: 'NORMAL',
    riskInterventions: Object.freeze([]),
    providerLimitations: Object.freeze([]),
    dataLimitations: Object.freeze([]),
    strategyStateChanges: Object.freeze([]),
    startingPortfolioValue: USD('9800000'),
    endingPortfolioValue: USD('10000000'),
    realizedPnl: USD('50000'),
    unrealizedPnl: USD('150000'),
    fees: USD('10000'),
    tradesOpened: Object.freeze([]),
    tradesClosed: Object.freeze([]),
    opportunitiesEvaluated: 0,
    opportunitiesRejected: Object.freeze([]),
    principalDepositsExcluded: USD('0'),
    withdrawals: USD('0'),
    performanceAttribution: Object.freeze([
      Object.freeze({
        source: 'BTC position',
        amount: USD('150000'),
        kind: 'UNREALIZED' as const,
        excludesDeposits: true as const,
      }),
    ]),
    growPaused: false,
    providerDegraded: false,
    reconciliationProblem: false,
    customerActionRequired: false,
  };

  switch (input.scenario) {
    case 'evening_profitable':
      return {
        ...common,
        realizedPnl: USD('200000'),
        unrealizedPnl: USD('100000'),
        endingPortfolioValue: USD('10200000'),
      };
    case 'evening_losing':
      return {
        ...common,
        realizedPnl: USD('-150000'),
        unrealizedPnl: USD('-50000'),
        endingPortfolioValue: USD('9700000'),
        performanceAttribution: Object.freeze([
          Object.freeze({
            source: 'BTC position',
            amount: USD('-50000'),
            kind: 'UNREALIZED' as const,
            excludesDeposits: true as const,
          }),
        ]),
      };
    case 'evening_no_trade':
      return {
        ...common,
        tradesOpened: Object.freeze([]),
        tradesClosed: Object.freeze([]),
        opportunitiesEvaluated: 2,
        opportunitiesRejected: Object.freeze([
          Object.freeze({
            opportunityId: 'opp_btc_breakout',
            instrumentId: 'CRYPTO:btc:USD',
            displayName: 'BTC breakout',
            rejectionReason: 'the volatility threshold exceeded your current Grow mandate',
            evaluatedAt: input.periodEnd,
            counterfactualProfitClaimPermitted: false as const,
          }),
        ]),
      };
    case 'evening_with_deposit':
      return {
        ...common,
        principalDepositsExcluded: USD('500000'),
        growCapital: USD('10500000'),
        endingPortfolioValue: USD('10500000'),
      };
    case 'evening_with_withdrawal':
      return {
        ...common,
        withdrawals: USD('300000'),
        withdrawableCash: USD('1700000'),
      };
    case 'evening_unsettled':
      return {
        ...common,
        unsettledCash: USD('400000'),
        withdrawableCash: USD('1600000'),
        tradesOpened: Object.freeze([
          Object.freeze({
            tradeId: 'trd_open_1',
            instrumentId: 'CRYPTO:btc:USD',
            displayName: 'Bitcoin',
            side: 'BUY' as const,
            quantityUnits: '10000000',
            notional: USD('400000'),
            isPaper: true as const,
            occurredAt: input.periodEnd,
            settlementState: 'UNSETTLED' as const,
          }),
        ]),
      };
    case 'evening_risk_block':
      return {
        ...common,
        riskState: 'NEW_ENTRIES_BLOCKED',
        riskInterventions: Object.freeze([
          Object.freeze({
            interventionId: 'risk_1',
            kind: 'NEW_ENTRIES_BLOCKED',
            message: 'HELIOS blocked new entries because portfolio drawdown exceeded your mandate threshold.',
            occurredAt: input.periodEnd,
          }),
        ]),
      };
    case 'evening_provider_outage':
      return {
        ...common,
        providerDegraded: true,
        providerLimitations: Object.freeze([
          Object.freeze({
            code: 'MARKET_DATA_DEGRADED',
            message: 'Market data freshness is degraded for one monitored provider.',
            severity: 'WARNING' as const,
          }),
        ]),
      };
    case 'paper_mode':
      return {
        ...common,
        executionMode: 'PAPER' as const,
      };
    case 'morning_default':
    default:
      return common;
  }
}

export function fixtureGrowIntelligenceFacts(input: {
  readonly customerId: string;
  readonly subjectId: string;
  readonly reportingDate: LocalDateKey;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly timeZone: string;
  readonly now: UtcInstant;
  readonly scenario?: GrowIntelligenceScenario;
}): GrowIntelligenceFactsSnapshot {
  const body = baseFacts({
    ...input,
    scenario: input.scenario ?? 'morning_default',
  });
  const factsHash = hashGrowIntelligenceFacts(body);
  return Object.freeze({ ...body, factsHash, assembledAt: input.now });
}

export function createFixtureFactsPort(
  scenario: GrowIntelligenceScenario = 'morning_default',
): GrowIntelligenceFactsPort {
  return Object.freeze({
    assembleFacts(input) {
      return fixtureGrowIntelligenceFacts({ ...input, scenario });
    },
  });
}
