/**
 * M07 — Gold and precious-metals market intelligence types.
 *
 * ETF, spot/reference, futures family, specific contracts, and continuous
 * research series are distinct canonical identities. Do not conflate them.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { CapitalMarketObservation, CapitalMarketSessionStatus } from '../types.ts';
import type { FuturesRollSnapshot } from '../futures/types.ts';

export const GOLD_MARKET_SCHEMA = 'sunrey.helios.gold-market.v1' as const;

export const GOLD_IDENTITY_KINDS = [
  'etf_proxy',
  'reference_commodity',
  'futures_family',
  'futures_contract',
  'continuous_research',
] as const;
export type GoldIdentityKind = (typeof GOLD_IDENTITY_KINDS)[number];

export const GOLD_BAR_INTERVALS = ['1h', '4h', '1d'] as const;
export type GoldBarInterval = (typeof GOLD_BAR_INTERVALS)[number];

export const GOLD_FEED_QUALIFICATION_STATUSES = [
  'QUALIFIED',
  'EXTERNAL_PROVIDER_REQUIRED',
  'NOT_CONFIGURED',
  'DEGRADED',
  'UNAVAILABLE',
] as const;
export type GoldFeedQualificationStatus = (typeof GOLD_FEED_QUALIFICATION_STATUSES)[number];

export type GoldCanonicalIdentity = {
  readonly identityId: string;
  readonly kind: GoldIdentityKind;
  readonly displayName: string;
  readonly symbol: string;
  readonly venueId: string | null;
  readonly currency: string;
  /** Whether this identity may be used for paper/live execution. */
  readonly executable: boolean;
  readonly feedQualification: GoldFeedQualificationStatus;
};

/** Relationship hooks for future macro/cross-asset analysis — no strategies yet. */
export const GOLD_MARKET_STATE_RELATIONSHIPS = [
  'USD',
  'RATES',
  'EQUITIES',
  'VOLATILITY',
  'INFLATION',
  'MACRO_EVENTS',
] as const;
export type GoldMarketStateRelationship = (typeof GOLD_MARKET_STATE_RELATIONSHIPS)[number];

export type GoldMarketState = {
  readonly schema: typeof GOLD_MARKET_SCHEMA;
  readonly identity: GoldCanonicalIdentity;
  readonly sessionStatus: CapitalMarketSessionStatus;
  readonly lastQuote: CapitalMarketObservation | null;
  readonly rollSnapshot: FuturesRollSnapshot | null;
  readonly relationships: readonly GoldMarketStateRelationship[];
  readonly evaluatedAt: UtcInstant;
};

export type GoldBarCandle = {
  readonly identityId: string;
  readonly interval: GoldBarInterval;
  readonly openMinorUnits: bigint;
  readonly highMinorUnits: bigint;
  readonly lowMinorUnits: bigint;
  readonly closeMinorUnits: bigint;
  readonly volumeUnits: bigint | null;
  readonly currency: string;
  readonly priceScale: number;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly marketTimestamp: UtcInstant;
  /** Earliest instant this bar could have been known — no look-ahead. */
  readonly knowableAt: UtcInstant;
  readonly providerId: string;
  readonly sessionStatus: CapitalMarketSessionStatus;
};

export type GoldBarHistoryResult =
  | {
      readonly ok: true;
      readonly candles: readonly GoldBarCandle[];
      readonly identityId: string;
      readonly interval: GoldBarInterval;
      readonly fromCache: boolean;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly identityId: string;
    };

export type GoldMarketResult<T> =
  | { readonly ok: true; readonly value: T; readonly fromCache: boolean }
  | { readonly ok: false; readonly code: string; readonly message: string };

/** Minimum 4h bars required for deterministic trend research. */
export const GOLD_4H_TREND_MIN_BARS = 42;
