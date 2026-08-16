import type { AlgorithmId } from './algorithm-ids.ts';
import type { SignedBinding } from './crypto-binding.ts';
import type {
  KemObjectDescriptor,
  PublicKeyDescriptor,
  SignatureDescriptor,
} from './crypto-descriptors.ts';
import type { CryptoSuiteId } from './crypto-suite.ts';
import type { SecurityResult } from './errors.ts';
import type { KeyPurpose } from './purposes.ts';
import type { PrivateKeyMaterial } from './redaction.ts';

export type GeneratedKeyPair = {
  readonly publicKey: PublicKeyDescriptor;
  readonly privateKey: PrivateKeyMaterial;
};

export type SignatureProvider = {
  readonly providerId: string;
  readonly algorithmId: AlgorithmId;
  readonly environmentLabel: string;
  generateKey(
    purpose: KeyPurpose,
    suiteId: CryptoSuiteId,
    keyId?: string,
  ): SecurityResult<GeneratedKeyPair>;
  sign(
    privateKey: PrivateKeyMaterial,
    publicKey: PublicKeyDescriptor,
    binding: SignedBinding,
  ): SecurityResult<SignatureDescriptor>;
  verify(
    publicKey: PublicKeyDescriptor,
    binding: SignedBinding,
    signature: SignatureDescriptor,
  ): SecurityResult<true>;
};

export type SharedSecretHandle = {
  readonly algorithmId: AlgorithmId;
  readonly sharedSecretHex: string;
};

export type KemProvider = {
  readonly providerId: string;
  readonly algorithmId: AlgorithmId;
  readonly environmentLabel: string;
  generateKey(
    purpose: KeyPurpose,
    suiteId: CryptoSuiteId,
    keyId?: string,
  ): SecurityResult<GeneratedKeyPair>;
  encapsulate(
    publicKey: PublicKeyDescriptor,
    suiteId: CryptoSuiteId,
  ): SecurityResult<{ readonly kem: KemObjectDescriptor; readonly sharedSecret: SharedSecretHandle }>;
  decapsulate(
    privateKey: PrivateKeyMaterial,
    publicKey: PublicKeyDescriptor,
    kem: KemObjectDescriptor,
  ): SecurityResult<SharedSecretHandle>;
};

export type ProviderCatalog = {
  signature(algorithmId: AlgorithmId): SecurityResult<SignatureProvider>;
  kem(algorithmId: AlgorithmId): SecurityResult<KemProvider>;
};
