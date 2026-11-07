/**
 * HELIOS MARKET DATA MD04 — deterministic L1/L2/L3 order-book reconstruction engine.
 */

import { aggregateBookLevels, levelsFromL2Seed } from './aggregate.ts';
import { computeBookStateHash } from './hash.ts';
import { validateBookIntegrity } from './integrity.ts';
import { marketStatePermitsExecutableBook } from './market-state.ts';
import { computeBookMetrics } from './metrics.ts';
import { HELIOS_MD04_ORDER_BOOK_SCHEMA, type BookIntegrityViolation, type BookSide } from './taxonomy.ts';
import type {
  BookMutation,
  BookMutationOutcome,
  BookOrder,
  CanonicalOrderBook,
  OrderBookSnapshotSeed,
} from './types.ts';

function syntheticL2OrderId(side: BookSide, priceMinorUnits: bigint): string {
  return `md04:l2:${side}:${priceMinorUnits.toString()}`;
}

function ordersFromL2Seed(
  bidLevels: OrderBookSnapshotSeed['bidLevels'],
  askLevels: OrderBookSnapshotSeed['askLevels'],
): readonly BookOrder[] {
  const orders: BookOrder[] = [];
  for (const row of bidLevels ?? []) {
    if (row.quantityMinorUnits <= 0n) continue;
    orders.push(
      Object.freeze({
        orderId: syntheticL2OrderId('bid', row.priceMinorUnits),
        side: 'bid',
        priceMinorUnits: row.priceMinorUnits,
        quantityMinorUnits: row.quantityMinorUnits,
      }),
    );
  }
  for (const row of askLevels ?? []) {
    if (row.quantityMinorUnits <= 0n) continue;
    orders.push(
      Object.freeze({
        orderId: syntheticL2OrderId('ask', row.priceMinorUnits),
        side: 'ask',
        priceMinorUnits: row.priceMinorUnits,
        quantityMinorUnits: row.quantityMinorUnits,
      }),
    );
  }
  return Object.freeze(orders);
}

function finalizeBook(input: {
  readonly instrumentId: string;
  readonly depthMode: CanonicalOrderBook['depthMode'];
  readonly marketState: CanonicalOrderBook['marketState'];
  readonly lastSequence: bigint;
  readonly observedAt: CanonicalOrderBook['observedAt'];
  readonly orders: readonly BookOrder[];
  readonly extraViolations?: readonly BookIntegrityViolation[];
}): CanonicalOrderBook {
  const bids = aggregateBookLevels(input.orders, 'bid');
  const asks = aggregateBookLevels(input.orders, 'ask');
  const executableFlag = marketStatePermitsExecutableBook(input.marketState);
  const integrity = validateBookIntegrity({
    orders: input.orders,
    bids,
    asks,
    executableBook: executableFlag,
    extraViolations: input.extraViolations,
  });
  const metrics = computeBookMetrics(bids, asks, integrity.executableBook);
  const stateHash = computeBookStateHash({
    instrumentId: input.instrumentId,
    marketState: input.marketState,
    lastSequence: input.lastSequence,
    depthMode: input.depthMode,
    orders: input.orders,
    bids,
    asks,
  });
  return Object.freeze({
    schema: HELIOS_MD04_ORDER_BOOK_SCHEMA,
    instrumentId: input.instrumentId,
    depthMode: input.depthMode,
    marketState: input.marketState,
    lastSequence: input.lastSequence,
    observedAt: input.observedAt,
    orders: Object.freeze([...input.orders]),
    bids,
    asks,
    stateHash,
    integrity,
    metrics,
  });
}

export function createEmptyCanonicalOrderBook(seed: OrderBookSnapshotSeed): CanonicalOrderBook {
  const orders = seed.orders ?? ordersFromL2Seed(seed.bidLevels, seed.askLevels);
  return finalizeBook({
    instrumentId: seed.instrumentId,
    depthMode: seed.depthMode,
    marketState: seed.marketState ?? 'UNKNOWN',
    lastSequence: seed.sequence ?? 0n,
    observedAt: seed.observedAt ?? null,
    orders,
  });
}

export function createCanonicalOrderBookFromSnapshot(seed: OrderBookSnapshotSeed): CanonicalOrderBook {
  return createEmptyCanonicalOrderBook(seed);
}

export function applyBookMutations(
  book: CanonicalOrderBook,
  mutations: readonly BookMutation[],
): CanonicalOrderBook {
  let current = book;
  for (const mutation of mutations) {
    const outcome = applyBookMutation(current, mutation);
    current = outcome.book;
  }
  return current;
}

