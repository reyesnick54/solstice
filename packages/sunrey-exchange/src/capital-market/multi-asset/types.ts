/**
 * HELIOS Multi-Asset Expansion M01 — canonical instrument domain types.
 *
 * Provider-independent instrument identity. Ticker alone is never canonical.
 * Reference/sandbox metadata only — not execution authority or live trading.
 */

import type { CapitalMarketVenue } from '../types.ts';

export const MULTI_ASSET_SCHEMA = 'sunrey.capital-market.multi-asset.v1' as const;

export const MULTI_ASSET_CLASSES = [
  'EQUITY',
  'ETF',
  'INDEX',
  'FUTURE',
  'COMMODITY',
  'CRYPTO_SPOT',
  'FX_SPOT',
  'CASH',
] as const;
export type MultiAssetClass = (typeof MULTI_ASSET_CLASSES)[number];

export const INSTRUMENT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type InstrumentStatus = (typeof INSTRUMENT_STATUSES)[number];

export const INSTRUMENT_METADATA_AUTHORITY = [
  'REFERENCE_ONLY',
  'SANDBOX',
  'RESEARCH_REQUIRED',
] as const;
export type InstrumentMetadataAuthority = (typeof INSTRUMENT_METADATA_AUTHORITY)[number];

export const SETTLEMENT_TYPES = ['T+0', 'T+1', 'T+2', 'PHYSICAL', 'CASH', 'REFERENCE_ONLY'] as const;
export type SettlementType = (typeof SETTLEMENT_TYPES)[number];

export const DELIVERY_TYPES = ['PHYSICAL', 'CASH', 'NONE'] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

export type InstrumentCapabilityLevel = 'NONE' | 'INDICATIVE' | 'SANDBOX' | 'RESEARCH_REQUIRED';

export type InstrumentCapability = {
  readonly marketData: InstrumentCapabilityLevel;
  readonly execution: InstrumentCapabilityLevel;
};

export type ProviderInstrumentMapping = {
  readonly providerId: string;
  readonly symbol: string;
  readonly nativeId: string | null;
};

export type CanonicalMultiAssetInstrument = {
  readonly schema: typeof MULTI_ASSET_SCHEMA;
  readonly instrumentId: string;
  readonly symbol: string;
  readonly displayName: string;
  readonly assetClass: MultiAssetClass;
  readonly jurisdiction: string;
  readonly venue: CapitalMarketVenue;
  readonly tradingCurrency: string;
  readonly settlementCurrency: string;
  readonly isin: string | null;
  readonly figi: string | null;
  readonly providerMappings: readonly ProviderInstrumentMapping[];
  readonly underlyingInstrumentId: string | null;
  readonly baseAsset: string | null;
  readonly quoteAsset: string | null;
  readonly contractMultiplier: bigint | null;
  readonly tickSizeScaledUnits: bigint | null;
  readonly lotSizeScaledUnits: bigint | null;
  readonly minimumQuantityScaledUnits: bigint | null;
  readonly quantityScale: number;
  readonly priceScale: number;
  readonly expiration: string | null;
  readonly firstNoticeDate: string | null;
  readonly lastTradeDate: string | null;
  readonly settlementType: SettlementType;
  readonly contractMonth: string | null;
  readonly deliveryType: DeliveryType;
  readonly tradingCalendarRef: string | null;
  readonly capability: InstrumentCapability;
  readonly status: InstrumentStatus;
  readonly metadataAuthority: InstrumentMetadataAuthority;
};

export type MultiAssetInstrumentSearchFilter = {
  readonly assetClass?: MultiAssetClass | readonly MultiAssetClass[];
  readonly jurisdiction?: string;
  readonly venueId?: string;
  readonly status?: InstrumentStatus;
  readonly query?: string;
  readonly limit?: number;
};
