import type { EncryptedEnvelope } from './envelope.ts';
import { securityErr, type SecurityResult } from './errors.ts';
import type { KeyMetadata, KeyVersionRef } from './metadata.ts';
import type { DataKeyHandle, KeyProvider, PublicKeyMaterial, Signature } from './provider.ts';
import type { KeyPurpose } from './purposes.ts';

const UNAVAILABLE = 'cryptographic provider is unavailable; failing closed';

/**
 * Fail-closed stand-in used when a configured provider cannot be reached.
 * Every operation returns PROVIDER_UNAVAILABLE. Nothing is allowed.
 */
export class UnavailableKeyProvider implements KeyProvider {
  readonly providerId: string;
  readonly environmentLabel = 'UNAVAILABLE — fail closed';

  constructor(providerId = 'unavailable') {
    this.providerId = providerId;
  }

  sign(_purpose?: KeyPurpose, _payload?: string | Buffer, _version?: number): SecurityResult<Signature> {
    return securityErr('PROVIDER_UNAVAILABLE', UNAVAILABLE);
  }

  verify(
    _purpose?: KeyPurpose,
    _payload?: string | Buffer,
    _signature?: string,
    _version?: number,
  ): SecurityResult<KeyVersionRef> {
    return securityErr('PROVIDER_UNAVAILABLE', UNAVAILABLE);
  }

  encrypt(_purpose?: KeyPurpose, _plaintext?: Buffer): SecurityResult<EncryptedEnvelope> {
    return securityErr('PROVIDER_UNAVAILABLE', UNAVAILABLE);
  }

  decrypt(_envelope?: EncryptedEnvelope): SecurityResult<Buffer> {
    return securityErr('PROVIDER_UNAVAILABLE', UNAVAILABLE);
  }

  generateDataKey(_purpose?: KeyPurpose): SecurityResult<DataKeyHandle> {
    return securityErr('PROVIDER_UNAVAILABLE', UNAVAILABLE);
  }

  resolveKeyVersion(_purpose?: KeyPurpose, _version?: number): SecurityResult<KeyMetadata> {
    return securityErr('PROVIDER_UNAVAILABLE', UNAVAILABLE);
  }

  getPublicKey(_purpose?: KeyPurpose, _version?: number): SecurityResult<PublicKeyMaterial> {
    return securityErr('PROVIDER_UNAVAILABLE', UNAVAILABLE);
  }

  rotateKey(_purpose?: KeyPurpose): SecurityResult<KeyMetadata> {
    return securityErr('PROVIDER_UNAVAILABLE', UNAVAILABLE);
  }

  retireKey(_purpose?: KeyPurpose, _version?: number): SecurityResult<KeyMetadata> {
    return securityErr('PROVIDER_UNAVAILABLE', UNAVAILABLE);
  }

  revokeKey(_purpose?: KeyPurpose, _version?: number): SecurityResult<KeyMetadata> {
    return securityErr('PROVIDER_UNAVAILABLE', UNAVAILABLE);
  }

  activateKey(_purpose?: KeyPurpose, _version?: number): SecurityResult<KeyMetadata> {
    return securityErr('PROVIDER_UNAVAILABLE', UNAVAILABLE);
  }

  keyStatus(_purpose?: KeyPurpose, _version?: number): SecurityResult<KeyMetadata> {
    return securityErr('PROVIDER_UNAVAILABLE', UNAVAILABLE);
  }

  listKeyMetadata(_purpose?: KeyPurpose): readonly KeyMetadata[] {
    return [];
  }
}
