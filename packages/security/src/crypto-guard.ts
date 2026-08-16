import { securityErr, type SecurityResult } from './errors.ts';

/**
 * Runtime permit for constructing cryptographic providers.
 * Business / protocol code must obtain providers from the catalog,
 * not instantiate algorithms directly.
 */
export const CRYPTO_PROVIDER_PERMIT = Symbol.for('solstice.security.cryptoProviderPermit');

export function assertProviderPermit(permit: symbol): SecurityResult<true> {
  if (permit !== CRYPTO_PROVIDER_PERMIT) {
    return securityErr(
      'DIRECT_INSTANTIATION_FORBIDDEN',
      'cryptographic algorithms may only be constructed through registered providers',
    );
  }
  return { ok: true, value: true };
}

export const PROVIDER_ONLY_FILES = Object.freeze([
  'packages/security/src/ed25519-provider.ts',
  'packages/security/src/pq-simulation-provider.ts',
  'packages/security/src/crypto-providers.ts',
  'packages/security/src/simulation.ts',
  'packages/security/src/envelope.ts',
  'packages/security/src/hmac.ts',
  'packages/security/src/hash.ts',
  'packages/security/src/random.ts',
]);
