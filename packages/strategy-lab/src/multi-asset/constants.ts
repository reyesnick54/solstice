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

/**
 * HELIOS Multi-Asset Expansion M11 — canonical gold and WTI instrument identities
 * (production-shaped M07 gold and M08 WTI market data).
 *
 * Reference and continuous series are research-only; execution targets ETF proxies
 * or specific futures contracts when provider data and roll state permit.
 */

/** GLD ETF proxy — M07 qualified execution representation. */
export const GOLD_ETF_GLD_ID = 'SECURITY:US:GLD:ARCX' as const;

/** Gold reference commodity — research / signal input, not direct execution. */
export const GOLD_REFERENCE_ID = 'COMMODITY:gold:USD:troy_oz' as const;

/** Example qualified GC Dec 2026 contract — executable when provider data exists. */
export const GOLD_FUTURES_GCZ2026_ID = 'FUTURES:US:GCZ2026:COMEX' as const;

/** Gold continuous research series — never executable. */
export const GOLD_FUTURES_CONTINUOUS_ID = 'FUTURES:US:GC:COMEX:CONTINUOUS' as const;

/** USO ETF proxy — M08 qualified execution representation. */
export const WTI_OIL_ETF_PROXY_ID = 'SECURITY:US:USO:ARCX' as const;

/** WTI commodity reference — research / signal input. */
export const WTI_COMMODITY_REFERENCE_ID = 'COMMODITY:wti:USD:barrel' as const;

/** Example qualified CL Jun 2026 contract. */
export const WTI_FUTURES_CLM2026_ID = 'FUTURES:US:CLM2026:NYMEX' as const;

/** WTI continuous research series — never executable. */
export const WTI_FUTURES_CONTINUOUS_ID = 'FUTURES:US:CL:NYMEX:CONTINUOUS' as const;

export const HELIOS_M11_GOLD_INSTRUMENTS = Object.freeze([
  GOLD_ETF_GLD_ID,
  GOLD_REFERENCE_ID,
  GOLD_FUTURES_GCZ2026_ID,
] as const);

export const HELIOS_M11_WTI_INSTRUMENTS = Object.freeze([
  WTI_OIL_ETF_PROXY_ID,
  WTI_COMMODITY_REFERENCE_ID,
  WTI_FUTURES_CLM2026_ID,
] as const);

export const HELIOS_M11_INSTRUMENT_UNIVERSE = Object.freeze([
  ...HELIOS_M11_GOLD_INSTRUMENTS,
  ...HELIOS_M11_WTI_INSTRUMENTS,
] as const);

export type HeliosM11InstrumentId = (typeof HELIOS_M11_INSTRUMENT_UNIVERSE)[number];

export const HELIOS_COMMODITY_OBSERVATION_SCHEMA = 'helios.commodity-ohlcv-multi-tf.v1' as const;

export const HELIOS_COMMODITY_QUALIFIED_TIMEFRAMES = Object.freeze(['1h', '4h', '1d'] as const);

export type HeliosCommodityQualifiedTimeframe = (typeof HELIOS_COMMODITY_QUALIFIED_TIMEFRAMES)[number];
