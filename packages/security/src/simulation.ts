import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { HMAC_KEY_BYTES, HMAC_SHA256 } from './algorithms.ts';
import { auditFromMetadata, type SecurityEvidenceSink, type SecurityEventSink } from './audit.ts';
import { systemSecurityClock, type SecurityClock } from './clock.ts';
import {
  generateDek,
  openEnvelope,
  sealEnvelope,
  type EncryptedEnvelope,
  wrapDek,
} from './envelope.ts';
import { securityErr, securityOk, type SecurityResult } from './errors.ts';
import { hmacSha256Hex, verifyHmacSha256Hex } from './hmac.ts';
import {
  assertTransition,
  canSignOrEncrypt,
  canVerifyOrDecrypt,
  type KeyStatus,
} from './lifecycle.ts';
import { freezeKeyMetadata, type KeyMetadata, type KeyVersionRef } from './metadata.ts';
import type { DataKeyHandle, KeyProvider, PublicKeyMaterial, Signature } from './provider.ts';
import {
  APPLICATION_KEY_PURPOSES,
  PURPOSE_ALGORITHMS,
  isApplicationKeyPurpose,
  isChainKeyPurpose,
  type KeyPurpose,
} from './purposes.ts';
import { secureRandomBytes } from './random.ts';
import { SecretValue } from './redaction.ts';

export const SIMULATION_PROVIDER_ID = 'simulation';
export const SIMULATION_ENVIRONMENT_LABEL =
  'DEVELOPMENT/SIMULATION — generated local keys; not for production; no cloud KMS';

type StoredKey = {
  metadata: KeyMetadata;
  material: SecretValue;
};

export type SimulationKeyProviderOptions = {
  readonly clock?: SecurityClock;
  readonly persistPath?: string;
  readonly events?: SecurityEventSink;
  readonly evidence?: SecurityEvidenceSink;
  readonly hmacSecrets?: Partial<Record<KeyPurpose, string>>;
};

/**
 * Local development / simulation key provider.
 *
 * Keys are generated with node:crypto CSPRNG (or an explicit test HMAC secret).
 * Optional filesystem persistence uses mode 0o600 and is never committed.
 * Tests must not depend on an external cloud account.
 */
export class SimulationKeyProvider implements KeyProvider {
  readonly providerId = SIMULATION_PROVIDER_ID;
  readonly environmentLabel = SIMULATION_ENVIRONMENT_LABEL;
  readonly #clock: SecurityClock;
  readonly #persistPath: string | undefined;
  #events: SecurityEventSink | undefined;
  #evidence: SecurityEvidenceSink | undefined;
  readonly #keys = new Map<string, StoredKey[]>();

  constructor(options: SimulationKeyProviderOptions = {}) {
    this.#clock = options.clock ?? systemSecurityClock;
    this.#persistPath = options.persistPath;
    this.#events = options.events;
    this.#evidence = options.evidence;
    if (options.persistPath && existsSync(options.persistPath)) {
      this.#loadFromDisk(options.persistPath);
    }
  }

  static fromHmacSecret(secret: string, options: SimulationKeyProviderOptions = {}): SimulationKeyProvider {
    if (secret.length === 0) {
      throw new Error('SimulationKeyProvider.fromHmacSecret requires a non-empty secret');
    }
    const provider = new SimulationKeyProvider(options);
    provider.ensurePurpose('EXECUTION_AUTHORITY_SIGNING', secret);
    return provider;
  }

  static createDefault(options: SimulationKeyProviderOptions = {}): SimulationKeyProvider {
    const provider = new SimulationKeyProvider(options);
    for (const purpose of APPLICATION_KEY_PURPOSES) {
      const seeded = options.hmacSecrets?.[purpose];
      provider.ensurePurpose(purpose, seeded);
    }
    return provider;
  }

  ensurePurpose(purpose: KeyPurpose, hmacSecret?: string): KeyMetadata {
    if (!isApplicationKeyPurpose(purpose)) {
      throw new Error(
        `SimulationKeyProvider cannot hold ${purpose}; chain public-key purposes use SignatureProvider`,
      );
    }
    const existing = this.#keys.get(purpose);
    if (existing && existing.length > 0) {
      const active = existing.find((row) => row.metadata.status === 'ACTIVE');
      return (active ?? existing[existing.length - 1]!).metadata;
    }
    return this.#createVersion(purpose, 1, 'ACTIVE', hmacSecret);
  }

