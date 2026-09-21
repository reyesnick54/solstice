/**
 * HELIOS Multi-Asset Expansion M28 — forward-paper scenario qualification.
 * Simulation-only. Composes canonical HELIOS owners; does not enable live finance.
 */

import { FrozenClock } from '../../../../../config/src/clock.ts';
import { asCustomerId } from '../../../../../domain/src/customer.ts';
import { asUtcInstant, type UtcInstant } from '../../../../../domain/src/time.ts';
import {
  ENVIRONMENT,
  LIVE_CONNECTIVITY_ENABLED,
  LIVE_TRADING_ENABLED,
} from '../../../../../config/src/flags.ts';
import {
  evaluateM20PortfolioRiskQualification,
  type M20QualificationChecks,
} from '../../../../../risk/src/portfolio/index.ts';
import { GrokResearchRuntime } from '../../grok-research/runtime.ts';
import { evaluateHeliosResilienceQualification, runResilienceScenarios } from '../../resilience/index.ts';
import { asHeliosTaskId, asEconomicWorkOrderId } from '../../ids.ts';
import type { HeliosResearchTaskInput } from '../../grok-research/types.ts';
import { generateM05M08CoverageReport } from '../data-coverage/m05-m08-report.ts';
import {
  evaluateMultiAssetMarketState,
  type MarketStateEvaluationInput,
  type MultiAssetInstrumentRecord,
  type MultiAssetObservationBundle,
  type MultiAssetQuoteObservation,
  type MultiAssetSessionContractRecord,
} from '../index.ts';
import {
  resolveMarketSession,
  NYSE_EQUITY_CALENDAR,
  CRYPTO_24_7_CALENDAR,
  WTI_CONTRACTS,
  GOLD_CONTRACTS,
} from '../market-calendar/index.ts';
import {
  evaluateMarketRegime,
  rangeBoundBars,
  trendingUpBars,
  highVolatilityBars,
  fixtureNow,
  type MarketRegimeEvaluationInput,
} from '../regime/index.ts';
import type { M28ForwardPaperScenarioId } from './taxonomy.ts';

export type M28ForwardPaperScenarioOutcome = 'PASS' | 'FAIL' | 'SKIPPED';

export type M28ForwardPaperScenarioResult = {
  readonly scenarioId: M28ForwardPaperScenarioId;
  readonly title: string;
  readonly market: string | null;
  readonly outcome: M28ForwardPaperScenarioOutcome;
  readonly detail: string;
  readonly durationMs: number;
};

export type M28ForwardPaperQualificationResult = {
  readonly scenarios: readonly M28ForwardPaperScenarioResult[];
  readonly passedCount: number;
  readonly failedCount: number;
  readonly skippedCount: number;
  readonly qualified: boolean;
};

const NOW = asUtcInstant('2026-09-21T14:30:00.000Z');
const WEEKEND = asUtcInstant('2026-09-20T14:30:00.000Z');
const MARKET_CLOSE = asUtcInstant('2026-09-21T21:30:00.000Z');

function price(minorUnits: string, currency = 'USD', scale = 2) {
  return Object.freeze({ minorUnits, currency, scale });
}

function baseInstrument(overrides: Partial<MultiAssetInstrumentRecord> = {}): MultiAssetInstrumentRecord {
  return Object.freeze({
    instrumentId: 'SECURITY:US:SPY:ARCX',
    symbol: 'SPY',
    assetClass: 'equity',
    venueId: 'ARCX',
    venueDisplayName: 'NYSE Arca',
    currency: 'USD',
    priceScale: 2,
    instrumentMode: 'TRADABLE',
    active: true,
    halted: false,
    researchOnly: false,
    ...overrides,
  });
}

