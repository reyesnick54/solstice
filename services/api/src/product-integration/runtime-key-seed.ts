import { createHmac } from 'node:crypto';

import {
  APPLICATION_KEY_PURPOSES,
  PURPOSE_ALGORITHMS,
} from '../../../../packages/security/src/purposes.ts';

/**
 * Stable simulation key material for a hosted runtime.
 *
 * By default the SimulationKeyProvider creates random key material per
 * process. That is fine for tests, but in a hosted runtime it means anything
 * derived from those keys and persisted to PostgreSQL stops verifying after a
 * restart: login-handle lookup hashes, access-token signatures, and TOTP
 * secret envelopes. Real users would be locked out on every deploy.
 *
 * Given one high-entropy seed held in the secret manager
 * (SUNREY_RUNTIME_KEY_SEED), derive a distinct secret per key purpose with
 * HMAC-SHA256(seed, purpose). HMAC purposes receive 64 hex characters;
 * AES-256-GCM purposes receive exactly 32 bytes (32 base64url characters,
 * 192 bits) because the provider uses the UTF-8 bytes as the key.
 *
 * This is still SIMULATION key management. It is not an HSM/KMS and does not
 * change PRODUCTION_HSM_KMS_CONFIGURED.
 */

export const MIN_RUNTIME_KEY_SEED_LENGTH = 32;

export type RuntimeKeySecrets = Readonly<Record<string, string>>;

export function deriveRuntimeKeySecrets(seed: string): RuntimeKeySecrets {
  if (typeof seed !== 'string' || seed.length < MIN_RUNTIME_KEY_SEED_LENGTH) {
    throw new Error(`SUNREY_RUNTIME_KEY_SEED must be at least ${MIN_RUNTIME_KEY_SEED_LENGTH} characters`);
  }
  const secrets: Record<string, string> = {};
  for (const purpose of APPLICATION_KEY_PURPOSES) {
    const digest = createHmac('sha256', seed).update(`sunrey-simulation-key:${purpose}:v1`).digest();
    const algorithm = (PURPOSE_ALGORITHMS as Record<string, string>)[purpose];
    secrets[purpose] = algorithm === 'AES-256-GCM'
      ? digest.subarray(0, 24).toString('base64url')
      : digest.toString('hex');
  }
  return Object.freeze(secrets);
}
