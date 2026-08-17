/**
 * Wallet key material helpers.
 *
 * Uses canonical CryptoSuite identifiers. Classical Ed25519 remains
 * the default development signer. Hybrid and standardized PQ suites
 * are routed through packages/security providers. Application code
 * does not import the PQ library.
 */

import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

import {
  SUITE_SUNREY_ED25519_V1,
  SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
  SUITE_SUNREY_HYBRID_SIM_V1,
  SUITE_SUNREY_MLDSA_65_V1,
  createEd25519SignatureProvider,
  createMlDsa65Provider,
  decodeHybridComponent,
  encodeHybridComponent,
  isHybridEncoded,
} from '../../../security/src/index.ts';
import type { AddressAlgorithm, PublicKeyDescriptor } from './types.ts';

const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const DOMAIN = 'SUNREY-KEY-TX-WALLET-V1';

export const CLASSICAL_WALLET_SUITE = SUITE_SUNREY_ED25519_V1;
export const HYBRID_WALLET_SUITE = SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1;
export const HYBRID_WALLET_SIM_SUITE = SUITE_SUNREY_HYBRID_SIM_V1;
export const PQ_WALLET_SUITE = SUITE_SUNREY_MLDSA_65_V1;

const ed25519 = createEd25519SignatureProvider();
const mlDsa = createMlDsa65Provider();

export function suiteToAlgorithm(suiteId: string): AddressAlgorithm {
  if (suiteId === HYBRID_WALLET_SUITE) {
    return 'HYBRID_V1';
  }
  if (suiteId === HYBRID_WALLET_SIM_SUITE) {
    return 'HYBRID_SIM_V1';
  }
  if (suiteId === PQ_WALLET_SUITE) {
    return 'ML_DSA_65_V1';
  }
  return 'ED25519_V1';
}

export function suiteRank(suiteId: string): number {
  if (suiteId === CLASSICAL_WALLET_SUITE) {
    return 1;
  }
  if (suiteId === HYBRID_WALLET_SIM_SUITE || suiteId === HYBRID_WALLET_SUITE) {
    return 2;
  }
  if (suiteId === PQ_WALLET_SUITE) {
    return 3;
  }
  return 0;
}

export function isApprovedWalletSuite(suiteId: string): boolean {
  return (
    suiteId === CLASSICAL_WALLET_SUITE ||
    suiteId === HYBRID_WALLET_SUITE ||
    suiteId === HYBRID_WALLET_SIM_SUITE ||
    suiteId === PQ_WALLET_SUITE
  );
}

export function seedFromLabel(label: string): Uint8Array {
  return createHash('sha256').update(`SUNREY-WALLET-DEV-SEED-v1:${label}`).digest();
}