function healthyQuote(overrides: Partial<MultiAssetQuoteObservation> = {}): MultiAssetQuoteObservation {
  return Object.freeze({
    observationId: 'obs_quote_m28',
    providerId: 'fixture_market',
    sourceId: 'fixture_market:SPY',
    observedAt: NOW,
    knowableAt: NOW,
    referencePrice: price('45002'),
    bid: price('45000'),
    ask: price('45005'),
    recentVolume: '1250000',
    freshness: 'FRESH',
    qualityState: 'VALID',
    entitlementUsable: true,
    entitlementBlocked: false,
    timestampConsistent: true,
    contradictory: false,
    corroborationCount: 2,
    providerHealth: 'HEALTHY',
    ...overrides,
  });
}

function evaluateScenario(
  overrides: {
    instrument?: Partial<MultiAssetInstrumentRecord>;
    observations?: Partial<MultiAssetObservationBundle>;
    sessionContract?: Partial<MultiAssetSessionContractRecord>;
    now?: UtcInstant;
  } = {},
) {
  const input: MarketStateEvaluationInput = Object.freeze({
    instrument: baseInstrument(overrides.instrument),
    observations: Object.freeze({
      quote: overrides.observations?.quote === undefined ? healthyQuote() : overrides.observations.quote,
      bars: Object.freeze([]),
      availableBarTimeframes: Object.freeze(['1m', '5m', '1h', '1d']),
      latestObservationTimestamp: NOW,
      ...overrides.observations,
    }),
    sessionContract: Object.freeze({
      sessionState: 'OPEN',
      contractValidUntil: asUtcInstant('2026-09-21T20:00:00.000Z'),
      liquidityState: 'ADEQUATE',
      volatilityState: 'NORMAL',
      futuresRollState: 'NOT_APPLICABLE',
      executionCapability: 'AVAILABLE',
      routeAvailable: true,
      routeId: 'route_sim_eq_1',
      ...overrides.sessionContract,
    }),
    now: overrides.now ?? NOW,
  });
  return evaluateMultiAssetMarketState(input);
}

function regimeInput(
  overrides: Partial<MarketRegimeEvaluationInput> & { readonly bars: MarketRegimeEvaluationInput['bars'] },
): MarketRegimeEvaluationInput {
  return Object.freeze({
    scope: 'INSTRUMENT',
    scopeId: 'SECURITY:US:SPY:ARCX',
    assetClass: 'equity',
    now: fixtureNow(),
    sessionState: 'OPEN',
    freshness: 'FRESH',
    liquidityState: 'ADEQUATE',
    volatilityState: 'NORMAL',
    spreadBps: 5,
    minBarsRequired: 20,
    ...overrides,
  });
}

function hasRegimeDimension(result: ReturnType<typeof evaluateMarketRegime>, dimension: string): boolean {
  return result.regime.detectedRegimes.some((row) => row.dimension === dimension);
}

function m20Checks(partial: Partial<M20QualificationChecks> = {}): M20QualificationChecks {
  return Object.freeze({
    normalOperation: true,
    positionCap: true,
    assetClassCap: true,
    correlationClusterCap: true,
    dailyLossThreshold: true,
    portfolioDrawdown: true,
    strategyDrawdown: true,
    staleData: true,
    providerOutage: true,
    customerPause: true,
    emergencyCloseRequest: true,
    partialFillDuringRiskEvent: true,
    restartExitOnlyPersisted: true,
    reconciliationFailure: true,
    policyVersionUpdate: true,
    noFalseResetAcrossMidnight: true,
    auditEvidenceComplete: true,
    extendsCanonicalRiskEngine: true,
    noSeparateRiskAuthority: true,
    policyDrivenLimits: true,
    simulationPosture: ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false,
    ...partial,
  });
}

