/**
 * Validator key lifecycle manager.
 *
 * States: PENDING → ACTIVE → DEPRECATED → RETIRED → REVOKED
 * Rotation creates a PENDING successor; activation is explicit.
 * Revoked keys cannot authorize new operations. Historical signatures
 * remain verifiable for DEPRECATED keys.
 */

import {
  assertTransition,
  canSignOrEncrypt,
  canVerifyOrDecrypt,
  type KeyStatus,
} from '../../../security/src/lifecycle.ts';
import { freezeKeyMetadata, type KeyMetadata } from '../../../security/src/metadata.ts';
import type { PublicKeyDescriptor } from '../../../security/src/crypto-descriptors.ts';
import type { KeyPurpose } from '../../../security/src/purposes.ts';
import { validatorErr, validatorOk, type ValidatorResult } from './types.ts';

export type ValidatorKeyLifecycleEvent = {
  readonly keyId: string;
  readonly version: number;
  readonly fromStatus: KeyStatus;
  readonly toStatus: KeyStatus;
  readonly atUtc: string;
  readonly reason: string;
  readonly publicKeyHex: string | null;
};

export type ValidatorKeyRecord = {
  readonly metadata: KeyMetadata;
  readonly publicKey: PublicKeyDescriptor;
};

export class ValidatorKeyLifecycleManager {
  readonly #records = new Map<string, ValidatorKeyRecord>();
  readonly #events: ValidatorKeyLifecycleEvent[] = [];

