/**
 * HELIOS AAF09 — external crypto multi-venue market observation plane.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { certifyAaf07Provider } from '../packages/platform/src/helios/adaptive-alpha-fabric/aaf07/index.ts';
import {
  Aaf09ExternalCryptoObservationFabric,
  applyValidationHealth,
  assertDistinctInstrumentPair,
  assessMultiSourceDisagreement,
  buildNormalizedObservation,
  computeAaf09Features,
  createAaf09ObservationStore,
  createCoingeckoReferenceAdapter,
  createKrakenVenueAdapter,
  decimalStringToMinorUnits,
  detectCrossedMarket,
  detectSequenceGap,
  detectStaleFeed,
  evaluateAaf09Qualification,
  HELIOS_AAF09_EXTERNAL_CRYPTO_DATA_QUALIFIED,
  instrumentsShareBaseButDifferQuote,
  isReferenceAggregate,
  isVenueSource,
  replayAaf09Snapshot,
  resolveAaf09Instrument,
  sourceClassForProvider,
  venueDislocationBps,
} from '../packages/platform/src/helios/adaptive-alpha-fabric/aaf09-external-crypto/index.ts';
import { isFeatureVisibleAt } from '../packages/platform/src/helios/feature-fabric/knowable-at.ts';

const NOW = asUtcInstant('2026-10-15T12:00:00.000Z');
const WEEKEND = asUtcInstant('2026-10-18T14:00:00.000Z');
const STALE_EVENT = asUtcInstant('2026-10-15T08:00:00.000Z');

function krakenHarness() {
  return async (url: string): Promise<Response> => {
    if (url.includes('/Ticker')) {
      return new Response(
        JSON.stringify({
          error: [],
          result: {
            XBTUSD: {
              a: ['65432.20', '1', '1.000'],
              b: ['65432.10', '1', '1.000'],
              c: ['65432.15', '0.01'],
            },
          },
        }),
        { status: 200 },
      );
    }
    if (url.includes('/Trades')) {
      return new Response(
        JSON.stringify({
          error: [],
          result: {
            XBTUSD: [['65432.10', '0.02', 1_760_529_600, 'b', 'm', '', 1001]],
            last: '1001',
          },
        }),
        { status: 200 },
      );
    }
    if (url.includes('/OHLC')) {
      return new Response(
        JSON.stringify({
          error: [],
          result: {
            XBTUSD: [[1_760_529_600, '65000', '66000', '64500', '65432.10', '65400', '120.5', 42]],
            last: 1_760_529_600,
          },
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ error: ['EGeneral:Unknown'] }), { status: 404 });
  };
}

function coingeckoHarness() {
  return async (url: string): Promise<Response> => {
    if (url.includes('/simple/price')) {
      const vs = url.includes('vs_currencies=usdt') ? 'usdt' : 'usd';
      const price = vs === 'usdt' ? 65400 : 65432;
      return new Response(
        JSON.stringify({
          bitcoin: { [vs]: price, last_updated_at: 1_760_529_600 },
        }),
        { status: 200 },
      );
    }
    return new Response('{}', { status: 404 });
  };
}

function buildFabric(staleMs = 60_000) {
  const store = createAaf09ObservationStore();
  return new Aaf09ExternalCryptoObservationFabric({
    store,
    venueAdapter: createKrakenVenueAdapter({ fetchFn: krakenHarness() }),
    referenceAdapter: createCoingeckoReferenceAdapter({ fetchFn: coingeckoHarness() }),
    staleThresholdMs: staleMs,
  });
}

describe('HELIOS AAF09 external crypto observation plane', () => {
  it('AAF07 certifies Kraken venue profile', () => {
    const verdict = certifyAaf07Provider('kraken');
    assert.equal(verdict.certified, true);
    assert.equal(verdict.record?.timestampSemantics, 'UNIX_SECONDS_UTC');
  });

  it('BTC/USD != BTC/USDT instrument identity', () => {
    const btcUsd = resolveAaf09Instrument('CRYPTO:AAF09:BTC:USD');
    const btcUsdt = resolveAaf09Instrument('CRYPTO:AAF09:BTC:USDT');
    assert.ok(btcUsd && btcUsdt);
    assert.equal(btcUsd.pairLabel, 'BTC/USD');
    assert.equal(btcUsdt.pairLabel, 'BTC/USDT');
    assert.ok(assertDistinctInstrumentPair(btcUsd.instrumentId, btcUsdt.instrumentId));
    assert.ok(instrumentsShareBaseButDifferQuote(btcUsd.instrumentId, btcUsdt.instrumentId));
  });

  it('venue source class differs from aggregate reference provider', () => {
    assert.equal(isVenueSource(sourceClassForProvider('kraken')), true);
    assert.equal(isReferenceAggregate(sourceClassForProvider('coingecko')), true);
  });

  it('ingests venue BBO and reference quote for BTC/USD', async () => {
    const fabric = buildFabric();
    const venue = await fabric.pullVenueBestBidOffer('CRYPTO:AAF09:BTC:USD', NOW);
    const reference = await fabric.pullReferenceQuote('CRYPTO:AAF09:BTC:USD', NOW);
    assert.equal(venue.ok, true);
    assert.equal(reference.ok, true);
    if (venue.ok && reference.ok) {
      assert.equal(venue.observation.sourceClass, 'VENUE_MARKET_DATA');
      assert.equal(reference.observation.sourceClass, 'REFERENCE_AGGREGATE');
      assert.equal(venue.observation.venue?.venueId, 'KRAKEN');
      assert.ok(venue.observation.spreadMinorUnits !== null && venue.observation.spreadMinorUnits > 0n);
    }
  });

  it('flags stale venue feed', () => {
    const instrument = resolveAaf09Instrument('CRYPTO:AAF09:ETH:USD')!;
    const stale = buildNormalizedObservation({
      instrument,
      providerId: 'kraken',
      observationKind: 'best_bid_offer',
      providerEventTime: STALE_EVENT,
      sunreyArrivalTime: NOW,
      sequenceId: '10',
      sourceHealth: 'HEALTHY',
      rawPayload: { test: true },
      bidMinorUnits: decimalStringToMinorUnits('3400'),
      askMinorUnits: decimalStringToMinorUnits('3401'),
    });
    const issue = detectStaleFeed({
      providerEventTime: stale.providerEventTime,
      nowUtc: NOW,
      maxAgeMs: 30 * 60 * 1000,
    });
    assert.ok(issue);
    const degraded = applyValidationHealth(stale, [issue!]);
    assert.equal(degraded.sourceHealth, 'DEGRADED_STALE');
  });

  it('detects sequence gap', () => {
    const gap = detectSequenceGap('1003', '1000');
    assert.ok(gap);
    assert.equal(gap!.code, 'SEQUENCE_GAP');
  });

  it('detects crossed market', () => {
    const instrument = resolveAaf09Instrument('CRYPTO:AAF09:BTC:USD')!;
    const crossed = buildNormalizedObservation({
      instrument,
      providerId: 'kraken',
      observationKind: 'best_bid_offer',
      providerEventTime: NOW,
      sunreyArrivalTime: NOW,
      sequenceId: null,
      sourceHealth: 'HEALTHY',
      rawPayload: {},
      bidMinorUnits: 100n,
      askMinorUnits: 100n,
    });
    const issue = detectCrossedMarket(crossed);
    assert.ok(issue);
    assert.equal(issue!.code, 'CROSSED_MARKET');
  });

  it('reports large source disagreement without counting aggregate as independent witness', async () => {
    const fabric = buildFabric();
    const instrument = 'CRYPTO:AAF09:BTC:USD';
    await fabric.pullVenueBestBidOffer(instrument, NOW);
    await fabric.pullReferenceQuote(instrument, NOW);
    const report = fabric.assessInstrument(instrument, NOW);
    assert.equal(report.aggregateWitnessCount, 1);
    assert.equal(report.independentWitnessCount, 1);
    assert.ok(report.lineageNotes.some((note) => note.includes('reference aggregate')));
  });

  it('handles provider outage state', () => {
    const fabric = buildFabric();
    const instrument = resolveAaf09Instrument('CRYPTO:AAF09:BTC:USD')!;
    const observation = buildNormalizedObservation({
      instrument,
      providerId: 'kraken',
      observationKind: 'best_bid_offer',
      providerEventTime: NOW,
      sunreyArrivalTime: NOW,
      sequenceId: '1',
      sourceHealth: 'HEALTHY',
      rawPayload: {},
      bidMinorUnits: 1n,
      askMinorUnits: 2n,
    });
    fabric.ingestObservation(observation, NOW);
    fabric.markProviderOutage(instrument.instrumentId, 'kraken', NOW);
    const rows = fabric.store().listByInstrument(instrument.instrumentId);
    assert.ok(rows.some((row) => row.sourceHealth === 'OUTAGE'));
  });

  it('supports weekend operation (crypto calendar always-on)', async () => {
    const fabric = buildFabric();
    const result = await fabric.pullVenueBestBidOffer('CRYPTO:AAF09:ETH:USD', WEEKEND);
    assert.equal(result.ok, true);
  });

  it('replays store snapshot deterministically', async () => {
    const fabric = buildFabric();
    await fabric.pullVenueBestBidOffer('CRYPTO:AAF09:BTC:USD', NOW);
    const snapshot = fabric.store().snapshot();
    const replayStore = createAaf09ObservationStore();
    const replay = replayAaf09Snapshot(replayStore, snapshot);
    assert.equal(replay.replayedCount, snapshot.observations.length);
    assert.deepEqual(
      replay.observations.map((row) => row.observationId),
      snapshot.observations.map((row) => row.observationId),
    );
  });

  it('computes point-in-time features without future leakage', async () => {
    const fabric = buildFabric();
    const instrument = 'CRYPTO:AAF09:BTC:USD';
    await fabric.pullVenueBestBidOffer(instrument, NOW);
    const prior = buildNormalizedObservation({
      instrument: resolveAaf09Instrument(instrument)!,
      providerId: 'kraken',
      observationKind: 'trade',
      providerEventTime: asUtcInstant('2026-10-15T11:00:00.000Z'),
      sunreyArrivalTime: asUtcInstant('2026-10-15T11:00:05.000Z'),
      sequenceId: '900',
      sourceHealth: 'HEALTHY',
      rawPayload: {},
      tradePriceMinorUnits: decimalStringToMinorUnits('64000'),
      lastMinorUnits: decimalStringToMinorUnits('64000'),
    });
    fabric.ingestObservation(prior, asUtcInstant('2026-10-15T11:00:05.000Z'));
    await fabric.pullVenueBestBidOffer(instrument, NOW);
    await fabric.pullReferenceQuote(instrument, NOW);
    const observations = fabric.store().listByInstrument(instrument);
    const venue = observations.filter((row) => row.sourceClass === 'VENUE_MARKET_DATA').at(-1)!;
    const reference = observations.filter((row) => row.sourceClass === 'REFERENCE_AGGREGATE').at(-1)!;
    const dislocation = venueDislocationBps(venue, reference);
    const report = assessMultiSourceDisagreement({
      instrumentId: instrument,
      evaluationTime: NOW,
      observations,
    });
    const features = computeAaf09Features({
      evaluationTime: NOW,
      instrumentId: instrument,
      observations,
      dispersionBps: report.dispersionBps,
      venueDislocationBps: dislocation,
    });
    assert.ok(features.features.length > 0);
    for (const feature of features.features) {
      assert.equal(isFeatureVisibleAt(NOW, feature.knowableAt), true);
      assert.equal(feature.grantsExecutionAuthority, false);
    }
    const beforeKnowable = asUtcInstant('2026-10-15T10:00:00.000Z');
    assert.equal(isFeatureVisibleAt(beforeKnowable, venue.knowableAt), false);
  });

  it('emits HELIOS_AAF09_EXTERNAL_CRYPTO_DATA_QUALIFIED when checks pass', () => {
    const result = evaluateAaf09Qualification({
      btcUsdDistinctFromBtcUsdt: true,
      venueDistinctFromAggregate: true,
      staleVenueFeedHandled: true,
      sequenceGapHandled: true,
      crossedMarketHandled: true,
      largeSourceDisagreementHandled: true,
      providerOutageHandled: true,
      weekendOperationSupported: true,
      replayDeterministic: true,
      pointInTimeFeatureCorrect: true,
      krakenAaf07Certified: true,
      referenceClassifiedAsAggregate: true,
      noTradingExecutionPath: true,
    });
    assert.equal(result.marker, HELIOS_AAF09_EXTERNAL_CRYPTO_DATA_QUALIFIED);
    assert.equal(result.qualified, true);
  });
});
