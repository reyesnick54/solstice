/**
 * In-memory provider data cache with metadata and invalidation.
 */

import { createHash } from 'node:crypto';

import type {
  CacheEntryMetadata,
  CacheFreshnessState,
  CacheInvalidateScope,
  CachePolicy,
  CachedObservationEnvelope,
  DataDeliveryClock,
  ExternalDataObservation,
  ProviderDataCache,
} from './types.ts';
import { rawPayloadAllowed } from './policies.ts';

type StoredEntry = {
  readonly envelope: CachedObservationEnvelope;
};

export function assessCacheFreshness(
  metadata: CacheEntryMetadata,
  nowMs: number,
): CacheFreshnessState {
  const staleAt = Date.parse(metadata.staleAtUtc);
  const hardExpireAt = Date.parse(metadata.hardExpireAtUtc);
  if (nowMs >= hardExpireAt) {
    return 'EXPIRED';
  }
  if (nowMs < staleAt) {
    return 'FRESH';
  }
  return 'STALE_USABLE';
}

export function isObservationStructurallyValid(observation: ExternalDataObservation): boolean {
  if (observation.schema !== 'sunrey.external-data.observation.v1') {
    return false;
  }
  if (!observation.observationId || !observation.providerId || !observation.capability) {
    return false;
  }
  if (!observation.resourceId || !observation.schemaVersion) {
    return false;
  }
  if (!observation.provenance?.deduplicationKey || !observation.provenance.contentHash) {
    return false;
  }
  return observation.simulation === true;
}

export function computeObservationContentHash(observation: ExternalDataObservation): string {
  const payload = JSON.stringify({
    providerId: observation.providerId,
    capability: observation.capability,
    resourceId: observation.resourceId,
    schemaVersion: observation.schemaVersion,
    normalizedValue: observation.normalizedValue,
    provenance: {
      sourceId: observation.provenance.sourceId,
      providerTimestampUtc: observation.provenance.providerTimestampUtc,
      deduplicationKey: observation.provenance.deduplicationKey,
    },
  });
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

export class InMemoryProviderDataCache implements ProviderDataCache {
  private readonly entries = new Map<string, StoredEntry>();
  private readonly clock: DataDeliveryClock;

  constructor(clock: DataDeliveryClock) {
    this.clock = clock;
  }

  async get(key: string): Promise<CachedObservationEnvelope | undefined> {
    const row = this.entries.get(key);
    if (!row) {
      return undefined;
    }
    const freshness = assessCacheFreshness(row.envelope.metadata, this.clock.nowMs());
    if (freshness === 'EXPIRED') {
      return undefined;
    }
    return Object.freeze({
      ...row.envelope,
      freshness,
      stale: freshness === 'STALE_USABLE',
    });
  }

  async set(
    key: string,
    observation: ExternalDataObservation,
    policy: CachePolicy,
    rawPayload?: string | undefined,
  ): Promise<void> {
    if (!isObservationStructurallyValid(observation)) {
      throw new Error('invalid observation cannot be cached');
    }
    if (rawPayload !== undefined) {
      if (!rawPayloadAllowed(policy.rawPayloadRetention)) {
        throw new Error('raw payload retention policy forbids storing payload');
      }
      if (rawPayload.length > policy.maxRawPayloadBytes) {
        throw new Error('raw payload exceeds max size');
      }
    }
    const nowMs = this.clock.nowMs();
    const nowUtc = this.clock.nowUtc();
    const metadata: CacheEntryMetadata = Object.freeze({
      providerId: observation.providerId,
      capability: observation.capability,
      resourceId: observation.resourceId,
      createdAtUtc: nowUtc,
      staleAtUtc: new Date(nowMs + policy.freshTtlMs).toISOString(),
      expiresAtUtc: new Date(nowMs + policy.freshTtlMs + policy.staleWindowMs).toISOString(),
      hardExpireAtUtc: new Date(nowMs + policy.hardExpireMs).toISOString(),
      schemaVersion: observation.schemaVersion,
      observationId: observation.observationId,
      contentHash: observation.provenance.contentHash,
    });
    const envelope: CachedObservationEnvelope = Object.freeze({
      observation,
      metadata,
      freshness: 'FRESH',
      stale: false,
      rawPayload: rawPayload ?? undefined,
    });
    this.entries.set(key, { envelope });
  }

  async delete(key: string): Promise<boolean> {
    return this.entries.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const row = await this.get(key);
    return row !== undefined;
  }

  async getMetadata(key: string): Promise<CacheEntryMetadata | undefined> {
    const row = this.entries.get(key);
    return row?.envelope.metadata;
  }

  async invalidate(scope: CacheInvalidateScope): Promise<number> {
    let removed = 0;
    for (const [key, row] of this.entries.entries()) {
      const meta = row.envelope.metadata;
      if (scope.providerId && meta.providerId !== scope.providerId) {
        continue;
      }
      if (scope.capability && meta.capability !== scope.capability) {
        continue;
      }
      if (scope.resourceId && meta.resourceId !== scope.resourceId) {
        continue;
      }
      if (scope.schemaVersion && meta.schemaVersion !== scope.schemaVersion) {
        continue;
      }
      this.entries.delete(key);
      removed += 1;
    }
    return removed;
  }

  async cleanupExpired(nowUtc: string): Promise<number> {
    const nowMs = Date.parse(nowUtc);
    let removed = 0;
    for (const [key, row] of this.entries.entries()) {
      if (Date.parse(row.envelope.metadata.hardExpireAtUtc) <= nowMs) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  async snapshot(): Promise<readonly { readonly key: string; readonly envelope: CachedObservationEnvelope }[]> {
    return [...this.entries.entries()].map(([key, row]) =>
      Object.freeze({ key, envelope: row.envelope }),
    );
  }
}
