/**
 * HELIOS MARKET DATA MD02 — precision market time and timestamp provenance.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant, type UtcInstant } from '../packages/domain/src/time.ts';
import { buildExternalObservation, MARKET_PRICE_FRESHNESS_POLICY } from '../packages/provider-sdk/src/index.ts';
import {
  HELIOS_MD02_PRECISION_TIME_QUALIFIED,
  aafTemporalJoinInstant,
  buildMarketTimeEnvelope,
  ciSoftwareClockDiscipline,
  computeMarketTimeLatencies,
  evaluateMd02PrecisionTimeQualification,
  marketTimeToInformationTime,
} from '../packages/platform/src/helios/market-data/md02/index.ts';
import { HeliosObservationFabric } from '../packages/platform/src/helios/observation/fabric.ts';
import { createHeliosObservationStore } from '../packages/platform/src/helios/observation/store.ts';
import { isKnowableAt } from '../packages/platform/src/helios/observation/information-time.ts';

const EXCHANGE_EVENT = asUtcInstant('2026-09-16T11:59:55.000Z');
const EXCHANGE_SEND = asUtcInstant('2026-09-16T11:59:55.010Z');
const PROVIDER_RECEIVE = asUtcInstant('2026-09-16T12:00:00.050Z');
const PROVIDER_PUBLISH = asUtcInstant('2026-09-16T12:00:00.100Z');
const SUNREY_RECEIVE = asUtcInstant('2026-09-16T12:00:01.000Z');
const SUNREY_DECODE = asUtcInstant('2026-09-16T12:00:01.020Z');
const SUNREY_NORMALIZE = asUtcInstant('2026-09-16T12:00:01.080Z');
const SUNREY_PERSIST = asUtcInstant('2026-09-16T12:00:01.150Z');
const EARLY_EVAL = asUtcInstant('2026-09-16T12:00:00.500Z');
const LATE_EVAL = asUtcInstant('2026-09-16T12:00:02.000Z');

describe('HELIOS MD02 precision market time', () => {
  it('preserves distinct pipeline timestamps in MarketTimeEnvelope', () => {
    const envelope = buildMarketTimeEnvelope({
      exchangeEventTime: EXCHANGE_EVENT,
      exchangeSendTime: EXCHANGE_SEND,
      providerReceiveTime: PROVIDER_RECEIVE,
      providerPublishTime: PROVIDER_PUBLISH,
      sunreyNetworkReceiveTime: SUNREY_RECEIVE,
      sunreyDecodeTime: SUNREY_DECODE,
      sunreyNormalizeTime: SUNREY_NORMALIZE,
      sunreyPersistTime: SUNREY_PERSIST,
      clockDiscipline: ciSoftwareClockDiscipline(SUNREY_RECEIVE),
    });

    assert.notEqual(envelope.exchangeEventTime, envelope.sunreyNetworkReceiveTime);
    assert.notEqual(envelope.providerPublishTime, envelope.sunreyDecodeTime);
    assert.notEqual(envelope.exchangeSendTime, envelope.sunreyNormalizeTime);
    assert.equal(envelope.knowableAt, SUNREY_PERSIST);
  });

  it('extends knowableAt beyond exchange event time for delayed availability', () => {
    const envelope = buildMarketTimeEnvelope({
      exchangeEventTime: EXCHANGE_EVENT,
      sunreyNetworkReceiveTime: SUNREY_RECEIVE,
      sunreyDecodeTime: SUNREY_DECODE,
      sunreyNormalizeTime: SUNREY_NORMALIZE,
      sunreyPersistTime: SUNREY_PERSIST,
    });
    assert.ok(Date.parse(envelope.knowableAt) > Date.parse(EXCHANGE_EVENT));
    assert.equal(isKnowableAt(EARLY_EVAL, marketTimeToInformationTime(envelope)), false);
    assert.equal(isKnowableAt(LATE_EVAL, marketTimeToInformationTime(envelope)), true);
  });

  it('surfaces negative latency instead of silently correcting', () => {
    const envelope = buildMarketTimeEnvelope({
      exchangeEventTime: EXCHANGE_EVENT,
      sunreyNetworkReceiveTime: SUNREY_RECEIVE,
      sunreyDecodeTime: SUNREY_NORMALIZE,
      sunreyNormalizeTime: SUNREY_DECODE,
      sunreyPersistTime: SUNREY_PERSIST,
    });
    assert.equal(envelope.timestampQuality.negativeLatencyDetected, true);
    const latencies = computeMarketTimeLatencies(envelope);
    assert.ok(latencies.negativeSegments.includes('normalization'));
  });

  it('flags CLOCK_INCONSISTENCY when source clock is ahead beyond tolerance', () => {
    const futureEvent = asUtcInstant('2026-09-16T13:00:00.000Z');
    const envelope = buildMarketTimeEnvelope({
      exchangeEventTime: futureEvent,
      sunreyNetworkReceiveTime: SUNREY_RECEIVE,
      sunreyNormalizeTime: SUNREY_NORMALIZE,
      sunreyPersistTime: SUNREY_PERSIST,
      clockAheadToleranceMs: 1000,
    });
    assert.equal(envelope.timestampQuality.clockInconsistency, true);
  });

  it('AAF historical joins use knowableAt not exchange event time', () => {
    const envelope = buildMarketTimeEnvelope({
      exchangeEventTime: EXCHANGE_EVENT,
      sunreyNetworkReceiveTime: SUNREY_RECEIVE,
      sunreyPersistTime: SUNREY_PERSIST,
    });
    const joinAt = aafTemporalJoinInstant(envelope);
    assert.equal(joinAt, envelope.knowableAt);
    assert.notEqual(joinAt, EXCHANGE_EVENT);
  });

  it('CI software clock discipline does not claim hardware timestamping', () => {
    const discipline = ciSoftwareClockDiscipline(SUNREY_RECEIVE);
    assert.equal(discipline.hardwareTimestampingClaimed, false);
    assert.equal(discipline.syncSource, 'SOFTWARE_WALL_CLOCK');
    assert.equal(discipline.state, 'DEGRADED');
  });

  it('H08 fabric seals MD02 marketTime on ingest', () => {
    const clock = new FrozenClock(SUNREY_NORMALIZE);
    const fabric = new HeliosObservationFabric({
      clock,
      store: createHeliosObservationStore(),
    });
    const built = buildExternalObservation({
      observationId: 'md02-fixture-quote',
      providerId: 'sandbox',
      providerCategory: 'markets',
      capability: 'quote',
      data: { bid: 100, ask: 101 },
      source: { provider: 'sandbox', dataset: 'SECURITY:US:SPY:ARCX' },
      time: { retrievedAt: SUNREY_RECEIVE, sourceTimestamp: EXCHANGE_EVENT },
      authorityClass: 'reference_data',
      provenance: { rawPayload: '{}', providerSchemaVersion: 'v1' },
      licensing: { commercialUseStatus: 'permitted', redistributionStatus: 'permitted' },
      freshnessPolicy: MARKET_PRICE_FRESHNESS_POLICY,
      validationStatus: 'valid',
    });
    assert.ok(built.ok);
    const result = fabric.ingest({
      observation: built.value,
      sourceId: 'sandbox.quote',
      canonicalInstrumentId: 'SECURITY:US:SPY:ARCX',
      observationType: 'quote',
      informationTime: {
        sourceEventTime: EXCHANGE_EVENT,
        providerAvailabilityTime: PROVIDER_PUBLISH,
        sunreyArrivalTime: SUNREY_RECEIVE,
        ingestionTime: SUNREY_NORMALIZE,
      },
    });
    assert.ok(result.ok);
    assert.equal(result.envelope.marketTime.schema, 'sunrey.helios.market-data.md02.v1');
    assert.equal(result.envelope.informationTime.knowableAt, result.envelope.marketTime.knowableAt);
  });

  it('HELIOS_MD02_PRECISION_TIME_QUALIFIED when engineering checks pass', () => {
    const goodEnvelope = buildMarketTimeEnvelope({
      exchangeEventTime: EXCHANGE_EVENT,
      exchangeSendTime: EXCHANGE_SEND,
      providerReceiveTime: PROVIDER_RECEIVE,
      providerPublishTime: PROVIDER_PUBLISH,
      sunreyNetworkReceiveTime: SUNREY_RECEIVE,
      sunreyDecodeTime: SUNREY_DECODE,
      sunreyNormalizeTime: SUNREY_NORMALIZE,
      sunreyPersistTime: SUNREY_PERSIST,
      processMonotonicNs: Object.freeze({
        networkReceive: 1_000n,
        decode: 1_500_000n,
        normalize: 3_000_000n,
        persist: 4_500_000n,
      }),
    });
    const badLatency = buildMarketTimeEnvelope({
      exchangeEventTime: EXCHANGE_EVENT,
      sunreyNetworkReceiveTime: SUNREY_RECEIVE,
      sunreyDecodeTime: SUNREY_PERSIST,
      sunreyNormalizeTime: SUNREY_DECODE,
      sunreyPersistTime: SUNREY_PERSIST,
    });
    const inconsistent = buildMarketTimeEnvelope({
      exchangeEventTime: asUtcInstant('2026-09-16T14:00:00.000Z'),
      sunreyNetworkReceiveTime: SUNREY_RECEIVE,
      sunreyPersistTime: SUNREY_PERSIST,
    });

    const qualification = evaluateMd02PrecisionTimeQualification({
      distinctPipelineStages: true,
      knowableAtNotEventTimeAlone: Date.parse(goodEnvelope.knowableAt) > Date.parse(EXCHANGE_EVENT),
      negativeLatencySurfaced: badLatency.timestampQuality.negativeLatencyDetected,
      clockInconsistencySurfaced: inconsistent.timestampQuality.clockInconsistency,
      aafJoinUsesKnowableAt: aafTemporalJoinInstant(goodEnvelope) === goodEnvelope.knowableAt,
      ciDoesNotClaimHardwarePrecision: !ciSoftwareClockDiscipline(SUNREY_RECEIVE).hardwareTimestampingClaimed,
      monotonicInternalLatency:
        computeMarketTimeLatencies(goodEnvelope, {
          networkReceive: 1_000n,
          decode: 2_000_000n,
          normalize: 3_000_000n,
          persist: 4_000_000n,
        }).negativeSegments.length === 0,
    });

    assert.equal(qualification.marker, HELIOS_MD02_PRECISION_TIME_QUALIFIED, qualification.blockers.join('; '));
  });
});
