/**
 * Client secure-storage port.
 *
 * Backend code receives references and public descriptors only.
 * Device-local key material, delegated session keys, and authentication
 * credentials stay on the client.
 */

import type { SecureLocalStoragePort } from './types.ts';

export class InMemorySecureLocalStorage implements SecureLocalStoragePort {
  readonly exposeToBackend = false as const;
  private readonly slots = new Map<string, string>();

  storeLocal(slot: string, materialRef: string): void {
    this.slots.set(slot, materialRef);
  }

  loadLocal(slot: string): string | null {
    return this.slots.get(slot) ?? null;
  }

  wipeLocal(slot: string): void {
    this.slots.delete(slot);
  }

  backendView(): { readonly slots: readonly string[]; readonly exposeToBackend: false } {
    return { slots: [...this.slots.keys()], exposeToBackend: false };
  }
}

export const BACKUP_MODELS = Object.freeze({
  SELF_CUSTODY: 'Local hardware or encrypted client backup. SunRey servers never store a plaintext seed.',
  ASSISTED_SELF_CUSTODY: 'Client holds signing keys. Recovery contacts hold narrowly scoped recovery descriptors only.',
  INSTITUTIONAL_CUSTODY: 'Canonical custody operator process and HSM/KMS ports. No wallet-package keystore.',
  MACHINE_CONTROLLED: 'Machine mandate plus hardware/HSM signer port. No seed phrase in application servers.',
  DELEGATED_AGENT: 'Delegated key material is purpose-bound and revocable. No master authority backup.',
} as const);
