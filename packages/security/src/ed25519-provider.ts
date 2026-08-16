import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';

import { CLASSICAL_SIGNATURE_ALGORITHM_ID } from './algorithm-ids.ts';
import { encodeSignedBinding, type SignedBinding } from './crypto-binding.ts';
import {
  freezePublicKeyDescriptor,
  freezeSignatureDescriptor,
  keyId,
  keyVersion,
  type PublicKeyDescriptor,
  type SignatureDescriptor,
} from './crypto-descriptors.ts';
import { assertProviderPermit, CRYPTO_PROVIDER_PERMIT } from './crypto-guard.ts';
import type { GeneratedKeyPair, SignatureProvider } from './crypto-providers.ts';
import type { CryptoSuiteId } from './crypto-suite.ts';
import { securityErr, securityOk, type SecurityResult } from './errors.ts';
import type { KeyPurpose } from './purposes.ts';
import { PrivateKeyMaterial } from './redaction.ts';
import { secureRandomHex } from './random.ts';

export const ED25519_PROVIDER_ID = 'node-crypto-ed25519';
export const ED25519_ENVIRONMENT_LABEL =
  'Ed25519 via node:crypto (RFC 8032). Simulation/engineering use. Not a certification claim. Not secp256k1.';

export const ED25519_PUBLIC_KEY_BYTES = 32;
export const ED25519_SECRET_KEY_BYTES = 32;
export const ED25519_SIGNATURE_BYTES = 64;

function b64urlToBuf(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function bufToB64url(value: Buffer): string {
  return value.toString('base64url');
}

const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

function privateFromSeed(seed: Buffer, _publicRaw: Buffer) {
  return createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8',
  });
}

function publicFromRaw(publicRaw: Buffer) {
  return createPublicKey({
    key: {
      kty: 'OKP',
      crv: 'Ed25519',
      x: bufToB64url(publicRaw),
    },
    format: 'jwk',
  });
}

export class Ed25519SignatureProvider implements SignatureProvider {
  readonly providerId = ED25519_PROVIDER_ID;
  readonly algorithmId = CLASSICAL_SIGNATURE_ALGORITHM_ID;
  readonly environmentLabel = ED25519_ENVIRONMENT_LABEL;

  constructor(permit: symbol = CRYPTO_PROVIDER_PERMIT) {
    const allowed = assertProviderPermit(permit);
    if (!allowed.ok) {
      throw new Error(allowed.error.message);
    }
  }

  generateKey(
    purpose: KeyPurpose,
    suiteId: CryptoSuiteId,
    explicitKeyId?: string,
  ): SecurityResult<GeneratedKeyPair> {
    const pair = generateKeyPairSync('ed25519');
    const privJwk = pair.privateKey.export({ format: 'jwk' });
    const pubJwk = pair.publicKey.export({ format: 'jwk' });
    if (!privJwk.d || !pubJwk.x) {
      return securityErr('PROVIDER_UNAVAILABLE', 'node:crypto Ed25519 JWK export failed');
    }
    const publicRaw = b64urlToBuf(pubJwk.x);
    const secretRaw = b64urlToBuf(privJwk.d);
    if (publicRaw.length !== ED25519_PUBLIC_KEY_BYTES || secretRaw.length !== ED25519_SECRET_KEY_BYTES) {
      return securityErr('PROVIDER_UNAVAILABLE', 'unexpected Ed25519 key length');
    }
    const publicKey = freezePublicKeyDescriptor({
      keyId: keyId(explicitKeyId ?? `ed25519:${purpose.toLowerCase()}:${secureRandomHex(8)}`),
      keyVersion: keyVersion(1),
      algorithmId: this.algorithmId,
      suiteId,
      purpose,
      publicKeyHex: publicRaw.toString('hex'),
      lifecycleState: 'ACTIVE',
      providerId: this.providerId,
    });
    return securityOk({
      publicKey,
      privateKey: new PrivateKeyMaterial(secretRaw),
    });
  }

  importSeed(
    seedHex: string,
    publicHex: string,
    purpose: KeyPurpose,
    suiteId: CryptoSuiteId,
    explicitKeyId: string,
  ): SecurityResult<GeneratedKeyPair> {
    const seed = Buffer.from(seedHex, 'hex');
    const publicRaw = Buffer.from(publicHex, 'hex');
    if (seed.length !== ED25519_SECRET_KEY_BYTES || publicRaw.length !== ED25519_PUBLIC_KEY_BYTES) {
      return securityErr('UNSUPPORTED_ALGORITHM', 'Ed25519 seed/public key must be 32 bytes');
    }
    return securityOk({
      publicKey: freezePublicKeyDescriptor({
        keyId: keyId(explicitKeyId),
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
        'Ed25519 provider refuses a non-Ed25519 algorithm id; no silent fallback',
      );
    }
    if (publicKey.purpose !== binding.keyPurpose) {
      return securityErr('PURPOSE_MISMATCH', 'key purpose does not match binding purpose');
    }
    if (publicKey.suiteId !== binding.suiteId) {
      return securityErr('BINDING_MISMATCH', 'suite id does not match binding');
    }
    try {
      const seed = privateKey.reveal();
      const publicRaw = Buffer.from(publicKey.publicKeyHex, 'hex');
      const key = privateFromSeed(seed, publicRaw);
      const signature = sign(null, encodeSignedBinding(binding), key);
      if (signature.length !== ED25519_SIGNATURE_BYTES) {
        return securityErr('PROVIDER_UNAVAILABLE', 'unexpected Ed25519 signature length');
      }
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
    } catch {
      return securityErr('SIGNATURE_INVALID', 'Ed25519 sign failed');
    }
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
        'Ed25519 provider refuses a non-Ed25519 algorithm id; no silent fallback',
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
    try {
      const publicRaw = Buffer.from(publicKey.publicKeyHex, 'hex');
      const ok = verify(
        null,
        encodeSignedBinding(binding),
        publicFromRaw(publicRaw),
        Buffer.from(signature.signatureHex, 'hex'),
      );
      if (!ok) {
        return securityErr('SIGNATURE_INVALID', 'Ed25519 signature is invalid');
      }
      return securityOk(true);
    } catch {
      return securityErr('SIGNATURE_INVALID', 'Ed25519 verify failed');
    }
  }

  /**
   * RFC 8032 raw-message sign. Protocol code must use sign() with a
   * SignedBinding. This exists for known test vectors only.
   */
  signRaw(secretHex: string, publicHex: string, message: Buffer): SecurityResult<Buffer> {
    try {
      const key = privateFromSeed(Buffer.from(secretHex, 'hex'), Buffer.from(publicHex, 'hex'));
      return securityOk(sign(null, message, key));
    } catch {
      return securityErr('SIGNATURE_INVALID', 'Ed25519 raw sign failed');
    }
  }

  verifyRaw(publicHex: string, message: Buffer, signatureHex: string): SecurityResult<true> {
    try {
      const ok = verify(
        null,
        message,
        publicFromRaw(Buffer.from(publicHex, 'hex')),
        Buffer.from(signatureHex, 'hex'),
      );
      if (!ok) {
        return securityErr('SIGNATURE_INVALID', 'Ed25519 raw verify failed');
      }
      return securityOk(true);
    } catch {
      return securityErr('SIGNATURE_INVALID', 'Ed25519 raw verify failed');
    }
  }
}

export function createEd25519SignatureProvider(): Ed25519SignatureProvider {
  return new Ed25519SignatureProvider(CRYPTO_PROVIDER_PERMIT);
}
