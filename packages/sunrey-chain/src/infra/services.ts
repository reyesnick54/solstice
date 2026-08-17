/**
 * Provider-neutral TLS, DNS, container-registry, and object-storage
 * interfaces. Custom TLS is not implemented. Floating image tags cannot
 * satisfy production release verification.
 */

import { parseSecretReference, type SecretReference } from '../../../security/src/secrets.ts';
import { digestJson, infraSha256 } from './hash.ts';
import {
  infraErr,
  infraOk,
  type EncryptionPolicy,
  type InfraEnvironment,
  type InfraResult,
  type ObjectClass,
  type TlsMode,
} from './types.ts';

export type CertificateReference = {
  readonly certificateId: string;
  readonly secretRef: SecretReference;
  readonly mode: TlsMode;
  readonly notAfterUtc: string;
  readonly chainFingerprint: string;
};

export type CertificateManager = {
  issue(input: {
    readonly certificateId: string;
    readonly secretHref: string;
    readonly mode: TlsMode;
    readonly notAfterUtc: string;
    readonly chainFingerprint: string;
  }): InfraResult<CertificateReference>;
  rotate(certificateId: string, next: Omit<CertificateReference, 'certificateId'>): InfraResult<CertificateReference>;
  expiringBefore(utc: string): readonly CertificateReference[];
  verifyChain(certificateId: string, expectedFingerprint: string): InfraResult<true>;
};

export class LocalCertificateManager implements CertificateManager {
  readonly #certs = new Map<string, CertificateReference>();

  issue(input: {
    readonly certificateId: string;
    readonly secretHref: string;
    readonly mode: TlsMode;
    readonly notAfterUtc: string;
    readonly chainFingerprint: string;
  }): InfraResult<CertificateReference> {
    const parsed = parseSecretReference(input.secretHref);
    if (!parsed.ok) {
      return infraErr(parsed.error.code, parsed.error.message);
    }
    const record: CertificateReference = Object.freeze({
      certificateId: input.certificateId,
      secretRef: parsed.value,
      mode: input.mode,
      notAfterUtc: input.notAfterUtc,
      chainFingerprint: input.chainFingerprint,
    });
    this.#certs.set(input.certificateId, record);
    return infraOk(record);
  }

  rotate(certificateId: string, next: Omit<CertificateReference, 'certificateId'>): InfraResult<CertificateReference> {
    if (!this.#certs.has(certificateId)) {
      return infraErr('CERT_NOT_FOUND', `certificate '${certificateId}' is not issued`);
    }
    const record: CertificateReference = Object.freeze({ ...next, certificateId });
    this.#certs.set(certificateId, record);
    return infraOk(record);
  }

  expiringBefore(utc: string): readonly CertificateReference[] {
    return Object.freeze([...this.#certs.values()].filter((row) => row.notAfterUtc <= utc));
  }

  verifyChain(certificateId: string, expectedFingerprint: string): InfraResult<true> {
    const cert = this.#certs.get(certificateId);
    if (!cert) {
      return infraErr('CERT_NOT_FOUND', `certificate '${certificateId}' is not issued`);
    }
    if (cert.chainFingerprint !== expectedFingerprint) {
      return infraErr('CERT_CHAIN_MISMATCH', 'certificate chain fingerprint mismatch');
    }
    return infraOk(true);
  }

  list(): readonly CertificateReference[] {
    return Object.freeze([...this.#certs.values()]);
  }
}

export const DNS_ENDPOINT_ROLES = ['RPC', 'EXPLORER', 'API', 'OPERATOR'] as const;
export type DnsEndpointRole = (typeof DNS_ENDPOINT_ROLES)[number];

export type DnsRecord = {
  readonly hostname: string;
  readonly role: DnsEndpointRole;
  readonly environment: InfraEnvironment;
  readonly target: string;
  readonly productionDomainRequired: false;
};

export class DnsConfiguration {
  readonly #records = new Map<string, DnsRecord>();

  upsert(record: DnsRecord): DnsRecord {
    const stored = Object.freeze({ ...record, productionDomainRequired: false as const });
    this.#records.set(`${record.environment}:${record.role}`, stored);
    return stored;
  }

  list(): readonly DnsRecord[] {
    return Object.freeze([...this.#records.values()]);
  }
}

export type ContainerImageReference = {
  readonly name: string;
  readonly digest: string;
  readonly tag: string | null;
  readonly immutable: boolean;
};

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

export function parseContainerReference(input: {
  readonly name: string;
  readonly digest?: string | null;
  readonly tag?: string | null;
}): InfraResult<ContainerImageReference> {
  if (!input.digest || !DIGEST_RE.test(input.digest)) {
    return infraErr(
      'MUTABLE_CONTAINER_REFERENCE',
      `floating image tag '${input.tag ?? 'latest'}' cannot satisfy production release verification`,
    );
  }
  return infraOk(
    Object.freeze({
      name: input.name,
      digest: input.digest,
      tag: input.tag ?? null,
      immutable: true,
    }),
  );
}

export function requireImmutableDigest(reference: ContainerImageReference): InfraResult<true> {
  if (!reference.immutable || !DIGEST_RE.test(reference.digest)) {
    return infraErr('MUTABLE_CONTAINER_REFERENCE', 'production candidate deployments must reference immutable container digests');
  }
  return infraOk(true);
}

export type StoredObject = {
  readonly objectId: string;
  readonly objectClass: ObjectClass;
  readonly environment: InfraEnvironment;
  readonly integrityHash: string;
  readonly encryptionPolicy: EncryptionPolicy;
  readonly retentionUntilUtc: string | null;
  readonly sizeBytes: number;
};

export class ObjectStorageAdapter {
  readonly #objects = new Map<string, { record: StoredObject; payload: Buffer }>();

  put(input: {
    readonly objectId: string;
    readonly objectClass: ObjectClass;
    readonly environment: InfraEnvironment;
    readonly payload: Buffer;
    readonly encryptionPolicy: EncryptionPolicy;
    readonly retentionUntilUtc: string | null;
  }): StoredObject {
    const integrityHash = infraSha256(input.payload);
    const record: StoredObject = Object.freeze({
      objectId: input.objectId,
      objectClass: input.objectClass,
      environment: input.environment,
      integrityHash,
      encryptionPolicy: input.encryptionPolicy,
      retentionUntilUtc: input.retentionUntilUtc,
      sizeBytes: input.payload.length,
    });
    this.#objects.set(input.objectId, { record, payload: Buffer.from(input.payload) });
    return record;
  }

  get(objectId: string, environment: InfraEnvironment): InfraResult<StoredObject> {
    const found = this.#objects.get(objectId);
    if (!found) {
      return infraErr('OBJECT_NOT_FOUND', `object '${objectId}' is not stored`);
    }
    if (found.record.environment !== environment) {
      return infraErr('ENVIRONMENT_MISMATCH', `object '${objectId}' is bound to ${found.record.environment}`);
    }
    return infraOk(found.record);
  }

  verify(objectId: string): InfraResult<true> {
    const found = this.#objects.get(objectId);
    if (!found) {
      return infraErr('OBJECT_NOT_FOUND', `object '${objectId}' is not stored`);
    }
    if (infraSha256(found.payload) !== found.record.integrityHash) {
      return infraErr('INTEGRITY_MISMATCH', `object '${objectId}' failed integrity verification`);
    }
    return infraOk(true);
  }

  list(): readonly StoredObject[] {
    return Object.freeze([...this.#objects.values()].map((row) => row.record));
  }

  catalogDigest(): string {
    return digestJson(this.list());
  }
}
