import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createHmac } from 'node:crypto';

import { createSimulationKeyProvider } from './simulation.ts';
import { APPLICATION_KEY_PURPOSES, PURPOSE_ALGORITHMS } from './purposes.ts';
import { deriveSimulationKeySecrets as deriveRuntimeKeySecrets } from './simulation-key-seed.ts';

// Mirrors identity's login-handle lookup: SESSION_SIGNING over the handle.
function handleLookupHash(keys: ReturnType<typeof createSimulationKeyProvider>, kind: string, value: string) {
  const signed = keys.sign('SESSION_SIGNING', `login-handle:${kind}:${value}`);
  return signed.ok ? signed.value.hex : null;
}
void createHmac;

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
      if (purpose === 'EXECUTION_AUTHORITY_SIGNING') {
        assert.equal(secret, undefined, 'Execution Authority keys stay ephemeral');
        continue;
      }
      assert.ok(secret, `missing ${purpose}`);
      values.add(secret);
      const algorithm = (PURPOSE_ALGORITHMS as Record<string, string>)[purpose];
      if (algorithm === 'AES-256-GCM') {
        assert.equal(Buffer.from(secret, 'utf8').length, 32, `${purpose} must be a 32-byte AES key`);
      }
    }
    assert.equal(values.size, APPLICATION_KEY_PURPOSES.length - 1);
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
