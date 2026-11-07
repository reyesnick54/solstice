/**
 * HELIOS MARKET DATA MD02 — institutional temporal provenance types.
 */

import type { UtcInstant } from '@solstice/domain';
import {
  HELIOS_MD02_PRECISION_TIME_SCHEMA,
  type ClockDisciplineStateKind,
  type ClockSyncSource,
  type TimestampPrecision,
} from './taxonomy.ts';

export type ClockOffsetObservation = {
  readonly observedAt: UtcInstant;
  readonly clockOffsetNs: bigint;
  readonly referenceSource: ClockSyncSource;
};

export type ClockUncertainty = {
  readonly clockUncertaintyNs: bigint;
  readonly measuredAt: UtcInstant;
};

export type ClockDisciplineState = {
  readonly state: ClockDisciplineStateKind;
  readonly syncSource: ClockSyncSource;
  readonly offset: ClockOffsetObservation | null;
  readonly uncertainty: ClockUncertainty | null;
  readonly hardwareTimestampingClaimed: boolean;
};

export type TimestampQualityState = {
  readonly sourceTimestampPrecision: TimestampPrecision;
  readonly receiveTimestampPrecision: TimestampPrecision;
  readonly clockInconsistency: boolean;
  readonly negativeLatencyDetected: boolean;
};

export type MarketTimeEnvelope = {
  readonly schema: typeof HELIOS_MD02_PRECISION_TIME_SCHEMA;
  /** When the exchange says the market event occurred. */
  readonly exchangeEventTime: UtcInstant | null;
  /** When the exchange sent the message on the wire, if known. */
  readonly exchangeSendTime: UtcInstant | null;
  /** When the provider first received the exchange message. */
  readonly providerReceiveTime: UtcInstant | null;
  /** When the provider published the observation on its feed. */
  readonly providerPublishTime: UtcInstant | null;
  /** When SunRey first received bytes from the provider network path. */
  readonly sunreyNetworkReceiveTime: UtcInstant;
  /** When SunRey finished decoding the provider payload. */
  readonly sunreyDecodeTime: UtcInstant;
  /** When SunRey finished normalizing to canonical market observation shape. */
  readonly sunreyNormalizeTime: UtcInstant;
  /** When SunRey durably persisted the sealed observation. */
  readonly sunreyPersistTime: UtcInstant;
  /**
   * Earliest UTC instant SunRey could have known this observation.
   * Never earlier than the latest availability stage in the pipeline.
   */
  readonly knowableAt: UtcInstant;
  readonly clockDiscipline: ClockDisciplineState;
  readonly timestampQuality: TimestampQualityState;
};

export type MarketTimeLatencySegment =
  | 'wire_provider'
  | 'ingestion'
  | 'normalization'
  | 'persistence';

export type MarketTimeLatencyResult = {
  readonly wireProviderLatencyMs: number | null;
  readonly ingestionLatencyMs: number | null;
  readonly normalizationLatencyMs: number | null;
  readonly persistenceLatencyMs: number | null;
  readonly negativeSegments: readonly MarketTimeLatencySegment[];
};

export type BuildMarketTimeEnvelopeInput = {
  readonly exchangeEventTime?: UtcInstant | null;
  readonly exchangeSendTime?: UtcInstant | null;
  readonly providerReceiveTime?: UtcInstant | null;
  readonly providerPublishTime?: UtcInstant | null;
  readonly sunreyNetworkReceiveTime: UtcInstant;
  readonly sunreyDecodeTime?: UtcInstant;
  readonly sunreyNormalizeTime?: UtcInstant;
  readonly sunreyPersistTime?: UtcInstant;
  readonly clockDiscipline?: ClockDisciplineState;
  readonly sourceTimestampPrecision?: TimestampPrecision;
  readonly receiveTimestampPrecision?: TimestampPrecision;
  readonly clockAheadToleranceMs?: number;
  /** Monotonic process clock samples for internal latency (hrtime ns). */
  readonly processMonotonicNs?: Readonly<{
    readonly networkReceive: bigint;
    readonly decode?: bigint;
    readonly normalize?: bigint;
    readonly persist?: bigint;
  }>;
};
