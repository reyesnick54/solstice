/**
 * HELIOS MD03 — sequence anomaly detection (fail-closed; no silent repair).
 */

import type { UtcInstant } from '@solstice/domain';
import type { SequenceAnomalyKind } from './taxonomy.ts';
import type { FeedSessionState, MarketFeedSnapshot, SequenceAnomalyEvent } from './types.ts';

export type SequenceObservation = {
  readonly sequence: number;
  readonly sessionId: string;
  readonly sessionGeneration: number;
  readonly checksum: string | null;
  readonly expectedChecksum: string | null;
  readonly at: UtcInstant;
};

export type SequenceDetectionContext = {
  readonly lastAppliedSequence: number | null;
  readonly expectedNextSequence: number | null;
  readonly session: FeedSessionState;
  readonly observation: SequenceObservation;
};

export function detectSequenceAnomalies(context: SequenceDetectionContext): readonly SequenceAnomalyEvent[] {
  const events: SequenceAnomalyEvent[] = [];
  const { observation, session, lastAppliedSequence, expectedNextSequence } = context;

  if (observation.sessionGeneration > session.sessionGeneration) {
    events.push(anomaly('SESSION_RESET', observation.sequence, 'Feed session generation advanced', observation.at));
  } else if (observation.sessionGeneration < session.sessionGeneration) {
    events.push(anomaly('SESSION_RESET', observation.sequence, 'Stale session generation on incremental', observation.at));
  } else if (observation.sessionId !== session.sessionId) {
    events.push(anomaly('SESSION_RESET', observation.sequence, 'Session identifier changed', observation.at));
  }

  if (lastAppliedSequence !== null) {
    if (observation.sequence === lastAppliedSequence) {
      events.push(anomaly('DUPLICATE_SEQUENCE', observation.sequence, 'Duplicate sequence number', observation.at));
    } else if (observation.sequence < lastAppliedSequence) {
      events.push(anomaly('OUT_OF_ORDER_SEQUENCE', observation.sequence, 'Sequence regressed below last applied', observation.at));
      if (observation.sequence === 1 || observation.sequence < lastAppliedSequence / 2) {
        events.push(anomaly('SEQUENCE_RESET', observation.sequence, 'Large sequence regression detected', observation.at));
      }
    } else if (expectedNextSequence !== null && observation.sequence > expectedNextSequence) {
      events.push(
        anomaly(
          'MISSING_SEQUENCE',
          observation.sequence,
          `Gap: expected ${expectedNextSequence}, received ${observation.sequence}`,
          observation.at,
        ),
      );
    } else if (expectedNextSequence !== null && observation.sequence < expectedNextSequence) {
      events.push(
        anomaly(
          'OUT_OF_ORDER_SEQUENCE',
          observation.sequence,
          `Late arrival below expected next ${expectedNextSequence}`,
          observation.at,
        ),
      );
    }
  }

  if (observation.checksum !== null && observation.expectedChecksum !== null && observation.checksum !== observation.expectedChecksum) {
    events.push(anomaly('CHECKSUM_MISMATCH', observation.sequence, 'Incremental checksum mismatch', observation.at));
  }

  return Object.freeze(events);
}

export function detectSnapshotAnomalies(
  snapshot: MarketFeedSnapshot,
  options: { readonly nowUtc: UtcInstant; readonly maxAgeMs: number },
): readonly SequenceAnomalyEvent[] {
  const events: SequenceAnomalyEvent[] = [];
  const observedMs = Date.parse(snapshot.observedAt);
  const nowMs = Date.parse(options.nowUtc);
  if (!Number.isNaN(observedMs) && !Number.isNaN(nowMs) && nowMs - observedMs > options.maxAgeMs) {
    events.push(anomaly('STALE_SNAPSHOT', snapshot.sequence, 'Snapshot exceeds freshness policy', options.nowUtc));
  }
  if (!snapshot.checksumValid) {
    events.push(anomaly('CHECKSUM_MISMATCH', snapshot.sequence, 'Snapshot checksum invalid', options.nowUtc));
  }
  return Object.freeze(events);
}

export function sequenceGapFromMissing(
  feedId: string,
  fromSequence: number,
  toSequence: number,
  at: UtcInstant,
): import('./types.ts').SequenceGap {
  return Object.freeze({
    feedId,
    fromSequence,
    toSequence,
    detectedAt: at,
    anomaly: 'MISSING_SEQUENCE',
  });
}

export function isRecoverableAnomaly(kind: SequenceAnomalyKind): boolean {
  return kind === 'MISSING_SEQUENCE' || kind === 'OUT_OF_ORDER_SEQUENCE';
}

export function forcesFailedSafe(kind: SequenceAnomalyKind): boolean {
  return kind === 'CHECKSUM_MISMATCH' || kind === 'STALE_SNAPSHOT';
}

/** Session or large sequence discontinuities require resync — never stay authoritative. */
export function requiresFeedResynchronization(kind: SequenceAnomalyKind): boolean {
  return kind === 'SESSION_RESET' || kind === 'SEQUENCE_RESET';
}

function anomaly(kind: SequenceAnomalyKind, sequence: number | null, message: string, at: UtcInstant): SequenceAnomalyEvent {
  return Object.freeze({ kind, sequence, message, at });
}
