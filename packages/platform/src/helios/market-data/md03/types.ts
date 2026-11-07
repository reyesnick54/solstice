/**
 * HELIOS MARKET DATA MD03 — sequence integrity domain types.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  BookAuthorityClass,
  FeedRecoveryPhase,
  RecoveryAdapterKind,
  RecoveryRequestStatus,
  SequenceAnomalyKind,
} from './taxonomy.ts';

export type SequenceGap = {
  readonly feedId: string;
  readonly fromSequence: number;
  readonly toSequence: number;
  readonly detectedAt: UtcInstant;
  readonly anomaly: SequenceAnomalyKind;
};

export type RecoveryRequest = {
  readonly requestId: string;
  readonly feedId: string;
  readonly adapterKind: RecoveryAdapterKind;
  readonly fromSequence: number;
  readonly toSequence: number;
  readonly requestedAt: UtcInstant;
  readonly status: RecoveryRequestStatus;
  readonly supportsRetransmission: boolean;
};

export type RecoveryState = {
  readonly activeRequest: RecoveryRequest | null;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly lastCompletedSequence: number | null;
  readonly lastFailureReason: string | null;
};

export type FeedSessionState = {
  readonly sessionId: string;
  readonly sessionGeneration: number;
  readonly startedAt: UtcInstant;
  readonly lastResetAt: UtcInstant | null;
  readonly resetReason: SequenceAnomalyKind | 'COLD_START' | null;
};

export type MarketFeedIncrementalUpdate = {
  readonly feedId: string;
  readonly sequence: number;
  readonly sessionId: string;
  readonly sessionGeneration: number;
  readonly payloadId: string;
  readonly observedAt: UtcInstant;
  readonly checksum: string | null;
};

export type MarketFeedSnapshot = {
  readonly feedId: string;
  readonly sequence: number;
  readonly sessionId: string;
  readonly sessionGeneration: number;
  readonly observedAt: UtcInstant;
  readonly checksum: string;
  readonly checksumValid: boolean;
  readonly stale: boolean;
};

export type BufferedIncremental = {
  readonly update: MarketFeedIncrementalUpdate;
  readonly bufferedAt: UtcInstant;
};

export type SequenceAnomalyEvent = {
  readonly kind: SequenceAnomalyKind;
  readonly sequence: number | null;
  readonly message: string;
  readonly at: UtcInstant;
};

export type MarketFeedSequenceState = {
  readonly feedId: string;
  readonly phase: FeedRecoveryPhase;
  readonly bookAuthority: BookAuthorityClass;
  readonly session: FeedSessionState;
  readonly recovery: RecoveryState;
  readonly lastAppliedSequence: number | null;
  readonly expectedNextSequence: number | null;
  readonly openGap: SequenceGap | null;
  readonly bufferedIncrementals: readonly BufferedIncremental[];
  readonly recentAnomalies: readonly SequenceAnomalyEvent[];
};

export type RecoveryAdapterProfile = {
  readonly adapterKind: RecoveryAdapterKind;
  readonly supportsRetransmission: boolean;
  readonly supportsSnapshotRecovery: boolean;
  readonly supportsRecoveryFeed: boolean;
  readonly requiresChecksum: boolean;
};

export type MarketFeedRecoveryPolicy = {
  readonly maxBufferedIncrementals: number;
  readonly maxRecoveryAttempts: number;
  readonly snapshotMaxAgeMs: number;
  readonly adapter: RecoveryAdapterProfile;
};
