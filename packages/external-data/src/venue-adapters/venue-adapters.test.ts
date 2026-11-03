import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HELIOS_OS04_VENUE_IDS } from '@solstice/provider-sdk';
import { KRAKEN_VENUE_ADAPTER } from './kraken/adapter.ts';
import { HELIOS_OS04_VENUE_ADAPTERS, assertOs04VenueRegistryComplete } from './registry.ts';

describe('external-data venue adapters', () => {
  it('registry includes Kraken and all skeleton venues', () => {
    assert.equal(assertOs04VenueRegistryComplete(), true);
    assert.equal(HELIOS_OS04_VENUE_ADAPTERS.length, HELIOS_OS04_VENUE_IDS.length);
    assert.equal(KRAKEN_VENUE_ADAPTER.venueId, 'kraken');
  });
});
