/**
 * External Data — Polymarket CLOB research provider (sandbox fixtures only).
 */

export const POLYMARKET_CLOB_RESEARCH_PROVIDER_ID = 'polymarket-clob-research-sandbox' as const;

export const POLYMARKET_CLOB_CAPABILITIES = [
  'prediction_market_catalog',
  'clob_order_book_snapshot',
  'market_volume',
] as const;

export type PolymarketClobCapability = (typeof POLYMARKET_CLOB_CAPABILITIES)[number];

/** Always false — no live order submission or wallet signing. */
export const POLYMARKET_LIVE_TRADING_ENABLED = false as const;

export const POLYMARKET_PRIVATE_KEY_HANDLING = 'PROHIBITED' as const;
