/**
 * Deterministic book-state hash for MD04 reconstruction.
 */

import { sha256CanonicalJson } from '../../release-evidence/hash.ts';
import { HELIOS_MD04_ORDER_BOOK_SCHEMA, type BookMarketState } from './taxonomy.ts';
import type { BookLevel, BookOrder, BookStateHash } from './types.ts';

export function computeBookStateHash(input: {
  readonly instrumentId: string;
  readonly marketState: BookMarketState;
  readonly lastSequence: bigint;
  readonly depthMode: string;
  readonly orders: readonly BookOrder[];
  readonly bids: readonly BookLevel[];
  readonly asks: readonly BookLevel[];
}): BookStateHash {
  const canonicalOrders = [...input.orders]
    .map((row) => ({
      orderId: row.orderId,
      side: row.side,
      priceMinorUnits: row.priceMinorUnits.toString(),
      quantityMinorUnits: row.quantityMinorUnits.toString(),
    }))
    .sort((a, b) => {
      const sideCmp = a.side.localeCompare(b.side);
      if (sideCmp !== 0) return sideCmp;
      const priceCmp = a.side === 'bid'
        ? b.priceMinorUnits.localeCompare(a.priceMinorUnits)
        : a.priceMinorUnits.localeCompare(b.priceMinorUnits);
      if (priceCmp !== 0) return priceCmp;
      return a.orderId.localeCompare(b.orderId);
    });

  const canonicalBids = input.bids.map((row) => ({
    priceMinorUnits: row.priceMinorUnits.toString(),
    quantityMinorUnits: row.quantityMinorUnits.toString(),
    orderCount: row.orderCount,
  }));
  const canonicalAsks = input.asks.map((row) => ({
    priceMinorUnits: row.priceMinorUnits.toString(),
    quantityMinorUnits: row.quantityMinorUnits.toString(),
    orderCount: row.orderCount,
  }));

  const body = Object.freeze({
    schema: HELIOS_MD04_ORDER_BOOK_SCHEMA,
    instrumentId: input.instrumentId,
    depthMode: input.depthMode,
    marketState: input.marketState,
    lastSequence: input.lastSequence.toString(),
    orders: canonicalOrders,
    bids: canonicalBids,
    asks: canonicalAsks,
  });

  return Object.freeze({
    schema: HELIOS_MD04_ORDER_BOOK_SCHEMA,
    digest: sha256CanonicalJson(body),
  });
}
