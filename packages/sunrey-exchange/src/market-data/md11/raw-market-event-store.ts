/**
 * Immutable append-only raw provider market event store.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { partitionKeyId } from './partition.ts';
import { indexFieldValue, type MarketEventIndexName, MARKET_EVENT_INDEX_NAMES, compareUtc } from './indexes.ts';
import type { MarketDataPartitionKey, RawMarketEventRecord } from './types.ts';

export type RawMarketEventStoreSnapshot = Readonly<{
  readonly events: readonly RawMarketEventRecord[];
  readonly nextIngestSequence: bigint;
}>;

export type RawMarketEventStore = Readonly<{
  readonly append: (event: Omit<RawMarketEventRecord, 'ingestSequence' | 'storeKind' | 'schema'>) => RawMarketEventRecord;
  readonly get: (eventId: string) => RawMarketEventRecord | undefined;
  readonly list: () => readonly RawMarketEventRecord[];
  readonly listByPartition: (partition: MarketDataPartitionKey) => readonly RawMarketEventRecord[];
  readonly listByIndex: (
    name: MarketEventIndexName,
    value: string,
    partition?: MarketDataPartitionKey,
  ) => readonly RawMarketEventRecord[];
  readonly snapshot: () => RawMarketEventStoreSnapshot;
  readonly restore: (snapshot: RawMarketEventStoreSnapshot) => void;
}>;

export function createRawMarketEventStore(): RawMarketEventStore {
  const byId = new Map<string, RawMarketEventRecord>();
  const ordered: RawMarketEventRecord[] = [];
  const byPartition = new Map<string, RawMarketEventRecord[]>();
  const indexMaps = new Map<MarketEventIndexName, Map<string, RawMarketEventRecord[]>>();
  for (const name of MARKET_EVENT_INDEX_NAMES) {
    indexMaps.set(name, new Map());
  }
  let nextIngestSequence = 0n;

  function indexEvent(event: RawMarketEventRecord): void {
    const pKey = partitionKeyId(event.partition);
    const pList = byPartition.get(pKey) ?? [];
    pList.push(event);
    byPartition.set(pKey, pList);
    for (const name of MARKET_EVENT_INDEX_NAMES) {
      const value = indexFieldValue(event.index, name);
      if (!value) continue;
      const map = indexMaps.get(name)!;
      const bucket = map.get(value) ?? [];
      bucket.push(event);
      map.set(value, bucket);
    }
  }

  function append(
    input: Omit<RawMarketEventRecord, 'ingestSequence' | 'storeKind' | 'schema'>,
  ): RawMarketEventRecord {
    if (byId.has(input.eventId)) {
      throw new Error(`raw event already stored: ${input.eventId}`);
    }
    nextIngestSequence += 1n;
    const event: RawMarketEventRecord = Object.freeze({
      schema: 'sunrey.helios.market-data.md11.v1',
      storeKind: 'raw',
      ...input,
      ingestSequence: nextIngestSequence,
    });
    byId.set(event.eventId, event);
    ordered.push(event);
    indexEvent(event);
    return event;
  }

  function filterPartition(rows: readonly RawMarketEventRecord[], partition?: MarketDataPartitionKey) {
    if (!partition) return rows;
    const id = partitionKeyId(partition);
    return rows.filter((row) => partitionKeyId(row.partition) === id);
  }

  return Object.freeze({
    append,
    get(eventId: string) {
      return byId.get(eventId);
    },
    list() {
      return Object.freeze([...ordered]);
    },
    listByPartition(partition: MarketDataPartitionKey) {
      return Object.freeze([...(byPartition.get(partitionKeyId(partition)) ?? [])]);
    },
    listByIndex(name: MarketEventIndexName, value: string, partition?: MarketDataPartitionKey) {
      const rows = indexMaps.get(name)?.get(value) ?? [];
      return Object.freeze(filterPartition(rows, partition));
    },
    snapshot() {
      return Object.freeze({
        events: Object.freeze([...ordered]),
        nextIngestSequence,
      });
    },
    restore(snapshot: RawMarketEventStoreSnapshot) {
      byId.clear();
      ordered.length = 0;
      byPartition.clear();
      for (const map of indexMaps.values()) map.clear();
      nextIngestSequence = snapshot.nextIngestSequence;
      for (const event of snapshot.events) {
        byId.set(event.eventId, event);
        ordered.push(event);
        indexEvent(event);
      }
    },
  });
}

export function sortRawByPacketOrder(events: readonly RawMarketEventRecord[]): readonly RawMarketEventRecord[] {
  return Object.freeze(
    [...events].sort((a, b) => {
      if (a.packetOrder !== b.packetOrder) return a.packetOrder - b.packetOrder;
      const seq = a.ingestSequence < b.ingestSequence ? -1 : a.ingestSequence > b.ingestSequence ? 1 : 0;
      if (seq !== 0) return seq;
      return compareUtc(a.index.exchangeTime, b.index.exchangeTime);
    }),
  );
}
