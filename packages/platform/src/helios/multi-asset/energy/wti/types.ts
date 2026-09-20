/**
 * M08 — WTI energy market intelligence types.
 */

import type { UtcInstant } from '../../../../../../domain/src/time.ts';
import type { BarInterval, MarketQuote, MultiAssetEntitlement, MultiAssetRouteStatus, OhlcvBar } from '../../types.ts';
import type { RollContext } from '../../futures/types.ts';
import { HELIOS_MULTI_ASSET_AUTHORITY, HELIOS_MULTI_ASSET_SCHEMA } from '../../types.ts';

export { HELIOS_MULTI_ASSET_SCHEMA, HELIOS_MULTI_ASSET_AUTHORITY };

export type WtiMarketObservation = {
  readonly schema: typeof HELIOS_MULTI_ASSET_SCHEMA;
  readonly authority: typeof HELIOS_MULTI_ASSET_AUTHORITY;
  readonly instrumentId: string;
  readonly quote: MarketQuote;
  readonly bars: readonly OhlcvBar[];
  readonly providerId: string;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
  readonly entitlement: MultiAssetEntitlement;
  readonly rollContext: RollContext | null;
  readonly observationId: string;
};

export type WtiBarsRequest = {
  readonly instrumentId: string;
  readonly interval: BarInterval;
  readonly limit?: number;
};

export type WtiDataResult<T> =
  | { readonly ok: true; readonly value: T; readonly routeStatus: MultiAssetRouteStatus; readonly fromCache: boolean }
  | { readonly ok: false; readonly code: string; readonly message: string; readonly routeStatus: MultiAssetRouteStatus };

export type WtiMarketState = {
  readonly evaluatedAt: UtcInstant;
  readonly commodityReference: WtiMarketObservation | null;
  readonly oilEtfProxy: WtiMarketObservation | null;
  readonly futuresFamilyId: string;
  readonly frontContract: WtiMarketObservation | null;
  readonly continuousSeries: WtiMarketObservation | null;
  readonly rollContext: RollContext;
  readonly routeStatus: MultiAssetRouteStatus;
  readonly trendReadiness4h: WtiTrendReadiness;
};

export type WtiTrendReadiness = {
  readonly interval: '4h';
  readonly qualified: boolean;
  readonly barCount: number;
  readonly minimumBarsRequired: number;
  readonly latestBarCloseTime: string | null;
  readonly message: string | null;
};

export type WtiProviderHealth = {
  readonly providerId: string;
  readonly status: 'healthy' | 'degraded' | 'unavailable';
  readonly credentialConfigured: boolean;
  readonly message: string | null;
};
