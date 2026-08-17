/**
 * Standardized post-quantum providers for development and testnet.
 *
 * Library: @noble/post-quantum (FIPS 203/204/205). Application modules
 * must obtain these through the CryptoSuite catalog. This is not a
 * quantum-proof, production-certified, or mainnet-approved claim.
 */

import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { slh_dsa_sha2_128s } from '@noble/post-quantum/slh-dsa.js';

import type { AlgorithmId } from './algorithm-ids.ts';
import { encodeSignedBinding, type SignedBinding } from './crypto-binding.ts';
import {
  freezePublicKeyDescriptor,
  freezeSignatureDescriptor,
  keyId,
  keyVersion,
  type KemObjectDescriptor,
  type PublicKeyDescriptor,
  type SignatureDescriptor,
} from './crypto-descriptors.ts';
import { assertProviderPermit, CRYPTO_PROVIDER_PERMIT } from './crypto-guard.ts';
import type {
  GeneratedKeyPair,
  KemProvider,
  SharedSecretHandle,
  SignatureProvider,
} from './crypto-providers.ts';
import type { CryptoSuiteId } from './crypto-suite.ts';
import { securityErr, securityOk, type SecurityResult } from './errors.ts';
import type { KeyPurpose } from './purposes.ts';
import { secureRandomHex } from './random.ts';
import { PrivateKeyMaterial } from './redaction.ts';
import {
  ML_DSA_65_V1_PUBLIC_KEY_BYTES,
  ML_DSA_65_V1_SECRET_KEY_BYTES,
  ML_DSA_65_V1_SEED_BYTES,
  ML_DSA_65_V1_SIGNATURE_BYTES,
  ML_KEM_768_V1_CIPHERTEXT_BYTES,
  ML_KEM_768_V1_PUBLIC_KEY_BYTES,
  ML_KEM_768_V1_SECRET_KEY_BYTES,
  ML_KEM_768_V1_SEED_BYTES,
  SLH_DSA_SHA2_128S_V1_PUBLIC_KEY_BYTES,
  SLH_DSA_SHA2_128S_V1_SECRET_KEY_BYTES,
  SLH_DSA_SHA2_128S_V1_SEED_BYTES,
  SLH_DSA_SHA2_128S_V1_SIGNATURE_BYTES,
} from './pq-sizes.ts';

export const NOBLE_PQ_PROVIDER_ID = 'noble-post-quantum-0.5.4';
export const NOBLE_PQ_ENVIRONMENT_LABEL =
  'Standardized FIPS 203/204/205 implementation via @noble/post-quantum 0.5.4. Development and testnet only. Not production-approved. Not a certified HSM. Not quantum-proof.';

export const ML_DSA_65_V1 = 'ML_DSA_65_V1' as const;
export const ML_KEM_768_V1 = 'ML_KEM_768_V1' as const;
export const SLH_DSA_SHA2_128S_V1 = 'SLH_DSA_SHA2_128S_V1' as const;

type DsaImpl = {
  readonly lengths: { readonly publicKey?: number; readonly secretKey?: number; readonly seed?: number; readonly signature?: number };
  keygen(seed?: Uint8Array): { secretKey: Uint8Array; publicKey: Uint8Array };
  sign(msg: Uint8Array, secretKey: Uint8Array, opts?: { extraEntropy?: false }): Uint8Array;
  verify(sig: Uint8Array, msg: Uint8Array, publicKey: Uint8Array): boolean;
};

