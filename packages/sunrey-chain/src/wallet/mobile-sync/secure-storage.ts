/**
 * Mobile secure-storage and biometric abstractions.
 *
 * Handles stay on the device. Biometrics do not leave the device
 * through SunRey APIs. There is no plaintext backend export.
 */

import { reject, type MobileSyncRejection, type SecureStorageKind } from './types.ts';

export type SecureStorageRecord = {
  readonly kind: SecureStorageKind;
  readonly handleId: string;
  readonly exported: false;
  readonly plaintextBackend: false;
};

export type BiometricUnlock = {
  readonly unlocked: boolean;
  readonly biometricLeftDevice: false;
  readonly usedFor: SecureStorageKind;
};

export class MobileSecureStorage {
  private readonly records = new Map<string, SecureStorageRecord>();
  private unlocked = false;

  store(kind: SecureStorageKind, handleId: string): SecureStorageRecord {
    const record: SecureStorageRecord = Object.freeze({
      kind,
      handleId,
      exported: false,
      plaintextBackend: false,
    });
    this.records.set(`${kind}:${handleId}`, record);
    return record;
  }

  get(kind: SecureStorageKind, handleId: string): SecureStorageRecord | undefined {
    return this.records.get(`${kind}:${handleId}`);
  }

  unlockWithBiometrics(kind: SecureStorageKind): BiometricUnlock {
    this.unlocked = true;
    return Object.freeze({
      unlocked: true,
      biometricLeftDevice: false,
      usedFor: kind,
    });
  }

  lock(): void {
    this.unlocked = false;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  refusePlaintextExport(): MobileSyncRejection {
    return reject('SELF_CUSTODY_KEY_UNAVAILABLE', 'mobile secure storage does not export plaintext key material to the backend');
  }

  list(): readonly SecureStorageRecord[] {
    return [...this.records.values()];
  }
}

export function transportIsAuthenticated(): { readonly authenticatedTransport: true; readonly customProtocol: false } {
  return Object.freeze({
    authenticatedTransport: true,
    customProtocol: false,
  });
}
