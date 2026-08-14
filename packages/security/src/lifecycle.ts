/**
 * Key lifecycle states and exact semantics.
 *
 * PENDING     — generated, not yet authorized for use. Sign/encrypt fail closed.
 *               Verify/decrypt fail closed. Activate to make it ACTIVE.
 * ACTIVE      — current version. New signatures and new envelopes use this
 *               version only.
 * DEPRECATED  — superseded by rotation. Must not sign or encrypt. Verification
 *               and decryption of historical material remain allowed.
 * RETIRED     — planned end of life after a deprecation window. Must not sign
 *               or encrypt. Verification/decryption fail closed. Historical
 *               Evidence Vault records are hash-chained (SHA-256) and are not
 *               invalidated by retirement of a signing key.
 * REVOKED     — compromise or administrative kill. Every cryptographic
 *               operation fails closed immediately.
 *
 * Rotation    — create a new ACTIVE version; previous ACTIVE becomes
 *               DEPRECATED. Historical signatures still verify.
 * Retirement  — planned withdrawal of a DEPRECATED version. Not a compromise.
 * Revocation  — unplanned kill. Treated as hostile. Never silent.
 */

export const KEY_STATUSES = [
  'PENDING',
  'ACTIVE',
  'DEPRECATED',
  'RETIRED',
  'REVOKED',
] as const;

export type KeyStatus = (typeof KEY_STATUSES)[number];

export function isKeyStatus(value: unknown): value is KeyStatus {
  return typeof value === 'string' && (KEY_STATUSES as readonly string[]).includes(value);
}

export function canSignOrEncrypt(status: KeyStatus): boolean {
  return status === 'ACTIVE';
}

export function canVerifyOrDecrypt(status: KeyStatus): boolean {
  return status === 'ACTIVE' || status === 'DEPRECATED';
}

export function isTerminalStatus(status: KeyStatus): boolean {
  return status === 'RETIRED' || status === 'REVOKED';
}

const ALLOWED_TRANSITIONS: Readonly<Record<KeyStatus, readonly KeyStatus[]>> = {
  PENDING: ['ACTIVE', 'REVOKED'],
  ACTIVE: ['DEPRECATED', 'REVOKED'],
  DEPRECATED: ['RETIRED', 'REVOKED'],
  RETIRED: ['REVOKED'],
  REVOKED: [],
};

export function canTransition(from: KeyStatus, to: KeyStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: KeyStatus, to: KeyStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`illegal key lifecycle transition ${from} → ${to}`);
  }
}
