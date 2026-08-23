/**
 * Versioned key rotation with overlapping verification windows.
 * Rotation must not invalidate all sessions without policy, corrupt
 * encrypted data, or break validator state.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import type { KeyMetadata } from '../metadata.ts';
import type { KeyProvider } from '../provider.ts';
import type { KeyPurpose } from '../purposes.ts';

export const ROTATION_POLICIES = Object.freeze({
  SESSION_SIGNING: Object.freeze({
    overlapVerification: true,
    invalidateSessionsOnRotate: false,
    emergencyRevokeInvalidates: true,
    note: 'new tokens use the active version; previous version verifies until retire',
  }),
  DATA_ENCRYPTION: Object.freeze({
    overlapVerification: true,
    rewrapRequiredBeforeRetire: true,
    corruptHistoricalEnvelopes: false,
    note: 'historical envelopes decrypt with their keyVersion until explicit retire',
  }),
  VALIDATOR_CONSENSUS_SIGNING: Object.freeze({
    overlapVerification: true,
    breakValidatorState: false,
    ceremonyRequired: true,
    note: 'validator rotation is a ceremony; historical signatures remain verifiable',
  }),
});

export type RotationWindow = {
  readonly purpose: KeyPurpose;
  readonly previousVersion: number;
  readonly currentVersion: number;
  readonly overlapUntil: string;
  readonly previousStatus: 'DEPRECATED';
  readonly currentStatus: 'ACTIVE';
};

export function rotateWithOverlap(
  keys: KeyProvider,
  purpose: KeyPurpose,
  overlapUntil: string,
): SecurityResult<RotationWindow> {
  const before = keys.keyStatus(purpose);
  if (!before.ok) {
    return before;
  }
  const rotated = keys.rotateKey(purpose);
  if (!rotated.ok) {
    return rotated;
  }
  if (purpose === 'SESSION_SIGNING' && ROTATION_POLICIES.SESSION_SIGNING.invalidateSessionsOnRotate) {
    return securityErr('POLICY_REJECTED', 'session rotation must not invalidate all sessions without policy');
  }
  return securityOk(
    Object.freeze({
      purpose,
      previousVersion: before.value.version,
      currentVersion: rotated.value.version,
      overlapUntil,
      previousStatus: 'DEPRECATED',
      currentStatus: 'ACTIVE',
    }),
  );
}

export function historicalVerifyAllowed(metadata: KeyMetadata, now: string, overlapUntil: string): boolean {
  if (metadata.status === 'REVOKED' || metadata.status === 'RETIRED') {
    return false;
  }
  if (metadata.status === 'DEPRECATED') {
    return Date.parse(now) < Date.parse(overlapUntil);
  }
  return metadata.status === 'ACTIVE';
}

export type EmergencyRevocation = {
  readonly purpose: KeyPurpose;
  readonly version: number;
  readonly reason: string;
  readonly recordedAt: string;
  readonly sessionsInvalidated: boolean;
  readonly encryptedDataPreserved: true;
  readonly validatorStatePreserved: true;
};

export function emergencyRevoke(
  keys: KeyProvider,
  purpose: KeyPurpose,
  version: number,
  reason: string,
  now: string,
): SecurityResult<EmergencyRevocation> {
  if (reason.trim().length === 0) {
    return securityErr('POLICY_REJECTED', 'emergency revocation requires a recorded reason');
  }
  const revoked = keys.revokeKey(purpose, version);
  if (!revoked.ok) {
    return revoked;
  }
  return securityOk(
    Object.freeze({
      purpose,
      version,
      reason,
      recordedAt: now,
      sessionsInvalidated: purpose === 'SESSION_SIGNING' || purpose === 'ADMINISTRATION_SIGNING',
      encryptedDataPreserved: true,
      validatorStatePreserved: true,
    }),
  );
}
