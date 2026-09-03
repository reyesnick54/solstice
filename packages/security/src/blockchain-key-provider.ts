// @ts-nocheck
/**
 * Secure key provider abstraction for blockchain signing.
 *
 * Backend categories:
 * - DEVELOPMENT_SOFTWARE — labeled test/dev fixture store
 * - ENVIRONMENT_SECRET — secret-reference backed store
 * - KMS_HSM — non-exportable HSM/KMS adapter
 *
 * Production mode fails closed when a configured secure provider is
 * unavailable. There is no silent fallback to plaintext file keys.
 */

import type { PublicKeyDescriptor, SignatureDescriptor } from './crypto-descriptors.ts';
import type { CryptoSuiteId } from './crypto-suite.ts';
import { securityErr, securityOk, type SecurityResult } from './errors.ts';
import {
  assertTransition,
  canSignOrEncrypt,
  canVerifyOrDecrypt,
  type KeyStatus,
} from './lifecycle.ts';
import type { KeyMetadata } from './metadata.ts';
import type { KeyPurpose } from './purposes.ts';
import { PrivateKeyMaterial } from './redaction.ts';

export const BLOCKCHAIN_KEY_BACKEND_KINDS = [
  'DEVELOPMENT_SOFTWARE',
  'ENVIRONMENT_SECRET',
  'KMS_HSM',
] as const;

export type BlockchainKeyBackendKind = (typeof BLOCKCHAIN_KEY_BACKEND_KINDS)[number];

export type BlockchainKeyHandle = {
  readonly keyId: string;
  readonly keyVersion: number;
  readonly purpose: KeyPurpose;
  readonly suiteId: CryptoSuiteId;
  readonly backendKind: BlockchainKeyBackendKind;
  readonly exportable: boolean;
  readonly publicKey: PublicKeyDescriptor;
};

export type BlockchainSignRequest = {
  readonly purpose: KeyPurpose;
  readonly keyId: string;
  readonly keyVersion?: number;
  readonly domain: string;
  readonly payload: Uint8Array | Buffer;
  readonly networkId: string;
  readonly chainId: string;
  readonly protocolVersion: string;
};

export type BlockchainKeyRotationEvent = {
  readonly keyId: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly fromStatus: KeyStatus;
  readonly toStatus: KeyStatus;
  readonly atUtc: string;
  readonly reason: string;
};

export type BlockchainKeyProvider = {
  readonly providerId: string;
  readonly backendKind: BlockchainKeyBackendKind;
  readonly environmentLabel: string;
  readonly productionCapable: boolean;
  sign(request: BlockchainSignRequest): SecurityResult<SignatureDescriptor>;
  verify(
    publicKey: PublicKeyDescriptor,
    request: BlockchainSignRequest,
    signature: SignatureDescriptor,
  ): SecurityResult<true>;
  getHandle(keyId: string, version?: number): SecurityResult<BlockchainKeyHandle>;
  rotateKey(keyId: string, atUtc: string, reason: string): SecurityResult<BlockchainKeyRotationEvent>;
  revokeKey(keyId: string, version: number, atUtc: string, reason: string): SecurityResult<KeyMetadata>;
  activateKey(keyId: string, version: number, atUtc: string): SecurityResult<KeyMetadata>;
  keyMetadata(keyId: string, version?: number): SecurityResult<KeyMetadata>;
  listMetadata(keyId?: string): readonly KeyMetadata[];
};

export type DevelopmentSoftwareKeyEntry = {
  readonly metadata: KeyMetadata;
  readonly publicKey: PublicKeyDescriptor;
  readonly privateKey: PrivateKeyMaterial;
};

