/**
 * HELIOS Multi-Asset Expansion M01 — canonical instrument record consumed by M04.
 */

import type { MarketSessionState } from '../taxonomy.ts';

export const MULTI_ASSET_INSTRUMENT_MODES = ['TRADABLE', 'RESEARCH_ONLY', 'INACTIVE'] as const;
export type MultiAssetInstrumentMode = (typeof MULTI_ASSET_INSTRUMENT_MODES)[number];

export type MultiAssetInstrumentRecord = {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly assetClass: string;
  readonly venueId: string;
  readonly venueDisplayName: string;
  readonly currency: string;
  readonly priceScale: number;
  readonly instrumentMode: MultiAssetInstrumentMode;
  readonly active: boolean;
  readonly halted: boolean;
  readonly researchOnly: boolean;
  readonly futuresContract?: {
    readonly expiryDate: string;
    readonly rollWindowDays: number;
  };
};

export type MultiAssetVenueRecord = {
  readonly venueId: string;
  readonly sessionState: MarketSessionState;
};