  sign(purpose: KeyPurpose, payload: string | Buffer, version?: number): SecurityResult<Signature> {
    if (isChainKeyPurpose(purpose)) {
      return securityErr(
        'PURPOSE_MISMATCH',
        `HMAC KeyProvider cannot sign ${purpose}; use a CryptoSuite SignatureProvider. HMAC is not consensus signing.`,
      );
    }
    const resolved = this.#resolveForUse(purpose, version, 'sign');
    if (!resolved.ok) {
      return resolved;
    }
    const hex = hmacSha256Hex(resolved.value.material, payload);
    return securityOk({
      algorithm: HMAC_SHA256,
      hex,
      keyId: resolved.value.metadata.keyId,
      keyVersion: resolved.value.metadata.version,
    });
  }

  verify(
    purpose: KeyPurpose,
    payload: string | Buffer,
    signature: string,
    version?: number,
  ): SecurityResult<KeyVersionRef> {
    if (isChainKeyPurpose(purpose)) {
      return securityErr(
        'PURPOSE_MISMATCH',
        `HMAC KeyProvider cannot verify ${purpose}; use a CryptoSuite SignatureProvider`,
      );
    }
    const candidates = this.#verifiable(purpose, version);
    if (!candidates.ok) {
      return candidates;
    }
    for (const row of candidates.value) {
      if (verifyHmacSha256Hex(row.material, payload, signature)) {
        return securityOk({
          keyId: row.metadata.keyId,
          purpose,
          version: row.metadata.version,
        });
      }
    }
    return securityErr('SIGNATURE_INVALID', 'HMAC-SHA256 signature is invalid');
  }

  encrypt(purpose: KeyPurpose, plaintext: Buffer): SecurityResult<EncryptedEnvelope> {
    if (purpose !== 'DATA_ENCRYPTION' && purpose !== 'BACKUP_ENCRYPTION') {
      return securityErr('PURPOSE_MISMATCH', 'encrypt requires DATA_ENCRYPTION or BACKUP_ENCRYPTION');
    }
    const resolved = this.#resolveForUse(purpose, undefined, 'encrypt');
    if (!resolved.ok) {
      return resolved;
    }
    return sealEnvelope({
      keyId: resolved.value.metadata.keyId,
      keyVersion: resolved.value.metadata.version,
      purpose,
      masterKey: resolved.value.material.reveal(),
      plaintext,
    });
  }

  decrypt(envelope: EncryptedEnvelope): SecurityResult<Buffer> {
    const resolved = this.#resolveForUse(envelope.purpose, envelope.keyVersion, 'decrypt');
    if (!resolved.ok) {
      return resolved;
    }
    if (resolved.value.metadata.keyId !== envelope.keyId) {
      return securityErr('WRONG_ENCRYPTION_KEY', 'envelope keyId does not match stored key');
    }
    return openEnvelope(resolved.value.material.reveal(), envelope);
  }

  generateDataKey(purpose: KeyPurpose): SecurityResult<DataKeyHandle> {
    if (purpose !== 'DATA_ENCRYPTION' && purpose !== 'BACKUP_ENCRYPTION') {
      return securityErr(
        'PURPOSE_MISMATCH',
        'generateDataKey requires DATA_ENCRYPTION or BACKUP_ENCRYPTION',
      );
    }
    const resolved = this.#resolveForUse(purpose, undefined, 'encrypt');
    if (!resolved.ok) {
      return resolved;
    }
    const dek = generateDek();
    const wrapped = wrapDek(resolved.value.material.reveal(), dek);
    if (!wrapped.ok) {
      return wrapped;
    }
    return securityOk({
      keyId: resolved.value.metadata.keyId,
      keyVersion: resolved.value.metadata.version,
      purpose,
      wrappedDek: wrapped.value.wrappedDek,
      wrappedDekIv: wrapped.value.wrappedDekIv,
      wrappedDekAuthTag: wrapped.value.wrappedDekAuthTag,
    });
  }

