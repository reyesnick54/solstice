import { inspect } from 'node:util';

import { securityErr, securityOk, type SecurityResult } from './errors.ts';
import { PrivateKeyMaterial, SENSITIVE_TYPE_NAMES } from './redaction.ts';

export const PRIVATE_KEY_FIELD_NAMES = Object.freeze([
  'privateKey',
  'private_key',
  'secretKey',
  'secret_key',
  'rawPrivate',
  'seedPhrase',
  'mnemonic',
  'signingSeed',
  'sk',
  'priv',
]);

const HEX_SECRET = /(?:^|[^a-f0-9])[0-9a-f]{64}(?:[^a-f0-9]|$)/i;

export function looksLikePrivateKeyField(name: string): boolean {
  const normalized = name.replaceAll(/[^a-z0-9]/gi, '').toLowerCase();
  return PRIVATE_KEY_FIELD_NAMES.some(
    (field) => field.replaceAll(/[^a-z0-9]/gi, '').toLowerCase() === normalized,
  );
}

function walk(
  value: unknown,
  path: string,
  hits: string[],
  seen: WeakSet<object>,
): void {
  if (value instanceof PrivateKeyMaterial) {
    hits.push(`${path}:PrivateKeyMaterial`);
    return;
  }
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value === 'string') {
    return;
  }
  if (typeof value !== 'object') {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, `${path}[${index}]`, hits, seen));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (looksLikePrivateKeyField(key)) {
      hits.push(`${path}.${key}`);
    }
    walk(entry, `${path}.${key}`, hits, seen);
  }
}

export function findPrivateKeyLeakage(value: unknown, root = '$'): readonly string[] {
  const hits: string[] = [];
  walk(value, root, hits, new WeakSet<object>());
  return hits;
}

export function assertNoPrivateKeyMaterial(
  value: unknown,
  context: string,
): SecurityResult<true> {
  const hits = findPrivateKeyLeakage(value);
  if (hits.length > 0) {
    return securityErr(
      'PRIVATE_KEY_LEAKAGE',
      `private key material must not appear in ${context}`,
    );
  }
  return securityOk(true);
}

export function safePublicLog(value: unknown): string {
  const leakage = assertNoPrivateKeyMaterial(value, 'logs');
  if (!leakage.ok) {
    return '[REDACTED-SECURITY-OBJECT]';
  }
  return inspect(value, { depth: 4, getters: false });
}

export function rejectErrorWithSecret(message: string, secretHex: string): string {
  if (secretHex.length > 0 && message.includes(secretHex)) {
    return message.replaceAll(secretHex, '[REDACTED]');
  }
  if (HEX_SECRET.test(message) && SENSITIVE_TYPE_NAMES.some((name) => message.includes(name))) {
    return '[REDACTED-SECURITY-ERROR]';
  }
  return message;
}

export const FORBIDDEN_PRIVATE_KEY_SURFACES = Object.freeze([
  'logs',
  'events',
  'evidence',
  'transaction',
  'public-api',
  'database-metadata',
  'error-message',
] as const);
