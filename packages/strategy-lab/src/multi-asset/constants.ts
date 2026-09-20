/**
 * HELIOS Multi-Asset Expansion M09 — canonical crypto instrument identities
 * for Strategy Lab evaluation (production-shaped M06 crypto market data).
 *
 * Reference-only. Not execution quotes or live crypto rails.
 */

export const HELIOS_MULTI_ASSET_M09_STRATEGY_LAB_FOUNDATION =
  'HELIOS_MULTI_ASSET_M09_STRATEGY_LAB_FOUNDATION' as const;

/** Canonical BTC/USD asset id from packages/sunrey-exchange crypto-market registry. */
export const CRYPTO_BTC_USD_ASSET_ID = 'CRYPTO:BTC:bitcoin:native:USD' as const;

/** Canonical ETH/USD asset id from packages/sunrey-exchange crypto-market registry. */
export const CRYPTO_ETH_USD_ASSET_ID = 'CRYPTO:ETH:ethereum:native:USD' as const;

export const HELIOS_CRYPTO_USD_INSTRUMENTS = Object.freeze([
  CRYPTO_BTC_USD_ASSET_ID,
  CRYPTO_ETH_USD_ASSET_ID,
] as const);

export type HeliosCryptoUsdInstrumentId = (typeof HELIOS_CRYPTO_USD_INSTRUMENTS)[number];

export const HELIOS_CRYPTO_OBSERVATION_SCHEMA = 'helios.crypto-ohlcv-1h.v1' as const;

export const HELIOS_CRYPTO_QUALIFIED_TIMEFRAMES = Object.freeze(['1h'] as const);

export type HeliosCryptoQualifiedTimeframe = (typeof HELIOS_CRYPTO_QUALIFIED_TIMEFRAMES)[number];