  resolveKeyVersion(purpose: KeyPurpose, version?: number): SecurityResult<KeyMetadata> {
    const row = this.#find(purpose, version);
    if (!row) {
      return version === undefined
        ? securityErr('KEY_NOT_FOUND', `no key for purpose ${purpose}`)
        : securityErr('KEY_VERSION_UNKNOWN', `unknown key version ${version} for ${purpose}`);
    }
    return securityOk(row.metadata);
  }

  getPublicKey(purpose: KeyPurpose, version?: number): SecurityResult<PublicKeyMaterial> {
    const meta = this.resolveKeyVersion(purpose, version);
    if (!meta.ok) {
      return meta;
    }
    return securityOk({
      keyId: meta.value.keyId,
      keyVersion: meta.value.version,
      algorithm: meta.value.algorithm,
      pem: null,
    });
  }

  rotateKey(purpose: KeyPurpose): SecurityResult<KeyMetadata> {
    const versions = this.#keys.get(purpose) ?? [];
    const active = versions.find((row) => row.metadata.status === 'ACTIVE');
    if (!active) {
      return securityErr('KEY_NOT_FOUND', `cannot rotate; no ACTIVE key for ${purpose}`);
    }
    this.#setStatus(active, 'DEPRECATED', { retiredAt: null });
    const nextVersion = Math.max(...versions.map((row) => row.metadata.version)) + 1;
    const created = this.#createVersion(purpose, nextVersion, 'ACTIVE');
    this.#audit('security.key.rotated', created, active.metadata.version);
    return securityOk(created);
  }

  retireKey(purpose: KeyPurpose, version: number): SecurityResult<KeyMetadata> {
    const row = this.#find(purpose, version);
    if (!row) {
      return securityErr('KEY_VERSION_UNKNOWN', `unknown key version ${version} for ${purpose}`);
    }
    try {
      assertTransition(row.metadata.status, 'RETIRED');
    } catch (error) {
      return securityErr('KEY_NOT_USABLE', error instanceof Error ? error.message : 'illegal retire');
    }
    this.#setStatus(row, 'RETIRED', { retiredAt: this.#clock.now() });
    this.#audit('security.key.retired', row.metadata, null);
    return securityOk(row.metadata);
  }

  revokeKey(purpose: KeyPurpose, version: number): SecurityResult<KeyMetadata> {
    const row = this.#find(purpose, version);
    if (!row) {
      return securityErr('KEY_VERSION_UNKNOWN', `unknown key version ${version} for ${purpose}`);
    }
    if (row.metadata.status === 'REVOKED') {
      return securityOk(row.metadata);
    }
    try {
      assertTransition(row.metadata.status, 'REVOKED');
    } catch (error) {
      return securityErr('KEY_NOT_USABLE', error instanceof Error ? error.message : 'illegal revoke');
    }
    this.#setStatus(row, 'REVOKED', { revokedAt: this.#clock.now() });
    this.#audit('security.key.revoked', row.metadata, null);
    return securityOk(row.metadata);
  }

  activateKey(purpose: KeyPurpose, version: number): SecurityResult<KeyMetadata> {
    const row = this.#find(purpose, version);
    if (!row) {
      return securityErr('KEY_VERSION_UNKNOWN', `unknown key version ${version} for ${purpose}`);
    }
    try {
      assertTransition(row.metadata.status, 'ACTIVE');
    } catch (error) {
      return securityErr('KEY_NOT_USABLE', error instanceof Error ? error.message : 'illegal activate');
    }
    this.#setStatus(row, 'ACTIVE', { activatedAt: this.#clock.now() });
    return securityOk(row.metadata);
  }

  keyStatus(purpose: KeyPurpose, version?: number): SecurityResult<KeyMetadata> {
    return this.resolveKeyVersion(purpose, version);
  }

