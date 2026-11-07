/**
 * HELIOS MARKET DATA MD04 — order-book reconstruction taxonomy.
 */

export const HELIOS_MD04_ORDER_BOOK_SCHEMA = 'sunrey.helios.market-data.md04-order-book.v1' as const;
export const HELIOS_MD04 = 'HELIOS_MD04' as const;

export const BOOK_DEPTH_MODES = ['L1', 'L2', 'L3'] as const;
export type BookDepthMode = (typeof BOOK_DEPTH_MODES)[number];

export const BOOK_SIDES = ['bid', 'ask'] as const;
export type BookSide = (typeof BOOK_SIDES)[number];

export const BOOK_MUTATION_KINDS = [
  'ADD',
  'MODIFY',
  'DELETE',
  'EXECUTE',
  'PARTIAL_EXECUTE',
  'CLEAR',
  'RESET',
] as const;
export type BookMutationKind = (typeof BOOK_MUTATION_KINDS)[number];

export const BOOK_MARKET_STATES = [
  'OPEN',
  'CLOSED',
  'PRE_OPEN',
  'AUCTION',
  'HALTED',
  'PAUSED',
  'POST_MARKET',
  'UNKNOWN',
] as const;
export type BookMarketState = (typeof BOOK_MARKET_STATES)[number];

export const BOOK_INTEGRITY_VIOLATIONS = [
  'NEGATIVE_QUANTITY',
  'DUPLICATE_ORDER_ID',
  'PHANTOM_DELETE',
  'PHANTOM_MODIFY',
  'PHANTOM_EXECUTE',
  'BID_SORT_VIOLATION',
  'ASK_SORT_VIOLATION',
  'PARTIAL_EXECUTE_OVERFLOW',
  'DUPLICATE_ADD',
  'NON_EXECUTABLE_STATE',
] as const;
export type BookIntegrityViolation = (typeof BOOK_INTEGRITY_VIOLATIONS)[number];
