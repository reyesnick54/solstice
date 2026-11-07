/**
 * Adversarial MD11 fixture tape: gaps, halts, late messages, revisions, failures.
 */

import { createHash } from 'node:crypto';
import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import { buildPartitionKey } from './partition.ts';
import { createNormalizedMarketEventStore } from './normalized-market-event-store.ts';
import { createRawMarketEventStore } from './raw-market-event-store.ts';
import { buildMarketSessionManifest } from './manifests.ts';
import type {
  MarketDataPartitionKey,
  MarketSessionManifest,
  NormalizedMarketEventRecord,
  RawMarketEventRecord,
} from './types.ts';

export const MD11_FIXTURE_PARTITION: MarketDataPartitionKey = buildPartitionKey({
  exchangeTime: '2026-06-02T14:00:00.000Z',
  venue: 'XNYS',
  feed: 'sim_tick',
  instrumentFamily: 'equity',
});

const VENUE = 'XNYS';
const PROVIDER = 'sandbox_fixture';
const INSTRUMENT = 'EQUITY:US:AAPL:USD:SIM';

function hashPayload(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}

function baseIndex(input: {
  readonly exchangeTime: UtcInstant;
  readonly sunreyReceiveTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly sequence: bigint | null;
}) {
  return Object.freeze({
    instrument: INSTRUMENT,
    venue: VENUE,
    provider: PROVIDER,
    exchangeTime: input.exchangeTime,
    sunreyReceiveTime: input.sunreyReceiveTime,
    knowableAt: input.knowableAt,
    sequence: input.sequence,
  });
}

type FixturePair = Readonly<{
  readonly raw: Omit<RawMarketEventRecord, 'schema' | 'storeKind' | 'ingestSequence'>;
  readonly normalized: Omit<NormalizedMarketEventRecord, 'schema' | 'storeKind' | 'ingestSequence'>;
}>;

