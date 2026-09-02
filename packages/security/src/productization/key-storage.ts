/**
 * Wave 7 — key storage audit and forbidden-surface enforcement.
 *
 * Prevents hard-coded secrets, plaintext repository secrets, private keys
 * in logs, validator keys on public API containers, and private keys in
 * ordinary database rows.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import { findPrivateKeyLeakage } from '../crypto-leakage.ts';
import { KEY_ROLE_POLICIES, KEY_ROLES, type KeyRole } from './key-classification.ts';

export const FORBIDDEN_KEY_STORAGE_SURFACES = [
  'SOURCE_CODE',
  'GIT_REPOSITORY',
  'APPLICATION_LOG',
  'ORDINARY_DATABASE_ROW',
  'PUBLIC_API_CONTAINER',
  'EXPLORER_CONTAINER',
  'CONSUMER_BFF',
  'ENVIRONMENT_VARIABLE_PLAINTEXT',
] as const;

export type ForbiddenKeyStorageSurface = (typeof FORBIDDEN_KEY_STORAGE_SURFACES)[number];

export const ALLOWED_KEY_STORAGE_BY_ROLE: Readonly<Record<KeyRole, readonly string[]>> = Object.freeze(
  Object.fromEntries(KEY_ROLES.map((role) => [role, KEY_ROLE_POLICIES[role].storage])) as Record<
    KeyRole,
    readonly string[]
  >,
);

const HARDCODED_SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk_live_[A-Za-z0-9]{16,}\b/,
  /\bwhsec_[A-Za-z0-9]{16,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bpassword\s*=\s*['"][^'"]{4,}['"]/i,
  /\bprivateKey\s*[:=]\s*['"][0-9a-fA-F]{32,}['"]/,
];

export type KeyStorageAuditFinding = {
  readonly surface: ForbiddenKeyStorageSurface | string;
  readonly role: KeyRole | null;
  readonly violation: string;
  readonly blocked: true;
};

export function auditTextForHardcodedSecrets(text: string): readonly KeyStorageAuditFinding[] {
  const findings: KeyStorageAuditFinding[] = [];
  for (const pattern of HARDCODED_SECRET_PATTERNS) {
    if (pattern.test(text)) {
      findings.push(
        Object.freeze({
          surface: 'SOURCE_CODE',
          role: null,
          violation: `hard-coded secret pattern matched: ${pattern.source}`,
          blocked: true,
        }),
      );
    }
  }
  const leakage = findPrivateKeyLeakage(text);
  if (leakage.length > 0) {
    for (const field of leakage) {
      findings.push(
        Object.freeze({
          surface: 'SOURCE_CODE',
          role: null,
          violation: `private key field detected: ${field}`,
          blocked: true,
        }),
      );
    }
  }
  return Object.freeze(findings);
}

export function assertKeyNotOnSurface(
  role: KeyRole,
  surface: string,
): SecurityResult<true> {
  const allowed = KEY_ROLE_POLICIES[role].storage;
  if (!allowed.includes(surface)) {
    if ((FORBIDDEN_KEY_STORAGE_SURFACES as readonly string[]).includes(surface)) {
      return securityErr(
        'PRIVATE_KEY_LEAKAGE',
        `${role} must not be stored on ${surface}`,
      );
    }
    return securityErr(
      'POLICY_REJECTED',
      `${role} is not permitted on storage surface ${surface}`,
    );
  }
  return securityOk(true);
}

export function assertValidatorKeyNotOnPublicApi(role: KeyRole, container: string): SecurityResult<true> {
  if (role === 'VALIDATOR_KEY' && (container === 'PUBLIC_API_CONTAINER' || container === 'CONSUMER_BFF')) {
    return securityErr(
      'PRIVATE_KEY_LEAKAGE',
      'validator keys must not be present on public API containers',
    );
  }
  return securityOk(true);
}

export function assertNoPrivateKeyInDatabaseRow(value: unknown): SecurityResult<true> {
  const fieldLeakage = findPrivateKeyLeakage(value);
  if (fieldLeakage.length > 0) {
    return securityErr('PRIVATE_KEY_LEAKAGE', 'private key material must not be stored in database rows');
  }
  if (typeof value === 'string') {
    const audit = auditTextForHardcodedSecrets(value);
    if (audit.length > 0) {
      return securityErr('PRIVATE_KEY_LEAKAGE', 'private key material must not be stored in database rows');
    }
  }
  if (value !== null && typeof value === 'object') {
    const serialized = JSON.stringify(value);
    const audit = auditTextForHardcodedSecrets(serialized);
    if (audit.length > 0) {
      return securityErr('PRIVATE_KEY_LEAKAGE', 'private key material must not be stored in database rows');
    }
  }
  return securityOk(true);
}

export function redactForAuditLog(payload: Record<string, unknown>): Record<string, unknown> {
  const sensitive = new Set([
    'privateKey',
    'secret',
    'password',
    'apiKey',
    'token',
    'credential',
    'seed',
    'seedHex',
    'keyMaterial',
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (sensitive.has(key) || /secret|password|private|key$/i.test(key)) {
      out[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      out[key] = redactForAuditLog(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return Object.freeze(out);
}
