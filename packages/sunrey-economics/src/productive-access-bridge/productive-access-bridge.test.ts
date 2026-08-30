import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runProductiveAccessIntegration } from './integration.ts';

describe('ACCESS-19 productive-engine integration', () => {
  it('closes the productive-to-access loop without Access minting MoonRey', () => {
    const result = runProductiveAccessIntegration();
    assert.equal(result.fleetDemo.totalVerifiedVehicleHours, 100_000n);
    assert.equal(result.fleetDemo.committedVehicleHours, 10_000n);
    assert.equal(result.fleetDemo.consumedVehicleDays, 4n);
    assert.equal(result.fleetDemo.moonreyIssuedByAccess, 0n);
    assert.equal(result.moonreySupplyBeforeAccess, result.moonreySupplyAfterAccess);
    assert.equal(result.moonreySupplyAfterAccess, result.fleetDemo.moonreyIssuanceAfter);
    assert.equal(result.fleetDemo.invariantsHeld, true);
    assert.equal(result.capacityExpansionDemonstrated, true);
  });
});
