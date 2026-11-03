/**
 * BYTEX BacktestEngine data ordering: CreatedTime ascending, then insertion index.
 */

import type { BytexMarketDataElement } from './types.ts';

export function assignInsertionIndices(
  elements: readonly Omit<BytexMarketDataElement, 'insertionIndex'>[],
): readonly BytexMarketDataElement[] {
  return Object.freeze(
    elements.map((element, insertionIndex) =>
      Object.freeze({
        ...element,
        insertionIndex,
      }),
    ),
  );
}

export function sortMarketDataChronologically(data: readonly BytexMarketDataElement[]): readonly BytexMarketDataElement[] {
  return Object.freeze(
    [...data].sort((a, b) => {
      if (a.createdTimeNs < b.createdTimeNs) {
        return -1;
      }
      if (a.createdTimeNs > b.createdTimeNs) {
        return 1;
      }
      return a.insertionIndex - b.insertionIndex;
    }),
  );
}

export function countDispatchedUpTo(
  sorted: readonly BytexMarketDataElement[],
  last: { readonly timeNs: bigint; readonly insertionIndex: number } | null,
): number {
  if (last === null) {
    return 0;
  }
  let count = 0;
  while (
    count < sorted.length &&
    (sorted[count]!.createdTimeNs < last.timeNs ||
      (sorted[count]!.createdTimeNs === last.timeNs && sorted[count]!.insertionIndex <= last.insertionIndex))
  ) {
    count += 1;
  }
  return count;
}
