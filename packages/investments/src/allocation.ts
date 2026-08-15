import type { InstrumentType } from './types.ts';
import type { PortfolioValuationSnapshot, ValuedPosition } from './valuation.ts';
import type { Instrument } from './instrument.ts';
import { Money } from '../../money/src/money.ts';

export type AllocationSlice = {
  readonly key: string;
  readonly marketValue: Money;
  readonly positionCount: bigint;
};

/**
 * Derived allocation views. No risk conclusions — Chunk 20 owns risk analytics.
 */
export type PortfolioAllocationView = {
  readonly byInstrument: readonly AllocationSlice[];
  readonly byInstrumentType: readonly AllocationSlice[];
  readonly byCurrency: readonly AllocationSlice[];
  readonly riskConclusion: null;
};

export function deriveAllocation(
  snapshot: PortfolioValuationSnapshot,
  instruments: ReadonlyMap<string, Instrument>,
): PortfolioAllocationView {
  return Object.freeze({
    byInstrument: group(snapshot.positions, (row) => row.instrumentId),
    byInstrumentType: group(snapshot.positions, (row) => {
      const instrument = instruments.get(row.instrumentId);
      const kind: InstrumentType | 'UNKNOWN' = instrument?.instrumentType ?? 'UNKNOWN';
      return kind;
    }),
    byCurrency: group(snapshot.positions, (row) => row.marketValue.currency),
    riskConclusion: null,
  });
}

function group(
  positions: readonly ValuedPosition[],
  keyOf: (row: ValuedPosition) => string,
): readonly AllocationSlice[] {
  const map = new Map<string, { value: Money; count: bigint }>();
  for (const row of positions) {
    const key = keyOf(row);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { value: row.marketValue, count: 1n });
    } else {
      map.set(key, { value: existing.value.plus(row.marketValue), count: existing.count + 1n });
    }
  }
  return Object.freeze(
    [...map.entries()].map(([key, row]) =>
      Object.freeze({ key, marketValue: row.value, positionCount: row.count }),
    ),
  );
}
