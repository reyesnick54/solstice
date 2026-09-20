/**
 * H07 — provider-neutral capital market observation types.
 *
 * Reference/research observations only. Not execution quotes, settlement
 * prices, ledger values, or issuance authority.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AuthorityClass } from '../../../provider-sdk/src/types.ts';

export const CAPITAL_MARKET_SCHEMA = 'sunrey.capital-market.v1' as const;
export const CAPITAL_MARKET_AUTHORITY = 'REFERENCE_ONLY' as const;

export const CAPITAL_MARKET_ROUTE_STATUSES = [
  'QUALIFIED',
  'DEGRADED',
  'UNAVAILABLE',
  'NOT_CONFIGURED',
  'NOT_QUALIFIED',
] as const;
export type CapitalMarketRouteStatus = (typeof CAPITAL_MARKET_ROUTE_STATUSES)[number];

export const CAPITAL_MARKET_OBSERVATION_TYPES = [
  'quote',
  'trade',
  'ticker',
  'session_status',
  'ohlcv_bar',
  'reference_price',
  'market_status',
  'best_bid_offer',
  'order_book_snapshot',
] as const;
export type CapitalMarketObservationType = (typeof CAPITAL_MARKET_OBSERVATION_TYPES)[number];

export const CAPITAL_MARKET_BAR_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type CapitalMarketBarTimeframe = (typeof CAPITAL_MARKET_BAR_TIMEFRAMES)[number];

export const CAPITAL_MARKET_SESSION_STATUSES = ['OPEN', 'CLOSED', 'HALTED', 'PRE_MARKET', 'AFTER_HOURS', 'UNKNOWN'] as const;
export type CapitalMarketSessionStatus = (typeof CAPITAL_MARKET_SESSION_STATUSES)[number];

export const CAPITAL_MARKET_ASSET_CLASSES = [
  'equity',
  'etf',
  'index',
  'commodity',
  'crypto',
  'future',
  'fx',
  'bond',
  'other',
] as const;
export type CapitalMarketAssetClass = (typeof CAPITAL_MARKET_ASSET_CLASSES)[number];

export const CAPITAL_MARKET_ENTITLEMENT_CLASSES = [
  'realtime',
  'delayed',
  'end_of_day',
  'sandbox',
  'indicative',
  'test',
  'unknown',
] as const;
export type CapitalMarketEntitlementClass = (typeof CAPITAL_MARKET_ENTITLEMENT_CLASSES)[number];

export const CAPITAL_MARKET_FEED_TIERS = [
  'free_tier',
  'professional',
  'institutional',
  'sandbox',
  'unknown',
] as const;
export type CapitalMarketFeedTier = (typeof CAPITAL_MARKET_FEED_TIERS)[number];

export type CapitalMarketVenue = {
  readonly venueId: string;
  readonly mic: string | null;
  readonly displayName: string;
  readonly exchange: string | null;
};

export type CapitalMarketInstrument = {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly vendorSymbol: string;
  readonly assetClass: CapitalMarketAssetClass;
  readonly venue: CapitalMarketVenue;
  readonly currency: string;
  readonly isin: string | null;
  readonly figi: string | null;
  readonly providerNativeId: string;
};

export type CapitalMarketEntitlement = {
  readonly entitlementClass: CapitalMarketEntitlementClass;
  readonly feedTier: CapitalMarketFeedTier;
  readonly delayedMinutes: number | null;
  readonly licensedForRealtime: boolean;
  readonly providerDeclaredRealtime: boolean;
};

export type CapitalMarketProvenance = {
  readonly providerId: string;
  readonly authorityClass: AuthorityClass;
  readonly sourceUrl: string | null;
  readonly rawPayloadHash: string;
  readonly observationId: string;
  readonly capability: string;
};

export type CapitalMarketObservation = {
  readonly schema: typeof CAPITAL_MARKET_SCHEMA;
  readonly authority: typeof CAPITAL_MARKET_AUTHORITY;
  readonly observationType: CapitalMarketObservationType;
  readonly instrument: CapitalMarketInstrument;
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
  readonly sessionStatus: CapitalMarketSessionStatus;
  readonly providerId: string;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
  readonly availabilityTimestamp: UtcInstant | null;
  readonly entitlement: CapitalMarketEntitlement;
  readonly sequenceNumber: bigint | null;
  readonly provenance: CapitalMarketProvenance;
};

export type CapitalMarketProviderHealth = {
  readonly providerId: string;
  readonly status: 'healthy' | 'degraded' | 'unavailable';
  readonly circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  readonly rateLimited: boolean;
  readonly authenticated: boolean;
  readonly credentialConfigured: boolean;
  readonly lastSuccessAt: UtcInstant | null;
  readonly message: string | null;
};

export type CapitalMarketResult<T> =
  | { readonly ok: true; readonly value: T; readonly fromCache: boolean }
  | { readonly ok: false; readonly code: string; readonly message: string; readonly providerId: string };

export type CapitalMarketOhlcvBar = {
  readonly instrumentId: string;
  readonly timeframe: CapitalMarketBarTimeframe;
  readonly openMinorUnits: bigint;
  readonly highMinorUnits: bigint;
  readonly lowMinorUnits: bigint;
  readonly closeMinorUnits: bigint;
  readonly volumeUnits: bigint;
  readonly startTime: UtcInstant;
  readonly endTime: UtcInstant;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
  readonly availabilityTimestamp: UtcInstant | null;
  readonly providerId: string;
  readonly venue: string;
  readonly provenance: CapitalMarketProvenance;
};

export type CapitalMarketOrderBookLevel = {
  readonly priceMinorUnits: bigint;
  readonly quantityMinorUnits: bigint;
  readonly depth: number;
};

export type CapitalMarketOrderBookSnapshot = {
  readonly bids: readonly CapitalMarketOrderBookLevel[];
  readonly asks: readonly CapitalMarketOrderBookLevel[];
  readonly sequence: bigint | null;
  readonly version: string | null;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
};

export type CapitalMarketRouteDiagnostics = {
  readonly routeStatus: CapitalMarketRouteStatus;
  readonly providerId: string;
  readonly credentialConfigured: boolean;
  readonly credentialResolved: boolean;
  readonly externalQualificationStatus: 'QUALIFIED' | 'ADAPTER_READY_EXTERNAL_QUALIFICATION_PENDING' | 'FAILED';
  readonly health: CapitalMarketProviderHealth;
  readonly message: string | null;
};
