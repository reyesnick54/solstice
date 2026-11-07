/**
 * Combined immutable tick store (raw + normalized, never bars-only).
 */

import type { RawMarketEventStore, RawMarketEventStoreSnapshot } from './raw-market-event-store.ts';
import { createRawMarketEventStore } from './raw-market-event-store.ts';
import type {
  NormalizedMarketEventStore,
  NormalizedMarketEventStoreSnapshot,
} from './normalized-market-event-store.ts';
import { createNormalizedMarketEventStore } from './normalized-market-event-store.ts';

export type ImmutableTickStoreSnapshot = Readonly<{
  readonly raw: RawMarketEventStoreSnapshot;
  readonly normalized: NormalizedMarketEventStoreSnapshot;
}>;

export type ImmutableTickStore = Readonly<{
  readonly raw: RawMarketEventStore;
  readonly normalized: NormalizedMarketEventStore;
  readonly snapshot: () => ImmutableTickStoreSnapshot;
  readonly restore: (snapshot: ImmutableTickStoreSnapshot) => void;
  readonly retainsBarsOnly: () => false;
}>;

export function createImmutableTickStore(): ImmutableTickStore {
  const raw = createRawMarketEventStore();
  const normalized = createNormalizedMarketEventStore();
  return Object.freeze({
    raw,
    normalized,
    snapshot() {
      return Object.freeze({
        raw: raw.snapshot(),
        normalized: normalized.snapshot(),
      });
    },
    restore(snapshot: ImmutableTickStoreSnapshot) {
      raw.restore(snapshot.raw);
      normalized.restore(snapshot.normalized);
    },
    retainsBarsOnly() {
      return false;
    },
  });
}
