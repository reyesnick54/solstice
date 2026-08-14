/**
 * Safe audit payloads. Never include key material, secrets, or plaintext.
 */

import type { KeyMetadata } from './metadata.ts';
import type { KeyPurpose } from './purposes.ts';

export const SECURITY_AUDIT_KINDS = [
  'security.key.created',
  'security.key.rotated',
  'security.key.retired',
  'security.key.revoked',
  'security.config.changed',
] as const;

export type SecurityAuditKind = (typeof SECURITY_AUDIT_KINDS)[number];

export type SecurityAuditPayload = {
  readonly kind: SecurityAuditKind;
  readonly keyId: string;
  readonly purpose: KeyPurpose;
  readonly version: number;
  readonly previousVersion: number | null;
  readonly status: string;
  readonly provider: string;
  readonly providerRef: string;
  readonly occurredAt: string;
};

export type SecurityEventSink = {
  emit(payload: SecurityAuditPayload): void;
};

export type SecurityEvidenceSink = {
  seal(kind: string, payload: SecurityAuditPayload): { readonly evidenceId: string };
};

export function auditFromMetadata(
  kind: SecurityAuditKind,
  meta: KeyMetadata,
  previousVersion: number | null,
  occurredAt: string,
): SecurityAuditPayload {
  return Object.freeze({
    kind,
    keyId: meta.keyId,
    purpose: meta.purpose,
    version: meta.version,
    previousVersion,
    status: meta.status,
    provider: meta.provider,
    providerRef: meta.providerRef,
    occurredAt,
  });
}