function hexToBytes(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export class StandardizedPqSignatureProvider implements SignatureProvider {
  readonly providerId = NOBLE_PQ_PROVIDER_ID;
  readonly environmentLabel = NOBLE_PQ_ENVIRONMENT_LABEL;
  readonly algorithmId: AlgorithmId;
  readonly #impl: DsaImpl;
  readonly #publicBytes: number;
  readonly #secretBytes: number;
  readonly #seedBytes: number;
  readonly #signatureBytes: number;
  #available: boolean;

  constructor(
    algorithmId: AlgorithmId,
    impl: DsaImpl,
    sizes: {
      readonly publicBytes: number;
      readonly secretBytes: number;
      readonly seedBytes: number;
      readonly signatureBytes: number;
    },
    permit: symbol = CRYPTO_PROVIDER_PERMIT,
    available = true,
  ) {
    const allowed = assertProviderPermit(permit);
    if (!allowed.ok) {
      throw new Error(allowed.error.message);
    }
    this.algorithmId = algorithmId;
    this.#impl = impl;
    this.#publicBytes = sizes.publicBytes;
    this.#secretBytes = sizes.secretBytes;
    this.#seedBytes = sizes.seedBytes;
    this.#signatureBytes = sizes.signatureBytes;
    this.#available = available;
  }

  markUnavailable(): void {
    this.#available = false;
  }

  markAvailable(): void {
    this.#available = true;
  }

  get available(): boolean {
    return this.#available;
  }

  generateKey(
    purpose: KeyPurpose,
    suiteId: CryptoSuiteId,
    explicitKeyId?: string,
  ): SecurityResult<GeneratedKeyPair> {
    if (!this.#available) {
      return securityErr('PROVIDER_UNAVAILABLE', `${this.algorithmId} provider is unavailable; fail closed`);
    }
    try {
      const keys = this.#impl.keygen();
      return this.#import(keys.secretKey, keys.publicKey, purpose, suiteId, explicitKeyId);
    } catch {
      return securityErr('PROVIDER_UNAVAILABLE', `${this.algorithmId} key generation failed; fail closed`);
    }
  }

  fromSeed(
    seedHex: string,
    purpose: KeyPurpose,
    suiteId: CryptoSuiteId,
    explicitKeyId: string,
  ): SecurityResult<GeneratedKeyPair> {
    if (!this.#available) {
      return securityErr('PROVIDER_UNAVAILABLE', `${this.algorithmId} provider is unavailable; fail closed`);
    }
    const seed = hexToBytes(seedHex);
    if (seed.length !== this.#seedBytes) {
      return securityErr(
        'UNSUPPORTED_ALGORITHM',
        `${this.algorithmId} seed must be ${this.#seedBytes} bytes`,
      );
    }
    try {
      const keys = this.#impl.keygen(seed);
      return this.#import(keys.secretKey, keys.publicKey, purpose, suiteId, explicitKeyId);
    } catch {
      return securityErr('PROVIDER_UNAVAILABLE', `${this.algorithmId} fromSeed failed; fail closed`);
    }
  }

  signRaw(secretHex: string, publicHex: string, message: Buffer): SecurityResult<Buffer> {
    if (!this.#available) {
      return securityErr('PROVIDER_UNAVAILABLE', `${this.algorithmId} provider is unavailable; fail closed`);
    }
    const secret = hexToBytes(secretHex);
    const publicKey = hexToBytes(publicHex);
    if (secret.length !== this.#secretBytes || publicKey.length !== this.#publicBytes) {
      return securityErr('UNSUPPORTED_ALGORITHM', `${this.algorithmId} key length is invalid`);
    }
    try {
      const signature = this.#impl.sign(message, secret, { extraEntropy: false });
      if (signature.length !== this.#signatureBytes) {
        return securityErr('PROVIDER_UNAVAILABLE', `${this.algorithmId} produced an unexpected signature length`);
      }
      return securityOk(Buffer.from(signature));
    } catch {
      return securityErr('SIGNATURE_INVALID', `${this.algorithmId} raw sign failed`);
    }
  }

  verifyRaw(publicHex: string, message: Buffer, signatureHex: string): SecurityResult<true> {
    if (!this.#available) {
      return securityErr('PROVIDER_UNAVAILABLE', `${this.algorithmId} provider is unavailable; fail closed`);
    }
    const publicKey = hexToBytes(publicHex);
    const signature = hexToBytes(signatureHex);
    if (publicKey.length !== this.#publicBytes) {
      return securityErr('UNSUPPORTED_ALGORITHM', `${this.algorithmId} public key length is invalid`);
    }
    if (signature.length !== this.#signatureBytes) {
      return securityErr('SIGNATURE_INVALID', `${this.algorithmId} signature length is invalid`);
    }
    try {
      if (!this.#impl.verify(signature, message, publicKey)) {
        return securityErr('SIGNATURE_INVALID', `${this.algorithmId} raw signature is invalid`);
      }
      return securityOk(true);
    } catch {
      return securityErr('SIGNATURE_INVALID', `${this.algorithmId} raw verify failed`);
    }
  }

  sign(
    privateKey: PrivateKeyMaterial,
    publicKey: PublicKeyDescriptor,
    binding: SignedBinding,
  ): SecurityResult<SignatureDescriptor> {
    if (!this.#available) {
      return securityErr('PROVIDER_UNAVAILABLE', `${this.algorithmId} provider is unavailable; fail closed`);
    }
    if (publicKey.algorithmId !== this.algorithmId || binding.algorithmId !== this.algorithmId) {
      return securityErr(
        'PROVIDER_ALGORITHM_MISMATCH',
        `${this.algorithmId} refuses another algorithm id; no silent fallback`,
      );
    }
    if (publicKey.purpose !== binding.keyPurpose) {
      return securityErr('PURPOSE_MISMATCH', 'key purpose does not match binding purpose');
    }
    if (publicKey.suiteId !== binding.suiteId) {
      return securityErr('BINDING_MISMATCH', 'suite id does not match binding');
    }
    const secret = privateKey.reveal();
    const publicRaw = hexToBytes(publicKey.publicKeyHex);
    if (secret.length !== this.#secretBytes || publicRaw.length !== this.#publicBytes) {
      return securityErr('UNSUPPORTED_ALGORITHM', `${this.algorithmId} key encoding is invalid`);
    }
    try {
      const signature = this.#impl.sign(encodeSignedBinding(binding), secret, { extraEntropy: false });
      if (signature.length !== this.#signatureBytes) {
        return securityErr('PROVIDER_UNAVAILABLE', `${this.algorithmId} produced an unexpected signature length`);
      }
      return securityOk(
        freezeSignatureDescriptor({
          algorithmId: this.algorithmId,
          suiteId: publicKey.suiteId,
          keyId: publicKey.keyId,
          keyVersion: publicKey.keyVersion,
          purpose: publicKey.purpose,
          signatureHex: bytesToHex(signature),
          domain: binding.messageDomain,
          protocolVersion: binding.protocolVersion,
        }),
      );
    } catch {
      return securityErr('SIGNATURE_INVALID', `${this.algorithmId} sign failed`);
    }
  }

  verify(
    publicKey: PublicKeyDescriptor,
    binding: SignedBinding,
    signature: SignatureDescriptor,
  ): SecurityResult<true> {
    if (!this.#available) {
      return securityErr('PROVIDER_UNAVAILABLE', `${this.algorithmId} provider is unavailable; fail closed`);
    }
    if (
      publicKey.algorithmId !== this.algorithmId ||
      signature.algorithmId !== this.algorithmId ||
      binding.algorithmId !== this.algorithmId
    ) {
      return securityErr(
        'PROVIDER_ALGORITHM_MISMATCH',
        `${this.algorithmId} refuses another algorithm id; no silent fallback`,
      );
    }
    if (signature.purpose !== binding.keyPurpose || publicKey.purpose !== binding.keyPurpose) {
      return securityErr('PURPOSE_MISMATCH', 'signature or key purpose does not match binding');
    }
    if (signature.domain !== binding.messageDomain) {
      return securityErr('BINDING_MISMATCH', 'signature domain does not match binding');
    }
    if (signature.suiteId !== binding.suiteId || publicKey.suiteId !== binding.suiteId) {
      return securityErr('BINDING_MISMATCH', 'suite id does not match binding');
    }
    const publicRaw = hexToBytes(publicKey.publicKeyHex);
    const signatureRaw = hexToBytes(signature.signatureHex);
    if (publicRaw.length !== this.#publicBytes) {
      return securityErr('UNSUPPORTED_ALGORITHM', `${this.algorithmId} public key length is invalid`);
    }
    if (signatureRaw.length !== this.#signatureBytes) {
      return securityErr('SIGNATURE_INVALID', `${this.algorithmId} signature length is invalid`);
    }
    try {
      if (!this.#impl.verify(signatureRaw, encodeSignedBinding(binding), publicRaw)) {
        return securityErr('SIGNATURE_INVALID', `${this.algorithmId} signature is invalid`);
      }
      return securityOk(true);
    } catch {
      return securityErr('SIGNATURE_INVALID', `${this.algorithmId} verify failed`);
    }
  }

  #import(
    secret: Uint8Array,
    publicKey: Uint8Array,
    purpose: KeyPurpose,
    suiteId: CryptoSuiteId,
    explicitKeyId?: string,
  ): SecurityResult<GeneratedKeyPair> {
    if (secret.length !== this.#secretBytes || publicKey.length !== this.#publicBytes) {
      return securityErr('PROVIDER_UNAVAILABLE', `${this.algorithmId} produced unexpected key lengths`);
    }
    return securityOk({
      publicKey: freezePublicKeyDescriptor({
        keyId: keyId(explicitKeyId ?? `pq:${this.algorithmId.toLowerCase()}:${purpose.toLowerCase()}:${secureRandomHex(8)}`),
        keyVersion: keyVersion(1),
        algorithmId: this.algorithmId,
        suiteId,
        purpose,
        publicKeyHex: bytesToHex(publicKey),
        lifecycleState: 'ACTIVE',
        providerId: this.providerId,
      }),
      privateKey: new PrivateKeyMaterial(Buffer.from(secret)),
    });
  }
}

