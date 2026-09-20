/**
 * HELIOS Multi-Asset Expansion — shared identity and authority types.
 *
 * Reference and research intelligence only. Does not grant Execution Authority.
 */

export const HELIOS_MULTI_ASSET_SCHEMA = 'sunrey.helios.multi-asset.v1' as const;
export const HELIOS_MULTI_ASSET_AUTHORITY = 'REFERENCE_ONLY' as const;

export const MULTI_ASSET_IDENTITY_KINDS = [
  'security_etf_proxy',
  'commodity_reference',
  'futures_family',
  'futures_contract',
  'futures_continuous',
] as const;
export type MultiAssetIdentityKind = (typeof MULTI_ASSET_IDENTITY_KINDS)[number];

export const BAR_INTERVALS = ['1h', '4h', '1d'] as const;
export type BarInterval = (typeof BAR_INTERVALS)[number];

export const SESSION_STATUSES = ['OPEN', 'CLOSED', 'PRE_OPEN', 'HALTED', 'UNKNOWN'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const ROUTE_STATUSES = [
  'QUALIFIED',
  'DEGRADED',
  'UNAVAILABLE',
  'NOT_CONFIGURED',
  'NOT_QUALIFIED',
  'STALE',
  'ENTITLEMENT_DENIED',
] as const;
export type MultiAssetRouteStatus = (typeof ROUTE_STATUSES)[number];

export type MultiAssetEntitlement = {
  readonly entitlementClass: 'realtime' | 'delayed' | 'end_of_day' | 'sandbox' | 'indicative' | 'unknown';
  readonly licensedForRealtime: boolean;
  readonly delayedMinutes: number | null;
  readonly unavailable: boolean;
};

export type OhlcvBar = {
  readonly interval: BarInterval;
  readonly openMinorUnits: bigint;
  readonly highMinorUnits: bigint;
  readonly lowMinorUnits: bigint;
  readonly closeMinorUnits: bigint;
  readonly volumeUnits: bigint;
  readonly barOpenTime: string;
  readonly barCloseTime: string;
  readonly priceScale: number;
  readonly currency: string;
};

export type MarketQuote = {
  readonly bidMinorUnits: bigint | null;
  readonly askMinorUnits: bigint | null;
  readonly lastMinorUnits: bigint | null;
  readonly openMinorUnits: bigint | null;
  readonly highMinorUnits: bigint | null;
  readonly lowMinorUnits: bigint | null;
  readonly previousCloseMinorUnits: bigint | null;
  readonly volumeUnits: bigint | null;
  readonly priceScale: number;
  readonly currency: string;
  readonly sessionStatus: SessionStatus;
};
