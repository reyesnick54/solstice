/**
 * HELIOS Multi-Asset Expansion M04 — market state and tradability tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant, type UtcInstant } from '../packages/domain/src/time.ts';
import {
  bridgeMarketStateToAllResearch,
  evaluateMultiAssetMarketState,
  evaluateMultiAssetM04Qualification,
  HELIOS_MULTI_ASSET_M04_MARKET_STATE_QUALIFIED,
  type MarketStateEvaluationInput,
  type MultiAssetInstrumentRecord,
  type MultiAssetObservationBundle,
  type MultiAssetQuoteObservation,
  type MultiAssetSessionContractRecord,
} from '../packages/platform/src/helios/multi-asset/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-16T14:00:00.000Z');

function price(minorUnits: string, currency = 'USD', scale = 2) {
  return Object.freeze({ minorUnits, currency, scale });
}

function baseInstrument(overrides: Partial<MultiAssetInstrumentRecord> = {}): MultiAssetInstrumentRecord {
  return Object.freeze({
    instrumentId: 'SECURITY:US:AAPL:XNAS',
    symbol: 'AAPL',
    assetClass: 'equity',
    venueId: 'XNAS',
    venueDisplayName: 'NASDAQ',
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
    observationId: 'obs_quote_1',
    providerId: 'fixture_market',
    sourceId: 'fixture_market:AAPL',
    observedAt: asUtcInstant('2026-09-16T13:59:58.000Z'),
    knowableAt: asUtcInstant('2026-09-16T13:59:59.000Z'),
    referencePrice: price('15000'),
    bid: price('14998'),
    ask: price('15002'),
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

function baseObservations(overrides: Partial<MultiAssetObservationBundle> = {}): MultiAssetObservationBundle {
  const quote = overrides.quote === undefined ? healthyQuote() : overrides.quote;
  return Object.freeze({
    quote,
    bars: Object.freeze([
      Object.freeze({
        barId: 'bar_1m_1',
        timeframe: '1m',
        observedAt: asUtcInstant('2026-09-16T13:59:00.000Z'),
        freshness: 'FRESH',
        complete: true,
      }),
    ]),
    availableBarTimeframes: Object.freeze(['1m', '5m', '1h', '1d']),
    latestObservationTimestamp: quote?.observedAt ?? null,
    ...overrides,
  });
}

function baseSession(overrides: Partial<MultiAssetSessionContractRecord> = {}): MultiAssetSessionContractRecord {
  return Object.freeze({
    sessionState: 'OPEN',
    contractValidUntil: asUtcInstant('2026-09-16T20:00:00.000Z'),
    liquidityState: 'ADEQUATE',
    volatilityState: 'NORMAL',
    futuresRollState: 'NOT_APPLICABLE',
    executionCapability: 'AVAILABLE',
    routeAvailable: true,
    routeId: 'route_sim_eq_1',
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
    observations: baseObservations(overrides.observations ?? {}),
    sessionContract: baseSession(overrides.sessionContract),
    now: overrides.now ?? NOW,
  });
  return evaluateMultiAssetMarketState(input);
}

describe('HELIOS Multi-Asset M04 market state and tradability', () => {
  it('passes HELIOS boundary guard', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('healthy equity is TRADABLE with full execution capability', () => {
    const result = evaluateScenario();
    assert.equal(result.tradability.tradability, 'TRADABLE');
    assert.equal(result.marketState.referencePrice?.minorUnits, '15000');
    assert.equal(result.marketState.spread?.minorUnits, '4');
    assert.ok((result.marketState.spreadBps ?? 0) < 500);
    assert.equal(result.tradability.capabilities.observable, true);
    assert.equal(result.tradability.capabilities.researchable, true);
    assert.equal(result.tradability.capabilities.proposalEligible, true);
    assert.equal(result.tradability.capabilities.executable, true);
  });

  it('healthy crypto is researchable but may remain RESEARCH_ONLY when route is sandbox-only', () => {
    const result = evaluateScenario({
      instrument: {
        instrumentId: 'CRYPTO:GLOBAL:BTC:COINBASE',
        symbol: 'BTC',
        assetClass: 'crypto',
        venueId: 'COINBASE',
        venueDisplayName: 'Coinbase',
        currency: 'USD',
        priceScale: 2,
      },
      sessionContract: {
        sessionState: 'OPEN',
        executionCapability: 'SANDBOX_ONLY',
        routeAvailable: true,
        routeId: 'route_crypto_sandbox',
      },
    });
    assert.equal(result.tradability.capabilities.researchable, true);
    assert.equal(result.tradability.capabilities.executable, false);
    assert.notEqual(result.marketState.referencePrice, null);
  });

  it('healthy commodity reference preserves reference price evidence', () => {
    const result = evaluateScenario({
      instrument: {
        instrumentId: 'COMMODITY:GLOBAL:CL:NYMEX',
        symbol: 'CL',
        assetClass: 'commodity',
        venueId: 'NYMEX',
        venueDisplayName: 'NYMEX',
      },
      observations: {
        quote: healthyQuote({
          observationId: 'obs_commodity_ref',
          referencePrice: price('7850'),
          bid: price('7848'),
          ask: price('7852'),
        }),
      },
      sessionContract: {
        futuresRollState: 'STABLE',
        liquidityState: 'ADEQUATE',
      },
    });
    assert.equal(result.marketState.assetClass, 'commodity');
    assert.equal(result.marketState.referencePrice?.minorUnits, '7850');
    assert.equal(result.marketState.futuresRollState, 'STABLE');
    assert.equal(result.tradability.tradability, 'TRADABLE');
  });

  it('stale quote is classified DATA_STALE and not executable', () => {
    const result = evaluateScenario({
      observations: {
        quote: healthyQuote({ freshness: 'STALE' }),
      },
    });
    assert.equal(result.tradability.tradability, 'DATA_STALE');
    assert.equal(result.tradability.capabilities.executable, false);
    assert.equal(result.marketState.freshness, 'STALE');
  });

  it('stale bars are classified DATA_STALE', () => {
    const result = evaluateScenario({
      observations: {
        bars: Object.freeze([
          Object.freeze({
            barId: 'bar_stale',
            timeframe: '1m',
            observedAt: asUtcInstant('2026-09-16T10:00:00.000Z'),
            freshness: 'STALE',
            complete: true,
          }),
        ]),
      },
    });
    assert.equal(result.tradability.tradability, 'DATA_STALE');
  });

  it('provider outage is classified PROVIDER_DEGRADED', () => {
    const result = evaluateScenario({
      observations: {
        quote: healthyQuote({ providerHealth: 'OUTAGE' }),
      },
    });
    assert.equal(result.tradability.tradability, 'PROVIDER_DEGRADED');
    assert.equal(result.tradability.capabilities.researchable, false);
  });

  it('closed market is classified MARKET_CLOSED', () => {
    const result = evaluateScenario({
      sessionContract: { sessionState: 'CLOSED' },
    });
    assert.equal(result.tradability.tradability, 'MARKET_CLOSED');
    assert.equal(result.tradability.capabilities.executable, false);
  });

  it('provider maintenance is classified PROVIDER_DEGRADED', () => {
    const result = evaluateScenario({
      observations: {
        quote: healthyQuote({ providerHealth: 'MAINTENANCE' }),
      },
    });
    assert.equal(result.tradability.tradability, 'PROVIDER_DEGRADED');
  });

  it('expiring futures are classified CONTRACT_EXPIRING', () => {
    const result = evaluateScenario({
      instrument: {
        instrumentId: 'FUTURE:US:ES:XCME',
        assetClass: 'future',
        futuresContract: Object.freeze({ expiryDate: '2026-09-19', rollWindowDays: 5 }),
      },
      sessionContract: { futuresRollState: 'EXPIRING' },
    });
    assert.equal(result.tradability.tradability, 'CONTRACT_EXPIRING');
    assert.equal(result.tradability.capabilities.proposalEligible, false);
  });

  it('missing execution capability is classified EXECUTION_UNAVAILABLE', () => {
    const result = evaluateScenario({
      sessionContract: {
        executionCapability: 'UNAVAILABLE',
        routeAvailable: false,
        routeId: null,
      },
    });
    assert.equal(result.tradability.tradability, 'EXECUTION_UNAVAILABLE');
    assert.equal(result.tradability.capabilities.executable, false);
  });

  it('entitlement failure is classified ENTITLEMENT_BLOCKED', () => {
    const result = evaluateScenario({
      observations: {
        quote: healthyQuote({
          entitlementUsable: false,
          entitlementBlocked: true,
        }),
      },
    });
    assert.equal(result.tradability.tradability, 'ENTITLEMENT_BLOCKED');
    assert.equal(result.tradability.capabilities.researchable, false);
  });

  it('extreme spread downgrades to RESEARCH_ONLY', () => {
    const result = evaluateScenario({
      observations: {
        quote: healthyQuote({
          bid: price('10000'),
          ask: price('20000'),
          referencePrice: price('15000'),
        }),
      },
    });
    assert.equal(result.tradability.tradability, 'RESEARCH_ONLY');
    assert.equal(result.tradability.capabilities.executable, false);
    assert.ok((result.marketState.spreadBps ?? 0) >= 500);
  });

  it('missing volume remains researchable but not executable when otherwise healthy', () => {
    const result = evaluateScenario({
      observations: {
        quote: healthyQuote({ recentVolume: null }),
      },
    });
    assert.equal(result.tradability.tradability, 'RESEARCH_ONLY');
    assert.equal(result.tradability.capabilities.researchable, true);
    assert.equal(result.tradability.capabilities.executable, false);
  });

  it('contradictory sources are classified INSUFFICIENT_DATA', () => {
    const result = evaluateScenario({
      observations: {
        quote: healthyQuote({ contradictory: true, corroborationCount: 0 }),
      },
    });
    assert.equal(result.tradability.tradability, 'INSUFFICIENT_DATA');
    assert.equal(result.marketState.dataQuality.state, 'UNUSABLE');
  });

  it('research-only instrument is classified RESEARCH_ONLY even with a price', () => {
    const result = evaluateScenario({
      instrument: {
        instrumentMode: 'RESEARCH_ONLY',
        researchOnly: true,
      },
    });
    assert.equal(result.tradability.tradability, 'RESEARCH_ONLY');
    assert.notEqual(result.marketState.referencePrice, null);
    assert.equal(result.tradability.capabilities.executable, false);
  });

  it('keeps observable, researchable, proposal eligible, and executable separate', () => {
    const closedWithPrice = evaluateScenario({ sessionContract: { sessionState: 'CLOSED' } });
    assert.equal(closedWithPrice.tradability.capabilities.observable, true);
    assert.equal(closedWithPrice.tradability.capabilities.researchable, true);
    assert.equal(closedWithPrice.tradability.capabilities.executable, false);

    const inactive = evaluateScenario({ instrument: { active: false, instrumentMode: 'INACTIVE' } });
    assert.equal(inactive.tradability.tradability, 'INSTRUMENT_INACTIVE');
    assert.equal(inactive.tradability.capabilities.researchable, false);
  });

  it('bridges MarketState to research systems without provider adapter coupling', () => {
    const result = evaluateScenario();
    const views = bridgeMarketStateToAllResearch(result);
    assert.equal(views.OPPORTUNITY_RESEARCH.admitted, true);
    assert.equal(views.STAT_ARB.admitted, true);
    assert.equal(views.MICROSTRUCTURE.admitted, true);
    assert.equal(views.EXECUTION_RESEARCH.admitted, true);
    assert.match(views.OPPORTUNITY_RESEARCH.admissionReason, /admitted/);
    assert.ok(!('providerId' in views.OPPORTUNITY_RESEARCH));
  });

  it('emits HELIOS_MULTI_ASSET_M04_MARKET_STATE_QUALIFIED when all scenarios pass', () => {
    const scenarios = {
      healthyEquityTradable: evaluateScenario().tradability.tradability === 'TRADABLE',
      healthyCryptoResearchable: evaluateScenario({
        instrument: {
          instrumentId: 'CRYPTO:GLOBAL:BTC:COINBASE',
          assetClass: 'crypto',
          venueId: 'COINBASE',
          venueDisplayName: 'Coinbase',
        },
        sessionContract: { executionCapability: 'SANDBOX_ONLY' },
      }).tradability.capabilities.researchable,
      healthyCommodityReference:
        evaluateScenario({
          instrument: { assetClass: 'commodity', instrumentId: 'COMMODITY:GLOBAL:CL:NYMEX' },
        }).marketState.referencePrice !== null,
      staleQuoteDetected: evaluateScenario({ observations: { quote: healthyQuote({ freshness: 'STALE' }) } })
        .tradability.tradability === 'DATA_STALE',
      staleBarsDetected: evaluateScenario({
        observations: {
          bars: Object.freeze([
            Object.freeze({
              barId: 'bar_stale',
              timeframe: '1m',
              observedAt: NOW,
              freshness: 'STALE',
              complete: true,
            }),
          ]),
        },
      }).tradability.tradability === 'DATA_STALE',
      providerOutageDetected:
        evaluateScenario({ observations: { quote: healthyQuote({ providerHealth: 'OUTAGE' }) } })
          .tradability.tradability === 'PROVIDER_DEGRADED',
      closedMarketDetected:
        evaluateScenario({ sessionContract: { sessionState: 'CLOSED' } }).tradability.tradability ===
        'MARKET_CLOSED',
      providerMaintenanceDetected:
        evaluateScenario({ observations: { quote: healthyQuote({ providerHealth: 'MAINTENANCE' }) } })
          .tradability.tradability === 'PROVIDER_DEGRADED',
      expiringFuturesDetected:
        evaluateScenario({ sessionContract: { futuresRollState: 'EXPIRING' } }).tradability.tradability ===
        'CONTRACT_EXPIRING',
      missingExecutionCapabilityDetected:
        evaluateScenario({ sessionContract: { executionCapability: 'UNAVAILABLE', routeAvailable: false } })
          .tradability.tradability === 'EXECUTION_UNAVAILABLE',
      entitlementFailureDetected:
        evaluateScenario({
          observations: { quote: healthyQuote({ entitlementBlocked: true, entitlementUsable: false }) },
        }).tradability.tradability === 'ENTITLEMENT_BLOCKED',
      extremeSpreadDetected:
        evaluateScenario({
          observations: {
            quote: healthyQuote({ bid: price('10000'), ask: price('20000'), referencePrice: price('15000') }),
          },
        }).tradability.tradability === 'RESEARCH_ONLY',
      missingVolumeDetected:
        evaluateScenario({ observations: { quote: healthyQuote({ recentVolume: null }) } }).tradability.tradability ===
        'RESEARCH_ONLY',
      contradictorySourcesDetected:
        evaluateScenario({ observations: { quote: healthyQuote({ contradictory: true }) } }).tradability
          .tradability === 'INSUFFICIENT_DATA',
      researchOnlyInstrumentDetected:
        evaluateScenario({ instrument: { researchOnly: true, instrumentMode: 'RESEARCH_ONLY' } }).tradability
          .tradability === 'RESEARCH_ONLY',
      capabilitiesSeparatedFromTradability: (() => {
        const closed = evaluateScenario({ sessionContract: { sessionState: 'CLOSED' } });
        return closed.tradability.capabilities.observable && !closed.tradability.capabilities.executable;
      })(),
      researchBridgeProviderNeutral: !('providerId' in bridgeMarketStateToAllResearch(evaluateScenario()).STAT_ARB),
      noAiValidityChecks: true,
    };

    const qualification = evaluateMultiAssetM04Qualification(scenarios);
    assert.equal(qualification.marker, HELIOS_MULTI_ASSET_M04_MARKET_STATE_QUALIFIED);
    assert.equal(qualification.qualified, true);
    assert.deepEqual(qualification.blockers, []);
  });
});
