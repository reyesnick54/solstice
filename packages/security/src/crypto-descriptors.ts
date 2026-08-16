import type { AlgorithmId } from './algorithm-ids.ts';
import type { CryptoSuiteId } from './crypto-suite.ts';
import type { KeyPurpose } from './purposes.ts';

export type KeyId = string & { readonly __brand: 'KeyId' };
export type KeyVersion = number & { readonly __brand: 'KeyVersion' };

export function keyId(value: string): KeyId {
  if (value.length === 0) {
    throw new TypeError('KeyId must be non-empty');
  }
  return value as KeyId;
}

export function keyVersion(value: number): KeyVersion {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError('KeyVersion must be a positive integer');
  }
  return value as KeyVersion;
}

export const KEY_LIFECYCLE_STATES = [
  'PENDING',
  'ACTIVE',
  'DEPRECATED',
  'VERIFY_ONLY',
  'RETIRED',
  'REVOKED',
] as const;

export type KeyLifecycleState = (typeof KEY_LIFECYCLE_STATES)[number];

export function isKeyLifecycleState(value: unknown): value is KeyLifecycleState {
  return typeof value === 'string' && (KEY_LIFECYCLE_STATES as readonly string[]).includes(value);
}

export type PublicKeyDescriptor = {
  readonly keyId: KeyId;
  readonly keyVersion: KeyVersion;
  readonly algorithmId: AlgorithmId;
  readonly suiteId: CryptoSuiteId;
  readonly purpose: KeyPurpose;
  readonly publicKeyHex: string;
  readonly lifecycleState: KeyLifecycleState;
  readonly providerId: string;
};

export type SignatureDescriptor = {
  readonly algorithmId: AlgorithmId;
  readonly suiteId: CryptoSuiteId;
  readonly keyId: KeyId;
  readonly keyVersion: KeyVersion;
  readonly purpose: KeyPurpose;
  readonly signatureHex: string;
  readonly domain: string;
  readonly protocolVersion: string;
};

export const HYBRID_COMBINERS = ['CLASSICAL_AND_PQ'] as const;
export type HybridCombiner = (typeof HYBRID_COMBINERS)[number];

export const HYBRID_VERIFICATION_POLICIES = [
  'REQUIRE_ALL',
  'REQUIRE_CLASSICAL',
  'REQUIRE_PQ',
  'VERIFY_LEGACY_ONLY',
] as const;

export type HybridVerificationPolicy = (typeof HYBRID_VERIFICATION_POLICIES)[number];

export type HybridSignatureDescriptor = {
  readonly suiteId: CryptoSuiteId;
  readonly combiner: HybridCombiner;
  readonly verificationPolicy: HybridVerificationPolicy;
  readonly classicalAlgorithmId: AlgorithmId;
  readonly postQuantumAlgorithmId: AlgorithmId;
  readonly classicalPublicKey: PublicKeyDescriptor;
  readonly postQuantumPublicKey: PublicKeyDescriptor;
  readonly classicalSignature: SignatureDescriptor;
  readonly postQuantumSignature: SignatureDescriptor;
  readonly domain: string;
  readonly protocolVersion: string;
};

export type KemObjectDescriptor = {
  readonly algorithmId: AlgorithmId;
  readonly suiteId: CryptoSuiteId;
  readonly ciphertextHex: string;
  readonly providerId: string;
};

export function freezePublicKeyDescriptor(value: PublicKeyDescriptor): PublicKeyDescriptor {
  return Object.freeze({ ...value });
}

export function freezeSignatureDescriptor(value: SignatureDescriptor): SignatureDescriptor {
  return Object.freeze({ ...value });
}

export function freezeHybridSignatureDescriptor(
  value: HybridSignatureDescriptor,
): HybridSignatureDescriptor {
  return Object.freeze({
    ...value,
    classicalPublicKey: freezePublicKeyDescriptor(value.classicalPublicKey),
    postQuantumPublicKey: freezePublicKeyDescriptor(value.postQuantumPublicKey),
    classicalSignature: freezeSignatureDescriptor(value.classicalSignature),
    postQuantumSignature: freezeSignatureDescriptor(value.postQuantumSignature),
  });
}
