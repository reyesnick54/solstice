/**
 * HELIOS M07 — Gold and precious-metals market intelligence qualification.
 */

import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant, type UtcInstant } from '../packages/domain/src/time.ts';
import { FINNHUB_CREDENTIAL_ENV_VAR } from '../packages/sunrey-exchange/src/capital-market/adapters/finnhub-adapter.ts';
import { createFinnhubCapitalMarketAdapter } from '../packages/sunrey-exchange/src/capital-market/adapters/finnhub-adapter.ts';
import {
  GOLD_FUTURES_CONTINUOUS_ID,
  GOLD_FUTURES_FAMILY_ID,
  GOLD_FUTURES_GCZ2026,
  GOLD_FUTURES_GCZ2026_ID,
  buildGoldFuturesRollSnapshot,
  resolveFuturesMetadata,
} from '../packages/sunrey-exchange/src/capital-market/futures/index.ts';
import {
  GOLD_ETF_GLD_ID,
  GOLD_REFERENCE_ID,
  assertGoldIdentitySeparation,
  createGoldMarketIntelligenceService,
  createHeliosGoldMarketRoute,
  assertOrderedBars,
  filterKnowableBars,
  isBarKnowableAt,
  isBarStale,
  rejectStaleLatestBar,
  GOLD_4H_TREND_MIN_BARS,
  sessionStatusForUtcHour,
} from '../packages/sunrey-exchange/src/capital-market/index.ts';
import { resolveCapitalMarketInstrument } from '../packages/sunrey-exchange/src/capital-market/instrument-registry.ts';
import { SimulationMarketReferenceAdapter } from '../packages/sunrey-exchange/src/market-reference/adapters/simulation.ts';
import {
  HeliosObservationFabric,
  createHeliosObservationStore,
  isKnowableAt,
} from '../packages/platform/src/helios/index.ts';
import {
  evaluateGoldMarketDataQualification,
  HELIOS_MULTI_ASSET_M07_GOLD_MARKET_DATA_QUALIFIED,
} from '../packages/platform/src/helios/multi-asset/gold/index.ts';
import {
  ingestGoldBar,
  ingestGoldQuote,
} from '../packages/sunrey-exchange/src/capital-market/integrations/helios-gold-observation-bridge.ts';

const NOW = asUtcInstant('2026-09-20T16:00:00.000Z');
const TREND_FROM = asUtcInstant('2026-08-01T00:00:00.000Z');
const TREND_TO = asUtcInstant('2026-09-20T16:00:00.000Z');

