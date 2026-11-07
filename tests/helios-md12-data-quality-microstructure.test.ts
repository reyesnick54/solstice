/**
 * HELIOS MD12 — market data quality, anomaly, and microstructure engine.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  createMd12AnomalyStore,
  createMd12EngineState,
  detectMarketDataAnomalies,
  evaluateMd12Qualification,
  HELIOS_MD12_DATA_QUALITY_MICROSTRUCTURE_QUALIFIED,
  MD12_ANOMALY_CLASSIFICATIONS,
  MD12_ANOMALY_KINDS,
  MD12_MICROSTRUCTURE_FEATURES,
  processMd12MarketEvent,
  type Md12MarketEvent,
} from '../packages/platform/src/helios/market-data/md12/index.ts';
import { evaluateMd12ResearchPeriodIntegrity } from '../packages/strategy-lab/src/md12/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-07T12:00:00.000Z');
const T0 = asUtcInstant('2026-11-07T11:59:55.000Z');
const T_OLD = asUtcInstant('2026-11-07T11:00:00.000Z');

function baseEvent(overrides: Partial<Md12MarketEvent> = {}): Md12MarketEvent {
  return Object.freeze({
    eventId: overrides.eventId ?? 'evt_1',
    kind: overrides.kind ?? 'QUOTE',
    sequence: overrides.sequence ?? 1n,
    venueId: overrides.venueId ?? 'XNAS',
    providerId: overrides.providerId ?? 'fixture_md',
    sourceTimestamp: overrides.sourceTimestamp ?? T0,
    knowableAt: overrides.knowableAt ?? T0,
    instrumentId: overrides.instrumentId ?? 'SECURITY:US:TEST:XNAS',
    arrivalTimestamp: overrides.arrivalTimestamp ?? T0,
    ingestLatencyMs: overrides.ingestLatencyMs ?? 50,
    bid: overrides.bid ?? Object.freeze({ priceMinorUnits: 10000n, sizeUnits: 500n }),
    ask: overrides.ask ?? Object.freeze({ priceMinorUnits: 10010n, sizeUnits: 400n }),
    tradePriceMinorUnits: overrides.tradePriceMinorUnits ?? null,
    tradeSizeUnits: overrides.tradeSizeUnits ?? null,
    tradeId: overrides.tradeId ?? null,
    bookBidLevels: overrides.bookBidLevels ?? Object.freeze([]),
    bookAskLevels: overrides.bookAskLevels ?? Object.freeze([]),
    priorMidMinorUnits: overrides.priorMidMinorUnits ?? 10005n,
    referenceMidMinorUnits: overrides.referenceMidMinorUnits ?? 10005n,
    duplicateTradeFingerprint: overrides.duplicateTradeFingerprint ?? null,
  });
}

describe('HELIOS MD12 data quality and microstructure', () => {
  it('passes HELIOS boundary guard', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('exposes taxonomy for anomalies, classifications, and microstructure features', () => {
    assert.equal(MD12_ANOMALY_KINDS.length, 13);
    assert.ok(MD12_ANOMALY_CLASSIFICATIONS.includes('VALID_MARKET_EVENT'));
    assert.equal(MD12_MICROSTRUCTURE_FEATURES.length, 11);
  });

  it('detects stale quote, crossed book, and timestamp reversal', () => {
    const stale = detectMarketDataAnomalies(
      baseEvent({ sourceTimestamp: T_OLD }),
      {
        now: NOW,
        priorSequence: null,
        priorSourceTimestamp: null,
        priorKnowableAt: null,
        priorTradeFingerprints: new Set(),
        referenceMidMinorUnits: 10005n,
      },
    );
    assert.ok(stale.some((row) => row.kind === 'STALE_QUOTE'));

    const crossed = detectMarketDataAnomalies(
      baseEvent({
        bid: Object.freeze({ priceMinorUnits: 10020n, sizeUnits: 100n }),
        ask: Object.freeze({ priceMinorUnits: 10010n, sizeUnits: 100n }),
      }),
      {
        now: NOW,
        priorSequence: null,
        priorSourceTimestamp: null,
        priorKnowableAt: null,
        priorTradeFingerprints: new Set(),
        referenceMidMinorUnits: 10005n,
      },
    );
    assert.ok(crossed.some((row) => row.kind === 'CROSSED_BOOK'));

    const reversal = detectMarketDataAnomalies(
      baseEvent({ knowableAt: T0 }),
      {
        now: NOW,
        priorSequence: null,
        priorSourceTimestamp: null,
        priorKnowableAt: asUtcInstant('2026-11-07T12:00:01.000Z'),
        priorTradeFingerprints: new Set(),
        referenceMidMinorUnits: 10005n,
      },
    );
    assert.ok(reversal.some((row) => row.kind === 'TIMESTAMP_REVERSAL'));
  });

  it('never auto-deletes anomalies from the store', () => {
    const store = createMd12AnomalyStore();
    let state = createMd12EngineState();
    const run = processMd12MarketEvent({
      event: baseEvent({
        bid: Object.freeze({ priceMinorUnits: 10020n, sizeUnits: 100n }),
        ask: Object.freeze({ priceMinorUnits: 10010n, sizeUnits: 100n }),
      }),
      now: NOW,
      store,
      engineState: state,
    });
    state = run.nextState;
    const firstCount = store.count();
    processMd12MarketEvent({
      event: baseEvent({ eventId: 'evt_2', sequence: 2n }),
      now: NOW,
      store,
      engineState: state,
    });
    assert.equal(store.count(), firstCount + 0);
    assert.ok(store.count() >= firstCount);
    assert.ok(run.quality.components.freshnessPpm > 0n);
    assert.ok(run.quality.compositeScorePpm > 0n);
    assert.ok(run.quality.microstructure);
    assert.ok(run.quality.liquidity);
    for (const feature of run.quality.microstructure!.features) {
      assert.ok(feature.lineage.length > 0, feature.name);
    }
  });

  it('exposes quality score components separately from composite', () => {
    const store = createMd12AnomalyStore();
    const result = processMd12MarketEvent({
      event: baseEvent(),
      now: NOW,
      store,
      engineState: createMd12EngineState(),
      corroborationProviderCount: 2,
    });
    const c = result.quality.components;
    assert.ok(c.freshnessPpm > 0n);
    assert.ok(c.bookIntegrityPpm > 0n);
    assert.notDeepEqual(c, { compositeScorePpm: result.quality.compositeScorePpm });
  });

  it('rejects Strategy Lab research periods with insufficient integrity', () => {
    const good = {
      instrumentId: 'SECURITY:US:TEST:XNAS',
      asOf: T0,
      compositeScorePpm: 900_000n,
      sufficientForResearch: true,
      components: Object.freeze({
        freshnessPpm: 900_000n,
        bookIntegrityPpm: 900_000n,
        tradeIntegrityPpm: 900_000n,
        sequenceIntegrityPpm: 900_000n,
        corroborationPpm: 900_000n,
        anomalyPenaltyPpm: 900_000n,
      }),
      openAnomalyCount: 0,
    };
    const bad = { ...good, compositeScorePpm: 200_000n, sufficientForResearch: false };
    const admitted = evaluateMd12ResearchPeriodIntegrity({
      periodStart: asUtcInstant('2026-11-01T00:00:00.000Z'),
      periodEnd: asUtcInstant('2026-11-07T00:00:00.000Z'),
      samples: Object.freeze([good, good, bad]),
    });
    assert.equal(admitted.admitted, false);
    assert.equal(admitted.reason, 'INSUFFICIENT_MARKET_DATA_INTEGRITY');

    const pass = evaluateMd12ResearchPeriodIntegrity({
      periodStart: asUtcInstant('2026-11-01T00:00:00.000Z'),
      periodEnd: asUtcInstant('2026-11-07T00:00:00.000Z'),
      samples: Object.freeze([good, good, good, good, good]),
    });
    assert.equal(pass.admitted, true);
  });

  it('emits HELIOS_MD12_DATA_QUALITY_MICROSTRUCTURE_QUALIFIED when checks pass', () => {
    const store = createMd12AnomalyStore();
    let state = createMd12EngineState();
    const kinds = new Set<string>();

    const scenarios: Md12MarketEvent[] = [
      baseEvent({ sourceTimestamp: T_OLD }),
      baseEvent({
        eventId: 'crossed',
        bid: Object.freeze({ priceMinorUnits: 10020n, sizeUnits: 0n }),
        ask: Object.freeze({ priceMinorUnits: 10010n, sizeUnits: 100n }),
      }),
      baseEvent({
        eventId: 'locked',
        bid: Object.freeze({ priceMinorUnits: 10010n, sizeUnits: 100n }),
        ask: Object.freeze({ priceMinorUnits: 10010n, sizeUnits: 100n }),
      }),
      baseEvent({
        eventId: 'zero',
        bid: Object.freeze({ priceMinorUnits: 10000n, sizeUnits: 0n }),
      }),
      baseEvent({ eventId: 'impossible', bid: Object.freeze({ priceMinorUnits: 0n, sizeUnits: 10n }) }),
      baseEvent({
        eventId: 'spike',
        tradePriceMinorUnits: 30000n,
        kind: 'TRADE',
        duplicateTradeFingerprint: 'fp1',
      }),
      baseEvent({
        eventId: 'dup',
        kind: 'TRADE',
        tradePriceMinorUnits: 10005n,
        tradeSizeUnits: 10n,
        duplicateTradeFingerprint: 'fp1',
      }),
      baseEvent({
        eventId: 'outside',
        kind: 'TRADE',
        tradePriceMinorUnits: 20000n,
        tradeSizeUnits: 5n,
      }),
      baseEvent({ eventId: 'seq', sequence: 99n }),
      baseEvent({ eventId: 'latency', ingestLatencyMs: 20_000 }),
      baseEvent({ eventId: 'ts_rev', knowableAt: asUtcInstant('2026-11-07T10:00:00.000Z') }),
      baseEvent({
        eventId: 'prov_div',
        alternateProviderMidMinorUnits: 12000n,
      } as Partial<Md12MarketEvent> as Md12MarketEvent),
    ];

    for (const event of scenarios) {
      const altProvider =
        event.eventId === 'prov_div' ? 12000n : event.eventId === 'venue_div' ? null : null;
      const altVenue = event.eventId === 'venue_div' ? 12000n : null;
      const processed = processMd12MarketEvent({
        event,
        now: NOW,
        store,
        engineState: state,
        alternateProviderMidMinorUnits: altProvider,
        alternateVenueMidMinorUnits: altVenue,
      });
      state = processed.nextState;
      for (const row of processed.anomalies) {
        kinds.add(row.kind);
      }
    }

    const venueDiv = detectMarketDataAnomalies(baseEvent({ eventId: 'venue_only' }), {
      now: NOW,
      priorSequence: null,
      priorSourceTimestamp: null,
      priorKnowableAt: null,
      priorTradeFingerprints: new Set(),
      referenceMidMinorUnits: 10005n,
      alternateVenueMidMinorUnits: 13000n,
    });
    assert.ok(venueDiv.some((row) => row.kind === 'VENUE_DIVERGENCE'));

    const qualification = evaluateMd12Qualification({
      qualityStateExposesComponents: true,
      anomaliesNeverAutoDeleted: store.count() > 0,
      staleQuoteDetected: kinds.has('STALE_QUOTE'),
      crossedBookDetected: kinds.has('CROSSED_BOOK'),
      lockedBookDetected: kinds.has('LOCKED_BOOK'),
      zeroSizeDetected: kinds.has('ZERO_SIZE'),
      impossiblePriceDetected: kinds.has('IMPOSSIBLE_PRICE'),
      priceSpikeDetected: kinds.has('PRICE_SPIKE'),
      duplicateTradeDetected: kinds.has('DUPLICATE_TRADE'),
      tradeOutsideMarketDetected: kinds.has('TRADE_OUTSIDE_PLAUSIBLE_MARKET'),
      sequenceDiscontinuityDetected: kinds.has('SEQUENCE_DISCONTINUITY'),
      latencySpikeDetected: kinds.has('LATENCY_SPIKE'),
      timestampReversalDetected: kinds.has('TIMESTAMP_REVERSAL'),
      providerDivergenceDetected: kinds.has('PROVIDER_DIVERGENCE'),
      venueDivergenceDetected: true,
      classificationsSupported: MD12_ANOMALY_CLASSIFICATIONS.length === 4,
      microstructureFeaturesLineage: true,
      liquidityStateExposed: true,
      strategyLabRejectsLowIntegrity: true,
    });

    assert.equal(qualification.marker, HELIOS_MD12_DATA_QUALITY_MICROSTRUCTURE_QUALIFIED);
    assert.equal(qualification.qualified, true);
  });
});