  listKeyMetadata(purpose?: KeyPurpose): readonly KeyMetadata[] {
    const rows = purpose
      ? (this.#keys.get(purpose) ?? [])
      : [...this.#keys.values()].flat();
    return rows.map((row) => row.metadata);
  }

  attachAuditSinks(sinks: { events?: SecurityEventSink; evidence?: SecurityEvidenceSink }): void {
    if (sinks.events) {
      this.#events = sinks.events;
    }
    if (sinks.evidence) {
      this.#evidence = sinks.evidence;
    }
  }

  hydrateMetadata(records: readonly KeyMetadata[]): void {
    for (const meta of records) {
      const list = this.#keys.get(meta.purpose) ?? [];
      if (list.some((row) => row.metadata.version === meta.version && row.metadata.keyId === meta.keyId)) {
        continue;
      }
      list.push({
        metadata: freezeKeyMetadata(meta),
        material: new SecretValue(secureRandomBytes(materialBytes(meta.purpose))),
      });
      this.#keys.set(meta.purpose, list);
    }
  }

  #createVersion(
    purpose: KeyPurpose,
    version: number,
    status: KeyStatus,
    hmacSecret?: string,
  ): KeyMetadata {
    const now = this.#clock.now();
    const keyId = `sim:${purpose.toLowerCase()}`;
    if (!isApplicationKeyPurpose(purpose)) {
      throw new Error(`cannot create HMAC material for chain purpose ${purpose}`);
    }
    const algorithm = PURPOSE_ALGORITHMS[purpose];
    const material =
      hmacSecret !== undefined
        ? new SecretValue(hmacSecret)
        : new SecretValue(secureRandomBytes(materialBytes(purpose)));
    const metadata = freezeKeyMetadata({
      keyId,
      purpose,
      algorithm,
      version,
      status,
      createdAt: now,
      activatedAt: status === 'ACTIVE' ? now : null,
      retiredAt: null,
      revokedAt: null,
      provider: SIMULATION_PROVIDER_ID,
      publicMaterial: null,
      providerRef: `secret://simulation/keys/${purpose.toLowerCase()}/v${version}`,
    });
    const list = this.#keys.get(purpose) ?? [];
    list.push({ metadata, material });
    this.#keys.set(purpose, list);
    this.#persist();
    if (version === 1) {
      this.#audit('security.key.created', metadata, null);
    }
    return metadata;
  }

  #setStatus(
    row: StoredKey,
    status: KeyStatus,
    extras: { activatedAt?: string | null; retiredAt?: string | null; revokedAt?: string | null },
  ): void {
    row.metadata = freezeKeyMetadata({
      ...row.metadata,
      status,
      activatedAt: extras.activatedAt !== undefined ? extras.activatedAt : row.metadata.activatedAt,
      retiredAt: extras.retiredAt !== undefined ? extras.retiredAt : row.metadata.retiredAt,
      revokedAt: extras.revokedAt !== undefined ? extras.revokedAt : row.metadata.revokedAt,
    });
    this.#persist();
  }

