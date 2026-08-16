import { createHmac, createHash } from 'node:crypto';

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
import { PQC_LIBRARY_SELECTION } from './pqc-library-selection.ts';
import type { KeyPurpose } from './purposes.ts';
import { secureRandomBytes, secureRandomHex } from './random.ts';
import { PrivateKeyMaterial } from './redaction.ts';

export const SIMULATION_PQ_PROVIDER_ID = 'simulation-pq-placeholder';
export const SIMULATION_PQ_ENVIRONMENT_LABEL =
  'TEST_ONLY simulation/test double — NOT post-quantum cryptography, NOT ML-DSA/ML-KEM/SLH-DSA, NOT production, NOT certified.';

const SIM_SIGN_ALGS = new Set<AlgorithmId>([
  'SIMULATION-ML-DSA-65',
  'SIMULATION-SLH-DSA-SHA2-128S',
]);
const SIM_KEM_ALGS = new Set<AlgorithmId>(['SIMULATION-ML-KEM-768']);

function hash(data: Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

/**
 * Deterministic simulation/test provider for PQ family ports.
 *
 * Uses node:crypto HMAC/SHA-256 only. This is not ML-DSA, ML-KEM, or
 * SLH-DSA. Real NIST algorithm IDs fail closed here.
 */
export class SimulationPqSignatureProvider implements SignatureProvider {
  readonly providerId = SIMULATION_PQ_PROVIDER_ID;
  readonly environmentLabel = SIMULATION_PQ_ENVIRONMENT_LABEL;
  readonly algorithmId: AlgorithmId;
  readonly librarySelection = PQC_LIBRARY_SELECTION.status;

  constructor(algorithmId: AlgorithmId, permit: symbol = CRYPTO_PROVIDER_PERMIT) {
    const allowed = assertProviderPermit(permit);
    if (!allowed.ok) {
      throw new Error(allowed.error.message);
    }
    if (!SIM_SIGN_ALGS.has(algorithmId)) {
      throw new Error(
        `SimulationPqSignatureProvider refuses ${algorithmId}; real PQ IDs have no production provider`,
      );
    }
    this.algorithmId = algorithmId;
  }

  generateKey(
    purpose: KeyPurpose,
    suiteId: CryptoSuiteId,
    explicitKeyId?: string,
  ): SecurityResult<GeneratedKeyPair> {
    const seed = secureRandomBytes(32);
    const publicRaw = hash(Buffer.concat([Buffer.from('sim-pq-pub', 'utf8'), seed]));
    return securityOk({
      publicKey: freezePublicKeyDescriptor({
        keyId: keyId(explicitKeyId ?? `sim-pq:${purpose.toLowerCase()}:${secureRandomHex(8)}`),
        keyVersion: keyVersion(1),
        algorithmId: this.algorithmId,
        suiteId,
        purpose,
        publicKeyHex: publicRaw.toString('hex'),
        lifecycleState: 'ACTIVE',
        providerId: this.providerId,
      }),
      privateKey: new PrivateKeyMaterial(seed),
    });
  }

  sign(
    privateKey: PrivateKeyMaterial,
    publicKey: PublicKeyDescriptor,
    binding: SignedBinding,
  ): SecurityResult<SignatureDescriptor> {
    if (publicKey.algorithmId !== this.algorithmId || binding.algorithmId !== this.algorithmId) {
      return securityErr(
        'PROVIDER_ALGORITHM_MISMATCH',
        'simulation PQ provider refuses another algorithm id; no silent fallback',
      );
    }
    if (publicKey.purpose !== binding.keyPurpose) {
      return securityErr('PURPOSE_MISMATCH', 'key purpose does not match binding purpose');
    }
    const expectedPub = hash(Buffer.concat([Buffer.from('sim-pq-pub', 'utf8'), privateKey.reveal()]));
    if (!expectedPub.equals(Buffer.from(publicKey.publicKeyHex, 'hex'))) {
      return securityErr('AUTHENTICATION_FAILED', 'simulation PQ public key does not match private seed');
    }
    const signature = createHmac('sha256', Buffer.from(publicKey.publicKeyHex, 'hex'))
      .update(encodeSignedBinding(binding))
      .digest();
    return securityOk(
      freezeSignatureDescriptor({
        algorithmId: this.algorithmId,
        suiteId: publicKey.suiteId,
        keyId: publicKey.keyId,
        keyVersion: publicKey.keyVersion,
        purpose: publicKey.purpose,
        signatureHex: signature.toString('hex'),
        domain: binding.messageDomain,
        protocolVersion: binding.protocolVersion,
      }),
    );
  }

  verify(
    publicKey: PublicKeyDescriptor,
    binding: SignedBinding,
    signature: SignatureDescriptor,
  ): SecurityResult<true> {
    if (
      publicKey.algorithmId !== this.algorithmId ||
      signature.algorithmId !== this.algorithmId ||
      binding.algorithmId !== this.algorithmId
    ) {
      return securityErr(
        'PROVIDER_ALGORITHM_MISMATCH',
        'simulation PQ provider refuses another algorithm id; no silent fallback',
      );
    }
    if (signature.purpose !== binding.keyPurpose || publicKey.purpose !== binding.keyPurpose) {
      return securityErr('PURPOSE_MISMATCH', 'signature or key purpose does not match binding');
    }
    if (signature.domain !== binding.messageDomain) {
      return securityErr('BINDING_MISMATCH', 'signature domain does not match binding');
    }
    const expected = createHmac('sha256', Buffer.from(publicKey.publicKeyHex, 'hex'))
      .update(encodeSignedBinding(binding))
      .digest();
    const provided = Buffer.from(signature.signatureHex, 'hex');
    if (expected.length !== provided.length || !expected.equals(provided)) {
      return securityErr('SIGNATURE_INVALID', 'simulation PQ signature is invalid');
    }
    return securityOk(true);
  }
}

/**
 * Sign and verify must use the same construction. The first verify
 * attempt above is wrong if sign uses the private seed. Fix: sign
 * with a public-verifiable commitment (HMAC of binding under a key
 * derived from seed, and also store a check MAC under the public key
 * is not possible without the seed).
 *
 * Correct test-double: HMAC-SHA256(seed, binding) and verify by
 * recomputing from the seed. Verification without the seed is not
 * offered — callers must use verifyFromSeed in tests? That's not a
 * public-key scheme.
 *
 * Better: HMAC-SHA256(SHA-256(seed) which IS the public key, binding)
 * so verify can use the public key. generateKey already sets
 * public = SHA-256("sim-pq-pub" || seed). Sign should MAC with that
 * public value so verify is public.
 */
export function createSimulationPqSignatureProvider(
  algorithmId: AlgorithmId = 'SIMULATION-ML-DSA-65',
): SimulationPqSignatureProvider {
  return new SimulationPqSignatureProvider(algorithmId, CRYPTO_PROVIDER_PERMIT);
}

export class SimulationPqKemProvider implements KemProvider {
  readonly providerId = SIMULATION_PQ_PROVIDER_ID;
  readonly environmentLabel = SIMULATION_PQ_ENVIRONMENT_LABEL;
  readonly algorithmId: AlgorithmId;

  constructor(algorithmId: AlgorithmId = 'SIMULATION-ML-KEM-768', permit: symbol = CRYPTO_PROVIDER_PERMIT) {
    const allowed = assertProviderPermit(permit);
    if (!allowed.ok) {
      throw new Error(allowed.error.message);
    }
    if (!SIM_KEM_ALGS.has(algorithmId)) {
      throw new Error(
        `SimulationPqKemProvider refuses ${algorithmId}; real ML-KEM has no production provider`,
      );
    }
    this.algorithmId = algorithmId;
  }

  generateKey(
    purpose: KeyPurpose,
    suiteId: CryptoSuiteId,
    explicitKeyId?: string,
  ): SecurityResult<GeneratedKeyPair> {
    const seed = secureRandomBytes(32);
    const publicRaw = hash(Buffer.concat([Buffer.from('sim-kem-pub', 'utf8'), seed]));
    return securityOk({
      publicKey: freezePublicKeyDescriptor({
        keyId: keyId(explicitKeyId ?? `sim-kem:${purpose.toLowerCase()}:${secureRandomHex(8)}`),
        keyVersion: keyVersion(1),
        algorithmId: this.algorithmId,
        suiteId,
        purpose,
        publicKeyHex: publicRaw.toString('hex'),
        lifecycleState: 'ACTIVE',
        providerId: this.providerId,
      }),
      privateKey: new PrivateKeyMaterial(seed),
    });
  }

  encapsulate(
    publicKey: PublicKeyDescriptor,
    suiteId: CryptoSuiteId,
  ): SecurityResult<{ readonly kem: KemObjectDescriptor; readonly sharedSecret: SharedSecretHandle }> {
    if (publicKey.algorithmId !== this.algorithmId) {
      return securityErr(
        'PROVIDER_ALGORITHM_MISMATCH',
        'simulation KEM refuses another algorithm id; no silent fallback',
      );
    }
    const ephemeral = secureRandomBytes(32);
    const ciphertext = hash(
      Buffer.concat([Buffer.from('sim-kem-ct', 'utf8'), Buffer.from(publicKey.publicKeyHex, 'hex'), ephemeral]),
    );
    const sharedSecret = hash(
      Buffer.concat([Buffer.from('sim-kem-ss', 'utf8'), Buffer.from(publicKey.publicKeyHex, 'hex'), ephemeral]),
    );
    return securityOk({
      kem: Object.freeze({
        algorithmId: this.algorithmId,
        suiteId,
        ciphertextHex: Buffer.concat([ciphertext, ephemeral]).toString('hex'),
        providerId: this.providerId,
      }),
      sharedSecret: Object.freeze({
        algorithmId: this.algorithmId,
        sharedSecretHex: sharedSecret.toString('hex'),
      }),
    });
  }

  decapsulate(
    privateKey: PrivateKeyMaterial,
    publicKey: PublicKeyDescriptor,
    kem: KemObjectDescriptor,
  ): SecurityResult<SharedSecretHandle> {
    if (publicKey.algorithmId !== this.algorithmId || kem.algorithmId !== this.algorithmId) {
      return securityErr(
        'PROVIDER_ALGORITHM_MISMATCH',
        'simulation KEM refuses another algorithm id; no silent fallback',
      );
    }
    const raw = Buffer.from(kem.ciphertextHex, 'hex');
    if (raw.length !== 64) {
      return securityErr('CIPHERTEXT_MALFORMED', 'simulation KEM ciphertext malformed');
    }
    const expectedPub = hash(Buffer.concat([Buffer.from('sim-kem-pub', 'utf8'), privateKey.reveal()]));
    if (!expectedPub.equals(Buffer.from(publicKey.publicKeyHex, 'hex'))) {
      return securityErr('AUTHENTICATION_FAILED', 'simulation KEM public key does not match private seed');
    }
    const ephemeral = raw.subarray(32);
    const ciphertext = raw.subarray(0, 32);
    const expectedCt = hash(
      Buffer.concat([Buffer.from('sim-kem-ct', 'utf8'), Buffer.from(publicKey.publicKeyHex, 'hex'), ephemeral]),
    );
    if (!expectedCt.equals(ciphertext)) {
      return securityErr('AUTHENTICATION_FAILED', 'simulation KEM ciphertext check failed');
    }
    const sharedSecret = hash(
      Buffer.concat([Buffer.from('sim-kem-ss', 'utf8'), Buffer.from(publicKey.publicKeyHex, 'hex'), ephemeral]),
    );
    return securityOk({
      algorithmId: this.algorithmId,
      sharedSecretHex: sharedSecret.toString('hex'),
    });
  }
}

export function createSimulationPqKemProvider(): SimulationPqKemProvider {
  return new SimulationPqKemProvider('SIMULATION-ML-KEM-768', CRYPTO_PROVIDER_PERMIT);
}
