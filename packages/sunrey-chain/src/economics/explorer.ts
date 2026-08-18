/**
 * Explorer-facing native supply reporting.
 *
 * Fee burn appears in the same supply identity as voluntary and
 * penalty burns. There is no parallel burn counter.
 */

import { snapshotOf, type AssetSupplyBook } from './supply.ts';
import { TICKER_STATUS_NOT_ASSIGNED, type NativeSupplySnapshot } from './types.ts';

export type ExplorerSupplyReport = {
  readonly tickerStatus: typeof TICKER_STATUS_NOT_ASSIGNED;
  readonly productionCirculation: false;
  readonly assets: readonly (NativeSupplySnapshot & {
    readonly feeBurn: bigint;
    readonly reconciliation: 'EXACT' | 'MISMATCH';
  })[];
};

export function explorerSupplyReport(
  books: readonly AssetSupplyBook[],
  feeBurnByAsset: Readonly<Record<string, bigint>> = {},
): ExplorerSupplyReport {
  return Object.freeze({
    tickerStatus: TICKER_STATUS_NOT_ASSIGNED,
    productionCirculation: false,
    assets: Object.freeze(
      books.map((book) => {
        const snap = snapshotOf(book);
        const feeBurn = feeBurnByAsset[book.assetId] ?? (book.assetId === 'SUNREY_COIN' ? book.burned : 0n);
        return Object.freeze({
          ...snap,
          feeBurn,
          reconciliation: snap.expectedTotal === snap.observedTotal ? ('EXACT' as const) : ('MISMATCH' as const),
        });
      }),
    ),
  });
}