  #find(purpose: KeyPurpose, version?: number): StoredKey | undefined {
    const list = this.#keys.get(purpose) ?? [];
    if (version !== undefined) {
      return list.find((row) => row.metadata.version === version);
    }
    return list.find((row) => row.metadata.status === 'ACTIVE') ?? list[list.length - 1];
  }

  #resolveForUse(
    purpose: KeyPurpose,
    version: number | undefined,
    op: 'sign' | 'encrypt' | 'decrypt',
  ): SecurityResult<StoredKey> {
    const row = this.#find(purpose, version);
    if (!row) {
      return version === undefined
        ? securityErr('KEY_NOT_FOUND', `no key for purpose ${purpose}`)
        : securityErr('KEY_VERSION_UNKNOWN', `unknown key version ${version} for ${purpose}`);
    }
    if (row.metadata.status === 'REVOKED') {
      return securityErr('KEY_REVOKED', `${purpose} v${row.metadata.version} is revoked`);
    }
    if (row.metadata.status === 'PENDING') {
      return securityErr('KEY_PENDING', `${purpose} v${row.metadata.version} is pending`);
    }
    if (op === 'sign' || op === 'encrypt') {
      if (!canSignOrEncrypt(row.metadata.status)) {
        return securityErr(
          'KEY_NOT_USABLE',
          `${purpose} v${row.metadata.version} status ${row.metadata.status} cannot ${op}`,
        );
      }
    } else if (!canVerifyOrDecrypt(row.metadata.status)) {
      return securityErr(
        row.metadata.status === 'RETIRED' ? 'KEY_RETIRED' : 'KEY_NOT_USABLE',
        `${purpose} v${row.metadata.version} status ${row.metadata.status} cannot decrypt`,
      );
    }
    return securityOk(row);
  }

  #verifiable(purpose: KeyPurpose, version?: number): SecurityResult<readonly StoredKey[]> {
    if (version !== undefined) {
      const row = this.#find(purpose, version);
      if (!row) {
        return securityErr('KEY_VERSION_UNKNOWN', `unknown key version ${version} for ${purpose}`);
      }
      if (row.metadata.status === 'REVOKED') {
        return securityErr('KEY_REVOKED', `${purpose} v${version} is revoked`);
      }
      if (row.metadata.status === 'RETIRED') {
        return securityErr('KEY_RETIRED', `${purpose} v${version} is retired`);
      }
      if (row.metadata.status === 'PENDING') {
        return securityErr('KEY_PENDING', `${purpose} v${version} is pending`);
      }
      if (!canVerifyOrDecrypt(row.metadata.status)) {
        return securityErr('KEY_NOT_USABLE', `${purpose} v${version} cannot verify`);
      }
      return securityOk([row]);
    }
    const list = this.#keys.get(purpose) ?? [];
    if (list.length === 0) {
      return securityErr('KEY_NOT_FOUND', `no key for purpose ${purpose}`);
    }
    if (list.every((row) => row.metadata.status === 'REVOKED')) {
      return securityErr('KEY_REVOKED', `all versions of ${purpose} are revoked`);
    }
    const usable = list.filter((row) => canVerifyOrDecrypt(row.metadata.status));
    if (usable.length === 0) {
      return securityErr('KEY_NOT_USABLE', `no verifiable version for ${purpose}`);
    }
    return securityOk(usable);
  }

  #audit(
    kind: 'security.key.created' | 'security.key.rotated' | 'security.key.retired' | 'security.key.revoked',
    meta: KeyMetadata,
    previousVersion: number | null,
  ): void {
    const payload = auditFromMetadata(kind, meta, previousVersion, this.#clock.now());
    this.#events?.emit(payload);
    this.#evidence?.seal(kind.toUpperCase().replaceAll('.', '_'), payload);
  }

  #persist(): void {
    if (!this.#persistPath) {
      return;
    }
    mkdirSync(dirname(this.#persistPath), { recursive: true, mode: 0o700 });
    const payload = {
      label: SIMULATION_ENVIRONMENT_LABEL,
      keys: [...this.#keys.entries()].map(([purpose, rows]) => ({
        purpose,
        versions: rows.map((row) => ({
          metadata: row.metadata,
          materialHex: row.material.reveal().toString('hex'),
        })),
      })),
    };
    writeFileSync(this.#persistPath, JSON.stringify(payload), { mode: 0o600 });
    chmodSync(this.#persistPath, 0o600);
  }

  #loadFromDisk(path: string): void {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as {
      keys: Array<{
        purpose: KeyPurpose;
        versions: Array<{ metadata: KeyMetadata; materialHex: string }>;
      }>;
    };
    for (const group of raw.keys) {
      this.#keys.set(
        group.purpose,
        group.versions.map((row) => ({
          metadata: freezeKeyMetadata(row.metadata),
          material: new SecretValue(Buffer.from(row.materialHex, 'hex')),
        })),
      );
    }
  }
}

function materialBytes(purpose: KeyPurpose): number {
  if (!isApplicationKeyPurpose(purpose)) {
    return HMAC_KEY_BYTES;
  }
  return PURPOSE_ALGORITHMS[purpose] === 'AES-256-GCM' ? 32 : HMAC_KEY_BYTES;
}

export function createSimulationKeyProvider(
  options: SimulationKeyProviderOptions = {},
): SimulationKeyProvider {
  return SimulationKeyProvider.createDefault(options);
}
