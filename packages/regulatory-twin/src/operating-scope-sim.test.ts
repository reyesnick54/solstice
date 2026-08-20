import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TWIN_CAN_EXTERNALLY_VERIFY,
  twinCannotUpgradeToExternallyVerified,
  twinOperatingScopeSimulation,
} from './operating-scope-sim.ts';

describe('Regulatory Twin operating-scope simulation', () => {
  it('cannot upgrade a row to EXTERNALLY_VERIFIED', () => {
    assert.equal(TWIN_CAN_EXTERNALLY_VERIFY, false);
    assert.equal(twinCannotUpgradeToExternallyVerified('EXTERNALLY_VERIFIED'), 'UNDER_REVIEW');
    assert.equal(twinCannotUpgradeToExternallyVerified('ELIGIBLE_CANDIDATE'), 'UNDER_REVIEW');
    const simulated = twinOperatingScopeSimulation({
      currentStatus: 'RESEARCH_REQUIRED',
      proposedStatus: 'EXTERNALLY_VERIFIED',
    });
    assert.notEqual(simulated.status, 'EXTERNALLY_VERIFIED');
    assert.equal(simulated.externallyVerified, false);
  });
});
