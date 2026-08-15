/**
 * Typed cryptographic purposes. Arbitrary strings are not authority.
 */

export const KEY_PURPOSES = [
  'EXECUTION_AUTHORITY_SIGNING',
  'EVIDENCE_INTEGRITY',
  'SESSION_SIGNING',
  'DATA_ENCRYPTION',
  'SERVICE_AUTHENTICATION',
  'WEBHOOK_SIGNING',
  'DATA_USE_PERMIT_SIGNING',
  'CLEAN_ROOM_JOIN_TOKEN',
  'PYRAMID_CUSTODY_FUTURE',
] as const;

export type KeyPurpose = (typeof KEY_PURPOSES)[number];

export function isKeyPurpose(value: unknown): value is KeyPurpose {
  return typeof value === 'string' && (KEY_PURPOSES as readonly string[]).includes(value);
}

export function assertKeyPurpose(value: string): KeyPurpose {
  if (!isKeyPurpose(value)) {
    throw new TypeError(`unknown key purpose: ${value}`);
  }
  return value;
}

export const PURPOSE_ALGORITHMS = Object.freeze({
  EXECUTION_AUTHORITY_SIGNING: 'HMAC-SHA256',
  EVIDENCE_INTEGRITY: 'SHA-256',
  SESSION_SIGNING: 'HMAC-SHA256',
  DATA_ENCRYPTION: 'AES-256-GCM',
  SERVICE_AUTHENTICATION: 'HMAC-SHA256',
  WEBHOOK_SIGNING: 'HMAC-SHA256',
  DATA_USE_PERMIT_SIGNING: 'HMAC-SHA256',
  CLEAN_ROOM_JOIN_TOKEN: 'HMAC-SHA256',
  PYRAMID_CUSTODY_FUTURE: 'HMAC-SHA256',
} as const);
