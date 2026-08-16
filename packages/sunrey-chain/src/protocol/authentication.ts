import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { ED25519_PUBLIC_KEY_BYTES, ED25519_SIGNATURE_BYTES, SIGNATURE_ALGORITHM_ED25519 } from './constants.ts';
import { encodeUnsignedEnvelope } from './codec.ts';
import type { Authentication, EnvelopeV1 } from './envelope.ts';
import { transactionIdOf } from './hash.ts';

const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

export function ed25519PrivateKeyFromSeed(seed: Uint8Array): { readonly privateKey: Buffer; readonly publicKey: Uint8Array } {
  if (seed.length !== 32) {
    throw new TypeError('Ed25519 seed must be 32 bytes');
  }
  const pkcs8 = Buffer.concat([PKCS8_PREFIX, Buffer.from(seed)]);
  const privateKey = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  const spki = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  return {
    privateKey: pkcs8,
    publicKey: new Uint8Array(spki.subarray(spki.length - ED25519_PUBLIC_KEY_BYTES)),
  };
}

export function signEnvelope(envelope: EnvelopeV1, seed: Uint8Array): EnvelopeV1 {
  const keys = ed25519PrivateKeyFromSeed(seed);
  const prepared: EnvelopeV1 = Object.freeze({
    ...envelope,
    authentication: Object.freeze({
      schemaVersion: 1 as const,
      algorithmId: SIGNATURE_ALGORITHM_ED25519,
      publicKey: keys.publicKey,
      signature: new Uint8Array(0),
      keyVersion: envelope.authentication.keyVersion,
    }),
  });
  const digest = Buffer.from(transactionIdOf(prepared), 'hex');
  const privateKey = createPrivateKey({ key: keys.privateKey, format: 'der', type: 'pkcs8' });
  const signature = sign(null, digest, privateKey);
  return Object.freeze({
    ...prepared,
    authentication: Object.freeze({
      ...prepared.authentication,
      signature: new Uint8Array(signature),
    }),
  });
}

export function verifyEnvelopeSignature(envelope: EnvelopeV1): boolean {
  const auth = envelope.authentication;
  if (auth.algorithmId !== SIGNATURE_ALGORITHM_ED25519) {
    return false;
  }
  if (auth.publicKey.length !== ED25519_PUBLIC_KEY_BYTES || auth.signature.length !== ED25519_SIGNATURE_BYTES) {
    return false;
  }
  const digest = Buffer.from(transactionIdOf(envelope), 'hex');
  const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
  const spki = Buffer.concat([spkiPrefix, Buffer.from(auth.publicKey)]);
  try {
    const publicKey = createPublicKey({ key: spki, format: 'der', type: 'spki' });
    return verify(null, digest, publicKey, Buffer.from(auth.signature));
  } catch {
    return false;
  }
}

export function unsignedBytesOf(envelope: EnvelopeV1): Uint8Array {
  return encodeUnsignedEnvelope(envelope);
}
