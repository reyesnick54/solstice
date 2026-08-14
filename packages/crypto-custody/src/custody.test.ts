import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SimulatedCustodyProvider } from './custody.ts';

describe('simulated custody', () => {
  it('refuses to commingle customer and corporate positions on one account', () => {
    const custody = new SimulatedCustodyProvider();
    custody.hold({ accountId: 'acct_1', holderClass: 'CUSTOMER' }, 10n);
    assert.throws(() => custody.hold({ accountId: 'acct_1', holderClass: 'CORPORATE' }, 1n));
    assert.equal(custody.position('acct_1'), 10n);
  });
});
