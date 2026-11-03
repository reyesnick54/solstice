/**
 * Provider-neutral skeleton manifest — every unknown capability is UNAVAILABLE.
 */

import {
  unavailableField,
  type VenueAccountCapability,
  type VenueCapabilityManifest,
  type VenueFeeDeclaration,
  type VenueMarketDataCapability,
  type VenueMinimumNotionalDeclaration,
  type VenueMinimumQuantityDeclaration,
  type VenueOrderCapability,
  type VenuePrecisionDeclaration,
  type VenueRateLimitDeclaration,
  type VenueReconciliationCapability,
  type HeliosOs04VenueId,
  type VenueAssetClass,
  type VenueMarketDataType,
  type VenueOrderType,
  type VenueTimeInForce,
  type VenueTimestampSemantics,
} from '@solstice/provider-sdk';

const UNAVAILABLE_MARKET_DATA = Object.freeze({
  marketDataTypes: unavailableField<readonly VenueMarketDataType[]>(),
  websocketAvailable: unavailableField<boolean>(),
  restAvailable: unavailableField<boolean>(),
  historicalDataSupport: unavailableField<boolean>(),
  timestampSemantics: unavailableField<VenueTimestampSemantics>(),
  rateLimits: unavailableField<VenueRateLimitDeclaration>(),
}) satisfies VenueMarketDataCapability;

const UNAVAILABLE_ORDERS = Object.freeze({
  orderTypes: unavailableField<readonly VenueOrderType[]>(),
  tifTypes: unavailableField<readonly VenueTimeInForce[]>(),
  precision: unavailableField<VenuePrecisionDeclaration>(),
  minimumQuantity: unavailableField<VenueMinimumQuantityDeclaration>(),
  minimumNotional: unavailableField<VenueMinimumNotionalDeclaration>(),
  makerTakerFees: unavailableField<VenueFeeDeclaration>(),
  reduceOnlySupport: unavailableField<boolean>(),
  postOnlySupport: unavailableField<boolean>(),
  fundingSupport: unavailableField<boolean>(),
}) satisfies VenueOrderCapability;

const UNAVAILABLE_ACCOUNT = Object.freeze({
  sandboxAvailability: unavailableField<boolean>(),
  subAccountSupport: unavailableField<boolean>(),
  portfolioMarginSupport: unavailableField<boolean>(),
}) satisfies VenueAccountCapability;

const UNAVAILABLE_RECON = Object.freeze({
  reconciliationSupport: unavailableField<boolean>(),
  fillHistoryAvailable: unavailableField<boolean>(),
  ledgerExportAvailable: unavailableField<boolean>(),
}) satisfies VenueReconciliationCapability;

export function createSkeletonVenueManifest(input: {
  readonly venueId: HeliosOs04VenueId;
  readonly displayName: string;
}): VenueCapabilityManifest {
  return Object.freeze({
    venueId: input.venueId,
    displayName: input.displayName,
    assetClasses: unavailableField<readonly VenueAssetClass[]>(),
    instruments: unavailableField<readonly string[]>(),
    venues: unavailableField<readonly string[]>(),
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
