/**
 * Provider-neutral skeleton manifest — every unknown capability is UNAVAILABLE.
 */

import {
  unavailableField,
  type VenueCapabilityManifest,
  type HeliosOs04VenueId,
} from '@solstice/provider-sdk';

const UNAVAILABLE_MARKET_DATA = Object.freeze({
  marketDataTypes: unavailableField(),
  websocketAvailable: unavailableField(),
  restAvailable: unavailableField(),
  historicalDataSupport: unavailableField(),
  timestampSemantics: unavailableField(),
  rateLimits: unavailableField(),
});

const UNAVAILABLE_ORDERS = Object.freeze({
  orderTypes: unavailableField(),
  tifTypes: unavailableField(),
  precision: unavailableField(),
  minimumQuantity: unavailableField(),
  minimumNotional: unavailableField(),
  makerTakerFees: unavailableField(),
  reduceOnlySupport: unavailableField(),
  postOnlySupport: unavailableField(),
  fundingSupport: unavailableField(),
});

const UNAVAILABLE_ACCOUNT = Object.freeze({
  sandboxAvailability: unavailableField(),
  subAccountSupport: unavailableField(),
  portfolioMarginSupport: unavailableField(),
});

const UNAVAILABLE_RECON = Object.freeze({
  reconciliationSupport: unavailableField(),
  fillHistoryAvailable: unavailableField(),
  ledgerExportAvailable: unavailableField(),
});

export function createSkeletonVenueManifest(input: {
  readonly venueId: HeliosOs04VenueId;
  readonly displayName: string;
}): VenueCapabilityManifest {
  return Object.freeze({
    venueId: input.venueId,
    displayName: input.displayName,
    assetClasses: unavailableField(),
    instruments: unavailableField(),
    venues: unavailableField(),
    marketData: UNAVAILABLE_MARKET_DATA,
    orders: UNAVAILABLE_ORDERS,
    account: UNAVAILABLE_ACCOUNT,
    reconciliation: UNAVAILABLE_RECON,
    healthState: 'UNAVAILABLE',
    liveOrderPlacementEnabled: false,
    qualificationNotes: Object.freeze([
      'OS04 skeleton adapter — capabilities remain UNAVAILABLE until explicitly qualified',
    ]),
  });
}