export class StandardizedMlKemProvider implements KemProvider {
  readonly providerId = NOBLE_PQ_PROVIDER_ID;
  readonly environmentLabel = NOBLE_PQ_ENVIRONMENT_LABEL;
  readonly algorithmId: AlgorithmId = ML_KEM_768_V1;
  #available: boolean;

  constructor(permit: symbol = CRYPTO_PROVIDER_PERMIT, available = true) {
    const allowed = assertProviderPermit(permit);
    if (!allowed.ok) {
      throw new Error(allowed.error.message);
    }
    this.#available = available;
  }

  markUnavailable(): void {
    this.#available = false;
  }

  generateKey(
    purpose: KeyPurpose,
    suiteId: CryptoSuiteId,
    explicitKeyId?: string,
  ): SecurityResult<GeneratedKeyPair> {
    if (!this.#available) {
      return securityErr('PROVIDER_UNAVAILABLE', 'ML_KEM_768_V1 provider is unavailable; fail closed');
    }
    try {
      const keys = ml_kem768.keygen();
      if (keys.secretKey.length !== ML_KEM_768_V1_SECRET_KEY_BYTES || keys.publicKey.length !== ML_KEM_768_V1_PUBLIC_KEY_BYTES) {
        return securityErr('PROVIDER_UNAVAILABLE', 'ML_KEM_768_V1 produced unexpected key lengths');
      }
      return securityOk({
        publicKey: freezePublicKeyDescriptor({
          keyId: keyId(explicitKeyId ?? `pq:mlkem768:${purpose.toLowerCase()}:${secureRandomHex(8)}`),
          keyVersion: keyVersion(1),
          algorithmId: this.algorithmId,
          suiteId,
          purpose,
          publicKeyHex: bytesToHex(keys.publicKey),
          lifecycleState: 'ACTIVE',
          providerId: this.providerId,
        }),
        privateKey: new PrivateKeyMaterial(Buffer.from(keys.secretKey)),
      });
    } catch {
      return securityErr('PROVIDER_UNAVAILABLE', 'ML_KEM_768_V1 key generation failed; fail closed');
    }
  }

