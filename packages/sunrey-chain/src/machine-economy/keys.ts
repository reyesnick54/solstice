/**
 * Machine cryptographic keys.
 *
 * Machine keys remain separate from validator consensus, governance,
 * Execution Authority, human wallet recovery, oracle provider, and
 * P2P validator keys. Signatures use CryptoSuite. Hybrid/PQ suites
 * rotate without changing owner/controller semantics.
 */

import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

import {
  SUITE_SUNREY_ED25519_V1,
  SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
  SUITE_SUNREY_HYBRID_SIM_V1,
  SUITE_SUNREY_MLDSA_65_V1,
  createMlDsa65Provider,
  decodeHybridComponent,
  encodeHybridComponent,
  isHybridEncoded,
} from '../../../security/src/index.ts';
import { SEPARATED_KEY_KINDS, type MachineKeyRecord, type SeparatedKeyKind } from './types.ts';

const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const DOMAIN = 'sunrey.machine.sig.v1';

export const MACHINE_KEY_PURPOSE = 'MACHINE_SIGNING' as const;
export const CLASSICAL_MACHINE_SUITE = SUITE_SUNREY_ED25519_V1;
export const HYBRID_MACHINE_SUITE = SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1;
export const HYBRID_MACHINE_SIM_SUITE = SUITE_SUNREY_HYBRID_SIM_V1;
export const PQ_MACHINE_SUITE = SUITE_SUNREY_MLDSA_65_V1;

const mlDsa = createMlDsa65Provider();

export function isSeparatedKeyKind(value: string): value is SeparatedKeyKind {
  return (SEPARATED_KEY_KINDS as readonly string[]).includes(value);
}

export function machineKeysMayShare(kind: SeparatedKeyKind): boolean {
  return kind === 'MACHINE_SIGNING';
}

export function seedFromLabel(label: string): Uint8Array {
  return createHash('sha256').update(`SUNREY-MACHINE-DEV-SEED-v1:${label}`).digest();
}

export function pqSeedFromClassicalSeed(seed: Uint8Array): Uint8Array {
  return createHash('sha256').update('SUNREY-MACHINE-PQ-SEED-v1').update(seed).digest();
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

function domainDigest(payloadHex: string): Buffer {
  return createHash('sha256').update(DOMAIN).update(Buffer.from(payloadHex, 'hex')).digest();
}

export function signMachinePayload(seed: Uint8Array, payloadHex: string, suiteId: string = CLASSICAL_MACHINE_SUITE): string {
  const digest = domainDigest(payloadHex);
  if (suiteId === PQ_MACHINE_SUITE) {
    const derived = mlDsa.fromSeed(Buffer.from(seed).toString('hex'), 'MACHINE_SIGNING', PQ_MACHINE_SUITE, 'machine-pq');
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
  if (suiteId === HYBRID_MACHINE_SUITE) {
    const classical = ed25519FromSeed(seed);
    const pq = mlDsa.fromSeed(
      Buffer.from(pqSeedFromClassicalSeed(seed)).toString('hex'),
      'MACHINE_SIGNING',
      HYBRID_MACHINE_SUITE,
      'machine-hybrid-pq',
    );
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
    return encodeHybridComponent(sign(null, digest, privateKey).toString('hex'), pqSigned.value.toString('hex'));
  }
  const keys = ed25519FromSeed(seed);
  const privateKey = createPrivateKey({ key: keys.privateKey, format: 'der', type: 'pkcs8' });
  return sign(null, digest, privateKey).toString('hex');
}

export function verifyMachinePayload(
  publicKeyHex: string,
  payloadHex: string,
  signatureHex: string,
  suiteId?: string,
): boolean {
  const digest = domainDigest(payloadHex);
  if (isHybridEncoded(signatureHex) || isHybridEncoded(publicKeyHex) || suiteId === HYBRID_MACHINE_SUITE) {
    const pub = decodeHybridComponent(publicKeyHex);
    const sig = decodeHybridComponent(signatureHex);
    if (!pub.ok || !sig.ok) {
      return false;
    }
    return verifyEd25519(pub.value.classicalHex, digest, sig.value.classicalHex) &&
      mlDsa.verifyRaw(pub.value.postQuantumHex, digest, sig.value.postQuantumHex).ok;
  }
  if (suiteId === PQ_MACHINE_SUITE || publicKeyHex.length === 3904) {
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

export function createMachineKey(input: {
  readonly keyId: string;
  readonly seedLabel: string;
  readonly suiteId?: string;
  readonly version?: number;
  readonly createdAtUtc: string;
  readonly rotatedFrom?: string | null;
}): { readonly record: MachineKeyRecord; readonly seed: Uint8Array; readonly publicKeyHex: string } {
  const seed = seedFromLabel(input.seedLabel);
  const suiteId = input.suiteId ?? CLASSICAL_MACHINE_SUITE;
  let publicKeyHex: string;
  if (suiteId === PQ_MACHINE_SUITE) {
    const derived = mlDsa.fromSeed(Buffer.from(seed).toString('hex'), 'MACHINE_SIGNING', PQ_MACHINE_SUITE, input.keyId);
    if (!derived.ok) {
      throw new Error(derived.error.message);
    }
    publicKeyHex = derived.value.publicKey.publicKeyHex;
  } else if (suiteId === HYBRID_MACHINE_SUITE) {
    const classical = ed25519FromSeed(seed);
    const pq = mlDsa.fromSeed(
      Buffer.from(pqSeedFromClassicalSeed(seed)).toString('hex'),
      'MACHINE_SIGNING',
      HYBRID_MACHINE_SUITE,
      `${input.keyId}:pq`,
    );
    if (!pq.ok) {
      throw new Error(pq.error.message);
    }
    publicKeyHex = encodeHybridComponent(classical.publicKeyHex, pq.value.publicKey.publicKeyHex);
  } else {
    publicKeyHex = ed25519FromSeed(seed).publicKeyHex;
  }
  return {
    record: Object.freeze({
      keyId: input.keyId,
      purpose: MACHINE_KEY_PURPOSE,
      suiteId,
      publicKeyHex,
      version: input.version ?? 1,
      status: 'ACTIVE',
      createdAtUtc: input.createdAtUtc,
      rotatedFrom: input.rotatedFrom ?? null,
    }),
    seed,
    publicKeyHex,
  };
}

export function suiteSupportsMachineLifecycle(suiteId: string): boolean {
  return (
    suiteId === CLASSICAL_MACHINE_SUITE ||
    suiteId === HYBRID_MACHINE_SUITE ||
    suiteId === HYBRID_MACHINE_SIM_SUITE ||
    suiteId === PQ_MACHINE_SUITE
  );
}

export function nextSuiteForMigration(current: string): string {
  if (current === CLASSICAL_MACHINE_SUITE) {
    return HYBRID_MACHINE_SUITE;
  }
  if (current === HYBRID_MACHINE_SUITE || current === HYBRID_MACHINE_SIM_SUITE) {
    return PQ_MACHINE_SUITE;
  }
  return current;
}
