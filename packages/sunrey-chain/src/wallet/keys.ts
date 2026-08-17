/**
 * Wallet key material helpers.
 *
 * Uses canonical CryptoSuite identifiers. Classical Ed25519 is the
 * development signer. Hybrid and simulated PQ suites are accepted for
 * rotation without inventing a second wallet system.
 */

import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

import {
  SUITE_SUNREY_ED25519_V1,
  SUITE_SUNREY_HYBRID_SIM_V1,
  SUITE_SUNREY_MLDSA_65_V1,
} from '../../../security/src/index.ts';
import type { AddressAlgorithm, PublicKeyDescriptor } from './types.ts';

const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const DOMAIN = 'SUNREY-KEY-TX-WALLET-V1';

export const CLASSICAL_WALLET_SUITE = SUITE_SUNREY_ED25519_V1;
export const HYBRID_WALLET_SUITE = SUITE_SUNREY_HYBRID_SIM_V1;
export const PQ_WALLET_SUITE = SUITE_SUNREY_MLDSA_65_V1;

export function suiteToAlgorithm(suiteId: string): AddressAlgorithm {
  if (suiteId === HYBRID_WALLET_SUITE) {
    return 'HYBRID_SIM_V1';
  }
  if (suiteId === PQ_WALLET_SUITE) {
    return 'PQ_SIM_V1';
  }
  return 'ED25519_V1';
}

export function suiteRank(suiteId: string): number {
  if (suiteId === CLASSICAL_WALLET_SUITE) {
    return 1;
  }
  if (suiteId === HYBRID_WALLET_SUITE) {
    return 2;
  }
  if (suiteId === PQ_WALLET_SUITE) {
    return 3;
  }
  return 0;
}

export function isApprovedWalletSuite(suiteId: string): boolean {
  return suiteId === CLASSICAL_WALLET_SUITE || suiteId === HYBRID_WALLET_SUITE || suiteId === PQ_WALLET_SUITE;
}

export function seedFromLabel(label: string): Uint8Array {
  return createHash('sha256').update(`SUNREY-WALLET-DEV-SEED-v1:${label}`).digest();
}

export function ed25519FromSeed(seed: Uint8Array): { readonly privateKey: Buffer; readonly publicKeyHex: string } {
  if (seed.length !== 32) {
    throw new TypeError('Ed25519 seed must be 32 bytes');
  }
  const pkcs8 = Buffer.concat([PKCS8_PREFIX, Buffer.from(seed)]);
  const privateKey = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  const spki = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  return {
    privateKey: pkcs8,
    publicKeyHex: Buffer.from(spki.subarray(spki.length - 32)).toString('hex'),
  };
}

export function signWalletBytes(seed: Uint8Array, message: Uint8Array): string {
  const keys = ed25519FromSeed(seed);
  const privateKey = createPrivateKey({ key: keys.privateKey, format: 'der', type: 'pkcs8' });
  const digest = createHash('sha256').update(DOMAIN).update(message).digest();
  return sign(null, digest, privateKey).toString('hex');
}

export function verifyWalletBytes(publicKeyHex: string, message: Uint8Array, signatureHex: string): boolean {
  const raw = Buffer.from(publicKeyHex, 'hex');
  if (raw.length !== 32) {
    return false;
  }
  const publicKey = createPublicKey({
    key: Buffer.concat([SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki',
  });
  const digest = createHash('sha256').update(DOMAIN).update(message).digest();
  return verify(null, digest, publicKey, Buffer.from(signatureHex, 'hex'));
}

export function publicDescriptorFromSeed(
  keyId: string,
  seed: Uint8Array,
  suiteId: string = CLASSICAL_WALLET_SUITE,
): PublicKeyDescriptor {
  const keys = ed25519FromSeed(seed);
  return Object.freeze({
    schemaVersion: 1,
    keyId,
    suiteId,
    algorithm: suiteToAlgorithm(suiteId),
    publicKeyHex: keys.publicKeyHex,
    purpose: 'WALLET_SIGNING',
  });
}

export function wipeBuffer(buffer: Buffer): void {
  buffer.fill(0);
}

export function containsPrivateMaterial(text: string): boolean {
  return /private[_-]?key|seedPhrase|mnemonic|pkcs8|BEGIN PRIVATE/i.test(text);
}
