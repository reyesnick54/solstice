import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LIVE_EXCHANGE_ENABLED } from '@solstice/flags';
import { JurisdictionalAssetRegistry } from './registry.ts';
import { ASSET_CAPABILITIES } from './types.ts';

describe('jurisdictional asset registry', () => {
  it('disables every capability by default and never marks counsel confirmation', () => {
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    const registry = new JurisdictionalAssetRegistry();
    for (const entry of registry.listEntries()) {
      assert.equal(entry.listingStatus, 'UNLISTED');
      assert.notEqual(entry.legalReviewState, 'CONFIRMED_BY_COUNSEL');
      for (const cap of ASSET_CAPABILITIES) {
        assert.equal(entry.capabilities[cap], false, `${entry.jurisdiction} ${cap}`);
      }
      assert.equal(registry.isPairTradeable(entry.jurisdiction), false);
    }
  });
});
