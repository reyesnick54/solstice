/**
 * Durable snapshot for the universal provider runtime control plane.
 * Never persists credential values. FILE_NOT_FOUND initializes empty.
 * Corruption fails closed. Not a second ledger.
 */

import { dirname, join } from 'node:path';

import type { UniversalProviderSnapshot } from '../../../sunrey-chain/src/provider-runtime/universal/types.ts';
import { EMPTY_UNIVERSAL_SNAPSHOT } from '../../../sunrey-chain/src/provider-runtime/universal/types.ts';
import {
  DurableStoreError,
  type SnapshotPersistOptions,
  loadEnvelopeOrEmpty,
  persistEnvelopeAtomic,
  wrapSnapshot,
} from '../production/snapshot-envelope.ts';

export type DurableUniversalProviderSnapshot = UniversalProviderSnapshot;

const EMPTY: DurableUniversalProviderSnapshot = EMPTY_UNIVERSAL_SNAPSHOT;

export class DurableUniversalProviderStore {
  readonly path: string;
  private snapshot: DurableUniversalProviderSnapshot;
  private sequence: number;
  private persistOptions: SnapshotPersistOptions;

  constructor(directory: string, persistOptions: SnapshotPersistOptions = {}) {
    this.path = join(directory, 'universal-provider.durable.json');
    this.persistOptions = persistOptions;
    const loaded = loadEnvelopeOrEmpty(this.path, 'PROVIDER', isUniversalSnapshot);
    if (loaded.kind === 'EMPTY') {
      this.snapshot = EMPTY;
      this.sequence = 0;
      return;
    }
    this.snapshot = reviveSnapshot(loaded.envelope.payload);
    this.sequence = loaded.envelope.sequence;
  }

  replace(snapshot: DurableUniversalProviderSnapshot): DurableUniversalProviderSnapshot {
    if (snapshot.secretsForbidden !== true) {
      throw new DurableStoreError('SCHEMA_INVALID', 'secrets must be forbidden');
    }
    if (snapshot.productionActive !== false || snapshot.liveConnectivityEnabled !== false) {
      throw new DurableStoreError('SCHEMA_INVALID', 'production must remain disabled');
    }
    for (const row of snapshot.registrations) {
      if (row.rawCredentialPresent !== false) {
        throw new DurableStoreError('SCHEMA_INVALID', 'raw credentials must not be persisted');
      }
    }
    this.snapshot = snapshot;
    this.persist();
    return this.snapshot;
  }

  list(): DurableUniversalProviderSnapshot {
    return this.snapshot;
  }

  reopen(): DurableUniversalProviderStore {
    return new DurableUniversalProviderStore(dirname(this.path));
  }

  private persist(): void {
    this.sequence += 1;
    persistEnvelopeAtomic(
      this.path,
      wrapSnapshot({
        storeKind: 'PROVIDER',
        sequence: this.sequence,
        createdAt: new Date().toISOString(),
        payload: serializeSnapshot(this.snapshot),
      }),
      this.persistOptions,
    );
  }
}

function serializeSnapshot(snapshot: DurableUniversalProviderSnapshot): unknown {
  return JSON.parse(
    JSON.stringify(snapshot, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)),
  );
}

function reviveSnapshot(value: DurableUniversalProviderSnapshot): DurableUniversalProviderSnapshot {
  return Object.freeze({
    ...value,
    limitedLiveRules: Object.freeze(
      value.limitedLiveRules.map((rule) =>
        Object.freeze({
          ...rule,
          maxTransactionMinor:
            rule.maxTransactionMinor === null || rule.maxTransactionMinor === undefined
              ? null
              : BigInt(rule.maxTransactionMinor as unknown as string),
          dailyAggregateCapMinor:
            rule.dailyAggregateCapMinor === null || rule.dailyAggregateCapMinor === undefined
              ? null
              : BigInt(rule.dailyAggregateCapMinor as unknown as string),
          activated: false as const,
        }),
      ),
    ),
  });
}

function isUniversalSnapshot(value: unknown): value is DurableUniversalProviderSnapshot {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.schemaVersion === 1 &&
    record.secretsForbidden === true &&
    record.productionActive === false &&
    record.liveConnectivityEnabled === false &&
    record.productionAuthorized === false &&
    Array.isArray(record.registrations)
  );
}

export { DurableStoreError };