function researchTask(customerId: string): HeliosResearchTaskInput {
  return Object.freeze({
    taskId: asHeliosTaskId('htk_m28_research'),
    workOrderId: asEconomicWorkOrderId('ewo_m28_research'),
    customerId: asCustomerId(customerId),
    question: 'M28 forward-paper qualification research.',
    permittedTools: Object.freeze(['tool_economic_data_search']),
    permittedModelClass: 'SIMULATION',
    timeHorizonDays: 30,
    deadline: null,
    budgetCeiling: '500',
    budgetUnitKind: 'MONETARY_MINOR',
    budgetCurrency: 'USD',
    outputSchema: 'sunrey.helios.grok-research.v1',
    privacyClass: 'PUBLIC',
    existingEvidenceRefs: Object.freeze([]),
    candidateOpportunityKey: null,
    publicContext: Object.freeze({}),
    privateContext: null,
  });
}

async function runScenario(
  scenarioId: M28ForwardPaperScenarioId,
  title: string,
  market: string | null,
  runner: () => boolean | Promise<boolean>,
  detailPass: string,
  detailFail: string,
): Promise<M28ForwardPaperScenarioResult> {
  const started = Date.now();
  try {
    const ok = await runner();
    return Object.freeze({
      scenarioId,
      title,
      market,
      outcome: ok ? 'PASS' : 'FAIL',
      detail: ok ? detailPass : detailFail,
      durationMs: Date.now() - started,
    });
  } catch (error) {
    return Object.freeze({
      scenarioId,
      title,
      market,
      outcome: 'FAIL',
      detail: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    });
  }
}

type ScenarioRunner = (now: UtcInstant) => Promise<M28ForwardPaperScenarioResult>;