  register(record: ValidatorKeyRecord): ValidatorResult<true> {
    const cacheKey = `${record.metadata.keyId}:${record.metadata.version}`;
    if (this.#records.has(cacheKey)) {
      return validatorErr('DUPLICATE_CONSENSUS_KEY', `key ${cacheKey} already registered`);
    }
    this.#records.set(cacheKey, {
      metadata: freezeKeyMetadata(record.metadata),
      publicKey: Object.freeze({ ...record.publicKey }),
    });
    return validatorOk(true);
  }

  events(): readonly ValidatorKeyLifecycleEvent[] {
    return Object.freeze([...this.#events]);
  }

  activeKey(keyId: string): ValidatorResult<ValidatorKeyRecord> {
    const matches = [...this.#records.values()].filter(
      (row) => row.metadata.keyId === keyId && row.metadata.status === 'ACTIVE',
    );
    if (matches.length === 0) {
      return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', `no ACTIVE key for ${keyId}`);
    }
    if (matches.length > 1) {
      return validatorErr('UNIVERSAL_VALIDATOR_KEY', `multiple ACTIVE keys for ${keyId}`);
    }
    return validatorOk(matches[0]!);
  }

  keyByVersion(keyId: string, version: number): ValidatorResult<ValidatorKeyRecord> {
    const row = this.#records.get(`${keyId}:${version}`);
    if (!row) {
      return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', `unknown key ${keyId} v${version}`);
    }
    return validatorOk(row);
  }

  assertCanSign(keyId: string, version?: number): ValidatorResult<ValidatorKeyRecord> {
    const resolved = version === undefined ? this.activeKey(keyId) : this.keyByVersion(keyId, version);
    if (!resolved.ok) {
      return resolved;
    }
    if (!canSignOrEncrypt(resolved.value.metadata.status)) {
      if (resolved.value.metadata.status === 'PENDING') {
        return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', `key ${keyId} is PENDING activation`);
      }
      if (resolved.value.metadata.status === 'REVOKED') {
        return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', `key ${keyId} is REVOKED`);
      }
      return validatorErr('OLD_KEY_CANNOT_SIGN_NEW_EPOCH', `key ${keyId} cannot sign in current state`);
    }
    return resolved;
  }

  assertCanVerify(keyId: string, version: number): ValidatorResult<ValidatorKeyRecord> {
    const resolved = this.keyByVersion(keyId, version);
    if (!resolved.ok) {
      return resolved;
    }
    if (!canVerifyOrDecrypt(resolved.value.metadata.status)) {
      return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', `key ${keyId} v${version} cannot verify`);
    }
    return resolved;
  }

  beginRotation(input: {
    readonly keyId: string;
    readonly successor: ValidatorKeyRecord;
    readonly atUtc: string;
    readonly reason: string;
  }): ValidatorResult<ValidatorKeyLifecycleEvent> {
    const active = this.activeKey(input.keyId);
    if (!active.ok) {
      return active;
    }
    if (input.successor.metadata.status !== 'PENDING') {
      return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', 'successor must start in PENDING');
    }
    if (input.successor.metadata.keyId !== input.keyId) {
      return validatorErr('KEY_ROLE_MISMATCH', 'successor keyId must match rotated key');
    }
    if (input.successor.metadata.version <= active.value.metadata.version) {
      return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', 'successor version must be greater than active version');
    }
    try {
      assertTransition(active.value.metadata.status, 'DEPRECATED');
    } catch (error) {
      return validatorErr('UNDEFINED_TRANSITION', error instanceof Error ? error.message : 'illegal transition');
    }
    const deprecated = freezeKeyMetadata({
      ...active.value.metadata,
      status: 'DEPRECATED',
      retiredAt: input.atUtc,
    });
    this.#records.set(`${input.keyId}:${active.value.metadata.version}`, {
      ...active.value,
      metadata: deprecated,
    });
    this.register(input.successor);
    const event: ValidatorKeyLifecycleEvent = Object.freeze({
      keyId: input.keyId,
      version: input.successor.metadata.version,
      fromStatus: 'ACTIVE',
      toStatus: 'PENDING',
      atUtc: input.atUtc,
      reason: input.reason,
      publicKeyHex: input.successor.publicKey.publicKeyHex,
    });
    this.#events.push(event);
    return validatorOk(event);
  }

  activate(input: {
    readonly keyId: string;
    readonly version: number;
    readonly atUtc: string;
  }): ValidatorResult<ValidatorKeyLifecycleEvent> {
    const resolved = this.keyByVersion(input.keyId, input.version);
    if (!resolved.ok) {
      return resolved;
    }
    try {
      assertTransition(resolved.value.metadata.status, 'ACTIVE');
    } catch (error) {
      return validatorErr('UNDEFINED_TRANSITION', error instanceof Error ? error.message : 'illegal transition');
    }
    const updated = freezeKeyMetadata({
      ...resolved.value.metadata,
      status: 'ACTIVE',
      activatedAt: input.atUtc,
    });
    this.#records.set(`${input.keyId}:${input.version}`, {
      ...resolved.value,
      metadata: updated,
    });
    const event: ValidatorKeyLifecycleEvent = Object.freeze({
      keyId: input.keyId,
      version: input.version,
      fromStatus: 'PENDING',
      toStatus: 'ACTIVE',
      atUtc: input.atUtc,
      reason: 'explicit activation',
      publicKeyHex: resolved.value.publicKey.publicKeyHex,
    });
    this.#events.push(event);
    return validatorOk(event);
  }

  revoke(input: {
    readonly keyId: string;
    readonly version: number;
    readonly atUtc: string;
    readonly reason: string;
  }): ValidatorResult<ValidatorKeyLifecycleEvent> {
    const resolved = this.keyByVersion(input.keyId, input.version);
    if (!resolved.ok) {
      return resolved;
    }
    try {
      assertTransition(resolved.value.metadata.status, 'REVOKED');
    } catch (error) {
      return validatorErr('UNDEFINED_TRANSITION', error instanceof Error ? error.message : 'illegal transition');
    }
    const updated = freezeKeyMetadata({
      ...resolved.value.metadata,
      status: 'REVOKED',
      revokedAt: input.atUtc,
    });
    this.#records.set(`${input.keyId}:${input.version}`, {
      ...resolved.value,
      metadata: updated,
    });
    const event: ValidatorKeyLifecycleEvent = Object.freeze({
      keyId: input.keyId,
      version: input.version,
      fromStatus: resolved.value.metadata.status,
      toStatus: 'REVOKED',
      atUtc: input.atUtc,
      reason: input.reason,
      publicKeyHex: resolved.value.publicKey.publicKeyHex,
    });
    this.#events.push(event);
    return validatorOk(event);
  }

  list(keyId?: string): readonly ValidatorKeyRecord[] {
    const all = [...this.#records.values()];
    return keyId ? all.filter((row) => row.metadata.keyId === keyId) : all;
  }
}

export function validatorKeyMetadata(input: {
  readonly keyId: string;
  readonly purpose: KeyPurpose;
  readonly algorithm: KeyMetadata['algorithm'];
  readonly version: number;
  readonly status: KeyStatus;
  readonly provider: string;
  readonly publicKeyHex: string;
  readonly atUtc: string;
}): KeyMetadata {
  return freezeKeyMetadata({
    keyId: input.keyId,
    purpose: input.purpose,
    algorithm: input.algorithm,
    version: input.version,
    status: input.status,
    createdAt: input.atUtc,
    activatedAt: input.status === 'ACTIVE' ? input.atUtc : null,
    retiredAt: input.status === 'DEPRECATED' || input.status === 'RETIRED' ? input.atUtc : null,
    revokedAt: input.status === 'REVOKED' ? input.atUtc : null,
    provider: input.provider,
    publicMaterial: input.publicKeyHex,
    providerRef: `${input.provider}:${input.keyId}:v${input.version}`,
  });
}
