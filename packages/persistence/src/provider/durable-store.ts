/**
 * Crash-safe provider control-plane metadata fixture.
 * Never persists credential values. FILE_NOT_FOUND initializes empty.
 */

import { dirname, join } from 'node:path';

import {
  DurableStoreError,
  type SnapshotPersistOptions,
  loadEnvelopeOrEmpty,
  persistEnvelopeAtomic,
  wrapSnapshot,
} from '../production/snapshot-envelope.ts';

export type DurableProviderAcceptance =
  | 'NOT_CONFIGURED'
  | 'CONFIGURED'
  | 'ACCEPTED'
  | 'SUSPENDED'
  | 'REVOKED';

export const PROVIDER_ACCEPTANCE_TRANSITIONS: {
  readonly [S in DurableProviderAcceptance]: readonly DurableProviderAcceptance[];
} = {
  NOT_CONFIGURED: ['CONFIGURED'],
  CONFIGURED: ['ACCEPTED', 'SUSPENDED', 'REVOKED'],
  ACCEPTED: ['SUSPENDED', 'REVOKED'],
  SUSPENDED: ['ACCEPTED', 'REVOKED'],
  REVOKED: [],
};

export type DurableProviderProfile = {
  readonly providerId: string;
  readonly profileVersion: string;
  readonly profileHash: string;
  readonly acceptanceStatus: DurableProviderAcceptance;
  readonly credentialDescriptorId: string | null;
  readonly credentialVersion: number | null;
  readonly credentialReferenceHash: string | null;
  readonly endpointProfileRef: string | null;
  readonly certificationRef: string | null;
  readonly revalidationState: 'CURRENT' | 'PENDING' | 'EXPIRED';
  readonly suspensionState: 'NONE' | 'SUSPENDED' | 'REVOKED';
  readonly rawCredentialPresent: false;
  readonly revision: number;
};

export type ProviderDurableSnapshot = {
  readonly profiles: readonly DurableProviderProfile[];
  readonly secretsForbidden: true;
};

const EMPTY_PROVIDER: ProviderDurableSnapshot = Object.freeze({
  profiles: [],
  secretsForbidden: true,
});

export class DurableProviderStore {
  readonly path: string;
  private snapshot: ProviderDurableSnapshot;
  private sequence: number;
  private persistOptions: SnapshotPersistOptions;

  constructor(directory: string, persistOptions: SnapshotPersistOptions = {}) {
    this.path = join(directory, 'provider.durable.json');
    this.persistOptions = persistOptions;
    const loaded = loadEnvelopeOrEmpty(this.path, 'PROVIDER', isProviderSnapshot);
    if (loaded.kind === 'EMPTY') {
      this.snapshot = EMPTY_PROVIDER;
      this.sequence = 0;
      return;
    }
    this.snapshot = loaded.envelope.payload;
    this.sequence = loaded.envelope.sequence;
  }

  upsertProfile(profile: DurableProviderProfile, expectedRevision?: number): DurableProviderProfile {
    if (profile.rawCredentialPresent !== false) {
      throw new DurableStoreError('SCHEMA_INVALID', 'raw credentials must not be persisted');
    }
    const existing = this.snapshot.profiles.find((row) => row.providerId === profile.providerId);
    if (existing) {
      if (expectedRevision !== undefined && existing.revision !== expectedRevision) {
        throw new DurableStoreError('STALE_REVISION', `stale writer for provider ${profile.providerId}`);
      }
      if (
        existing.acceptanceStatus !== profile.acceptanceStatus &&
        !PROVIDER_ACCEPTANCE_TRANSITIONS[existing.acceptanceStatus].includes(profile.acceptanceStatus)
      ) {
        throw new DurableStoreError(
          'ILLEGAL_TRANSITION',
          `provider ${existing.acceptanceStatus} → ${profile.acceptanceStatus} is illegal`,
        );
      }
      const next = { ...profile, rawCredentialPresent: false as const, revision: existing.revision + 1 };
      this.snapshot = {
        ...this.snapshot,
        profiles: this.snapshot.profiles.map((row) => (row.providerId === profile.providerId ? next : row)),
      };
      this.persist();
      return next;
    }
    const created = { ...profile, rawCredentialPresent: false as const, revision: profile.revision ?? 1 };
    this.snapshot = { ...this.snapshot, profiles: [...this.snapshot.profiles, created] };
    this.persist();
    return created;
  }

  reopen(): DurableProviderStore {
    return new DurableProviderStore(dirname(this.path));
  }

  list(): ProviderDurableSnapshot {
    return this.snapshot;
  }

  private persist(): void {
    this.sequence += 1;
    persistEnvelopeAtomic(
      this.path,
      wrapSnapshot({
        storeKind: 'PROVIDER',
        sequence: this.sequence,
        createdAt: new Date().toISOString(),
        payload: this.snapshot,
      }),
      this.persistOptions,
    );
  }
}

function isProviderSnapshot(value: unknown): value is ProviderDurableSnapshot {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.secretsForbidden !== true || !Array.isArray(record.profiles)) {
    return false;
  }
  return (record.profiles as readonly unknown[]).every((item) => {
    if (item === null || typeof item !== 'object') {
      return false;
    }
    const row = item as Record<string, unknown>;
    return row.rawCredentialPresent === false && typeof row.providerId === 'string';
  });
}

export { DurableStoreError };