  encapsulate(
    publicKey: PublicKeyDescriptor,
    suiteId: CryptoSuiteId,
  ): SecurityResult<{ readonly kem: KemObjectDescriptor; readonly sharedSecret: SharedSecretHandle }> {
    if (!this.#available) {
      return securityErr('PROVIDER_UNAVAILABLE', 'ML_KEM_768_V1 provider is unavailable; fail closed');
    }
    if (publicKey.algorithmId !== this.algorithmId && publicKey.algorithmId !== 'ML-KEM-768') {
      return securityErr('PROVIDER_ALGORITHM_MISMATCH', 'ML_KEM_768_V1 refuses another algorithm id');
    }
    const publicRaw = hexToBytes(publicKey.publicKeyHex);
    if (publicRaw.length !== ML_KEM_768_V1_PUBLIC_KEY_BYTES) {
      return securityErr('UNSUPPORTED_ALGORITHM', 'ML_KEM_768_V1 public key length is invalid');
    }
    try {
      const result = ml_kem768.encapsulate(publicRaw);
      if (result.cipherText.length !== ML_KEM_768_V1_CIPHERTEXT_BYTES) {
        return securityErr('PROVIDER_UNAVAILABLE', 'ML_KEM_768_V1 produced unexpected ciphertext length');
      }
      return securityOk({
        kem: Object.freeze({
          algorithmId: this.algorithmId,
          suiteId,
          ciphertextHex: bytesToHex(result.cipherText),
          providerId: this.providerId,
        }),
        sharedSecret: Object.freeze({
          algorithmId: this.algorithmId,
          sharedSecretHex: bytesToHex(result.sharedSecret),
        }),
      });
    } catch {
      return securityErr('CIPHERTEXT_MALFORMED', 'ML_KEM_768_V1 encapsulate failed');
    }
  }

