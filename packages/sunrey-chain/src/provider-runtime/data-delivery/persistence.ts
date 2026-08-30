/**
 * Observation persistence for historical retention.
 */

import type {
  CachePolicy,
  ObservationPersistenceStore,
  PersistedObservationRecord,
} from './types.ts';
import { rawPayloadAllowed, rawPayloadExpired } from './policies.ts';

export class InMemoryObservationPersistence implements ObservationPersistenceStore {
  private readonly byObservationId = new Map<string, PersistedObservationRecord>();
  private readonly byResource = new Map<string, string[]>();

  async persist(record: PersistedObservationRecord): Promise<'accepted' | 'duplicate'> {
    if (this.byObservationId.has(record.observationId)) {
      return 'duplicate';
    }
    const dedupeKey = `${record.providerId}::${record.capability}::${record.resourceId}::${record.contentHash}`;
    for (const id of this.byObservationId.values()) {
      if (
        id.providerId === record.providerId &&
        id.capability === record.capability &&
        id.resourceId === record.resourceId &&
        id.contentHash === record.contentHash
      ) {
        return 'duplicate';
      }
    }
    this.byObservationId.set(record.observationId, record);
    const resourceKey = resourceIndexKey(record.providerId, record.capability, record.resourceId);
    const ids = this.byResource.get(resourceKey) ?? [];
    ids.push(record.observationId);
    this.byResource.set(resourceKey, ids);
    return 'accepted';
  }

  async get(observationId: string): Promise<PersistedObservationRecord | undefined> {
    return this.byObservationId.get(observationId);
  }

  async listByResource(input: {
    readonly providerId: string;
    readonly capability: string;
    readonly resourceId: string;
    readonly limit?: number | undefined;
  }): Promise<readonly PersistedObservationRecord[]> {
    const resourceKey = resourceIndexKey(input.providerId, input.capability, input.resourceId);
    const ids = this.byResource.get(resourceKey) ?? [];
    const limit = input.limit ?? ids.length;
    return ids
      .slice(-limit)
      .map((id) => this.byObservationId.get(id))
      .filter((row): row is PersistedObservationRecord => row !== undefined);
  }

  async cleanup(input: {
    readonly nowUtc: string;
    readonly policy: CachePolicy;
  }): Promise<number> {
    const nowMs = Date.parse(input.nowUtc);
    let removed = 0;
    for (const [observationId, record] of this.byObservationId.entries()) {
      let shouldRemove = false;
      if (record.rawPayload !== undefined) {
        if (!rawPayloadAllowed(record.rawPayloadRetention)) {
          shouldRemove = true;
        } else if (rawPayloadExpired(record.rawPayloadRetention, record.persistedAtUtc, nowMs)) {
          shouldRemove = true;
        }
      }
      const resourceKey = resourceIndexKey(record.providerId, record.capability, record.resourceId);
      const ids = this.byResource.get(resourceKey) ?? [];
      if (ids.length > input.policy.maxHistoryEntries) {
        const overflow = ids.length - input.policy.maxHistoryEntries;
        const toDrop = ids.slice(0, overflow);
        if (toDrop.includes(observationId)) {
          shouldRemove = true;
        }
      }
      if (shouldRemove) {
        this.byObservationId.delete(observationId);
        const nextIds = (this.byResource.get(resourceKey) ?? []).filter((id) => id !== observationId);
        if (nextIds.length === 0) {
          this.byResource.delete(resourceKey);
        } else {
          this.byResource.set(resourceKey, nextIds);
        }
        removed += 1;
      }
    }
    return removed;
  }

  async snapshot(): Promise<readonly PersistedObservationRecord[]> {
    return [...this.byObservationId.values()];
  }
}

export function toPersistedRecord(input: {
  readonly observation: PersistedObservationRecord['observation'];
  readonly policy: CachePolicy;
  readonly persistedAtUtc: string;
  readonly rawPayload?: string | undefined;
}): PersistedObservationRecord {
  return Object.freeze({
    observationId: input.observation.observationId,
    providerId: input.observation.providerId,
    capability: input.observation.capability,
    resourceId: input.observation.resourceId,
    schemaVersion: input.observation.schemaVersion,
    observation: input.observation,
    persistedAtUtc: input.persistedAtUtc,
    rawPayloadRetention: input.policy.rawPayloadRetention,
    rawPayload: input.rawPayload,
    contentHash: input.observation.provenance.contentHash,
  });
}

function resourceIndexKey(providerId: string, capability: string, resourceId: string): string {
  return `${providerId}::${capability}::${resourceId}`;
}
