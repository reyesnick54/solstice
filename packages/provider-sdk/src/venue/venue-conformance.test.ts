import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { unavailableField, availableField } from './types.ts';
import type {
  VenueAccountCapability,
  VenueCapabilityManifest,
  VenueFeeDeclaration,
  VenueMarketDataCapability,
  VenueMinimumNotionalDeclaration,
  VenueMinimumQuantityDeclaration,
  VenueOrderCapability,
  VenuePrecisionDeclaration,
  VenueRateLimitDeclaration,
  VenueReconciliationCapability,
} from './types.ts';
import { evaluateVenueManifestQualification, SKELETON_OS04_QUALIFICATION_PROFILE } from './conformance.ts';
import type {
  VenueAssetClass,
  VenueMarketDataType,
  VenueOrderType,
  VenueTimeInForce,
  VenueTimestampSemantics,
} from './taxonomy.ts';

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

function minimalSkeletonManifest(): VenueCapabilityManifest {
  return Object.freeze({
    venueId: 'binance',
    displayName: 'Binance',
    assetClasses: unavailableField<readonly VenueAssetClass[]>(),
    instruments: unavailableField<readonly string[]>(),
    venues: unavailableField<readonly string[]>(),
    marketData: UNAVAILABLE_MARKET_DATA,
    orders: UNAVAILABLE_ORDERS,
    account: UNAVAILABLE_ACCOUNT,
    reconciliation: UNAVAILABLE_RECON,
    healthState: 'UNAVAILABLE',
    liveOrderPlacementEnabled: false,
    qualificationNotes: Object.freeze([]),
  });
}

describe('HELIOS OS04 venue SDK', () => {
  it('fail-closed fields default to UNAVAILABLE on skeleton manifests', () => {
    const manifest = minimalSkeletonManifest();
    assert.equal(manifest.assetClasses.availability, 'UNAVAILABLE');
    assert.equal(manifest.marketData.restAvailable.availability, 'UNAVAILABLE');
    assert.equal(manifest.liveOrderPlacementEnabled, false);
  });

  it('skeleton qualification rejects assumed order capabilities', () => {
    const manifest = minimalSkeletonManifest();
    const checks = evaluateVenueManifestQualification(manifest, SKELETON_OS04_QUALIFICATION_PROFILE);
    assert.ok(checks.some((row) => row.checkId === 'skeleton_no_assumed_orders' && row.outcome === 'PASS'));
  });

  it('availableField and unavailableField are frozen declarations', () => {
    assert.deepEqual(unavailableField(), { availability: 'UNAVAILABLE' });
    assert.deepEqual(availableField(['crypto_spot']), {
      availability: 'AVAILABLE',
      value: ['crypto_spot'],
    });
  });
});
