import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '@solstice/permissions';

import { EvidenceVault, GENESIS_PREV_SHA256 } from './index.ts';

describe('EvidenceVault', () => {
  it('seals a hash-chained record and verifies end to end', () => {
    const vault = new EvidenceVault(new FrozenClock(new Date('2026-08-13T12:00:00.000Z')));
    const first = vault.seal('KERNEL_DECISION', { status: 'ALLOW', intentId: 'i1' });
    const second = vault.seal('KERNEL_DECISION', { status: 'BLOCK', intentId: 'i2' });

    assert.equal(first.prevRecordSha256, GENESIS_PREV_SHA256);
    assert.equal(second.prevRecordSha256, first.recordSha256);
    assert.equal(first.recordSha256.length, 64);
    const chain = vault.verifyChain();
    assert.equal(chain.ok, true);
    assert.equal(chain.length, 2);
  });
});
