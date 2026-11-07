/**
 * HELIOS MARKET DATA MD04 — canonical order-book types.
 */

import type { UtcInstant } from '@solstice/domain';
import {
  HELIOS_MD04_ORDER_BOOK_SCHEMA,
  type BookDepthMode,
  type BookIntegrityViolation,
  type BookMarketState,
  type BookMutationKind,
  type BookSide,
} from './taxonomy.ts';

export type BookOrder = {
  readonly orderId: string;
  readonly side: BookSide;
  readonly priceMinorUnits: bigint;
  readonly quantityMinorUnits: bigint;
};

export type BookLevel = {
  readonly priceMinorUnits: bigint;
  readonly quantityMinorUnits: bigint;
  readonly orderCount: number;
};

export type BookMutation = {
  readonly kind: BookMutationKind;
  readonly sequence: bigint;
  readonly side?: BookSide;
  readonly orderId?: string;
  readonly priceMinorUnits?: bigint;
  readonly quantityMinorUnits?: bigint;
  /** Filled quantity for EXECUTE / PARTIAL_EXECUTE. */
  readonly executedQuantityMinorUnits?: bigint;
  readonly marketState?: BookMarketState;
};

export type BookStateHash = {
  readonly schema: typeof HELIOS_MD04_ORDER_BOOK_SCHEMA;
  readonly digest: string;
};

export type BookIntegrityState = {
  readonly ok: boolean;
  readonly violations: readonly BookIntegrityViolation[];
  readonly executableBook: boolean;
};

export type BookTopOfBookMetrics = {
  readonly bestBid: BookLevel | null;
  readonly bestAsk: BookLevel | null;
  readonly midMinorUnits: bigint | null;
  readonly spreadMinorUnits: bigint | null;
  readonly micropriceMinorUnits: bigint | null;
};

export type BookDepthMetrics = {
  readonly bidDepthMinorUnits: bigint;
  readonly askDepthMinorUnits: bigint;
  readonly imbalancePpm: bigint | null;
  readonly levelsBid: number;
  readonly levelsAsk: number;
};

export type BookMetrics = BookTopOfBookMetrics &
  BookDepthMetrics & {
    readonly executable: boolean;
  };

export type CanonicalOrderBook = {
  readonly schema: typeof HELIOS_MD04_ORDER_BOOK_SCHEMA;
  readonly instrumentId: string;
  readonly depthMode: BookDepthMode;
  readonly marketState: BookMarketState;
  readonly lastSequence: bigint;
  readonly observedAt: UtcInstant | null;
  readonly orders: readonly BookOrder[];
  readonly bids: readonly BookLevel[];
  readonly asks: readonly BookLevel[];
  readonly stateHash: BookStateHash;
  readonly integrity: BookIntegrityState;
  readonly metrics: BookMetrics;
};

export type OrderBookSnapshotSeed = {
  readonly instrumentId: string;
  readonly depthMode: BookDepthMode;
  readonly marketState?: BookMarketState;
  readonly sequence?: bigint;
  readonly observedAt?: UtcInstant | null;
  readonly orders?: readonly BookOrder[];
  readonly bidLevels?: readonly Pick<BookLevel, 'priceMinorUnits' | 'quantityMinorUnits'>[];
  readonly askLevels?: readonly Pick<BookLevel, 'priceMinorUnits' | 'quantityMinorUnits'>[];
};

export type BookMutationOutcome =
  | { readonly ok: true; readonly book: CanonicalOrderBook }
  | {
      readonly ok: false;
      readonly book: CanonicalOrderBook;
      readonly code: BookIntegrityViolation | 'INVALID_MUTATION';
      readonly message: string;
    };
