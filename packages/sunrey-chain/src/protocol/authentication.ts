import {
  createDefaultCryptoSuiteRegistry,
  createSecurityProviderCatalog,
  SUITE_SUNREY_ED25519_V1,
} from '../../../security/src/index.ts';
import { ED25519_PUBLIC_KEY_BYTES, ED25519_SIGNATURE_BYTES } from './constants.ts';
import { encodeUnsignedEnvelope } from './codec.ts';
import type { EnvelopeV1 } from './envelope.ts';
import { transactionSigningDigest } from './signing.ts';

/**
 * Wire algorithm 1 is registered to the canonical CryptoSuite.
 * Protocol code does not select an algorithm by name; it resolves
 * the suite, then the catalog provider. Unknown IDs fail closed.
 */
export const WIRE_ALGORITHM_TO_SUITE = Object.freeze({
  1: SUITE_SUNREY_ED25519_V1,
} as const);

function protocolProvider(suiteId: string) {
  const registry = createDefaultCryptoSuiteRegistry();
  const suite = registry.get(suiteId);
  if (!suite.ok) {
    throw new TypeError(`unknown CryptoSuite ${suiteId}; no silent fallback`);
  }
  if (!suite.value.signatureAlgorithm) {
    throw new TypeError(`suite ${suiteId} has no signature algorithm`);
  }
  const catalog = createSecurityProviderCatalog();
  const provider = catalog.signature(suite.value.signatureAlgorithm);
  if (!provider.ok) {
    throw new TypeError(provider.error.message);
  }
  return { suite: suite.value, provider: provider.value };
}

export function protocolKeyPairFromSeed(seed: Uint8Array): { readonly privateKey: Buffer; readonly publicKey: Uint8Array } {
  if (seed.length !== 32) {
    throw new TypeError('protocol seed must be 32 bytes');
  }
  const { provider, suite } = protocolProvider(SUITE_SUNREY_ED25519_V1);
  const derived = provider.fromSeed(
    Buffer.from(seed).toString('hex'),
    'TRANSACTION_SIGNING',
    suite.suiteId,
    'protocol-seed',
  );
  if (!derived.ok) {
    throw new TypeError(derived.error.message);
  }
  return {
    privateKey: Buffer.from(seed),
    publicKey: Buffer.from(derived.value.publicKey.publicKeyHex, 'hex'),
  };
}

/** @deprecated use protocolKeyPairFromSeed — kept for fixture compatibility */
export function ed25519PrivateKeyFromSeed(seed: Uint8Array): { readonly privateKey: Buffer; readonly publicKey: Uint8Array } {
  return protocolKeyPairFromSeed(seed);
}

export function signEnvelope(envelope: EnvelopeV1, seed: Uint8Array): EnvelopeV1 {
  const keys = protocolKeyPairFromSeed(seed);
  const prepared: EnvelopeV1 = Object.freeze({
    ...envelope,
    authentication: Object.freeze({
      schemaVersion: 1 as const,
      algorithmId: 1 as const,
      publicKey: keys.publicKey,
      signature: new Uint8Array(0),
      keyVersion: envelope.authentication.keyVersion,
    }),
  });
  const digest = transactionSigningDigest(prepared);
  const { provider } = protocolProvider(WIRE_ALGORITHM_TO_SUITE[1]);
  const signature = provider.signRaw(Buffer.from(seed).toString('hex'), Buffer.from(keys.publicKey).toString('hex'), digest);
  if (!signature.ok) {
    throw new TypeError(signature.error.message);
  }
  return Object.freeze({
    ...prepared,
    authentication: Object.freeze({
      ...prepared.authentication,
      signature: new Uint8Array(signature.value),
    }),
  });
}

export function verifyEnvelopeSignature(envelope: EnvelopeV1): boolean {
  const auth = envelope.authentication;
  const suiteId = WIRE_ALGORITHM_TO_SUITE[auth.algorithmId as 1];
  if (!suiteId) {
    return false;
  }
  if (auth.publicKey.length !== ED25519_PUBLIC_KEY_BYTES || auth.signature.length !== ED25519_SIGNATURE_BYTES) {
    return false;
  }
  try {
    const { provider } = protocolProvider(suiteId);
    const digest = transactionSigningDigest(envelope);
    const verified = provider.verifyRaw(
      Buffer.from(auth.publicKey).toString('hex'),
      digest,
      Buffer.from(auth.signature).toString('hex'),
    );
    return verified.ok;
  } catch {
    return false;
  }
}

export function unsignedBytesOf(envelope: EnvelopeV1): Uint8Array {
  return encodeUnsignedEnvelope(envelope);
}