function assertUsableForSign(metadata: KeyMetadata): SecurityResult<true> {
  if (metadata.status === 'REVOKED') {
    return securityErr('KEY_REVOKED', `key ${metadata.keyId} v${metadata.version} is revoked`);
  }
  if (metadata.status === 'PENDING') {
    return securityErr('KEY_PENDING', `key ${metadata.keyId} v${metadata.version} is pending activation`);
  }
  if (metadata.status === 'RETIRED') {
    return securityErr('KEY_RETIRED', `key ${metadata.keyId} v${metadata.version} is retired`);
  }
  if (!canSignOrEncrypt(metadata.status)) {
    return securityErr('KEY_NOT_USABLE', `key ${metadata.keyId} v${metadata.version} cannot sign`);
  }
  return securityOk(true);
}

function assertUsableForVerify(metadata: KeyMetadata): SecurityResult<true> {
  if (metadata.status === 'REVOKED') {
    return securityErr('KEY_REVOKED', `key ${metadata.keyId} v${metadata.version} is revoked`);
  }
  if (!canVerifyOrDecrypt(metadata.status)) {
    return securityErr('KEY_NOT_USABLE', `key ${metadata.keyId} v${metadata.version} cannot verify`);
  }
  return securityOk(true);
}

export class DevelopmentSoftwareBlockchainKeyProvider implements BlockchainKeyProvider {
  readonly providerId = 'development-software-blockchain-key-v1';
  readonly backendKind = 'DEVELOPMENT_SOFTWARE' as const;
  readonly environmentLabel: string;
  readonly productionCapable = false;
  readonly #entries = new Map<string, DevelopmentSoftwareKeyEntry>();
  readonly #events: BlockchainKeyRotationEvent[] = [];

  constructor(environmentLabel = 'simulation') {
    this.environmentLabel = environmentLabel;
  }

  register(entry: DevelopmentSoftwareKeyEntry): void {
    const key = `${entry.metadata.keyId}:${entry.metadata.version}`;
    this.#entries.set(key, entry);
  }

