import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from './vault.ts';

describe('Evidence Vault', () => {
  it('seals records and verifies the hash chain', () => {
    const vault = new EvidenceVault(new FrozenClock(asUtcInstant('2026-08-13T15:00:00.000Z')));
    vault.seal('A', { n: 1 });
    vault.seal('B', { n: 2 });
    const result = vault.verifyChain();
    assert.equal(result.ok, true);
    assert.equal(result.length, 2);
    assert.equal(vault.list()[1]?.prevRecordSha256, vault.list()[0]?.recordSha256);
  });
});