export function applyBookMutation(book: CanonicalOrderBook, mutation: BookMutation): BookMutationOutcome {
  if (mutation.sequence < book.lastSequence) {
    return Object.freeze({
      ok: false,
      book,
      code: 'INVALID_MUTATION',
      message: 'mutation sequence regresses',
    });
  }

  const violations: BookIntegrityViolation[] = [];
  let orders = [...book.orders];
  let marketState = book.marketState;
  if (mutation.marketState != null) {
    marketState = mutation.marketState;
  }

  const requireOrderFields = (): { side: BookSide; orderId: string; price: bigint; qty: bigint } | null => {
    if (
      mutation.side == null ||
      mutation.orderId == null ||
      mutation.priceMinorUnits == null ||
      mutation.quantityMinorUnits == null
    ) {
      return null;
    }
    return {
      side: mutation.side,
      orderId: mutation.orderId,
      price: mutation.priceMinorUnits,
      qty: mutation.quantityMinorUnits,
    };
  };

  const indexOfOrder = (orderId: string): number => orders.findIndex((row) => row.orderId === orderId);

  switch (mutation.kind) {
    case 'RESET': {
      orders = [];
      if (mutation.side != null) {
        // partial reset ignored — full reset only
      }
      break;
    }
    case 'CLEAR': {
      if (mutation.side == null) {
        orders = [];
      } else {
        orders = orders.filter((row) => row.side !== mutation.side);
      }
      break;
    }
    case 'ADD': {
      const fields = requireOrderFields();
      if (!fields) {
        return Object.freeze({
          ok: false,
          book,
          code: 'INVALID_MUTATION',
          message: 'ADD requires side, orderId, price, quantity',
        });
      }
      if (fields.qty < 0n) {
        violations.push('NEGATIVE_QUANTITY');
      }
      if (indexOfOrder(fields.orderId) >= 0) {
        violations.push('DUPLICATE_ADD');
      } else {
        orders.push(
          Object.freeze({
            orderId: fields.orderId,
            side: fields.side,
            priceMinorUnits: fields.price,
            quantityMinorUnits: fields.qty,
          }),
        );
      }
      break;
    }
    case 'MODIFY': {
      const fields = requireOrderFields();
      if (!fields) {
        return Object.freeze({
          ok: false,
          book,
          code: 'INVALID_MUTATION',
          message: 'MODIFY requires side, orderId, price, quantity',
        });
      }
      const idx = indexOfOrder(fields.orderId);
      if (idx < 0) {
        violations.push('PHANTOM_MODIFY');
      } else if (fields.qty < 0n) {
        violations.push('NEGATIVE_QUANTITY');
      } else if (fields.qty === 0n) {
        orders.splice(idx, 1);
      } else {
        orders[idx] = Object.freeze({
          orderId: fields.orderId,
          side: fields.side,
          priceMinorUnits: fields.price,
          quantityMinorUnits: fields.qty,
        });
      }
      break;
    }
    case 'DELETE': {
      if (mutation.orderId == null) {
        return Object.freeze({
          ok: false,
          book,
          code: 'INVALID_MUTATION',
          message: 'DELETE requires orderId',
        });
      }
      const idx = indexOfOrder(mutation.orderId);
      if (idx < 0) {
        violations.push('PHANTOM_DELETE');
      } else {
        orders.splice(idx, 1);
      }
      break;
    }
    case 'EXECUTE':
    case 'PARTIAL_EXECUTE': {
      if (mutation.orderId == null) {
        return Object.freeze({
          ok: false,
          book,
          code: 'INVALID_MUTATION',
          message: 'EXECUTE requires orderId',
        });
      }
      const idx = indexOfOrder(mutation.orderId);
      if (idx < 0) {
        violations.push('PHANTOM_EXECUTE');
        break;
      }
      const existing = orders[idx]!;
      const fill =
        mutation.executedQuantityMinorUnits ??
        (mutation.kind === 'EXECUTE' ? existing.quantityMinorUnits : null);
      if (fill == null || fill <= 0n) {
        return Object.freeze({
          ok: false,
          book,
          code: 'INVALID_MUTATION',
          message: 'PARTIAL_EXECUTE requires executedQuantityMinorUnits',
        });
      }
      if (fill > existing.quantityMinorUnits) {
        violations.push('PARTIAL_EXECUTE_OVERFLOW');
      } else if (fill === existing.quantityMinorUnits) {
        orders.splice(idx, 1);
      } else {
        orders[idx] = Object.freeze({
          ...existing,
          quantityMinorUnits: existing.quantityMinorUnits - fill,
        });
      }
      break;
    }
    default: {
      return Object.freeze({
        ok: false,
        book,
        code: 'INVALID_MUTATION',
        message: `unsupported mutation kind`,
      });
    }
  }

  const next = finalizeBook({
    instrumentId: book.instrumentId,
    depthMode: book.depthMode,
    marketState,
    lastSequence: mutation.sequence,
    observedAt: book.observedAt,
    orders: Object.freeze(orders),
    extraViolations: violations,
  });

  if (violations.length > 0) {
    const code = violations[0]!;
    return Object.freeze({
      ok: false,
      book: next,
      code,
      message: `book mutation recorded integrity violation: ${code}`,
    });
  }

  return Object.freeze({ ok: true, book: next });
}

export function seedL2LevelsAsOrders(
  bidLevels: readonly { readonly priceMinorUnits: bigint; readonly quantityMinorUnits: bigint }[],
  askLevels: readonly { readonly priceMinorUnits: bigint; readonly quantityMinorUnits: bigint }[],
): readonly BookOrder[] {
  return ordersFromL2Seed(bidLevels, askLevels);
}

export function mergeSnapshotLevels(
  bidLevels: readonly { readonly priceMinorUnits: bigint; readonly quantityMinorUnits: bigint }[],
  askLevels: readonly { readonly priceMinorUnits: bigint; readonly quantityMinorUnits: bigint }[],
): { readonly bids: ReturnType<typeof levelsFromL2Seed>; readonly asks: ReturnType<typeof levelsFromL2Seed> } {
  return Object.freeze({
    bids: levelsFromL2Seed(bidLevels, 'bid'),
    asks: levelsFromL2Seed(askLevels, 'ask'),
  });
}