export function pqSeedFromClassicalSeed(seed: Uint8Array): Uint8Array {
  return createHash('sha256').update('SUNREY-WALLET-PQ-SEED-v1').update(seed).digest();
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

function domainDigest(message: Uint8Array): Buffer {
  return createHash('sha256').update(DOMAIN).update(message).digest();
}

export function signWalletBytes(seed: Uint8Array, message: Uint8Array, suiteId: string = CLASSICAL_WALLET_SUITE): string {
  const digest = domainDigest(message);
  if (suiteId === PQ_WALLET_SUITE) {
    const derived = mlDsa.fromSeed(Buffer.from(seed).toString('hex'), 'WALLET_SIGNING', PQ_WALLET_SUITE, 'wallet-pq');
    if (!derived.ok) {
      throw new Error(derived.error.message);
    }
    const signed = mlDsa.signRaw(
      derived.value.privateKey.reveal().toString('hex'),
      derived.value.publicKey.publicKeyHex,
      digest,
    );
    if (!signed.ok) {
      throw new Error(signed.error.message);
    }
    return signed.value.toString('hex');
  }
  if (suiteId === HYBRID_WALLET_SUITE) {
    const classical = ed25519FromSeed(seed);
    const pqSeed = pqSeedFromClassicalSeed(seed);
    const pq = mlDsa.fromSeed(Buffer.from(pqSeed).toString('hex'), 'WALLET_SIGNING', HYBRID_WALLET_SUITE, 'wallet-hybrid-pq');
    if (!pq.ok) {
      throw new Error(pq.error.message);
    }
    const pqSigned = mlDsa.signRaw(
      pq.value.privateKey.reveal().toString('hex'),
      pq.value.publicKey.publicKeyHex,
      digest,
    );
    if (!pqSigned.ok) {
      throw new Error(pqSigned.error.message);
    }
    const privateKey = createPrivateKey({ key: classical.privateKey, format: 'der', type: 'pkcs8' });
    const classicalSig = sign(null, digest, privateKey).toString('hex');
    return encodeHybridComponent(classicalSig, pqSigned.value.toString('hex'));
  }
  const keys = ed25519FromSeed(seed);
  const privateKey = createPrivateKey({ key: keys.privateKey, format: 'der', type: 'pkcs8' });
  return sign(null, digest, privateKey).toString('hex');
}

export function verifyWalletBytes(
  publicKeyHex: string,
  message: Uint8Array,
  signatureHex: string,
  suiteId?: string,
): boolean {
  const digest = domainDigest(message);
  if (isHybridEncoded(signatureHex) || isHybridEncoded(publicKeyHex) || suiteId === HYBRID_WALLET_SUITE) {
    const pub = decodeHybridComponent(publicKeyHex);
    const sig = decodeHybridComponent(signatureHex);
    if (!pub.ok || !sig.ok) {
      return false;
    }
    const classicalOk = verifyEd25519(pub.value.classicalHex, digest, sig.value.classicalHex);
    const pqOk = mlDsa.verifyRaw(pub.value.postQuantumHex, digest, sig.value.postQuantumHex);
    return classicalOk && pqOk.ok;
  }
  if (suiteId === PQ_WALLET_SUITE || publicKeyHex.length === 3904) {
    return mlDsa.verifyRaw(publicKeyHex, digest, signatureHex).ok;
  }
  return verifyEd25519(publicKeyHex, digest, signatureHex);
}

function verifyEd25519(publicKeyHex: string, digest: Buffer, signatureHex: string): boolean {
  const raw = Buffer.from(publicKeyHex, 'hex');
  if (raw.length !== 32) {
    return false;
  }
  const publicKey = createPublicKey({
    key: Buffer.concat([SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki',
  });
  return verify(null, digest, publicKey, Buffer.from(signatureHex, 'hex'));
}

export function publicDescriptorFromSeed(
  keyId: string,
  seed: Uint8Array,
  suiteId: string = CLASSICAL_WALLET_SUITE,
): PublicKeyDescriptor {
  if (suiteId === PQ_WALLET_SUITE) {
    const derived = mlDsa.fromSeed(Buffer.from(seed).toString('hex'), 'WALLET_SIGNING', PQ_WALLET_SUITE, keyId);
    if (!derived.ok) {
      throw new Error(derived.error.message);
    }
    return Object.freeze({
      schemaVersion: 1,
      keyId,
      suiteId,
      algorithm: suiteToAlgorithm(suiteId),
      publicKeyHex: derived.value.publicKey.publicKeyHex,
      purpose: 'WALLET_SIGNING',
    });
  }
  if (suiteId === HYBRID_WALLET_SUITE) {
    const classical = ed25519FromSeed(seed);
    const pq = mlDsa.fromSeed(
      Buffer.from(pqSeedFromClassicalSeed(seed)).toString('hex'),
      'WALLET_SIGNING',
      HYBRID_WALLET_SUITE,
      `${keyId}:pq`,
    );
    if (!pq.ok) {
      throw new Error(pq.error.message);
    }
    return Object.freeze({
      schemaVersion: 1,
      keyId,
      suiteId,
      algorithm: suiteToAlgorithm(suiteId),
      publicKeyHex: encodeHybridComponent(classical.publicKeyHex, pq.value.publicKey.publicKeyHex),
      purpose: 'WALLET_SIGNING',
    });
  }
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

void ed25519;
