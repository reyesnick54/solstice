import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createResource, redactLocation } from './registry.ts';
import { createProductiveEconomyDataPlatform } from './platform.ts';
import { PRODUCTION_ACTIVE, LIVE_PROVIDER_CONNECTED } from './types.ts';

test('sensitive infrastructure location is redacted when disclosure is forbidden', () => {
  const hidden = createResource({
    resourceId: 'res_secure_plant',
    category: 'MANUFACTURING',
    subtype: 'CRITICAL_FACILITY',
    ownerRef: 'op_secret',
    operatorRef: 'op_secret',
    jurisdiction: 'SIM',
    region: 'grid-cell-9',
    publicDisclosureAllowed: false,
    unit: 'units_produced',
    valuationMethodologyId: 'pvm.manufacturing.sim',
  });
  const publicView = redactLocation(hidden);
  assert.equal(publicView.location.precision, 'REDACTED');
  assert.equal(publicView.location.region, null);
  assert.equal(publicView.ownerRef, 'REDACTED');
});

test('production and live providers remain disabled', () => {
  const platform = createProductiveEconomyDataPlatform();
  assert.equal(PRODUCTION_ACTIVE, false);
  assert.equal(LIVE_PROVIDER_CONNECTED, false);
  assert.equal(platform.productionActive, false);
  assert.equal(platform.liveProviderConnected, false);
  assert.equal(platform.methodologies.productionAuthorizedCount(), 0);
  for (const observation of platform.observations()) {
    assert.equal(observation.mintsMoonRey, false);
    assert.equal(observation.setsMarketPrice, false);
    assert.equal(observation.simulation, true);
  }
});