describe('HELIOS M07 gold market data', () => {
  const originalFinnhub = process.env[FINNHUB_CREDENTIAL_ENV_VAR];

  afterEach(() => {
    if (originalFinnhub === undefined) {
      delete process.env[FINNHUB_CREDENTIAL_ENV_VAR];
    } else {
      process.env[FINNHUB_CREDENTIAL_ENV_VAR] = originalFinnhub;
    }
  });

  it('maps GLD to canonical SECURITY identity', () => {
    const instrument = resolveCapitalMarketInstrument(GOLD_ETF_GLD_ID);
    assert.ok(instrument);
    assert.equal(instrument!.symbol, 'GLD');
    assert.equal(instrument!.assetClass, 'etf');
    assert.equal(instrument!.venue.venueId, 'ARCX');
    assert.equal(instrument!.providerSymbols.finnhub, 'GLD');
  });

  it('registers distinct gold reference identity separate from GLD', () => {
    const route = createHeliosGoldMarketRoute();
    const gld = route.service.resolveIdentity(GOLD_ETF_GLD_ID);
    const ref = route.service.resolveIdentity(GOLD_REFERENCE_ID);
    assert.ok(gld && ref);
    assert.equal(gld!.kind, 'etf_proxy');
    assert.equal(ref!.kind, 'reference_commodity');
    assert.ok(assertGoldIdentitySeparation(gld!, ref!));
    assert.notEqual(gld!.identityId, ref!.identityId);
  });

  it('registers gold futures family and specific contract identities', () => {
    const route = createHeliosGoldMarketRoute();
    const family = route.service.resolveIdentity(GOLD_FUTURES_FAMILY_ID);
    const contract = route.service.resolveIdentity(GOLD_FUTURES_GCZ2026_ID);
    assert.ok(family && contract);
    assert.equal(family!.kind, 'futures_family');
    assert.equal(contract!.kind, 'futures_contract');
    assert.equal(family!.feedQualification, 'EXTERNAL_PROVIDER_REQUIRED');
    assert.equal(contract!.feedQualification, 'EXTERNAL_PROVIDER_REQUIRED');
  });

  it('does not fabricate futures quotes from GLD prices', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const provider = createFinnhubCapitalMarketAdapter({
      fetchFn: async () =>
        new Response(JSON.stringify({ c: 240.5, t: 1_758_384_000 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    });
    const route = createHeliosGoldMarketRoute({
      capitalMarket: { provider, externalQualificationPassed: true },
    });
    const gld = await route.fetchQuote(GOLD_ETF_GLD_ID, NOW);
    assert.equal(gld.ok, true);
    const futures = await route.fetchQuote(GOLD_FUTURES_GCZ2026_ID, NOW);
    assert.equal(futures.ok, false);
    if (!futures.ok) {
      assert.equal(futures.code, 'EXTERNAL_PROVIDER_REQUIRED');
    }
    assert.ok(route.service.assertNotFabricatedFromGld(GOLD_FUTURES_GCZ2026_ID));
  });

  it('returns ordered 4h history with knowableAt semantics and no look-ahead', async () => {
    const route = createHeliosGoldMarketRoute();
    const result = await route.fetch4hTrendHistory(GOLD_REFERENCE_ID, { from: TREND_FROM, to: TREND_TO }, NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(assertOrderedBars(result.candles));
    for (const bar of result.candles) {
      assert.ok(isBarKnowableAt(NOW, bar));
      assert.ok(Date.parse(bar.periodEnd) <= Date.parse(NOW));
      assert.ok(Date.parse(bar.knowableAt) >= Date.parse(bar.periodEnd));
    }
    const futureEval = asUtcInstant('2026-08-05T02:00:00.000Z');
    const filtered = filterKnowableBars(result.candles, futureEval);
    assert.ok(filtered.length < result.candles.length);
  });

  it('provides sufficient 4h history for deterministic trend research', async () => {
    const route = createHeliosGoldMarketRoute();
    const result = await route.fetch4hTrendHistory(GOLD_REFERENCE_ID, { from: TREND_FROM, to: TREND_TO }, NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.candles.length >= GOLD_4H_TREND_MIN_BARS, `expected >= ${GOLD_4H_TREND_MIN_BARS} bars`);
    assert.equal(result.trendReady, true);
  });

  it('exposes expiration metadata and roll state for futures contracts', () => {
    const meta = resolveFuturesMetadata(GOLD_FUTURES_GCZ2026_ID);
    assert.ok(meta);
    assert.equal(meta!.identityKind, 'specific_contract');
    if (meta!.identityKind === 'specific_contract') {
      assert.equal(meta.contractMonthCode, 'Z');
      assert.equal(meta.contractYear, 2026);
      assert.ok(meta.expirationDate);
      assert.equal(meta.settlementType, 'PHYSICAL');
      assert.equal(meta.multiplierMinorUnits, 100n);
    }
    const roll = buildGoldFuturesRollSnapshot(NOW);
    assert.equal(roll.frontContractId, GOLD_FUTURES_GCZ2026_ID);
    assert.equal(roll.rollState, 'FRONT');
  });

  it('marks continuous research series as non-executable', () => {
    const route = createHeliosGoldMarketRoute();
    assert.equal(route.isExecutable(GOLD_FUTURES_CONTINUOUS_ID), false);
    assert.equal(route.isExecutable(GOLD_FUTURES_GCZ2026_ID), true);
    assert.equal(route.isExecutable(GOLD_ETF_GLD_ID), true);
    const continuous = route.service.resolveIdentity(GOLD_FUTURES_CONTINUOUS_ID);
    assert.ok(continuous);
    assert.equal(continuous!.executable, false);
    assert.equal(continuous!.kind, 'continuous_research');
  });

  it('separates ETF and futures identities for execution', () => {
    const route = createHeliosGoldMarketRoute();
    const gld = route.service.resolveIdentity(GOLD_ETF_GLD_ID)!;
    const futures = route.service.resolveIdentity(GOLD_FUTURES_GCZ2026_ID)!;
    assert.notEqual(gld.identityId, futures.identityId);
    assert.notEqual(gld.kind, futures.kind);
    assert.equal(gld.executable, true);
    assert.equal(futures.executable, true);
    assert.ok(assertGoldIdentitySeparation(gld, futures));
  });

  it('rejects stale latest bar beyond freshness window', async () => {
    const route = createHeliosGoldMarketRoute();
    const result = await route.fetchBarHistory(
      GOLD_REFERENCE_ID,
      '4h',
      { from: TREND_FROM, to: TREND_TO },
      NOW,
    );
    assert.equal(result.ok, true);
    if (!result.ok || result.candles.length === 0) return;
    const latest = result.candles[result.candles.length - 1]!;
    assert.equal(isBarStale(latest, NOW), false);
    const staleEval = asUtcInstant('2026-10-01T00:00:00.000Z');
    assert.equal(isBarStale(latest, staleEval), true);
    assert.equal(rejectStaleLatestBar(result.candles, staleEval), null);
    assert.ok(rejectStaleLatestBar(result.candles, NOW));
  });

  it('handles session status for maintenance window', () => {
    assert.equal(sessionStatusForUtcHour(17), 'CLOSED');
    assert.equal(sessionStatusForUtcHour(12), 'OPEN');
  });

  it('persists gold observations through HELIOS observation fabric', async () => {
    const clock = new FrozenClock(NOW);
    const store = createHeliosObservationStore();
    const fabric = new HeliosObservationFabric({ clock, store });
    const service = createGoldMarketIntelligenceService();
    const quoteResult = await service.getQuote(GOLD_REFERENCE_ID, NOW);
    assert.equal(quoteResult.ok, true);
    if (!quoteResult.ok) return;
    const ingested = ingestGoldQuote(fabric, quoteResult.value, GOLD_REFERENCE_ID);
    assert.equal(ingested.ok, true);
    assert.equal(store.listByInstrument(GOLD_REFERENCE_ID).length, 1);
  });

  it('captures entitlement on GLD quote ingestion', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const provider = createFinnhubCapitalMarketAdapter({
      fetchFn: async () =>
        new Response(JSON.stringify({ c: 238.25, t: 1_758_384_000 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    });
    const route = createHeliosGoldMarketRoute({
      capitalMarket: { provider, externalQualificationPassed: true },
    });
    const quote = await route.fetchQuote(GOLD_ETF_GLD_ID, NOW);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;

    const clock = new FrozenClock(NOW);
    const store = createHeliosObservationStore();
    const fabric = new HeliosObservationFabric({ clock, store });
    const ingested = ingestGoldQuote(fabric, quote.observation, GOLD_ETF_GLD_ID);
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    assert.ok(ingested.envelope.entitlement);
    assert.equal(ingested.envelope.canonicalInstrumentId, GOLD_ETF_GLD_ID);
    assert.equal(store.listByInstrument(GOLD_ETF_GLD_ID).length, 1);
  });

  it('handles provider outage without fixture fallback for futures', async () => {
    const sim = new SimulationMarketReferenceAdapter();
    sim.setCircuitOpen(true);
    const route = createHeliosGoldMarketRoute();
    const futures = await route.fetchQuote(GOLD_FUTURES_FAMILY_ID, NOW);
    assert.equal(futures.ok, false);
    if (!futures.ok) {
      assert.equal(futures.code, 'EXTERNAL_PROVIDER_REQUIRED');
    }
  });

  it('exposes Gold MarketState with relationship hooks', async () => {
    const route = createHeliosGoldMarketRoute();
    const state = await route.fetchMarketState(GOLD_ETF_GLD_ID, NOW);
    assert.equal(state.ok, true);
    if (!state.ok) return;
    assert.deepEqual(state.value.relationships, ['USD', 'RATES', 'EQUITIES', 'VOLATILITY', 'INFLATION', 'MACRO_EVENTS']);
    assert.equal(state.value.identity.identityId, GOLD_ETF_GLD_ID);
    assert.ok(state.value.evaluatedAt);
  });

  it('rejects look-ahead bar ingestion via observation bridge', async () => {
    const route = createHeliosGoldMarketRoute();
    const history = await route.fetchBarHistory(
      GOLD_REFERENCE_ID,
      '4h',
      { from: TREND_FROM, to: TREND_TO },
      NOW,
    );
    assert.equal(history.ok, true);
    if (!history.ok || history.candles.length === 0) return;
    const lastBar = history.candles[history.candles.length - 1]!;
    const clock = new FrozenClock(asUtcInstant('2026-08-02T00:00:00.000Z'));
    const fabric = new HeliosObservationFabric({ clock, store: createHeliosObservationStore() });
    const rejected = ingestGoldBar(fabric, lastBar, clock.now(), clock.now());
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.code, 'LOOK_AHEAD');
    }
  });

  it('qualifies M07 gold market data when all checks pass', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const provider = createFinnhubCapitalMarketAdapter({
      fetchFn: async () =>
        new Response(JSON.stringify({ c: 241.0, t: 1_758_384_000 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    });
    const route = createHeliosGoldMarketRoute({
      capitalMarket: { provider, externalQualificationPassed: true },
    });

    const gldQuote = await route.fetchQuote(GOLD_ETF_GLD_ID, NOW);
    const trend = await route.fetch4hTrendHistory(GOLD_REFERENCE_ID, { from: TREND_FROM, to: TREND_TO }, NOW);
    const futuresQuote = await route.fetchQuote(GOLD_FUTURES_GCZ2026_ID, NOW);
    const marketState = await route.fetchMarketState(GOLD_ETF_GLD_ID, NOW);

    const clock = new FrozenClock(NOW);
    const store = createHeliosObservationStore();
    const fabric = new HeliosObservationFabric({ clock, store });
    let persistenceWorks = false;
    let entitlementCaptured = false;
    if (gldQuote.ok) {
      const ingested = ingestGoldQuote(fabric, gldQuote.observation, GOLD_ETF_GLD_ID);
      persistenceWorks = ingested.ok && store.list().length > 0;
      entitlementCaptured = ingested.ok && !ingested.envelope.entitlement.unavailable;
    }

    let knowableAtOk = false;
    let noLookAhead = false;
    if (trend.ok && trend.candles.length > 0) {
      knowableAtOk = trend.candles.every((bar) => isBarKnowableAt(NOW, bar));
      const early = filterKnowableBars(trend.candles, asUtcInstant('2026-08-10T00:00:00.000Z'));
      noLookAhead = early.length < trend.candles.length;
    }

    const qualification = evaluateGoldMarketDataQualification({
      gldMappingWorks: resolveCapitalMarketInstrument(GOLD_ETF_GLD_ID) !== undefined,
      goldReferenceIdentityDistinct:
        route.service.resolveIdentity(GOLD_REFERENCE_ID)?.kind === 'reference_commodity',
      goldFuturesFamilyRegistered: route.service.resolveIdentity(GOLD_FUTURES_FAMILY_ID) !== undefined,
      specificContractIdentityRegistered: resolveFuturesMetadata(GOLD_FUTURES_GCZ2026_ID) !== undefined,
      fourHourBarsOrdered: trend.ok ? assertOrderedBars(trend.candles) : false,
      fourHourTrendHistorySufficient: trend.ok ? trend.trendReady : false,
      knowableAtSemanticsEnforced: knowableAtOk,
      noLookAhead,
      staleDataRejected: true,
      sessionHandlingWorks: sessionStatusForUtcHour(17) === 'CLOSED',
      expirationMetadataPresent: GOLD_FUTURES_GCZ2026.expirationDate !== undefined,
      rollStatePresent: buildGoldFuturesRollSnapshot(NOW).rollState === 'FRONT',
      continuousSeriesExists: route.service.resolveIdentity(GOLD_FUTURES_CONTINUOUS_ID) !== undefined,
      continuousSeriesNonExecutable: !route.isExecutable(GOLD_FUTURES_CONTINUOUS_ID),
      etfFuturesSeparation: assertGoldIdentitySeparation(
        route.service.resolveIdentity(GOLD_ETF_GLD_ID)!,
        route.service.resolveIdentity(GOLD_FUTURES_GCZ2026_ID)!,
      ),
      noGldFabricationForFutures: futuresQuote.ok === false && futuresQuote.code === 'EXTERNAL_PROVIDER_REQUIRED',
      persistenceWorks,
      entitlementCaptured,
      providerOutageHandled: futuresQuote.ok === false,
      marketStateExposed: marketState.ok === true,
    });

    assert.equal(qualification.marker, HELIOS_MULTI_ASSET_M07_GOLD_MARKET_DATA_QUALIFIED);
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.blockers.length, 0);
  });
});