const FIXTURE_EVENTS: readonly FixturePair[] = Object.freeze([
  {
    raw: {
      eventId: 'raw_md11_001',
      partition: MD11_FIXTURE_PARTITION,
      index: baseIndex({
        exchangeTime: asUtcInstant('2026-06-02T14:00:01.000Z'),
        sunreyReceiveTime: asUtcInstant('2026-06-02T14:00:01.050Z'),
        knowableAt: asUtcInstant('2026-06-02T14:00:01.050Z'),
        sequence: 100n,
      }),
      rawKind: 'trade',
      providerPayload: '{"trade_id":"t1","price":"15025","qty":"10"}',
      providerPayloadHash: hashPayload('{"trade_id":"t1","price":"15025","qty":"10"}'),
      packetOrder: 1,
      isLate: false,
      isRevision: false,
      revisesEventId: null,
      providerFailure: false,
      recordedAt: asUtcInstant('2026-06-02T14:00:01.050Z'),
    },
    normalized: {
      eventId: 'norm_md11_001',
      rawEventId: 'raw_md11_001',
      partition: MD11_FIXTURE_PARTITION,
      index: baseIndex({
        exchangeTime: asUtcInstant('2026-06-02T14:00:01.000Z'),
        sunreyReceiveTime: asUtcInstant('2026-06-02T14:00:01.050Z'),
        knowableAt: asUtcInstant('2026-06-02T14:00:01.050Z'),
        sequence: 100n,
      }),
      heliosKind: 'trade',
      normalizedBody: '{"priceMinorUnits":"15025","quantityMinorUnits":"10"}',
      normalizedBodyHash: hashPayload('{"priceMinorUnits":"15025","quantityMinorUnits":"10"}'),
      packetOrder: 1,
      isLate: false,
      isRevision: false,
      revisesEventId: null,
      providerFailure: false,
      recordedAt: asUtcInstant('2026-06-02T14:00:01.050Z'),
    },
  },
  {
    raw: {
      eventId: 'raw_md11_gap',
      partition: MD11_FIXTURE_PARTITION,
      index: baseIndex({
        exchangeTime: asUtcInstant('2026-06-02T14:00:02.000Z'),
        sunreyReceiveTime: asUtcInstant('2026-06-02T14:00:02.020Z'),
        knowableAt: asUtcInstant('2026-06-02T14:00:02.020Z'),
        sequence: null,
      }),
      rawKind: 'sequence_gap',
      providerPayload: '{"gap_from":101,"gap_to":104}',
      providerPayloadHash: hashPayload('{"gap_from":101,"gap_to":104}'),
      packetOrder: 2,
      isLate: false,
      isRevision: false,
      revisesEventId: null,
      providerFailure: false,
      recordedAt: asUtcInstant('2026-06-02T14:00:02.020Z'),
    },
    normalized: {
      eventId: 'norm_md11_gap',
      rawEventId: 'raw_md11_gap',
      partition: MD11_FIXTURE_PARTITION,
      index: baseIndex({
        exchangeTime: asUtcInstant('2026-06-02T14:00:02.000Z'),
        sunreyReceiveTime: asUtcInstant('2026-06-02T14:00:02.020Z'),
        knowableAt: asUtcInstant('2026-06-02T14:00:02.020Z'),
        sequence: null,
      }),
      heliosKind: 'sequence_gap',
      normalizedBody: '{"expectedSequence":101,"receivedSequence":104}',
      normalizedBodyHash: hashPayload('{"expectedSequence":101,"receivedSequence":104}'),
      packetOrder: 2,
      isLate: false,
      isRevision: false,
      revisesEventId: null,
      providerFailure: false,
      recordedAt: asUtcInstant('2026-06-02T14:00:02.020Z'),
    },
  },
  {
    raw: {
      eventId: 'raw_md11_halt',
      partition: MD11_FIXTURE_PARTITION,
      index: baseIndex({
        exchangeTime: asUtcInstant('2026-06-02T14:00:03.000Z'),
        sunreyReceiveTime: asUtcInstant('2026-06-02T14:00:03.030Z'),
        knowableAt: asUtcInstant('2026-06-02T14:00:03.030Z'),
        sequence: 105n,
      }),
      rawKind: 'halt',
      providerPayload: '{"status":"HALTED"}',
      providerPayloadHash: hashPayload('{"status":"HALTED"}'),
      packetOrder: 3,
      isLate: false,
      isRevision: false,
      revisesEventId: null,
      providerFailure: false,
      recordedAt: asUtcInstant('2026-06-02T14:00:03.030Z'),
    },
    normalized: {
      eventId: 'norm_md11_halt',
      rawEventId: 'raw_md11_halt',
      partition: MD11_FIXTURE_PARTITION,
      index: baseIndex({
        exchangeTime: asUtcInstant('2026-06-02T14:00:03.000Z'),
        sunreyReceiveTime: asUtcInstant('2026-06-02T14:00:03.030Z'),
        knowableAt: asUtcInstant('2026-06-02T14:00:03.030Z'),
        sequence: 105n,
      }),
      heliosKind: 'market_status',
      normalizedBody: '{"sessionStatus":"HALTED"}',
      normalizedBodyHash: hashPayload('{"sessionStatus":"HALTED"}'),
      packetOrder: 3,
      isLate: false,
      isRevision: false,
      revisesEventId: null,
      providerFailure: false,
      recordedAt: asUtcInstant('2026-06-02T14:00:03.030Z'),
    },
  },
  {
    raw: {
      eventId: 'raw_md11_late',
      partition: MD11_FIXTURE_PARTITION,
      index: baseIndex({
        exchangeTime: asUtcInstant('2026-06-02T14:00:01.500Z'),
        sunreyReceiveTime: asUtcInstant('2026-06-02T14:00:04.100Z'),
        knowableAt: asUtcInstant('2026-06-02T14:00:04.100Z'),
        sequence: 106n,
      }),
      rawKind: 'trade',
      providerPayload: '{"trade_id":"t_late","price":"15030","qty":"5"}',
      providerPayloadHash: hashPayload('{"trade_id":"t_late","price":"15030","qty":"5"}'),
      packetOrder: 4,
      isLate: true,
      isRevision: false,
      revisesEventId: null,
      providerFailure: false,
      recordedAt: asUtcInstant('2026-06-02T14:00:04.100Z'),
    },
    normalized: {
      eventId: 'norm_md11_late',
      rawEventId: 'raw_md11_late',
      partition: MD11_FIXTURE_PARTITION,
      index: baseIndex({
        exchangeTime: asUtcInstant('2026-06-02T14:00:01.500Z'),
        sunreyReceiveTime: asUtcInstant('2026-06-02T14:00:04.100Z'),
        knowableAt: asUtcInstant('2026-06-02T14:00:04.100Z'),
        sequence: 106n,
      }),
      heliosKind: 'trade',
      normalizedBody: '{"priceMinorUnits":"15030","quantityMinorUnits":"5"}',
      normalizedBodyHash: hashPayload('{"priceMinorUnits":"15030","quantityMinorUnits":"5"}'),
      packetOrder: 4,
      isLate: true,
      isRevision: false,
      revisesEventId: null,
      providerFailure: false,
      recordedAt: asUtcInstant('2026-06-02T14:00:04.100Z'),
    },
  },
  {
    raw: {
      eventId: 'raw_md11_rev',
      partition: MD11_FIXTURE_PARTITION,
      index: baseIndex({
        exchangeTime: asUtcInstant('2026-06-02T14:00:05.000Z'),
        sunreyReceiveTime: asUtcInstant('2026-06-02T14:00:05.040Z'),
        knowableAt: asUtcInstant('2026-06-02T14:00:05.040Z'),
        sequence: 107n,
      }),
      rawKind: 'revision',
      providerPayload: '{"revises":"raw_md11_001","price":"15020"}',
      providerPayloadHash: hashPayload('{"revises":"raw_md11_001","price":"15020"}'),
      packetOrder: 5,
      isLate: false,
      isRevision: true,
      revisesEventId: 'raw_md11_001',
      providerFailure: false,
      recordedAt: asUtcInstant('2026-06-02T14:00:05.040Z'),
    },
    normalized: {
      eventId: 'norm_md11_rev',
      rawEventId: 'raw_md11_rev',
      partition: MD11_FIXTURE_PARTITION,
      index: baseIndex({
        exchangeTime: asUtcInstant('2026-06-02T14:00:05.000Z'),
        sunreyReceiveTime: asUtcInstant('2026-06-02T14:00:05.040Z'),
        knowableAt: asUtcInstant('2026-06-02T14:00:05.040Z'),
        sequence: 107n,
      }),
      heliosKind: 'revision',
      normalizedBody: '{"revisesEventId":"norm_md11_001","priceMinorUnits":"15020"}',
      normalizedBodyHash: hashPayload('{"revisesEventId":"norm_md11_001","priceMinorUnits":"15020"}'),
      packetOrder: 5,
      isLate: false,
      isRevision: true,
      revisesEventId: 'norm_md11_001',
      providerFailure: false,
      recordedAt: asUtcInstant('2026-06-02T14:00:05.040Z'),
    },
  },
  {
    raw: {
      eventId: 'raw_md11_fail',
      partition: MD11_FIXTURE_PARTITION,
      index: baseIndex({
        exchangeTime: asUtcInstant('2026-06-02T14:00:06.000Z'),
        sunreyReceiveTime: asUtcInstant('2026-06-02T14:00:06.060Z'),
        knowableAt: asUtcInstant('2026-06-02T14:00:06.060Z'),
        sequence: null,
      }),
      rawKind: 'provider_failure',
      providerPayload: '{"error":"feed_disconnect"}',
      providerPayloadHash: hashPayload('{"error":"feed_disconnect"}'),
      packetOrder: 6,
      isLate: false,
      isRevision: false,
      revisesEventId: null,
      providerFailure: true,
      recordedAt: asUtcInstant('2026-06-02T14:00:06.060Z'),
    },
    normalized: {
      eventId: 'norm_md11_fail',
      rawEventId: 'raw_md11_fail',
      partition: MD11_FIXTURE_PARTITION,
      index: baseIndex({
        exchangeTime: asUtcInstant('2026-06-02T14:00:06.000Z'),
        sunreyReceiveTime: asUtcInstant('2026-06-02T14:00:06.060Z'),
        knowableAt: asUtcInstant('2026-06-02T14:00:06.060Z'),
        sequence: null,
      }),
      heliosKind: 'provider_failure',
      normalizedBody: '{"code":"feed_disconnect","degraded":true}',
      normalizedBodyHash: hashPayload('{"code":"feed_disconnect","degraded":true}'),
      packetOrder: 6,
      isLate: false,
      isRevision: false,
      revisesEventId: null,
      providerFailure: true,
      recordedAt: asUtcInstant('2026-06-02T14:00:06.060Z'),
    },
  },
  {
    raw: {
      eventId: 'raw_md11_002',
      partition: MD11_FIXTURE_PARTITION,
      index: baseIndex({
        exchangeTime: asUtcInstant('2026-06-02T14:00:07.000Z'),
        sunreyReceiveTime: asUtcInstant('2026-06-02T14:00:07.070Z'),
        knowableAt: asUtcInstant('2026-06-02T14:00:07.070Z'),
        sequence: 108n,
      }),
      rawKind: 'trade',
      providerPayload: '{"trade_id":"t2","price":"15040","qty":"12"}',
      providerPayloadHash: hashPayload('{"trade_id":"t2","price":"15040","qty":"12"}'),
      packetOrder: 7,
      isLate: false,
      isRevision: false,
      revisesEventId: null,
      providerFailure: false,
      recordedAt: asUtcInstant('2026-06-02T14:00:07.070Z'),
    },
    normalized: {
      eventId: 'norm_md11_002',
      rawEventId: 'raw_md11_002',
      partition: MD11_FIXTURE_PARTITION,
      index: baseIndex({
        exchangeTime: asUtcInstant('2026-06-02T14:00:07.000Z'),
        sunreyReceiveTime: asUtcInstant('2026-06-02T14:00:07.070Z'),
        knowableAt: asUtcInstant('2026-06-02T14:00:07.070Z'),
        sequence: 108n,
      }),
      heliosKind: 'trade',
      normalizedBody: '{"priceMinorUnits":"15040","quantityMinorUnits":"12"}',
      normalizedBodyHash: hashPayload('{"priceMinorUnits":"15040","quantityMinorUnits":"12"}'),
      packetOrder: 7,
      isLate: false,
      isRevision: false,
      revisesEventId: null,
      providerFailure: false,
      recordedAt: asUtcInstant('2026-06-02T14:00:07.070Z'),
    },
  },
]);

export function loadMd11FixtureTape(): Readonly<{
  readonly rawStore: ReturnType<typeof createRawMarketEventStore>;
  readonly normalizedStore: ReturnType<typeof createNormalizedMarketEventStore>;
  readonly sessionManifest: MarketSessionManifest;
}> {
  const rawStore = createRawMarketEventStore();
  const normalizedStore = createNormalizedMarketEventStore();
  const rawEvents = [];
  const normalizedEvents = [];
  for (const pair of FIXTURE_EVENTS) {
    rawEvents.push(rawStore.append(pair.raw));
    normalizedEvents.push(normalizedStore.append(pair.normalized));
  }
  const sessionManifest = buildMarketSessionManifest({
    sessionId: 'md11_fixture_session',
    partition: MD11_FIXTURE_PARTITION,
    sessionOpenUtc: asUtcInstant('2026-06-02T14:00:00.000Z'),
    sessionCloseUtc: asUtcInstant('2026-06-02T14:00:08.000Z'),
    rawEvents,
    normalizedEvents,
  });
  return Object.freeze({ rawStore, normalizedStore, sessionManifest });
}