  decapsulate(
    privateKey: PrivateKeyMaterial,
    publicKey: PublicKeyDescriptor,
    kem: KemObjectDescriptor,
  ): SecurityResult<SharedSecretHandle> {
    if (!this.#available) {
      return securityErr('PROVIDER_UNAVAILABLE', 'ML_KEM_768_V1 provider is unavailable; fail closed');
    }
    if (
      (publicKey.algorithmId !== this.algorithmId && publicKey.algorithmId !== 'ML-KEM-768') ||
      (kem.algorithmId !== this.algorithmId && kem.algorithmId !== 'ML-KEM-768')
    ) {
      return securityErr('PROVIDER_ALGORITHM_MISMATCH', 'ML_KEM_768_V1 refuses another algorithm id');
    }
    const secret = privateKey.reveal();
    const ciphertext = hexToBytes(kem.ciphertextHex);
    if (secret.length !== ML_KEM_768_V1_SECRET_KEY_BYTES) {
      return securityErr('UNSUPPORTED_ALGORITHM', 'ML_KEM_768_V1 secret key length is invalid');
    }
    if (ciphertext.length !== ML_KEM_768_V1_CIPHERTEXT_BYTES) {
      return securityErr('CIPHERTEXT_MALFORMED', 'ML_KEM_768_V1 ciphertext length is invalid');
    }
    try {
      const shared = ml_kem768.decapsulate(ciphertext, secret);
      return securityOk({
        algorithmId: this.algorithmId,
        sharedSecretHex: bytesToHex(shared),
      });
    } catch {
      return securityErr('AUTHENTICATION_FAILED', 'ML_KEM_768_V1 decapsulate failed');
    }
  }

  fromSeed(
    seedHex: string,
    purpose: KeyPurpose,
    suiteId: CryptoSuiteId,
    explicitKeyId: string,
  ): SecurityResult<GeneratedKeyPair> {
    if (!this.#available) {
      return securityErr('PROVIDER_UNAVAILABLE', 'ML_KEM_768_V1 provider is unavailable; fail closed');
    }
    const seed = hexToBytes(seedHex);
    if (seed.length !== ML_KEM_768_V1_SEED_BYTES) {
      return securityErr('UNSUPPORTED_ALGORITHM', `ML_KEM_768_V1 seed must be ${ML_KEM_768_V1_SEED_BYTES} bytes`);
    }
    try {
      const keys = ml_kem768.keygen(seed);
      return securityOk({
        publicKey: freezePublicKeyDescriptor({
          keyId: keyId(explicitKeyId),
          keyVersion: keyVersion(1),
          algorithmId: this.algorithmId,
          suiteId,
          purpose,
          publicKeyHex: bytesToHex(keys.publicKey),
          lifecycleState: 'ACTIVE',
          providerId: this.providerId,
        }),
        privateKey: new PrivateKeyMaterial(Buffer.from(keys.secretKey)),
      });
    } catch {
      return securityErr('PROVIDER_UNAVAILABLE', 'ML_KEM_768_V1 fromSeed failed; fail closed');
    }
  }
}

export function createMlDsa65Provider(available = true): StandardizedPqSignatureProvider {
  return new StandardizedPqSignatureProvider(
    ML_DSA_65_V1,
    ml_dsa65,
    {
      publicBytes: ML_DSA_65_V1_PUBLIC_KEY_BYTES,
      secretBytes: ML_DSA_65_V1_SECRET_KEY_BYTES,
      seedBytes: ML_DSA_65_V1_SEED_BYTES,
      signatureBytes: ML_DSA_65_V1_SIGNATURE_BYTES,
    },
    CRYPTO_PROVIDER_PERMIT,
    available,
  );
}

export function createSlhDsaSha2128sProvider(available = true): StandardizedPqSignatureProvider {
  return new StandardizedPqSignatureProvider(
    SLH_DSA_SHA2_128S_V1,
    slh_dsa_sha2_128s,
    {
      publicBytes: SLH_DSA_SHA2_128S_V1_PUBLIC_KEY_BYTES,
      secretBytes: SLH_DSA_SHA2_128S_V1_SECRET_KEY_BYTES,
      seedBytes: SLH_DSA_SHA2_128S_V1_SEED_BYTES,
      signatureBytes: SLH_DSA_SHA2_128S_V1_SIGNATURE_BYTES,
    },
    CRYPTO_PROVIDER_PERMIT,
    available,
  );
}

export function createMlKem768Provider(available = true): StandardizedMlKemProvider {
  return new StandardizedMlKemProvider(CRYPTO_PROVIDER_PERMIT, available);
}

export const STANDARDIZED_PQ_ZEROIZATION_NOTE =
  'PrivateKeyMaterial is wiped on dispose where callers invoke it. @noble/post-quantum 0.5.4 does not guarantee secure zeroization of intermediate JS allocations. Do not claim guaranteed zeroization.';
