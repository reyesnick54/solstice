/**
 * HELIOS Multi-Asset Expansion M02 — observation records consumed by M04.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { MarketFreshnessState, MarketProviderHealthState } from '../taxonomy.ts';

export type MultiAssetPriceQuote = {
  readonly minorUnits: string;
  readonly currency: string;
  readonly scale: number;
};

export type MultiAssetQuoteObservation = {
  readonly observationId: string;
  readonly providerId: string;
  readonly sourceId: string;
  readonly observedAt: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly referencePrice: MultiAssetPriceQuote | null;
  readonly bid: MultiAssetPriceQuote | null;
  readonly ask: MultiAssetPriceQuote | null;
  readonly recentVolume: string | null;
  readonly freshness: MarketFreshnessState;
  readonly qualityState: string;
  readonly entitlementUsable: boolean;
  readonly entitlementBlocked: boolean;
  readonly timestampConsistent: boolean;
  readonly contradictory: boolean;
  readonly corroborationCount: number;
  readonly providerHealth: MarketProviderHealthState;
};

export type MultiAssetBarObservation = {
  readonly barId: string;
  readonly timeframe: string;
  readonly observedAt: UtcInstant;
  readonly freshness: MarketFreshnessState;
  readonly complete: boolean;
};

export type MultiAssetObservationBundle = {
  readonly quote: MultiAssetQuoteObservation | null;
  readonly bars: readonly MultiAssetBarObservation[];
  readonly availableBarTimeframes: readonly string[];
  readonly latestObservationTimestamp: UtcInstant | null;
};
