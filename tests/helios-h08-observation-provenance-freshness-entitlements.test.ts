/**
 * HELIOS H08 — observation provenance, freshness, and entitlements.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HeliosObservationFabric,
  assessHeliosFreshness,
  buildInformationTime,
  createHeliosObservationStore,
  isKnowableAt,
  isEntitlementUsable,
  isFreshnessDegraded,
} from '../packages/platform/src/helios/index.ts';
import {
  buildExternalObservation,
  MARKET_PRICE_FRESHNESS_POLICY,
  type ExternalObservation,
} from '../packages/provider-sdk/src/index.ts';
import {
  assessMarketReferenceTrust,
  createExternalDataTrustEngine,
} from '../packages/provider-sdk/src/trust/index.ts';
import {
  loadHeliosObservationState,
  persistHeliosObservationState,
} from '../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './persistence/helpers.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-16T12:00:00.000Z');
const SOURCE_EVENT = asUtcInstant('2026-09-16T11:59:55.000Z');
const PUBLISHED = asUtcInstant('2026-09-16T11:59:56.000Z');
const PROVIDER_AVAILABLE = asUtcInstant('2026-09-16T11:59:58.000Z');
const ARRIVAL = asUtcInstant('2026-09-16T12:00:00.000Z');
const DELAYED_ARRIVAL = asUtcInstant('2026-09-16T12:15:00.000Z');

const describePersistence = persistenceAvailable() ? describe : describe.skip;

function marketObservation(
  overrides: {
    observationId?: string;
    providerId?: string;
    sourceTimestamp?: string;
    retrievedAt?: string;
    priceMinor?: bigint;
    rawPayload?: string;
    commercialUseStatus?: 'permitted' | 'restricted' | 'prohibited' | 'unknown';
    redistributionStatus?: 'permitted' | 'restricted' | 'prohibited' | 'unknown';
    validationStatus?: 'valid' | 'timestamp_invalid' | 'schema_invalid';
  } = {},
): ExternalObservation<{
  symbol: string;
  priceMinor: bigint;
  currency: string;
  asOf: string;
  sourceProvider: string;
  exchange: string | null;
}> {
  const built = buildExternalObservation({
    observationId: overrides.observationId ?? `obs_${Math.random().toString(36).slice(2, 10)}`,
    providerId: overrides.providerId ?? 'fixture_market',
    providerCategory: 'markets',
    capability: 'market_prices',
    data: {
      symbol: 'AAPL',
      priceMinor: overrides.priceMinor ?? 150_00n,
      currency: 'USD',
      asOf: overrides.sourceTimestamp ?? SOURCE_EVENT,
      sourceProvider: overrides.providerId ?? 'fixture_market',
      exchange: 'NASDAQ',
    },
    source: { provider: overrides.providerId ?? 'fixture_market', dataset: 'AAPL' },
    time: {
      retrievedAt: overrides.retrievedAt ?? ARRIVAL,
      sourceTimestamp: overrides.sourceTimestamp ?? SOURCE_EVENT,
    },
    authorityClass: 'reference_data',
    provenance: {
      rawPayload: overrides.rawPayload ?? JSON.stringify({ priceMinor: '15000' }),
      providerSchemaVersion: 'test/1',
    },
    freshnessPolicy: MARKET_PRICE_FRESHNESS_POLICY,
    validationStatus: overrides.validationStatus ?? 'valid',
    licensing: {
      commercialUseStatus: overrides.commercialUseStatus,
      redistributionStatus: overrides.redistributionStatus,
    },
  });
  assert.equal(built.ok, true);
  return built.value!;
}

function fabricAt(now: string): HeliosObservationFabric {
  const clock = new FrozenClock(asUtcInstant(now));
  const store = createHeliosObservationStore();
  return new HeliosObservationFabric({ clock, store });
}

describe('HELIOS H08 — observation provenance, freshness, and entitlements', () => {
  it('architecture guard: observation fabric does not grant Execution Authority', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const observationFindings = findings.filter((f) => f.file.includes('helios/observation'));
    assert.equal(observationFindings.length, 0);
  });

  it('distinguishes source event time from knowable arrival time', () => {
    const observation = marketObservation();
    const informationTime = buildInformationTime({
      observation,
      sourceEventTime: SOURCE_EVENT,
      sourcePublishedTime: PUBLISHED,
      providerAvailabilityTime: PROVIDER_AVAILABLE,
      sunreyArrivalTime: ARRIVAL,
      ingestionTime: NOW,
    });
    assert.equal(informationTime.sourceEventTime, SOURCE_EVENT);
    assert.equal(informationTime.knowableAt, ARRIVAL);
    assert.ok(isKnowableAt(NOW, informationTime));
    assert.ok(!isKnowableAt(PROVIDER_AVAILABLE, informationTime));
  });

  it('classifies delayed feed with later knowableAt', () => {
    const observation = marketObservation({ retrievedAt: DELAYED_ARRIVAL });
    const fabric = fabricAt(DELAYED_ARRIVAL);
    const result = fabric.ingest({
      observation,
      sourceId: 'fixture_market:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      venue: 'NASDAQ',
      observationType: 'quote',
      feedDelayClassification: 'delayed',
      informationTime: {
        sourceEventTime: SOURCE_EVENT,
        providerAvailabilityTime: DELAYED_ARRIVAL,
        sunreyArrivalTime: DELAYED_ARRIVAL,
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.message);
    assert.equal(result.envelope.entitlement.feedDelayClassification, 'delayed');
    assert.equal(result.envelope.informationTime.knowableAt, DELAYED_ARRIVAL);
    assert.ok(result.envelope.informationTime.sourceEventTime! < result.envelope.informationTime.knowableAt);
  });

  it('fresh observation passes with VALID quality state', () => {
    const fabric = fabricAt(NOW);
    const result = fabric.ingest({
      observation: marketObservation({
        sourceTimestamp: asUtcInstant('2026-09-16T11:59:58.000Z'),
      }),
      sourceId: 'fixture_market:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      observationType: 'quote',
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.message);
    assert.equal(result.envelope.freshness.status, 'fresh');
    assert.equal(result.envelope.qualityState, 'VALID');
    assert.equal(result.duplicate, false);
  });

  it('stale observation is explicitly degraded', () => {
    const staleNow = asUtcInstant('2026-09-16T12:05:00.000Z');
    const fabric = fabricAt(staleNow);
    const result = fabric.ingest({
      observation: marketObservation({ sourceTimestamp: SOURCE_EVENT, retrievedAt: staleNow }),
      sourceId: 'fixture_market:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      observationType: 'tick',
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.message);
    assert.ok(isFreshnessDegraded(result.envelope.freshness.status));
    assert.equal(result.envelope.qualityState, 'DEGRADED_STALE');
    assert.ok(result.envelope.qualityFlags.some((f) => f.code === 'STALENESS'));
  });

  it('expired observation is explicitly degraded', () => {
    const expiredNow = asUtcInstant('2026-09-16T12:10:00.000Z');
    const assessment = assessHeliosFreshness({
      observationType: 'tick',
      referenceTimestamp: SOURCE_EVENT,
      nowUtc: expiredNow,
    });
    assert.equal(assessment.status, 'expired');
    const fabric = fabricAt(expiredNow);
    const result = fabric.ingest({
      observation: marketObservation({ retrievedAt: expiredNow }),
      sourceId: 'fixture_market:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      observationType: 'tick',
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.message);
    assert.equal(result.envelope.freshness.status, 'expired');
    assert.equal(result.envelope.qualityState, 'DEGRADED_STALE');
  });

  it('unknown freshness when reference timestamp missing', () => {
    const built = buildExternalObservation({
      providerId: 'fixture_market',
      providerCategory: 'markets',
      capability: 'market_prices',
      data: { symbol: 'AAPL', priceMinor: 150_00n, currency: 'USD', asOf: '', sourceProvider: 'fixture_market', exchange: null },
      source: { provider: 'fixture_market', dataset: 'AAPL' },
      time: { retrievedAt: NOW, sourceTimestamp: null },
      authorityClass: 'reference_data',
      provenance: { rawPayload: '{}', providerSchemaVersion: 'test/1' },
    });
    assert.equal(built.ok, true);
    const assessment = assessHeliosFreshness({
      observationType: 'daily_price',
      referenceTimestamp: null,
      nowUtc: NOW,
    });
    assert.equal(assessment.status, 'unknown');
  });

  it('uses per-type freshness policies — daily price not tick threshold', () => {
    const oneDayLater = asUtcInstant('2026-09-17T12:00:00.000Z');
    const tickAssessment = assessHeliosFreshness({
      observationType: 'tick',
      referenceTimestamp: SOURCE_EVENT,
      nowUtc: oneDayLater,
    });
    const dailyAssessment = assessHeliosFreshness({
      observationType: 'daily_price',
      referenceTimestamp: SOURCE_EVENT,
      nowUtc: oneDayLater,
    });
    assert.equal(tickAssessment.status, 'expired');
    assert.equal(dailyAssessment.status, 'aging');
  });

  it('detects duplicate observations from same upstream event', () => {
    const fabric = fabricAt(NOW);
    const obs = marketObservation({ observationId: 'obs_dup_1' });
    const first = fabric.ingest({
      observation: obs,
      sourceId: 'fixture_market:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      observationType: 'quote',
      lineage: { upstreamSourceRef: 'upstream_report_42' },
    });
    const second = fabric.ingest({
      observation: marketObservation({ observationId: 'obs_dup_2', providerId: 'other_adapter' }),
      sourceId: 'other_adapter:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      observationType: 'quote',
      lineage: { upstreamSourceRef: 'upstream_report_42' },
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) throw new Error('ingest failed');
    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
    assert.equal(second.envelope.qualityState, 'DEGRADED_DUPLICATE');
  });

  it('lineage records upstream source reference', () => {
    const fabric = fabricAt(NOW);
    const result = fabric.ingest({
      observation: marketObservation(),
      sourceId: 'fixture_market:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      observationType: 'quote',
      lineage: { upstreamSourceRef: 'reuters:quote:12345', sourceFamily: 'reuters' },
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.message);
    assert.equal(result.envelope.lineage.upstreamSourceRef, 'reuters:quote:12345');
    assert.equal(result.envelope.lineage.sourceFamily, 'reuters');
    assert.ok(result.envelope.lineage.lineageId.startsWith('hln_'));
  });

  it('shared upstream source is not counted as independent', () => {
    const fabric = fabricAt(NOW);
    fabric.ingest({
      observation: marketObservation({ observationId: 'obs_ind_1', providerId: 'adapter_a' }),
      sourceId: 'adapter_a:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      observationType: 'quote',
      lineage: { upstreamSourceRef: 'shared_upstream_99' },
    });
    const second = fabric.ingest({
      observation: marketObservation({ observationId: 'obs_ind_2', providerId: 'adapter_b', rawPayload: '{"priceMinor":"15100"}' }),
      sourceId: 'adapter_b:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      observationType: 'quote',
      lineage: { upstreamSourceRef: 'shared_upstream_99' },
    });
    assert.equal(second.ok, true);
    if (!second.ok) throw new Error(second.message);
    assert.equal(second.envelope.sourceIndependence, 'SHARED_UPSTREAM');
    assert.ok(second.envelope.qualityFlags.some((f) => f.code === 'SHARED_UPSTREAM_SOURCE'));
  });

  it('entitlement unavailable blocks usable state', () => {
    const fabric = fabricAt(NOW);
    const result = fabric.ingest({
      observation: marketObservation({ commercialUseStatus: 'prohibited' }),
      sourceId: 'fixture_market:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      observationType: 'quote',
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.message);
    assert.equal(result.envelope.qualityState, 'DEGRADED_ENTITLEMENT');
    assert.ok(!isEntitlementUsable(result.envelope.entitlement));
  });

  it('unknown entitlement is not treated as unrestricted', () => {
    const fabric = fabricAt(NOW);
    const result = fabric.ingest({
      observation: marketObservation({ commercialUseStatus: 'unknown', redistributionStatus: 'unknown' }),
      sourceId: 'fixture_market:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      observationType: 'quote',
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.message);
    assert.equal(result.envelope.entitlement.entitlementClass, 'unknown');
    assert.ok(result.envelope.qualityFlags.some((f) => f.code === 'ENTITLEMENT_UNKNOWN'));
  });

  it('malformed timestamp degrades quality', () => {
    const fabric = fabricAt(NOW);
    const result = fabric.ingest({
      observation: marketObservation({ validationStatus: 'timestamp_invalid' }),
      sourceId: 'fixture_market:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      observationType: 'quote',
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.message);
    assert.equal(result.envelope.qualityState, 'DEGRADED_MALFORMED');
  });

  it('detects sequence gap', () => {
    const fabric = fabricAt(NOW);
    fabric.ingest({
      observation: marketObservation({
        observationId: 'obs_seq_1',
        sourceTimestamp: asUtcInstant('2026-09-16T11:59:50.000Z'),
        rawPayload: '{"priceMinor":"15000","seq":1}',
      }),
      sourceId: 'fixture_market:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      observationType: 'quote',
      sequence: 1,
    });
    const gap = fabric.ingest({
      observation: marketObservation({
        observationId: 'obs_seq_3',
        sourceTimestamp: asUtcInstant('2026-09-16T11:59:52.000Z'),
        rawPayload: '{"priceMinor":"15010","seq":3}',
      }),
      sourceId: 'fixture_market:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      observationType: 'quote',
      sequence: 3,
    });
    assert.equal(gap.ok, true);
    if (!gap.ok) throw new Error(gap.message);
    assert.equal(gap.envelope.gapState, 'DETECTED');
    assert.equal(gap.envelope.qualityState, 'DEGRADED_GAP');
  });

  it('outlier from trust engine degrades quality', () => {
    const engine = createExternalDataTrustEngine({ nowUtc: () => NOW });
    const obs = marketObservation();
    const trust = assessMarketReferenceTrust(engine, {
      observations: [obs],
      assetId: 'AAPL',
      providerRisk: {},
    });
    const trustWithOutlier = Object.freeze({
      ...trust,
      outlierStatus: 'OUTLIER' as const,
    });
    const fabric = fabricAt(NOW);
    const result = fabric.ingest({
      observation: obs,
      sourceId: 'fixture_market:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      observationType: 'quote',
      trustResult: trustWithOutlier,
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.message);
    assert.equal(result.envelope.outlierState, 'OUTLIER');
    assert.equal(result.envelope.qualityState, 'DEGRADED_OUTLIER');
    assert.ok(result.envelope.trustRef);
    assert.equal(result.envelope.trustRef!.grantsExecutionAuthority, false);
  });

  it('provider unavailable yields UNAVAILABLE quality without synthetic fallback', () => {
    const engine = createExternalDataTrustEngine({ nowUtc: () => NOW });
    const obs = marketObservation();
    const trust = assessMarketReferenceTrust(engine, {
      observations: [],
      assetId: 'AAPL',
    });
    const fabric = fabricAt(NOW);
    const result = fabric.ingest({
      observation: obs,
      sourceId: 'fixture_market:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      observationType: 'quote',
      trustResult: Object.freeze({ ...trust, status: 'UNAVAILABLE' }),
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.message);
    assert.equal(result.envelope.qualityState, 'UNAVAILABLE');
    assert.equal(fabric.store().list().length, 0);
  });

  it('envelope answers WHAT/WHERE/WHEN/WHICH/IS questions for consumers', () => {
    const fabric = fabricAt(NOW);
    const result = fabric.ingest({
      observation: marketObservation({ observationId: 'obs_consumer_1' }),
      sourceId: 'fixture_market:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      venue: 'NASDAQ',
      observationType: 'quote',
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.message);
    const e = result.envelope;
    assert.equal(e.observation.data.symbol, 'AAPL');
    assert.equal(e.canonicalInstrumentId, 'instr_aapl_nasdaq');
    assert.equal(e.providerId, 'fixture_market');
    assert.equal(e.informationTime.sourceEventTime, SOURCE_EVENT);
    assert.ok(e.informationTime.knowableAt);
    assert.equal(e.freshness.status, 'fresh');
    assert.ok(e.entitlement.entitlementClass);
    assert.ok(e.sourceIndependence);
    assert.ok(e.qualityState);
  });
});

describePersistence('HELIOS H08 persistence', () => {
  it('observation metadata survives restart', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const pool = durable.session.pools.customer;
    const clock = new FrozenClock(NOW);
    const store = createHeliosObservationStore();
    const fabric = new HeliosObservationFabric({ clock, store });
    const result = fabric.ingest({
      observation: marketObservation({ observationId: 'obs_persist_1' }),
      sourceId: 'fixture_market:AAPL',
      canonicalInstrumentId: 'instr_aapl_nasdaq',
      observationType: 'quote',
    });
    assert.equal(result.ok, true);
    await persistHeliosObservationState(pool, store.snapshot());
    const loaded = await loadHeliosObservationState(pool);
    const restoredStore = createHeliosObservationStore();
    restoredStore.restore(loaded);
    const restored = restoredStore.get('obs_persist_1');
    assert.ok(restored);
    assert.equal(restored!.canonicalInstrumentId, 'instr_aapl_nasdaq');
    assert.equal(restored!.informationTime.knowableAt, ARRIVAL);
    assert.equal(restored!.freshness.status, 'fresh');
  });
});