  rotationEvents(): readonly BlockchainKeyRotationEvent[] {
    return Object.freeze([...this.#events]);
  }

  sign(request: BlockchainSignRequest): SecurityResult<SignatureDescriptor> {
    const handle = this.getHandle(request.keyId, request.keyVersion);
    if (!handle.ok) {
      return handle;
    }
    const meta = this.keyMetadata(request.keyId, request.keyVersion);
    if (!meta.ok) {
      return meta;
    }
    const usable = assertUsableForSign(meta.value);
    if (!usable.ok) {
      return usable;
    }
    if (meta.value.purpose !== request.purpose) {
      return securityErr('PURPOSE_MISMATCH', 'signing purpose does not match key purpose');
    }
  return securityErr(
      'PROVIDER_UNAVAILABLE',
      'DevelopmentSoftwareBlockchainKeyProvider requires an injected sign delegate; use ValidatorSigningService',
    );
  }

  verify(
    publicKey: PublicKeyDescriptor,
    _request: BlockchainSignRequest,
    _signature: SignatureDescriptor,
  ): SecurityResult<true> {
    const meta = this.keyMetadata(publicKey.keyId, publicKey.keyVersion);
    if (!meta.ok) {
      return meta;
    }
    return assertUsableForVerify(meta.value);
  }

  getHandle(keyId: string, version?: number): SecurityResult<BlockchainKeyHandle> {
    const resolved = this.#resolve(keyId, version);
    if (!resolved.ok) {
      return resolved;
    }
    const { entry } = resolved.value;
    return securityOk(
      Object.freeze({
        keyId: entry.metadata.keyId,
        keyVersion: entry.metadata.version,
        purpose: entry.metadata.purpose,
        suiteId: entry.publicKey.suiteId,
        backendKind: this.backendKind,
        exportable: true,
        publicKey: entry.publicKey,
      }),
    );
  }

  rotateKey(keyId: string, atUtc: string, reason: string): SecurityResult<BlockchainKeyRotationEvent> {
    const active = this.#findActive(keyId);
    if (!active) {
      return securityErr('KEY_NOT_FOUND', `no active key for ${keyId}`);
    }
    const nextVersion = active.metadata.version + 1;
    try {
      assertTransition(active.metadata.status, 'DEPRECATED');
    } catch (error) {
      return securityErr('KEY_NOT_USABLE', error instanceof Error ? error.message : 'illegal transition');
    }
    active.metadata = Object.freeze({
      ...active.metadata,
      status: 'DEPRECATED',
      retiredAt: atUtc,
    });
    const event: BlockchainKeyRotationEvent = Object.freeze({
      keyId,
      fromVersion: active.metadata.version,
      toVersion: nextVersion,
      fromStatus: 'ACTIVE',
      toStatus: 'PENDING',
      atUtc,
      reason,
    });
    this.#events.push(event);
    return securityOk(event);
  }

  revokeKey(keyId: string, version: number, atUtc: string, reason: string): SecurityResult<KeyMetadata> {
    const resolved = this.#resolve(keyId, version);
    if (!resolved.ok) {
      return resolved;
    }
    const { entry, cacheKey } = resolved.value;
    try {
      assertTransition(entry.metadata.status, 'REVOKED');
    } catch (error) {
      return securityErr('KEY_NOT_USABLE', error instanceof Error ? error.message : 'illegal transition');
    }
    const updated = Object.freeze({
      ...entry.metadata,
      status: 'REVOKED' as const,
      revokedAt: atUtc,
      provider: `${entry.metadata.provider};revoked:${reason}`,
    });
    this.#entries.set(cacheKey, { ...entry, metadata: updated });
    return securityOk(updated);
  }

  activateKey(keyId: string, version: number, atUtc: string): SecurityResult<KeyMetadata> {
    const resolved = this.#resolve(keyId, version);
    if (!resolved.ok) {
      return resolved;
    }
    const { entry, cacheKey } = resolved.value;
    try {
      assertTransition(entry.metadata.status, 'ACTIVE');
    } catch (error) {
      return securityErr('KEY_NOT_USABLE', error instanceof Error ? error.message : 'illegal transition');
    }
    const updated = Object.freeze({
      ...entry.metadata,
      status: 'ACTIVE' as const,
      activatedAt: atUtc,
    });
    this.#entries.set(cacheKey, { ...entry, metadata: updated });
    return securityOk(updated);
  }

  keyMetadata(keyId: string, version?: number): SecurityResult<KeyMetadata> {
    const resolved = this.#resolve(keyId, version);
    if (!resolved.ok) {
      return resolved;
    }
    return securityOk(resolved.value.entry.metadata);
  }

  listMetadata(keyId?: string): readonly KeyMetadata[] {
    const all = [...this.#entries.values()].map((row) => row.metadata);
    return keyId ? all.filter((row) => row.keyId === keyId) : all;
  }

  #resolve(
    keyId: string,
    version?: number,
  ): SecurityResult<{ readonly entry: DevelopmentSoftwareKeyEntry; readonly cacheKey: string }> {
    if (version !== undefined) {
      const cacheKey = `${keyId}:${version}`;
      const entry = this.#entries.get(cacheKey);
      if (!entry) {
        return securityErr('KEY_VERSION_UNKNOWN', `unknown key ${keyId} v${version}`);
      }
      return securityOk({ entry, cacheKey });
    }
    const active = this.#findActive(keyId);
    if (!active) {
      return securityErr('KEY_NOT_FOUND', `no active key for ${keyId}`);
    }
    return securityOk({ entry: active, cacheKey: `${keyId}:${active.metadata.version}` });
  }

  #findActive(keyId: string): DevelopmentSoftwareKeyEntry | null {
    const matches = [...this.#entries.values()].filter(
      (row) => row.metadata.keyId === keyId && row.metadata.status === 'ACTIVE',
    );
    if (matches.length !== 1) {
      return null;
    }
    return matches[0] ?? null;
  }
}

export class UnavailableBlockchainKeyProvider implements BlockchainKeyProvider {
  readonly providerId: string;
  readonly backendKind: BlockchainKeyBackendKind;
  readonly environmentLabel: string;
  readonly productionCapable: boolean;
  readonly #reason: string;

