import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSimulationKeyProvider } from '../../../../packages/security/src/simulation.ts';
import { APPLICATION_KEY_PURPOSES, PURPOSE_ALGORITHMS } from '../../../../packages/security/src/purposes.ts';
import { handleLookupHash } from '../../../../packages/identity/src/login-handle.ts';
import { deriveRuntimeKeySecrets } from './runtime-key-seed.ts';

const SEED = 'test-only-seed-0123456789abcdef-0123456789abcdef';
const clock = { now: () => '2026-11-10T05:00:00.000Z' as never };

describe('runtime key seed', () => {
  it('rejects short seeds', () => {
    assert.throws(() => deriveRuntimeKeySecrets('too-short'), /at least 32/);
  });

  it('derives a distinct, correctly sized secret for every application purpose', () => {
    const secrets = deriveRuntimeKeySecrets(SEED);
    const values = new Set<string>();
    for (const purpose of APPLICATION_KEY_PURPOSES) {
      const secret = secrets[purpose];
      assert.ok(secret, `missing ${purpose}`);
      values.add(secret);
      const algorithm = (PURPOSE_ALGORITHMS as Record<string, string>)[purpose];
      if (algorithm === 'AES-256-GCM') {
        assert.equal(Buffer.from(secret, 'utf8').length, 32, `${purpose} must be a 32-byte AES key`);
      }
    }
    assert.equal(values.size, APPLICATION_KEY_PURPOSES.length);
    assert.notDeepEqual(deriveRuntimeKeySecrets(SEED), deriveRuntimeKeySecrets(`${SEED}-other`));
  });

  it('gives two processes the same handle hashes and mutually decryptable envelopes', () => {
    const first = createSimulationKeyProvider({ clock, hmacSecrets: deriveRuntimeKeySecrets(SEED) as never });
    const second = createSimulationKeyProvider({ clock, hmacSecrets: deriveRuntimeKeySecrets(SEED) as never });
    assert.equal(
      handleLookupHash(first, 'EMAIL', 'ada@example.com'),
      handleLookupHash(second, 'EMAIL', 'ada@example.com'),
    );

    const sealed = first.encrypt('DATA_ENCRYPTION', Buffer.from('totp-secret'));
    assert.equal(sealed.ok, true);
    if (!sealed.ok) return;
    const opened = second.decrypt(sealed.value);
    assert.equal(opened.ok, true);
    if (opened.ok) assert.equal(Buffer.from(opened.value).toString('utf8'), 'totp-secret');

    const unseeded = createSimulationKeyProvider({ clock });
    assert.notEqual(
      handleLookupHash(first, 'EMAIL', 'ada@example.com'),
      handleLookupHash(unseeded, 'EMAIL', 'ada@example.com'),
      'without a seed, material is random per process (the failure this fixes)',
    );
  });
});
