import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { unavailableField, availableField } from './types.ts';
import { evaluateVenueManifestQualification, SKELETON_OS04_QUALIFICATION_PROFILE } from './conformance.ts';
import type { VenueCapabilityManifest } from './types.ts';

function minimalSkeletonManifest(): VenueCapabilityManifest {
  return Object.freeze({
    venueId: 'binance',
    displayName: 'Binance',
    assetClasses: unavailableField(),
    instruments: unavailableField(),
    venues: unavailableField(),
    marketData: Object.freeze({
      marketDataTypes: unavailableField(),
      websocketAvailable: unavailableField(),
      restAvailable: unavailableField(),
      historicalDataSupport: unavailableField(),
      timestampSemantics: unavailableField(),
      rateLimits: unavailableField(),
    }),
    orders: Object.freeze({
      orderTypes: unavailableField(),
      tifTypes: unavailableField(),
      precision: unavailableField(),
      minimumQuantity: unavailableField(),
      minimumNotional: unavailableField(),
      makerTakerFees: unavailableField(),
      reduceOnlySupport: unavailableField(),
      postOnlySupport: unavailableField(),
      fundingSupport: unavailableField(),
    }),
    account: Object.freeze({
      sandboxAvailability: unavailableField(),
      subAccountSupport: unavailableField(),
      portfolioMarginSupport: unavailableField(),
    }),
    reconciliation: Object.freeze({
      reconciliationSupport: unavailableField(),
      fillHistoryAvailable: unavailableField(),
      ledgerExportAvailable: unavailableField(),
    }),
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
