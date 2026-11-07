/**
 * HELIOS Market Data MD11 — immutable tick store and historical replay types.
 *
 * Research/reference plane only. Does not grant Execution Authority.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';

export const HELIOS_MD11_SCHEMA = 'sunrey.helios.market-data.md11.v1' as const;
export const HELIOS_MD11 = 'HELIOS_MD11_IMMUTABLE_TICK_STORE' as const;

export const HELIOS_MD11_DETERMINISTIC_REPLAY_QUALIFIED =
  'HELIOS_MD11_DETERMINISTIC_REPLAY_QUALIFIED' as const;
export const HELIOS_MD11_DETERMINISTIC_REPLAY_BLOCKED =
  'HELIOS_MD11_DETERMINISTIC_REPLAY_BLOCKED' as const;

export const MARKET_REPLAY_MODES = ['SOURCE_TIME', 'ARRIVAL_TIME', 'KNOWABLE_AT_TIME'] as const;
export type MarketReplayMode = (typeof MARKET_REPLAY_MODES)[number];

export const RAW_MARKET_EVENT_KINDS = [
  'trade',
  'quote',
  'bar',
  'halt',
  'status',
  'book',
  'heartbeat',
  'provider_failure',
  'revision',
  'sequence_gap',
] as const;
export type RawMarketEventKind = (typeof RAW_MARKET_EVENT_KINDS)[number];

export const NORMALIZED_HELIOS_EVENT_KINDS = [
  'trade',
  'quote',
  'ohlcv_bar',
  'market_status',
  'order_book_snapshot',
  'provider_failure',
  'revision',
  'sequence_gap',
] as const;
export type NormalizedHeliosEventKind = (typeof NORMALIZED_HELIOS_EVENT_KINDS)[number];

/** Partition dimensions: trade date × venue × feed × instrument family. */
export type MarketDataPartitionKey = Readonly<{
  readonly tradeDate: string;
  readonly venue: string;
  readonly feed: string;
  readonly instrumentFamily: string;
}>;

/** Secondary index dimensions retained on every stored event. */
export type MarketEventIndexFields = Readonly<{
  readonly instrument: string;
  readonly venue: string;
  readonly provider: string;
  readonly exchangeTime: UtcInstant;
  readonly sunreyReceiveTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly sequence: bigint | null;
}>;

export type RawMarketEventRecord = Readonly<{
  readonly schema: typeof HELIOS_MD11_SCHEMA;
  readonly storeKind: 'raw';
  readonly eventId: string;
  readonly partition: MarketDataPartitionKey;
  readonly index: MarketEventIndexFields;
  readonly rawKind: RawMarketEventKind;
  readonly providerPayload: string;
  readonly providerPayloadHash: string;
  readonly ingestSequence: bigint;
  readonly packetOrder: number;
  readonly isLate: boolean;
  readonly isRevision: boolean;
  readonly revisesEventId: string | null;
  readonly providerFailure: boolean;
  readonly recordedAt: UtcInstant;
}>;

export type NormalizedMarketEventRecord = Readonly<{
  readonly schema: typeof HELIOS_MD11_SCHEMA;
  readonly storeKind: 'normalized';
  readonly eventId: string;
  readonly rawEventId: string;
  readonly partition: MarketDataPartitionKey;
  readonly index: MarketEventIndexFields;
  readonly heliosKind: NormalizedHeliosEventKind;
  readonly normalizedBody: string;
  readonly normalizedBodyHash: string;
  readonly ingestSequence: bigint;
  readonly packetOrder: number;
  readonly isLate: boolean;
  readonly isRevision: boolean;
  readonly revisesEventId: string | null;
  readonly providerFailure: boolean;
  readonly recordedAt: UtcInstant;
}>;

export type MarketSessionManifest = Readonly<{
  readonly schema: typeof HELIOS_MD11_SCHEMA;
  readonly sessionId: string;
  readonly partition: MarketDataPartitionKey;
  readonly sessionOpenUtc: UtcInstant;
  readonly sessionCloseUtc: UtcInstant | null;
  readonly rawEventCount: number;
  readonly normalizedEventCount: number;
  readonly firstExchangeTime: UtcInstant | null;
  readonly lastExchangeTime: UtcInstant | null;
  readonly sequenceGapCount: number;
  readonly haltCount: number;
  readonly providerFailureCount: number;
  readonly contentFingerprint: string;
}>;

export type ReplayCheckpoint = Readonly<{
  readonly schema: typeof HELIOS_MD11_SCHEMA;
  readonly checkpointId: string;
  readonly replayId: string;
  readonly mode: MarketReplayMode;
  readonly cursorInstant: UtcInstant;
  readonly cursorIngestSequence: bigint;
  readonly eventsEmitted: number;
  readonly fingerprint: string;
  readonly recordedAt: UtcInstant;
}>;

export type MarketReplayManifest = Readonly<{
  readonly schema: typeof HELIOS_MD11_SCHEMA;
  readonly replayId: string;
  readonly mode: MarketReplayMode;
  readonly partition: MarketDataPartitionKey;
  readonly windowFrom: UtcInstant;
  readonly windowTo: UtcInstant;
  readonly sessionManifestIds: readonly string[];
  readonly barBuilderVersion: string;
  readonly preservesSequenceGaps: true;
  readonly preservesHalts: true;
  readonly preservesLateMessages: true;
  readonly preservesRevisions: true;
  readonly preservesProviderFailures: true;
  readonly replayFingerprint: string;
  readonly checkpointIds: readonly string[];
}>;

export const MD11_BAR_BUILDER_VERSION = 'helios.md11.bar-builder.v1' as const;

export type DerivedOhlcvBar = Readonly<{
  readonly schema: typeof HELIOS_MD11_SCHEMA;
  readonly barId: string;
  readonly instrument: string;
  readonly venue: string;
  readonly timeframe: '1m';
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly openMinorUnits: bigint;
  readonly highMinorUnits: bigint;
  readonly lowMinorUnits: bigint;
  readonly closeMinorUnits: bigint;
  readonly volumeMinorUnits: bigint;
  readonly barBuilderVersion: typeof MD11_BAR_BUILDER_VERSION;
  readonly sourceObservationIds: readonly string[];
  readonly immutable: true;
}>;

export type ReplayTimelineEntry = Readonly<{
  readonly orderingInstant: UtcInstant;
  readonly ingestSequence: bigint;
  readonly packetOrder: number;
  readonly raw: RawMarketEventRecord | null;
  readonly normalized: NormalizedMarketEventRecord | null;
}>;

export type ReplayEmitResult = Readonly<{
  readonly entries: readonly ReplayTimelineEntry[];
  readonly manifest: MarketReplayManifest;
  readonly checkpoints: readonly ReplayCheckpoint[];
  readonly derivedBars: readonly DerivedOhlcvBar[];
}>;
