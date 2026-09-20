/**
 * HELIOS Multi-Asset Expansion — shared taxonomies for 15-minute index strategies.
 */

export const HELIOS_MULTI_ASSET_BAR_INTERVALS = ['15m'] as const;
export type HeliosMultiAssetBarInterval = (typeof HELIOS_MULTI_ASSET_BAR_INTERVALS)[number];

export const HELIOS_MULTI_ASSET_INDEX_INSTRUMENTS = [
  'SECURITY:US:SPY:ARCX',
  'SECURITY:US:QQQ:XNAS',
] as const;

export type HeliosMultiAssetIndexInstrument = (typeof HELIOS_MULTI_ASSET_INDEX_INSTRUMENTS)[number];

export const HELIOS_M09_STRATEGY_FAMILY = 'sfam_helios_m09_index_mean_reversion' as const;
