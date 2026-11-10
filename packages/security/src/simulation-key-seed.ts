import { createHmac } from 'node:crypto';

import { APPLICATION_KEY_PURPOSES, PURPOSE_ALGORITHMS, type KeyPurpose } from './purposes.ts';

/**
 * Stable simulation key material for a hosted (sandbox) runtime.
 *
 * SimulationKeyProvider creates random key material per process by default.
 * That is right for tests, but in a hosted runtime anything derived from
 * those keys and persisted to PostgreSQL stops verifying after a restart:
 * login-handle lookup hashes, access-token signatures and TOTP secret
 * envelopes. Real users would be locked out on every deploy.
 *
 * From one high-entropy seed held in the secret manager, derive a distinct
 * secret per purpose with HMAC-SHA256(seed, purpose). HMAC purposes receive
 * 64 hex characters; AES-256-GCM purposes receive exactly 32 bytes (32
 * base64url characters) because the provider uses the UTF-8 bytes as the key.
 *
 * EXECUTION_AUTHORITY_SIGNING is deliberately NOT derived: Execution
 * Authorities are short-lived and never need to verify across a restart, so
 * their key stays random per process and a leaked seed cannot mint them.
 *
 * This remains SIMULATION key management. It is not an HSM/KMS and does not
 * change PRODUCTION_HSM_KMS_CONFIGURED.
 */

export const MIN_SIMULATION_KEY_SEED_LENGTH = 32;

const NOT_SEEDED: ReadonlySet<KeyPurpose> = new Set<KeyPurpose>(['EXECUTION_AUTHORITY_SIGNING']);

export function deriveSimulationKeySecrets(seed: string): Readonly<Partial<Record<KeyPurpose, string>>> {
  if (typeof seed !== 'string' || seed.length < MIN_SIMULATION_KEY_SEED_LENGTH) {
    throw new Error(`simulation key seed must be at least ${MIN_SIMULATION_KEY_SEED_LENGTH} characters`);
  }
  const secrets: Partial<Record<KeyPurpose, string>> = {};
  for (const purpose of APPLICATION_KEY_PURPOSES) {
    if (NOT_SEEDED.has(purpose)) continue;
    const digest = createHmac('sha256', seed).update(`sunrey-simulation-key:${purpose}:v1`).digest();
    secrets[purpose] =
      (PURPOSE_ALGORITHMS as Record<string, string>)[purpose] === 'AES-256-GCM'
        ? digest.subarray(0, 24).toString('base64url')
        : digest.toString('hex');
  }
  return Object.freeze(secrets);
}