  constructor(input: {
    readonly providerId: string;
    readonly backendKind: BlockchainKeyBackendKind;
    readonly environmentLabel: string;
    readonly productionCapable: boolean;
    readonly reason: string;
  }) {
    this.providerId = input.providerId;
    this.backendKind = input.backendKind;
    this.environmentLabel = input.environmentLabel;
    this.productionCapable = input.productionCapable;
    this.#reason = input.reason;
  }

  sign(): SecurityResult<SignatureDescriptor> {
    return securityErr('PROVIDER_UNAVAILABLE', this.#reason);
  }

  verify(): SecurityResult<true> {
    return securityErr('PROVIDER_UNAVAILABLE', this.#reason);
  }

  getHandle(): SecurityResult<BlockchainKeyHandle> {
    return securityErr('PROVIDER_UNAVAILABLE', this.#reason);
  }

  rotateKey(): SecurityResult<BlockchainKeyRotationEvent> {
    return securityErr('PROVIDER_UNAVAILABLE', this.#reason);
  }

  revokeKey(): SecurityResult<KeyMetadata> {
    return securityErr('PROVIDER_UNAVAILABLE', this.#reason);
  }

  activateKey(): SecurityResult<KeyMetadata> {
    return securityErr('PROVIDER_UNAVAILABLE', this.#reason);
  }

  keyMetadata(): SecurityResult<KeyMetadata> {
    return securityErr('PROVIDER_UNAVAILABLE', this.#reason);
  }

  listMetadata(): readonly KeyMetadata[] {
    return Object.freeze([]);
  }
}

export type BlockchainKeyProviderFactoryInput = {
  readonly environment: 'simulation' | 'production';
  readonly configuredBackend: BlockchainKeyBackendKind;
  readonly developmentProvider?: DevelopmentSoftwareBlockchainKeyProvider;
};

/**
 * Select a blockchain key provider. Production refuses insecure fallback.
 */
export function createBlockchainKeyProvider(
  input: BlockchainKeyProviderFactoryInput,
): BlockchainKeyProvider {
  if (input.environment === 'production' && input.configuredBackend === 'DEVELOPMENT_SOFTWARE') {
    return new UnavailableBlockchainKeyProvider({
      providerId: 'production-blockchain-key-fail-closed',
      backendKind: input.configuredBackend,
      environmentLabel: 'production',
      productionCapable: false,
      reason: 'DEVELOPMENT_SOFTWARE backend is forbidden in production; fail-closed',
    });
  }
  if (input.configuredBackend === 'DEVELOPMENT_SOFTWARE') {
    if (!input.developmentProvider) {
      return new UnavailableBlockchainKeyProvider({
        providerId: 'development-blockchain-key-missing',
        backendKind: input.configuredBackend,
        environmentLabel: 'simulation',
        productionCapable: false,
        reason: 'development provider not configured',
      });
    }
    return input.developmentProvider;
  }
  if (input.configuredBackend === 'KMS_HSM') {
    return new UnavailableBlockchainKeyProvider({
      providerId: 'kms-hsm-blockchain-key-port',
      backendKind: 'KMS_HSM',
      environmentLabel: input.environment,
      productionCapable: true,
      reason: 'KMS_HSM blockchain adapter is port-only; configure a production HSM/KMS integration',
    });
  }
  return new UnavailableBlockchainKeyProvider({
    providerId: 'environment-secret-blockchain-key-port',
    backendKind: 'ENVIRONMENT_SECRET',
    environmentLabel: input.environment,
    productionCapable: true,
    reason: 'ENVIRONMENT_SECRET blockchain adapter is port-only; configure secret references',
  });
}
