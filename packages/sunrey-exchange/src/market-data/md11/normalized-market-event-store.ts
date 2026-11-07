/**
 * Immutable append-only normalized HELIOS market event store.
 */

import { partitionKeyId } from './partition.ts';
import { indexFieldValue, type MarketEventIndexName, MARKET_EVENT_INDEX_NAMES, compareUtc } from './indexes.ts';
import type { MarketDataPartitionKey, NormalizedMarketEventRecord } from './types.ts';

export type NormalizedMarketEventStoreSnapshot = Readonly<{
  readonly events: readonly NormalizedMarketEventRecord[];
  readonly nextIngestSequence: bigint;
}>;

export type NormalizedMarketEventStore = Readonly<{
  readonly append: (
    event: Omit<NormalizedMarketEventRecord, 'ingestSequence' | 'storeKind' | 'schema'>,
  ) => NormalizedMarketEventRecord;
  readonly get: (eventId: string) => NormalizedMarketEventRecord | undefined;
  readonly getByRawEventId: (rawEventId: string) => NormalizedMarketEventRecord | undefined;
  readonly list: () => readonly NormalizedMarketEventRecord[];
  readonly listByPartition: (partition: MarketDataPartitionKey) => readonly NormalizedMarketEventRecord[];
  readonly listByIndex: (
    name: MarketEventIndexName,
    value: string,
    partition?: MarketDataPartitionKey,
  ) => readonly NormalizedMarketEventRecord[];
  readonly snapshot: () => NormalizedMarketEventStoreSnapshot;
  readonly restore: (snapshot: NormalizedMarketEventStoreSnapshot) => void;
}>;

export function createNormalizedMarketEventStore(): NormalizedMarketEventStore {
  const byId = new Map<string, NormalizedMarketEventRecord>();
  const byRawId = new Map<string, NormalizedMarketEventRecord>();
  const ordered: NormalizedMarketEventRecord[] = [];
  const byPartition = new Map<string, NormalizedMarketEventRecord[]>();
  const indexMaps = new Map<MarketEventIndexName, Map<string, NormalizedMarketEventRecord[]>>();
  for (const name of MARKET_EVENT_INDEX_NAMES) {
    indexMaps.set(name, new Map());
  }
  let nextIngestSequence = 0n;

  function indexEvent(event: NormalizedMarketEventRecord): void {
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
    input: Omit<NormalizedMarketEventRecord, 'ingestSequence' | 'storeKind' | 'schema'>,
  ): NormalizedMarketEventRecord {
    if (byId.has(input.eventId)) {
      throw new Error(`normalized event already stored: ${input.eventId}`);
    }
    nextIngestSequence += 1n;
    const event: NormalizedMarketEventRecord = Object.freeze({
      schema: 'sunrey.helios.market-data.md11.v1',
      storeKind: 'normalized',
      ...input,
      ingestSequence: nextIngestSequence,
    });
    byId.set(event.eventId, event);
    byRawId.set(event.rawEventId, event);
    ordered.push(event);
    indexEvent(event);
    return event;
  }

  function filterPartition(rows: readonly NormalizedMarketEventRecord[], partition?: MarketDataPartitionKey) {
    if (!partition) return rows;
    const id = partitionKeyId(partition);
    return rows.filter((row) => partitionKeyId(row.partition) === id);
  }

  return Object.freeze({
    append,
    get(eventId: string) {
      return byId.get(eventId);
    },
    getByRawEventId(rawEventId: string) {
      return byRawId.get(rawEventId);
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
    restore(snapshot: NormalizedMarketEventStoreSnapshot) {
      byId.clear();
      byRawId.clear();
      ordered.length = 0;
      byPartition.clear();
      for (const map of indexMaps.values()) map.clear();
      nextIngestSequence = snapshot.nextIngestSequence;
      for (const event of snapshot.events) {
        byId.set(event.eventId, event);
        byRawId.set(event.rawEventId, event);
        ordered.push(event);
        indexEvent(event);
      }
    },
  });
}

export function sortNormalizedByPacketOrder(
  events: readonly NormalizedMarketEventRecord[],
): readonly NormalizedMarketEventRecord[] {
  return Object.freeze(
    [...events].sort((a, b) => {
      if (a.packetOrder !== b.packetOrder) return a.packetOrder - b.packetOrder;
      const seq = a.ingestSequence < b.ingestSequence ? -1 : a.ingestSequence > b.ingestSequence ? 1 : 0;
      if (seq !== 0) return seq;
      return compareUtc(a.index.exchangeTime, b.index.exchangeTime);
    }),
  );
}
