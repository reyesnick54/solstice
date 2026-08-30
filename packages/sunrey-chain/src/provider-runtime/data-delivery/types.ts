/**
 * Wave 1 Prompt 6 — provider data cache, persistence, and refresh types.
 *
 * Extends the universal provider runtime (`packages/sunrey-chain/src/provider-runtime`).
 * Not a second cache package, ledger, or Execution Authority.
 * Simulation-only: no live external API integration in this prompt.
 */

export const PROVIDER_DATA_DELIVERY_SCHEMA_VERSION = 1 as const;
export const EXTERNAL_DATA_OBSERVATION_SCHEMA = 'sunrey.external-data.observation.v1' as const;

export const CACHE_FRESHNESS_STATES = ['FRESH', 'STALE_USABLE', 'EXPIRED', 'MISSING'] as const;
export type CacheFreshnessState = (typeof CACHE_FRESHNESS_STATES)[number];

export const RAW_PAYLOAD_RETENTION_POLICIES = [
  'none',
  'short_term',
  'audit_required',
  'long_term',
] as const;
export type RawPayloadRetention = (typeof RAW_PAYLOAD_RETENTION_POLICIES)[number];

export const RAW_RETENTION_TTL_MS: Readonly<Record<RawPayloadRetention, number | null>> = Object.freeze({
  none: 0,
  short_term: 86_400_000,
  audit_required: 2_592_000_000,
  long_term: null,
});

export type ExternalDataObservation = {
  readonly schema: typeof EXTERNAL_DATA_OBSERVATION_SCHEMA;
  readonly observationId: string;
  readonly providerId: string;
  readonly capability: string;
  readonly resourceId: string;
  readonly schemaVersion: string;
  readonly normalizedValue: Readonly<Record<string, string>>;
  readonly provenance: ExternalDataProvenance;
  readonly simulation: true;
};

export type ExternalDataProvenance = {
  readonly sourceId: string;
  readonly collectedAtUtc: string;
  readonly providerTimestampUtc: string | null;
  readonly deduplicationKey: string;
  readonly contentHash: string;
};

export type CachePolicy = {
  readonly freshTtlMs: number;
  readonly staleWindowMs: number;
  readonly hardExpireMs: number;
  readonly persistNormalized: boolean;
  readonly rawPayloadRetention: RawPayloadRetention;
  readonly maxHistoryEntries: number;
  readonly maxRawPayloadBytes: number;
};

export type CacheEntryMetadata = {
  readonly providerId: string;
  readonly capability: string;
  readonly resourceId: string;
  readonly createdAtUtc: string;
  readonly expiresAtUtc: string;
  readonly staleAtUtc: string;
  readonly hardExpireAtUtc: string;
  readonly schemaVersion: string;
  readonly observationId: string;
  readonly contentHash: string;
};

export type CachedObservationEnvelope = {
  readonly observation: ExternalDataObservation;
  readonly metadata: CacheEntryMetadata;
  readonly freshness: CacheFreshnessState;
  readonly stale: boolean;
  readonly rawPayload?: string | undefined;
};

export type CacheInvalidateScope = {
  readonly providerId?: string | undefined;
  readonly capability?: string | undefined;
  readonly resourceId?: string | undefined;
  readonly schemaVersion?: string | undefined;
};

export type ProviderDataCache = {
  get(key: string): Promise<CachedObservationEnvelope | undefined>;
  set(
    key: string,
    observation: ExternalDataObservation,
    policy: CachePolicy,
    rawPayload?: string | undefined,
  ): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  getMetadata(key: string): Promise<CacheEntryMetadata | undefined>;
  invalidate(scope: CacheInvalidateScope): Promise<number>;
  cleanupExpired(nowUtc: string): Promise<number>;
  snapshot(): Promise<readonly { readonly key: string; readonly envelope: CachedObservationEnvelope }[]>;
};

export type PersistedObservationRecord = {
  readonly observationId: string;
  readonly providerId: string;
  readonly capability: string;
  readonly resourceId: string;
  readonly schemaVersion: string;
  readonly observation: ExternalDataObservation;
  readonly persistedAtUtc: string;
  readonly rawPayloadRetention: RawPayloadRetention;
  readonly rawPayload?: string | undefined;
  readonly contentHash: string;
};

export type ObservationPersistenceStore = {
  persist(record: PersistedObservationRecord): Promise<'accepted' | 'duplicate'>;
  get(observationId: string): Promise<PersistedObservationRecord | undefined>;
  listByResource(input: {
    readonly providerId: string;
    readonly capability: string;
    readonly resourceId: string;
    readonly limit?: number | undefined;
  }): Promise<readonly PersistedObservationRecord[]>;
  cleanup(input: {
    readonly nowUtc: string;
    readonly policy: CachePolicy;
  }): Promise<number>;
  snapshot(): Promise<readonly PersistedObservationRecord[]>;
};

export type RefreshScheduleEntry = {
  readonly scheduleId: string;
  readonly providerId: string;
  readonly capability: string;
  readonly intervalMs: number;
  readonly jitterMs: number;
  readonly priority: number;
  readonly enabled: boolean;
  readonly maxRuntimeMs: number;
  readonly resourceId: string;
};

export const PROVIDER_REFRESH_JOB_TYPE = 'PROVIDER_DATA_REFRESH' as const;

export type RefreshFailureRecord = {
  readonly providerId: string;
  readonly capability: string;
  readonly resourceId: string;
  readonly failedAtUtc: string;
  readonly errorSafe: string;
  readonly retainedCached: boolean;
};

export type DataDeliveryClock = {
  nowUtc(): string;
  nowMs(): number;
};

export type ProviderFetchResult = {
  readonly ok: true;
  readonly observation: ExternalDataObservation;
  readonly rawPayload?: string | undefined;
} | {
  readonly ok: false;
  readonly errorSafe: string;
};

export type ProviderFetchFn = (input: {
  readonly providerId: string;
  readonly capability: string;
  readonly resourceId: string;
}) => Promise<ProviderFetchResult>;
