import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EconomicClaimRegistry, EXISTING_DUPLICATE_PROTECTIONS } from '../packages/sunrey-chain/src/economic-proof/index.ts';

describe('Wave 3 economic proof — repository integration', () => {
  it('exports registry and audit surfaces', () => {
    const registry = new EconomicClaimRegistry();
    assert.equal(registry.snapshot().claims.length, 0);
    assert.ok(EXISTING_DUPLICATE_PROTECTIONS.some((entry) => entry.surface.includes('HumanContributionRegistry')));
  });
});
