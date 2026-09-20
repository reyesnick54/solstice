/**
 * HELIOS Multi-Asset M02 — canonical market observation and time-series fabric.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant, type UtcInstant } from '../packages/domain/src/time.ts';
import {
  HeliosMarketObservationFabric,
  HELIOS_MARKET_TIME_SERIES_SCHEMA,
  HELIOS_MULTI_ASSET_M02_MARKET_OBSERVATIONS_QUALIFIED,
  createStrategyMarketDataApi,
  evaluateMarketObservationQualification,
  normalizeOrderBookLevels,
  rebuildMarketTimeSeriesFromEnvelopes,
  validateOhlcvBar,
  type BarTimeframe,
  type MarketEntitlementMetadata,
  type MarketProvenance,
  type OhlcvBar,
} from '../packages/platform/src/helios/index.ts';
import {
  loadHeliosObservationState,
  persistHeliosObservationState,
  queryHeliosMarketBars,
} from '../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './persistence/helpers.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const BASE = asUtcInstant('2026-09-16T12:00:00.000Z');
const ARRIVAL = asUtcInstant('2026-09-16T12:00:05.000Z');
const DELAYED = asUtcInstant('2026-09-16T12:15:00.000Z');

const ENTITLEMENT: MarketEntitlementMetadata = Object.freeze({
  entitlementClass: 'provider_feed_delayed',
  feedDelayClassification: 'delayed',
  delayedMinutes: 15,
  licensedForRealtime: false,
  redistributionRestricted: false,
  commercialRestricted: false,
  unavailable: false,
});

function provenance(
  observationId: string,
  providerId: string,
  instrumentId: string,
): MarketProvenance {
  return Object.freeze({
    providerId,
    sourceId: `${providerId}.fixture`,
    authorityClass: 'reference_data',
    sourceUrl: null,
    rawPayloadHash: `hash_${observationId}`,
    observationId,
    capability: 'market_prices',
    upstreamSourceRef: `${providerId}:${instrumentId}`,
  });
}

function bar(input: {
  instrumentId: string;
  timeframe: BarTimeframe;
  startTime: UtcInstant;
  endTime: UtcInstant;
  open: bigint;
  high: bigint;
  low: bigint;
  close: bigint;
  volume?: bigint;
  arrival?: UtcInstant;
  availability?: UtcInstant | null;
  providerId?: string;
  observationId?: string;
  sequence?: bigint;
  entitlement?: MarketEntitlementMetadata;
}): OhlcvBar {
  return Object.freeze({
    schema: HELIOS_MARKET_TIME_SERIES_SCHEMA,
    authority: 'REFERENCE_ONLY',
    observationType: 'ohlcv_bar',
    instrumentId: input.instrumentId,
    timeframe: input.timeframe,
    openMinorUnits: input.open,
    highMinorUnits: input.high,
    lowMinorUnits: input.low,
    closeMinorUnits: input.close,
    volumeUnits: input.volume ?? 1_000n,
    startTime: input.startTime,
    endTime: input.endTime,
    sourceTimestamp: input.endTime,
    arrivalTimestamp: input.arrival ?? ARRIVAL,
    availabilityTimestamp: input.availability ?? null,
    providerId: input.providerId ?? 'fixture_market',
    venue: input.instrumentId.split(':').pop() ?? 'UNKNOWN',
    entitlement: input.entitlement ?? ENTITLEMENT,
    provenance: provenance(
      input.observationId ?? `bar_${input.instrumentId}_${input.startTime}`,
      input.providerId ?? 'fixture_market',
      input.instrumentId,
    ),
    quality: Object.freeze({
      qualityState: 'VALID',
      staleState: 'FRESH',
      quarantined: false,
      quarantineReason: null,
    }),
    sequence: input.sequence ?? null,
  });
}

describe('HELIOS Multi-Asset M02 market observations', () => {
  it('passes HELIOS boundary lint', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('ingests SPY 15m, BTC 1h, and Gold 4h bars', () => {
    const fabric = new HeliosMarketObservationFabric({ clock: new FrozenClock(BASE) });
    const api = createStrategyMarketDataApi(fabric.timeSeriesStore());

    const spy = bar({
      instrumentId: 'SECURITY:US:SPY:ARCX',
      timeframe: '15m',
      startTime: asUtcInstant('2026-09-16T11:45:00.000Z'),
      endTime: asUtcInstant('2026-09-16T12:00:00.000Z'),
      open: 550_00n,
      high: 552_00n,
      low: 549_00n,
      close: 551_50n,
    });
    const btc = bar({
      instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
      timeframe: '1h',
      startTime: asUtcInstant('2026-09-16T11:00:00.000Z'),
      endTime: asUtcInstant('2026-09-16T12:00:00.000Z'),
      open: 62_000_00n,
      high: 62_500_00n,
      low: 61_800_00n,
      close: 62_200_00n,
    });
    const gold = bar({
      instrumentId: 'COMMODITY:GLOBAL:GOLD:XCEC',
      timeframe: '4h',
      startTime: asUtcInstant('2026-09-16T08:00:00.000Z'),
      endTime: asUtcInstant('2026-09-16T12:00:00.000Z'),
      open: 2_400_00n,
      high: 2_410_00n,
      low: 2_395_00n,
      close: 2_405_00n,
    });

    for (const observation of [spy, btc, gold]) {
      const result = fabric.ingest(observation);
      assert.equal(result.ok, true);
    }

    assert.equal(api.getBars({ instrumentId: spy.instrumentId, timeframe: '15m', knowableAt: ARRIVAL }).length, 1);
    assert.equal(api.getBars({ instrumentId: btc.instrumentId, timeframe: '1h', knowableAt: ARRIVAL }).length, 1);
    assert.equal(api.getBars({ instrumentId: gold.instrumentId, timeframe: '4h', knowableAt: ARRIVAL }).length, 1);
  });

  it('returns bars in chronological order', () => {
    const fabric = new HeliosMarketObservationFabric({ clock: new FrozenClock(BASE) });
    const api = createStrategyMarketDataApi(fabric.timeSeriesStore());
    const instrumentId = 'SECURITY:US:SPY:ARCX';

    const windows = [
      {
        startTime: asUtcInstant('2026-09-16T10:00:00.000Z'),
        endTime: asUtcInstant('2026-09-16T10:15:00.000Z'),
      },
      {
        startTime: asUtcInstant('2026-09-16T10:15:00.000Z'),
        endTime: asUtcInstant('2026-09-16T10:30:00.000Z'),
      },
      {
        startTime: asUtcInstant('2026-09-16T10:30:00.000Z'),
        endTime: asUtcInstant('2026-09-16T10:45:00.000Z'),
      },
    ] as const;
    for (const [idx, window] of windows.entries()) {
      fabric.ingest(
        bar({
          instrumentId,
          timeframe: '15m',
          startTime: window.startTime,
          endTime: window.endTime,
          open: BigInt(550_00 + idx * 10),
          high: BigInt(552_00 + idx * 10),
          low: BigInt(549_00 + idx * 10),
          close: BigInt(551_00 + idx * 10),
          observationId: `spy_bar_${idx}`,
        }),
      );
    }

    const rows = api.getBars({ instrumentId, timeframe: '15m', knowableAt: ARRIVAL });
    for (let i = 1; i < rows.length; i += 1) {
      assert.ok(Date.parse(rows[i]!.startTime) >= Date.parse(rows[i - 1]!.startTime));
    }
  });

  it('enforces knowableAt semantics — no look-ahead', () => {
    const fabric = new HeliosMarketObservationFabric({ clock: new FrozenClock(BASE) });
    const api = createStrategyMarketDataApi(fabric.timeSeriesStore());
    const instrumentId = 'CRYPTO:GLOBAL:BTC:USD:SIM';

    fabric.ingest(
      bar({
        instrumentId,
        timeframe: '1h',
        startTime: asUtcInstant('2026-09-16T11:00:00.000Z'),
        endTime: asUtcInstant('2026-09-16T12:00:00.000Z'),
        open: 62_000_00n,
        high: 62_500_00n,
        low: 61_800_00n,
        close: 62_200_00n,
        arrival: DELAYED,
        availability: DELAYED,
      }),
    );

    assert.equal(
      api.getBars({ instrumentId, timeframe: '1h', knowableAt: ARRIVAL }).length,
      0,
      'bar must not be visible before knowableAt',
    );
    assert.equal(
      api.getBars({ instrumentId, timeframe: '1h', knowableAt: DELAYED }).length,
      1,
    );
  });

  it('rejects duplicate bars and invalid OHLC', () => {
    const fabric = new HeliosMarketObservationFabric({ clock: new FrozenClock(BASE) });
    const duplicate = bar({
      instrumentId: 'SECURITY:US:SPY:ARCX',
      timeframe: '15m',
      startTime: asUtcInstant('2026-09-16T11:45:00.000Z'),
      endTime: asUtcInstant('2026-09-16T12:00:00.000Z'),
      open: 550_00n,
      high: 552_00n,
      low: 549_00n,
      close: 551_50n,
      observationId: 'dup_bar',
    });
    assert.equal(fabric.ingest(duplicate).ok, true);
    const dup = fabric.ingest(duplicate);
    assert.equal(dup.ok, false);
    if (!dup.ok) assert.equal(dup.code, 'DUPLICATE_BAR');

    const invalid = bar({
      instrumentId: 'SECURITY:US:SPY:ARCX',
      timeframe: '15m',
      startTime: asUtcInstant('2026-09-16T11:45:00.000Z'),
      endTime: asUtcInstant('2026-09-16T12:00:00.000Z'),
      open: 550_00n,
      high: 548_00n,
      low: 549_00n,
      close: 551_50n,
      observationId: 'invalid_ohlc',
    });
    const invalidResult = validateOhlcvBar(invalid);
    assert.equal(invalidResult.ok, false);
    if (!invalidResult.ok) assert.equal(invalidResult.code, 'IMPOSSIBLE_OHLC');
  });

  it('enforces entitlement and provider lineage', () => {
    const fabric = new HeliosMarketObservationFabric({ clock: new FrozenClock(BASE) });
    const deniedResult = fabric.ingest(
      bar({
        instrumentId: 'COMMODITY:GLOBAL:GOLD:XCEC',
        timeframe: '4h',
        startTime: asUtcInstant('2026-09-16T08:00:00.000Z'),
        endTime: asUtcInstant('2026-09-16T12:00:00.000Z'),
        open: 2_400_00n,
        high: 2_410_00n,
        low: 2_395_00n,
        close: 2_405_00n,
        observationId: 'entitlement_denied',
        entitlement: Object.freeze({ ...ENTITLEMENT, unavailable: true }),
      }),
    );
    assert.equal(deniedResult.ok, false);
    if (!deniedResult.ok) assert.equal(deniedResult.code, 'MISSING_ENTITLEMENT');

    const ok = fabric.ingest(
      bar({
        instrumentId: 'COMMODITY:GLOBAL:GOLD:XCEC',
        timeframe: '4h',
        startTime: asUtcInstant('2026-09-16T08:00:00.000Z'),
        endTime: asUtcInstant('2026-09-16T12:00:00.000Z'),
        open: 2_400_00n,
        high: 2_410_00n,
        low: 2_395_00n,
        close: 2_405_00n,
        observationId: 'lineage_ok',
        providerId: 'fixture_market',
      }),
    );
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.sealed.marketObservation.provenance.upstreamSourceRef, 'fixture_market:COMMODITY:GLOBAL:GOLD:XCEC');
    }
  });

  it('validates order book only where supported', () => {
    const fabric = new HeliosMarketObservationFabric({ clock: new FrozenClock(BASE) });
    const unsupported = fabric.ingest({
      schema: HELIOS_MARKET_TIME_SERIES_SCHEMA,
      authority: 'REFERENCE_ONLY',
      observationType: 'order_book_snapshot',
      instrumentId: 'SECURITY:US:SPY:ARCX',
      orderBook: Object.freeze({
        bids: Object.freeze([Object.freeze({ priceMinorUnits: 550_00n, quantityMinorUnits: 100n, depth: 1 })]),
        asks: Object.freeze([Object.freeze({ priceMinorUnits: 551_00n, quantityMinorUnits: 100n, depth: 1 })]),
        sequence: 1n,
        version: 'v1',
        sourceTimestamp: BASE,
        arrivalTimestamp: ARRIVAL,
        providerSupportsOrderBook: true as const,
      }),
      availabilityTimestamp: null,
      providerId: 'fixture_market',
      venue: 'ARCX',
      entitlement: ENTITLEMENT,
      provenance: provenance('ob_unsupported', 'fixture_market', 'SECURITY:US:SPY:ARCX'),
      quality: Object.freeze({
        qualityState: 'VALID',
        staleState: 'FRESH',
        quarantined: false,
        quarantineReason: null,
      }),
    });
    assert.equal(unsupported.ok, false);

    const levels = normalizeOrderBookLevels(
      [
        Object.freeze({ priceMinorUnits: 62_100_00n, quantityMinorUnits: 50n, depth: 0 }),
        Object.freeze({ priceMinorUnits: 62_000_00n, quantityMinorUnits: 100n, depth: 0 }),
      ],
      'bid',
    );
    assert.equal(levels[0]!.priceMinorUnits, 62_100_00n);

    const supported = fabric.ingest({
      schema: HELIOS_MARKET_TIME_SERIES_SCHEMA,
      authority: 'REFERENCE_ONLY',
      observationType: 'order_book_snapshot',
      instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
      orderBook: Object.freeze({
        bids: levels,
        asks: Object.freeze([Object.freeze({ priceMinorUnits: 62_200_00n, quantityMinorUnits: 80n, depth: 1 })]),
        sequence: 2n,
        version: 'v1',
        sourceTimestamp: BASE,
        arrivalTimestamp: ARRIVAL,
        providerSupportsOrderBook: true as const,
      }),
      availabilityTimestamp: null,
      providerId: 'fixture_market',
      venue: 'SIM',
      entitlement: ENTITLEMENT,
      provenance: provenance('ob_supported', 'fixture_market', 'CRYPTO:GLOBAL:BTC:USD:SIM'),
      quality: Object.freeze({
        qualityState: 'VALID',
        staleState: 'FRESH',
        quarantined: false,
        quarantineReason: null,
      }),
    });
    assert.equal(supported.ok, true);
  });

  it('exposes strategy-facing getLatestQuote and getMarketSnapshot', () => {
    const fabric = new HeliosMarketObservationFabric({ clock: new FrozenClock(BASE) });
    const api = createStrategyMarketDataApi(fabric.timeSeriesStore());
    const instrumentId = 'SECURITY:US:SPY:ARCX';

    fabric.ingest(
      bar({
        instrumentId,
        timeframe: '15m',
        startTime: asUtcInstant('2026-09-16T11:45:00.000Z'),
        endTime: asUtcInstant('2026-09-16T12:00:00.000Z'),
        open: 550_00n,
        high: 552_00n,
        low: 549_00n,
        close: 551_50n,
        observationId: 'snapshot_bar',
      }),
    );

    fabric.ingest({
      schema: HELIOS_MARKET_TIME_SERIES_SCHEMA,
      authority: 'REFERENCE_ONLY',
      observationType: 'quote',
      instrumentId,
      bidMinorUnits: 551_00n,
      askMinorUnits: 551_50n,
      lastMinorUnits: 551_25n,
      priceScale: 2,
      currency: 'USD',
      sourceTimestamp: BASE,
      arrivalTimestamp: ARRIVAL,
      availabilityTimestamp: null,
      providerId: 'fixture_market',
      venue: 'ARCX',
      entitlement: ENTITLEMENT,
      provenance: provenance('snapshot_quote', 'fixture_market', instrumentId),
      quality: Object.freeze({
        qualityState: 'VALID',
        staleState: 'FRESH',
        quarantined: false,
        quarantineReason: null,
      }),
      sequence: 10n,
    });

    const quote = api.getLatestQuote({ instrumentId, knowableAt: ARRIVAL });
    assert.ok(quote);
    assert.equal(quote!.lastMinorUnits, 551_25n);

    const snapshot = api.getMarketSnapshot({ instrumentId, knowableAt: ARRIVAL, timeframes: Object.freeze(['15m']) });
    assert.equal(snapshot.instrumentId, instrumentId);
    assert.ok(snapshot.latestQuote);
    assert.ok(snapshot.latestBarByTimeframe['15m']);
  });

  it('emits M02 qualification marker when acceptance criteria pass', () => {
    const qualification = evaluateMarketObservationQualification({
      spy15mBars: 1,
      btc1hBars: 1,
      gold4hBars: 1,
      chronologicalOrdering: true,
      persistenceRestart: true,
      staleDataHandled: true,
      delayedDataHandled: true,
      knowableAtSemantics: true,
      duplicateHandling: true,
      entitlementEnforcement: true,
      invalidOhlcRejected: true,
      providerLineage: true,
      orderBookValidation: true,
    });
    assert.equal(qualification.marker, HELIOS_MULTI_ASSET_M02_MARKET_OBSERVATIONS_QUALIFIED);
    assert.equal(qualification.qualified, true);
  });
});

const describePersistence = persistenceAvailable() ? describe : describe.skip;

describePersistence('HELIOS M02 persistence restart', () => {
  it('persists and restores market observations across restart', async () => {
    await preparePersistence();
    const runtime = await createDurableRuntime();
    const fabric = new HeliosMarketObservationFabric({ clock: new FrozenClock(BASE) });

    fabric.ingest(
      bar({
        instrumentId: 'SECURITY:US:SPY:ARCX',
        timeframe: '15m',
        startTime: asUtcInstant('2026-09-16T11:45:00.000Z'),
        endTime: asUtcInstant('2026-09-16T12:00:00.000Z'),
        open: 550_00n,
        high: 552_00n,
        low: 549_00n,
        close: 551_50n,
        observationId: 'persist_spy',
      }),
    );

    await persistHeliosObservationState(runtime.pool, fabric.observationFabric().store().snapshot());
    const restoredSnapshot = await loadHeliosObservationState(runtime.pool);
    assert.ok(restoredSnapshot.observations.length >= 1);

    const restoredFabric = new HeliosMarketObservationFabric({ clock: new FrozenClock(BASE) });
    restoredFabric.observationFabric().store().restore(restoredSnapshot);
    rebuildMarketTimeSeriesFromEnvelopes(
      restoredFabric.timeSeriesStore(),
      restoredSnapshot.observations,
    );
    const api = createStrategyMarketDataApi(restoredFabric.timeSeriesStore());

    const bars = await queryHeliosMarketBars(runtime.pool, {
      canonicalInstrumentId: 'SECURITY:US:SPY:ARCX',
      timeframe: '15m',
      knowableAt: ARRIVAL,
      limit: 10,
    });
    assert.ok(bars.length >= 1);
    assert.equal(api.getBars({ instrumentId: 'SECURITY:US:SPY:ARCX', timeframe: '15m', knowableAt: ARRIVAL }).length, 1);
  });
});
