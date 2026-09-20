/**
 * In-memory capital market bar store with idempotent storage and restart snapshot support.
 */

import type { UtcInstant } from '@solstice/domain';
import type { CapitalMarketTimeframe } from './timeframes.ts';
import type { CapitalMarketBar } from './types.ts';

export type CapitalMarketBarStoreSnapshot = {
  readonly bars: readonly CapitalMarketBar[];
  readonly barIds: readonly string[];
  readonly duplicateBarIds: readonly string[];
};

export type CapitalMarketBarStore = {
  readonly get: (barId: string) => CapitalMarketBar | undefined;
  readonly list: () => readonly CapitalMarketBar[];
  readonly listByInstrument: (instrumentId: string) => readonly CapitalMarketBar[];
  readonly listByInstrumentTimeframe: (
    instrumentId: string,
    timeframe: CapitalMarketTimeframe,
  ) => readonly CapitalMarketBar[];
  readonly put: (bar: CapitalMarketBar) => { readonly stored: boolean; readonly duplicate: boolean };
  readonly putMany: (bars: readonly CapitalMarketBar[]) => {
    readonly stored: number;
    readonly duplicates: number;
  };
  readonly duplicateBarIds: () => ReadonlySet<string>;
  readonly snapshot: () => CapitalMarketBarStoreSnapshot;
  readonly restore: (snapshot: CapitalMarketBarStoreSnapshot) => void;
};

export function createCapitalMarketBarStore(): CapitalMarketBarStore {
  const bars = new Map<string, CapitalMarketBar>();
  const byInstrument = new Map<string, CapitalMarketBar[]>();
  const byInstrumentTimeframe = new Map<string, CapitalMarketBar[]>();
  const duplicateBarIds = new Set<string>();

  function timeframeKey(instrumentId: string, timeframe: CapitalMarketTimeframe): string {
    return `${instrumentId}:${timeframe}`;
  }

  function indexBar(bar: CapitalMarketBar): void {
    const instrumentList = byInstrument.get(bar.instrument.instrumentId) ?? [];
    instrumentList.push(bar);
    byInstrument.set(bar.instrument.instrumentId, instrumentList);

    const tfKey = timeframeKey(bar.instrument.instrumentId, bar.timeframe);
    const tfList = byInstrumentTimeframe.get(tfKey) ?? [];
    tfList.push(bar);
    byInstrumentTimeframe.set(tfKey, tfList);
  }

  function put(bar: CapitalMarketBar): { readonly stored: boolean; readonly duplicate: boolean } {
    if (bars.has(bar.barId)) {
      duplicateBarIds.add(bar.barId);
      return Object.freeze({ stored: false, duplicate: true });
    }
    bars.set(bar.barId, bar);
    indexBar(bar);
    return Object.freeze({ stored: true, duplicate: false });
  }

  return Object.freeze({
    get(barId: string) {
      return bars.get(barId);
    },
    list() {
      return Object.freeze([...bars.values()]);
    },
    listByInstrument(instrumentId: string) {
      return Object.freeze([...(byInstrument.get(instrumentId) ?? [])]);
    },
    listByInstrumentTimeframe(instrumentId: string, timeframe: CapitalMarketTimeframe) {
      return Object.freeze([...(byInstrumentTimeframe.get(timeframeKey(instrumentId, timeframe)) ?? [])]);
    },
    put,
    putMany(barsToStore: readonly CapitalMarketBar[]) {
      let stored = 0;
      let duplicates = 0;
      for (const bar of barsToStore) {
        const result = put(bar);
        if (result.stored) {
          stored += 1;
        }
        if (result.duplicate) {
          duplicates += 1;
        }
      }
      return Object.freeze({ stored, duplicates });
    },
    duplicateBarIds() {
      return duplicateBarIds;
    },
    snapshot() {
      return Object.freeze({
        bars: Object.freeze([...bars.values()]),
        barIds: Object.freeze([...bars.keys()]),
        duplicateBarIds: Object.freeze([...duplicateBarIds]),
      });
    },
    restore(snapshot: CapitalMarketBarStoreSnapshot) {
      bars.clear();
      byInstrument.clear();
      byInstrumentTimeframe.clear();
      duplicateBarIds.clear();
      for (const id of snapshot.duplicateBarIds) {
        duplicateBarIds.add(id);
      }
      for (const bar of snapshot.bars) {
        bars.set(bar.barId, bar);
        indexBar(bar);
      }
    },
  });
}

export function sortBarsByPeriodStart(bars: readonly CapitalMarketBar[]): readonly CapitalMarketBar[] {
  return Object.freeze([...bars].sort((a, b) => Date.parse(a.periodStart) - Date.parse(b.periodStart)));
}

export function latestBarForInstrument(
  bars: readonly CapitalMarketBar[],
  instrumentId: string,
  timeframe?: CapitalMarketTimeframe,
): CapitalMarketBar | null {
  const filtered = bars.filter(
    (bar) => bar.instrument.instrumentId === instrumentId && (timeframe ? bar.timeframe === timeframe : true),
  );
  if (filtered.length === 0) {
    return null;
  }
  return sortBarsByPeriodStart(filtered)[filtered.length - 1] ?? null;
}

export function barsInRange(
  bars: readonly CapitalMarketBar[],
  range: { readonly from: UtcInstant; readonly to: UtcInstant },
): readonly CapitalMarketBar[] {
  const fromMs = Date.parse(range.from);
  const toMs = Date.parse(range.to);
  return Object.freeze(
    bars.filter((bar) => {
      const startMs = Date.parse(bar.periodStart);
      return startMs >= fromMs && startMs <= toMs;
    }),
  );
}
