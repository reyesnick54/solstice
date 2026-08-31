import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  allWave1InvariantsHeld,
  checkAllWave1Invariants,
  createAccessSolvencyService,
  runAccessWave1,
  TOKEN_CONVERSION_CONTRIBUTION,
} from '../packages/access-economy/src/funding-solvency/index.ts';

describe('ACCESS-30 integration qualification', () => {
  it('runs Wave 1 end-to-end with solvency invariants', () => {
    const service = createAccessSolvencyService();
    const result = runAccessWave1({ service, userId: 'participant-a' });

    assert.equal(result.tokenConversionContribution, TOKEN_CONVERSION_CONTRIBUTION);
    assert.ok(result.entitlements.length > 0);
    assert.ok(result.fundingPools.length >= 2);

    for (const pool of result.fundingPools) {
      const balance = service.getFundingPoolBalance(pool.fundingPoolId, pool.currency, '2026-08-31T23:59:59.999Z');
      const invariants = checkAllWave1Invariants({ fundingBalance: balance });
      assert.ok(allWave1InvariantsHeld(invariants), JSON.stringify(invariants));
    }

    for (const ent of result.entitlements) {
      const balance = service.getEntitlementLedger().getBalance(ent.entitlementId);
      assert.ok(balance);
      const invariants = checkAllWave1Invariants({ entitlementBalance: balance });
      assert.ok(allWave1InvariantsHeld(invariants));
    }
  });
});