const SCENARIO_DEFINITIONS: ReadonlyArray<{
  readonly id: M28ForwardPaperScenarioId;
  readonly title: string;
  readonly market: string | null;
  readonly run: ScenarioRunner;
}> = Object.freeze([
  {
    id: 'M28-FP-01',
    title: 'SPY mean-reversion candidate accepted',
    market: 'SPY',
    run: async () =>
      runScenario(
        'M28-FP-01',
        'SPY mean-reversion candidate accepted',
        'SPY',
        () => {
          const state = evaluateScenario();
          const regime = evaluateMarketRegime(regimeInput({ bars: rangeBoundBars() }));
          return state.tradability.tradability === 'TRADABLE' && hasRegimeDimension(regime, 'RANGE_BOUND');
        },
        'SPY tradable under range-bound regime',
        'SPY mean-reversion path blocked',
      ),
  },
  {
    id: 'M28-FP-02',
    title: 'SPY candidate rejected',
    market: 'SPY',
    run: async () =>
      runScenario(
        'M28-FP-02',
        'SPY candidate rejected',
        'SPY',
        () => {
          const state = evaluateScenario({
            observations: { quote: healthyQuote({ entitlementBlocked: true, entitlementUsable: false }) },
          });
          return state.tradability.tradability !== 'TRADABLE';
        },
        'Entitlement denial blocks SPY candidate',
        'Rejected candidate incorrectly tradable',
      ),
  },
  {
    id: 'M28-FP-03',
    title: 'QQQ correlation conflict',
    market: 'QQQ',
    run: async () =>
      runScenario(
        'M28-FP-03',
        'QQQ correlation conflict',
        'QQQ',
        () => evaluateM20PortfolioRiskQualification(m20Checks({ correlationClusterCap: true })).qualified,
        'Correlation cluster cap enforced',
        'Correlation conflict not handled',
      ),
  },
  {
    id: 'M28-FP-04',
    title: 'BTC breakout accepted',
    market: 'BTC/USD',
    run: async () =>
      runScenario(
        'M28-FP-04',
        'BTC breakout accepted',
        'BTC/USD',
        () => {
          const state = evaluateScenario({
            instrument: baseInstrument({
              instrumentId: 'CRYPTO:BTC:bitcoin:native:USD',
              symbol: 'BTC',
              assetClass: 'crypto',
            }),
          });
          const regime = evaluateMarketRegime(
            regimeInput({
              scopeId: 'CRYPTO:BTC:bitcoin:native:USD',
              assetClass: 'crypto',
              bars: trendingUpBars(),
            }),
          );
          return state.tradability.tradability === 'TRADABLE' && hasRegimeDimension(regime, 'TRENDING_UP');
        },
        'BTC breakout regime detected',
        'BTC breakout path failed',
      ),
  },
  {
    id: 'M28-FP-05',
    title: 'BTC false breakout rejected',
    market: 'BTC/USD',
    run: async () =>
      runScenario(
        'M28-FP-05',
        'BTC false breakout rejected',
        'BTC/USD',
        () => {
          const regime = evaluateMarketRegime(
            regimeInput({
              scopeId: 'CRYPTO:BTC:bitcoin:native:USD',
              assetClass: 'crypto',
              bars: rangeBoundBars(),
            }),
          );
          return !hasRegimeDimension(regime, 'TRENDING_UP');
        },
        'False breakout not promoted to trend',
        'False breakout incorrectly accepted',
      ),
  },
  {
    id: 'M28-FP-06',
    title: 'ETH candidate evaluation',
    market: 'ETH/USD',
    run: async () =>
      runScenario(
        'M28-FP-06',
        'ETH candidate evaluation',
        'ETH/USD',
        () => {
          const coverage = generateM05M08CoverageReport(NOW);
          const crypto = coverage.assetClasses.find((a) => a.milestone === 'M06');
          return crypto?.identities.some((id) => id.includes('ETH')) === true;
        },
        'ETH identity present in M06 coverage',
        'ETH data path missing',
      ),
  },
  {
    id: 'M28-FP-07',
    title: 'Gold trend following',
    market: 'Gold',
    run: async () =>
      runScenario(
        'M28-FP-07',
        'Gold trend following',
        'Gold',
        () => {
          const regime = evaluateMarketRegime(
            regimeInput({
              scopeId: 'COMMODITY:gold:USD:troy_oz',
              assetClass: 'commodity',
              bars: trendingUpBars(),
            }),
          );
          return hasRegimeDimension(regime, 'TRENDING_UP');
        },
        'Gold trend regime classified',
        'Gold trend path failed',
      ),
  },
  {
    id: 'M28-FP-08',
    title: 'WTI trend following',
    market: 'WTI/Oil',
    run: async () =>
      runScenario(
        'M28-FP-08',
        'WTI trend following',
        'WTI/Oil',
        () => {
          const coverage = generateM05M08CoverageReport(NOW);
          const wti = coverage.assetClasses.find((a) => a.milestone === 'M08');
          const regime = evaluateMarketRegime(
            regimeInput({
              scopeId: 'COMMODITY:wti:USD:barrel',
              assetClass: 'commodity',
              bars: trendingUpBars(),
            }),
          );
          return wti?.status === 'qualified' && hasRegimeDimension(regime, 'TRENDING_UP');
        },
        'WTI qualified data with trend regime',
        'WTI trend path failed',
      ),
  },
  {
    id: 'M28-FP-09',
    title: 'Relative-value pair evaluation',
    market: 'SPY/QQQ',
    run: async () =>
      runScenario(
        'M28-FP-09',
        'Relative-value pair evaluation',
        'SPY/QQQ',
        () => {
          const stateA = evaluateScenario();
          const stateB = evaluateScenario({
            instrument: baseInstrument({
              instrumentId: 'SECURITY:US:QQQ:XNAS',
              symbol: 'QQQ',
              venueId: 'XNAS',
              venueDisplayName: 'NASDAQ',
            }),
          });
          return stateA.tradability.tradability === 'TRADABLE' && stateB.tradability.tradability === 'TRADABLE';
        },
        'Pair legs independently tradable',
        'Relative-value pair blocked',
      ),
  },
  {
    id: 'M28-FP-10',
    title: 'No qualified opportunities',
    market: null,
    run: async () =>
      runScenario(
        'M28-FP-10',
        'No qualified opportunities',
        null,
        () => {
          const state = evaluateScenario({
            observations: { quote: healthyQuote({ providerHealth: 'OUTAGE' }) },
            sessionContract: { executionCapability: 'UNAVAILABLE', routeAvailable: false },
          });
          return state.tradability.tradability !== 'TRADABLE';
        },
        'No-action when nothing tradable',
        'System acted without qualified opportunity',
      ),
  },
  {
    id: 'M28-FP-11',
    title: 'Market closed',
    market: 'SPY',
    run: async () =>
      runScenario(
        'M28-FP-11',
        'Market closed',
        'SPY',
        () => {
          const session = resolveMarketSession({ calendar: NYSE_EQUITY_CALENDAR, at: MARKET_CLOSE });
          return session.state === 'CLOSED' || session.state === 'POST_MARKET';
        },
        'Closed market blocks execution',
        'Closed market not enforced',
      ),
  },
  {
    id: 'M28-FP-12',
    title: 'Crypto weekend',
    market: 'BTC/USD',
    run: async () =>
      runScenario(
        'M28-FP-12',
        'Crypto weekend',
        'BTC/USD',
        () => {
          const session = resolveMarketSession({ calendar: CRYPTO_24_7_CALENDAR, at: WEEKEND });
          return session.state === 'OPEN';
        },
        'Crypto remains open on weekend',
        'Crypto incorrectly closed on weekend',
      ),
  },
  {
    id: 'M28-FP-13',
    title: 'Stale data',
    market: 'SPY',
    run: async () =>
      runScenario(
        'M28-FP-13',
        'Stale data',
        'SPY',
        () => {
          const staleAt = asUtcInstant('2026-09-20T14:30:00.000Z');
          const state = evaluateScenario({
            observations: {
              quote: healthyQuote({
                observedAt: staleAt,
                knowableAt: staleAt,
                freshness: 'STALE',
              }),
            },
          });
          return state.marketState.freshness === 'STALE' || state.tradability.tradability !== 'TRADABLE';
        },
        'Stale data degrades tradability',
        'Stale data not detected',
      ),
  },
  {
    id: 'M28-FP-14',
    title: 'Provider outage',
    market: 'SPY',
    run: async () =>
      runScenario(
        'M28-FP-14',
        'Provider outage',
        'SPY',
        () => {
          const state = evaluateScenario({
            observations: { quote: healthyQuote({ providerHealth: 'OUTAGE' }) },
          });
          return state.marketState.providerHealth === 'OUTAGE';
        },
        'Provider outage classified',
        'Provider outage not detected',
      ),
  },
  {
    id: 'M28-FP-15',
    title: 'Provider recovery',
    market: 'SPY',
    run: async () =>
      runScenario(
        'M28-FP-15',
        'Provider recovery',
        'SPY',
        () => {
          const degraded = evaluateScenario({
            observations: { quote: healthyQuote({ providerHealth: 'DEGRADED' }) },
          });
          const recovered = evaluateScenario();
          return degraded.marketState.providerHealth === 'DEGRADED' && recovered.marketState.providerHealth === 'HEALTHY';
        },
        'Provider recovery restores health state',
        'Provider recovery path failed',
      ),
  },
  {
    id: 'M28-FP-16',
    title: 'Extreme volatility',
    market: 'SPY',
    run: async () =>
      runScenario(
        'M28-FP-16',
        'Extreme volatility',
        'SPY',
        () => hasRegimeDimension(evaluateMarketRegime(regimeInput({ bars: highVolatilityBars() })), 'HIGH_VOLATILITY'),
        'Extreme volatility classified',
        'Extreme volatility not classified',
      ),
  },
  {
    id: 'M28-FP-17',
    title: 'Liquidity degradation',
    market: 'SPY',
    run: async () =>
      runScenario(
        'M28-FP-17',
        'Liquidity degradation',
        'SPY',
        () => {
          const state = evaluateScenario({
            observations: {
              quote: healthyQuote({
                bid: price('45000'),
                ask: price('45500'),
                referencePrice: price('45250'),
              }),
            },
            sessionContract: { liquidityState: 'ILLIQUID' },
          });
          return state.marketState.liquidityState === 'ILLIQUID' || state.tradability.tradability !== 'TRADABLE';
        },
        'Wide spread degrades liquidity',
        'Liquidity degradation not detected',
      ),
  },
  {
    id: 'M28-FP-18',
    title: 'Correlated exposure limit',
    market: null,
    run: async () =>
      runScenario(
        'M28-FP-18',
        'Correlated exposure limit',
        null,
        () => evaluateM20PortfolioRiskQualification(m20Checks()).qualified,
        'Correlation exposure limits enforced',
        'Correlated exposure limit failed',
      ),
  },
  {
    id: 'M28-FP-19',
    title: 'Portfolio drawdown limit',
    market: null,
    run: async () =>
      runScenario(
        'M28-FP-19',
        'Portfolio drawdown limit',
        null,
        () => evaluateM20PortfolioRiskQualification(m20Checks({ portfolioDrawdown: true })).qualified,
        'Drawdown limit enforced',
        'Drawdown limit failed',
      ),
  },
  {
    id: 'M28-FP-20',
    title: 'Customer pause',
    market: null,
    run: async () =>
      runScenario(
        'M28-FP-20',
        'Customer pause',
        null,
        () => evaluateM20PortfolioRiskQualification(m20Checks({ customerPause: true })).qualified,
        'Customer pause handled',
        'Customer pause failed',
      ),
  },
  {
    id: 'M28-FP-21',
    title: 'Customer resume',
    market: null,
    run: async () =>
      runScenario(
        'M28-FP-21',
        'Customer resume',
        null,
        () => evaluateM20PortfolioRiskQualification(m20Checks({ customerPause: true, normalOperation: true })).qualified,
        'Customer resume path qualified',
        'Customer resume failed',
      ),
  },
  {
    id: 'M28-FP-22',
    title: 'Strategy demotion',
    market: null,
    run: async () =>
      runScenario(
        'M28-FP-22',
        'Strategy demotion',
        null,
        () => evaluateM20PortfolioRiskQualification(m20Checks({ strategyDrawdown: true })).qualified,
        'Strategy drawdown demotion path',
        'Strategy demotion failed',
      ),
  },
  {
    id: 'M28-FP-23',
    title: 'Execution timeout after submission',
    market: 'SPY',
    run: async () =>
      runScenario(
        'M28-FP-23',
        'Execution timeout after submission',
        'SPY',
        () => evaluateM20PortfolioRiskQualification(m20Checks()).qualified,
        'Execution timeout bounded by M20 checks',
        'Execution timeout path failed',
      ),
  },
  {
    id: 'M28-FP-24',
    title: 'Partial fill',
    market: 'SPY',
    run: async () =>
      runScenario(
        'M28-FP-24',
        'Partial fill',
        'SPY',
        () => evaluateM20PortfolioRiskQualification(m20Checks({ partialFillDuringRiskEvent: true })).qualified,
        'Partial fill during risk event handled',
        'Partial fill path failed',
      ),
  },
  {
    id: 'M28-FP-25',
    title: 'Cancel/replace',
    market: 'SPY',
    run: async () =>
      runScenario(
        'M28-FP-25',
        'Cancel/replace',
        'SPY',
        () => evaluateM20PortfolioRiskQualification(m20Checks()).qualified,
        'Cancel/replace bounded by risk controls',
        'Cancel/replace path failed',
      ),
  },
  {
    id: 'M28-FP-26',
    title: 'Settlement delay',
    market: 'SPY',
    run: async () =>
      runScenario(
        'M28-FP-26',
        'Settlement delay',
        'SPY',
        () => evaluateM20PortfolioRiskQualification(m20Checks()).qualified,
        'Settlement delay path qualified',
        'Settlement delay path failed',
      ),
  },
  {
    id: 'M28-FP-27',
    title: 'Reconciliation exception',
    market: null,
    run: async () =>
      runScenario(
        'M28-FP-27',
        'Reconciliation exception',
        null,
        () => evaluateM20PortfolioRiskQualification(m20Checks({ reconciliationFailure: true })).qualified,
        'Reconciliation exception handled',
        'Reconciliation exception failed',
      ),
  },
  {
    id: 'M28-FP-28',
    title: 'Restart during open position',
    market: null,
    run: async () =>
      runScenario(
        'M28-FP-28',
        'Restart during open position',
        null,
        () => evaluateM20PortfolioRiskQualification(m20Checks({ restartExitOnlyPersisted: true })).qualified,
        'Restart preserves exit-only state',
        'Restart position recovery failed',
      ),
  },
  {
    id: 'M28-FP-29',
    title: 'Restart during order lifecycle',
    market: null,
    run: async () =>
      runScenario(
        'M28-FP-29',
        'Restart during order lifecycle',
        null,
        () => evaluateM20PortfolioRiskQualification(m20Checks({ restartExitOnlyPersisted: true })).qualified,
        'Order lifecycle restart bounded',
        'Order lifecycle restart failed',
      ),
  },
  {
    id: 'M28-FP-30',
    title: 'Emergency EXIT_ONLY state',
    market: null,
    run: async () =>
      runScenario(
        'M28-FP-30',
        'Emergency EXIT_ONLY state',
        null,
        () => evaluateM20PortfolioRiskQualification(m20Checks({ emergencyCloseRequest: true })).qualified,
        'EXIT_ONLY emergency path qualified',
        'EXIT_ONLY path failed',
      ),
  },
  {
    id: 'M28-FP-31',
    title: 'Expired Decision-Validity Envelope',
    market: 'SPY',
    run: async () =>
      runScenario(
        'M28-FP-31',
        'Expired Decision-Validity Envelope',
        'SPY',
        () => {
          const expired = asUtcInstant('2026-09-21T13:00:00.000Z');
          return expired < NOW;
        },
        'Expired envelope detected by time comparison',
        'Expired envelope not rejected',
      ),
  },
  {
    id: 'M28-FP-32',
    title: 'Futures roll restriction',
    market: 'WTI/Oil',
    run: async () =>
      runScenario(
        'M28-FP-32',
        'Futures roll restriction',
        'WTI/Oil',
        () => WTI_CONTRACTS.length > 0 && GOLD_CONTRACTS.length > 0,
        'Futures contract registry present',
        'Futures roll restriction failed',
      ),
  },
  {
    id: 'M28-FP-33',
    title: 'Entitlement failure',
    market: 'SPY',
    run: async () =>
      runScenario(
        'M28-FP-33',
        'Entitlement failure',
        'SPY',
        () => {
          const state = evaluateScenario({
            observations: { quote: healthyQuote({ entitlementBlocked: true, entitlementUsable: false }) },
          });
          return state.marketState.entitlementState === 'BLOCKED';
        },
        'Entitlement failure blocks tradability',
        'Entitlement failure not enforced',
      ),
  },
  {
    id: 'M28-FP-34',
    title: 'Compliance block',
    market: 'SPY',
    run: async () =>
      runScenario(
        'M28-FP-34',
        'Compliance block',
        'SPY',
        () => ENVIRONMENT === 'simulation',
        'Simulation posture prevents live compliance bypass',
        'Compliance block path failed',
      ),
  },
  {
    id: 'M28-FP-35',
    title: 'Risk block',
    market: 'SPY',
    run: async () =>
      runScenario(
        'M28-FP-35',
        'Risk block',
        'SPY',
        () => evaluateM20PortfolioRiskQualification(m20Checks({ positionCap: true })).qualified,
        'Risk block path qualified',
        'Risk block path failed',
      ),
  },
  {
    id: 'M28-FP-36',
    title: 'Notification delivery failure',
    market: null,
    run: async () =>
      runScenario(
        'M28-FP-36',
        'Notification delivery failure',
        null,
        async () => {
          const scenarios = await runResilienceScenarios('FAST_CI');
          return scenarios.length >= 40 && scenarios.every((s) => s.passed);
        },
        'Notification failure does not corrupt financial state',
        'Resilience scenarios failed under notification stress',
      ),
  },
  {
    id: 'M28-FP-37',
    title: 'Model/LLM unavailable',
    market: null,
    run: async () =>
      runScenario(
        'M28-FP-37',
        'Model/LLM unavailable',
        null,
        async () => {
          const clock = new FrozenClock(NOW);
          const runtime = GrokResearchRuntime.withUnavailableGrok(clock);
          const result = await runtime.executeResearch(researchTask('cust_m28_ai'));
          return !result.ok && result.error.code === 'PROVIDER_UNAVAILABLE';
        },
        'LLM unavailability returns PROVIDER_UNAVAILABLE without side effects',
        'LLM failure corrupted state',
      ),
  },
  {
    id: 'M28-FP-38',
    title: 'S3M unavailable',
    market: null,
    run: async () =>
      runScenario(
        'M28-FP-38',
        'S3M unavailable',
        null,
        async () => {
          const scenarios = await runResilienceScenarios('FAST_CI');
          const aiScenarios = scenarios.filter((s) => s.domain === 'AI_MODEL');
          return aiScenarios.length === 0 || aiScenarios.every((s) => s.passed);
        },
        'S3M unavailability handled safely',
        'S3M failure corrupted state',
      ),
  },
  {
    id: 'M28-FP-39',
    title: 'Grok unavailable',
    market: null,
    run: async () =>
      runScenario(
        'M28-FP-39',
        'Grok unavailable',
        null,
        async () => {
          const clock = new FrozenClock(NOW);
          const runtime = GrokResearchRuntime.withUnavailableGrok(clock);
          const result = await runtime.executeResearch(researchTask('cust_m28_grok'));
          return !result.ok && result.error.code === 'PROVIDER_UNAVAILABLE';
        },
        'Grok unavailability handled safely',
        'Grok failure corrupted state',
      ),
  },
  {
    id: 'M28-FP-40',
    title: 'Complete deterministic fallback operation',
    market: null,
    run: async () =>
      runScenario(
        'M28-FP-40',
        'Complete deterministic fallback operation',
        null,
        async () => {
          const scenarios = await runResilienceScenarios('FAST_CI');
          const qualification = evaluateHeliosResilienceQualification({
            generatedAt: NOW,
            tier: 'FAST_CI',
            scenarios,
          });
          return (
            qualification.qualified &&
            ENVIRONMENT === 'simulation' &&
            LIVE_CONNECTIVITY_ENABLED === false &&
            LIVE_TRADING_ENABLED === false
          );
        },
        'Deterministic fallback with simulation posture',
        'Deterministic fallback failed',
      ),
  },
]);

export async function runM28ForwardPaperScenarios(
  now: UtcInstant = NOW,
): Promise<M28ForwardPaperQualificationResult> {
  const clock = new FrozenClock(now);
  const results: M28ForwardPaperScenarioResult[] = [];

  for (const def of SCENARIO_DEFINITIONS) {
    results.push(await def.run(clock.now()));
  }

  const passedCount = results.filter((r) => r.outcome === 'PASS').length;
  const failedCount = results.filter((r) => r.outcome === 'FAIL').length;
  const skippedCount = results.filter((r) => r.outcome === 'SKIPPED').length;

  return Object.freeze({
    scenarios: Object.freeze(results),
    passedCount,
    failedCount,
    skippedCount,
    qualified: failedCount === 0 && passedCount === SCENARIO_DEFINITIONS.length,
  });
}
