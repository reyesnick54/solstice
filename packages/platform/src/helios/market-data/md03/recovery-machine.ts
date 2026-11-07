/**
 * HELIOS MD03 — lossless feed sequence recovery state machine.
 * A book with a broken sequence is never treated as current.
 */

import type { UtcInstant } from '@solstice/domain';
import {
  detectSequenceAnomalies,
  detectSnapshotAnomalies,
  forcesFailedSafe,
  isRecoverableAnomaly,
  requiresFeedResynchronization,
  sequenceGapFromMissing,
} from './detection.ts';
import { buildRecoveryRequest, selectRecoveryStrategy } from './recovery-adapters.ts';
import type {
  BufferedIncremental,
  MarketFeedIncrementalUpdate,
  MarketFeedRecoveryPolicy,
  MarketFeedSequenceState,
  MarketFeedSnapshot,
  RecoveryRequest,
  SequenceAnomalyEvent,
} from './types.ts';
import type { FeedRecoveryPhase } from './taxonomy.ts';

let requestCounter = 0;

function nextRequestId(): string {
  requestCounter += 1;
  return `md03-recovery-${requestCounter}`;
}

export function createMarketFeedSequenceState(input: {
  readonly feedId: string;
  readonly sessionId: string;
  readonly startedAt: UtcInstant;
  readonly policy: MarketFeedRecoveryPolicy;
}): MarketFeedSequenceState {
  return Object.freeze({
    feedId: input.feedId,
    phase: 'INITIALIZING',
    bookAuthority: 'NON_AUTHORITATIVE',
    session: Object.freeze({
      sessionId: input.sessionId,
      sessionGeneration: 1,
      startedAt: input.startedAt,
      lastResetAt: null,
      resetReason: 'COLD_START',
    }),
    recovery: Object.freeze({
      activeRequest: null,
      attemptCount: 0,
      maxAttempts: input.policy.maxRecoveryAttempts,
      lastCompletedSequence: null,
      lastFailureReason: null,
    }),
    lastAppliedSequence: null,
    expectedNextSequence: null,
    openGap: null,
    bufferedIncrementals: Object.freeze([]),
    recentAnomalies: Object.freeze([]),
  });
}

export type IngestIncrementalResult = {
  readonly state: MarketFeedSequenceState;
  readonly applied: boolean;
  readonly buffered: boolean;
  readonly anomalies: readonly SequenceAnomalyEvent[];
};

export function ingestMarketFeedIncremental(
  state: MarketFeedSequenceState,
  update: MarketFeedIncrementalUpdate,
  policy: MarketFeedRecoveryPolicy,
): IngestIncrementalResult {
  if (state.phase === 'FAILED_SAFE') {
    return Object.freeze({
      state,
      applied: false,
      buffered: false,
      anomalies: Object.freeze([
        Object.freeze({
          kind: 'MISSING_SEQUENCE' as const,
          sequence: update.sequence,
          message: 'Feed in FAILED_SAFE; incrementals rejected',
          at: update.observedAt,
        }),
      ]),
    });
  }

  const checksumExpected =
    policy.adapter.requiresChecksum && update.checksum !== null ? update.checksum : null;

  const anomalies = detectSequenceAnomalies({
    lastAppliedSequence: state.lastAppliedSequence,
    expectedNextSequence: state.expectedNextSequence,
    session: state.session,
    observation: Object.freeze({
      sequence: update.sequence,
      sessionId: update.sessionId,
      sessionGeneration: update.sessionGeneration,
      checksum: update.checksum,
      expectedChecksum: checksumExpected,
      at: update.observedAt,
    }),
  });

  const blocking = anomalies.find(
    (row) =>
      row.kind !== 'DUPLICATE_SEQUENCE' ||
      anomalies.some((other) => other.kind !== 'DUPLICATE_SEQUENCE'),
  );

  if (anomalies.some((row) => row.kind === 'DUPLICATE_SEQUENCE') && anomalies.length === 1) {
    return Object.freeze({
      state: withAnomalies(state, anomalies),
      applied: false,
      buffered: false,
      anomalies,
    });
  }

  const needsRecovery = anomalies.some(
    (row) =>
      row.kind !== 'DUPLICATE_SEQUENCE' &&
      (isRecoverableAnomaly(row.kind) ||
        forcesFailedSafe(row.kind) ||
        requiresFeedResynchronization(row.kind)),
  );

  if (!needsRecovery && state.phase === 'INITIALIZING') {
    const synced = applyIncremental(state, update, 'SYNCHRONIZED', 'AUTHORITATIVE');
    return Object.freeze({ state: synced, applied: true, buffered: false, anomalies });
  }

  if (!needsRecovery && state.phase === 'SYNCHRONIZED' && state.bookAuthority === 'AUTHORITATIVE') {
    const synced = applyIncremental(state, update, 'SYNCHRONIZED', 'AUTHORITATIVE');
    return Object.freeze({ state: synced, applied: true, buffered: false, anomalies });
  }

  if (
    !needsRecovery &&
    state.expectedNextSequence !== null &&
    update.sequence === state.expectedNextSequence &&
    (state.phase === 'RECOVERING' || state.phase === 'RESYNCHRONIZING' || state.phase === 'GAP_DETECTED')
  ) {
    const authority: 'AUTHORITATIVE' | 'NON_AUTHORITATIVE' = 'NON_AUTHORITATIVE';
    const phase: FeedRecoveryPhase = state.openGap === null ? 'SYNCHRONIZED' : state.phase;
    const synced = applyIncremental(state, update, phase, authority);
    return Object.freeze({ state: synced, applied: true, buffered: false, anomalies });
  }

  if (!needsRecovery && (state.phase === 'RECOVERING' || state.phase === 'GAP_DETECTED')) {
    return Object.freeze({
      state: withBuffered(state, update, policy, anomalies),
      applied: false,
      buffered: true,
      anomalies,
    });
  }

  if (needsRecovery && blocking) {
    return handleGap(state, update, policy, anomalies);
  }

  const synced = applyIncremental(state, update, state.phase, state.bookAuthority);
  return Object.freeze({ state: synced, applied: true, buffered: false, anomalies });
}

function handleGap(
  state: MarketFeedSequenceState,
  update: MarketFeedIncrementalUpdate,
  policy: MarketFeedRecoveryPolicy,
  anomalies: readonly SequenceAnomalyEvent[],
): IngestIncrementalResult {
  if (anomalies.some((row) => forcesFailedSafe(row.kind))) {
    const failed = patchState(state, {
      phase: 'FAILED_SAFE',
      bookAuthority: 'NON_AUTHORITATIVE',
      recentAnomalies: mergeAnomalies(state.recentAnomalies, anomalies),
      recovery: Object.freeze({
        ...state.recovery,
        lastFailureReason: anomalies.map((row) => row.message).join('; '),
      }),
    });
    return Object.freeze({ state: failed, applied: false, buffered: false, anomalies });
  }

  const fromSeq = state.lastAppliedSequence ?? 0;
  const gap = sequenceGapFromMissing(state.feedId, fromSeq, update.sequence - 1, update.observedAt);

  let next = patchState(state, {
    phase: 'GAP_DETECTED',
    bookAuthority: 'NON_AUTHORITATIVE',
    openGap: gap,
    recentAnomalies: mergeAnomalies(state.recentAnomalies, anomalies),
  });

  next = withBuffered(next, update, policy, anomalies);

  const strategy = selectRecoveryStrategy(gap, policy.adapter);
  const request = buildRecoveryRequest({
    requestId: nextRequestId(),
    gap,
    adapterKind: policy.adapter.adapterKind,
    strategy,
    requestedAt: update.observedAt,
  });

  if (request === null) {
    const failed = patchState(next, {
      phase: 'FAILED_SAFE',
      recovery: Object.freeze({
        ...next.recovery,
        lastFailureReason: 'No recovery strategy for adapter profile',
      }),
    });
    return Object.freeze({ state: failed, applied: false, buffered: true, anomalies });
  }

  const phase: FeedRecoveryPhase =
    strategy === 'SNAPSHOT' || strategy === 'RECOVERY_FEED' ? 'SNAPSHOT_REQUIRED' : 'RECOVERING';

  next = patchState(next, {
    phase,
    recovery: Object.freeze({
      ...next.recovery,
      activeRequest: Object.freeze({ ...request, status: 'PENDING' }),
      attemptCount: next.recovery.attemptCount + 1,
    }),
  });

  if (next.bufferedIncrementals.length > policy.maxBufferedIncrementals) {
    const failed = patchState(next, {
      phase: 'FAILED_SAFE',
      recovery: Object.freeze({
        ...next.recovery,
        lastFailureReason: 'Buffered incremental policy exceeded',
      }),
    });
    return Object.freeze({ state: failed, applied: false, buffered: true, anomalies });
  }

  return Object.freeze({ state: next, applied: false, buffered: true, anomalies });
}

export type ApplySnapshotResult = {
  readonly state: MarketFeedSequenceState;
  readonly ok: boolean;
  readonly appliedSequences: readonly number[];
  readonly anomalies: readonly SequenceAnomalyEvent[];
};

export function applyMarketFeedSnapshot(
  state: MarketFeedSequenceState,
  snapshot: MarketFeedSnapshot,
  policy: MarketFeedRecoveryPolicy,
  options: { readonly evaluatedAtUtc?: UtcInstant } = {},
): ApplySnapshotResult {
  const snapshotAnomalies = detectSnapshotAnomalies(snapshot, {
    nowUtc: options.evaluatedAtUtc ?? snapshot.observedAt,
    maxAgeMs: policy.snapshotMaxAgeMs,
  });

  if (snapshotAnomalies.length > 0) {
    const failed = patchState(state, {
      phase: 'FAILED_SAFE',
      bookAuthority: 'NON_AUTHORITATIVE',
      recentAnomalies: mergeAnomalies(state.recentAnomalies, snapshotAnomalies),
      recovery: Object.freeze({
        ...state.recovery,
        lastFailureReason: snapshotAnomalies.map((row) => row.message).join('; '),
      }),
    });
    return Object.freeze({ state: failed, ok: false, appliedSequences: Object.freeze([]), anomalies: snapshotAnomalies });
  }

  let next = patchState(state, {
    phase: 'RESYNCHRONIZING',
    bookAuthority: 'NON_AUTHORITATIVE',
    lastAppliedSequence: snapshot.sequence,
    expectedNextSequence: snapshot.sequence + 1,
    openGap: null,
    session: Object.freeze({
      ...state.session,
      sessionId: snapshot.sessionId,
      sessionGeneration: snapshot.sessionGeneration,
      lastResetAt: snapshot.observedAt,
      resetReason: state.openGap?.anomaly ?? 'SESSION_RESET',
    }),
    recovery: Object.freeze({
      ...state.recovery,
      activeRequest: state.recovery.activeRequest
        ? Object.freeze({ ...state.recovery.activeRequest, status: 'COMPLETED' as const })
        : null,
      lastCompletedSequence: snapshot.sequence,
    }),
  });

  const toApply = [...next.bufferedIncrementals]
    .filter((row) => row.update.sequence > snapshot.sequence)
    .sort((a, b) => a.update.sequence - b.update.sequence);

  const applied: number[] = [snapshot.sequence];
  let expected = snapshot.sequence + 1;

  for (const row of toApply) {
    if (row.update.sequence !== expected) {
      const gap = sequenceGapFromMissing(next.feedId, expected - 1, row.update.sequence - 1, row.update.observedAt);
      next = patchState(next, {
        phase: 'GAP_DETECTED',
        bookAuthority: 'NON_AUTHORITATIVE',
        openGap: gap,
        recentAnomalies: mergeAnomalies(next.recentAnomalies, [
          Object.freeze({
            kind: 'MISSING_SEQUENCE' as const,
            sequence: row.update.sequence,
            message: `Post-snapshot continuity break at ${row.update.sequence}`,
            at: row.update.observedAt,
          }),
        ]),
      });
      return Object.freeze({ state: next, ok: false, appliedSequences: Object.freeze(applied), anomalies: next.recentAnomalies });
    }
    applied.push(row.update.sequence);
    expected = row.update.sequence + 1;
    next = patchState(next, {
      lastAppliedSequence: row.update.sequence,
      expectedNextSequence: expected,
    });
  }

  next = patchState(next, {
    phase: 'SYNCHRONIZED',
    bookAuthority: 'AUTHORITATIVE',
    bufferedIncrementals: Object.freeze([]),
    openGap: null,
  });

  return Object.freeze({ state: next, ok: true, appliedSequences: Object.freeze(applied), anomalies: snapshotAnomalies });
}

export function completeRecoveryRetransmission(
  state: MarketFeedSequenceState,
  recovered: readonly MarketFeedIncrementalUpdate[],
  policy: MarketFeedRecoveryPolicy,
): MarketFeedSequenceState {
  if (state.recovery.activeRequest === null) {
    return state;
  }

  let next = state;
  const sorted = [...recovered].sort((a, b) => a.sequence - b.sequence);
  for (const row of sorted) {
    const result = ingestMarketFeedIncremental(next, row, policy);
    next = result.state;
    if (next.phase === 'FAILED_SAFE') {
      return next;
    }
  }

  const pendingBuffered = [...next.bufferedIncrementals].sort((a, b) => a.update.sequence - b.update.sequence);
  for (const row of pendingBuffered) {
    if (next.expectedNextSequence !== null && row.update.sequence < next.expectedNextSequence) {
      continue;
    }
    const result = ingestMarketFeedIncremental(next, row.update, policy);
    next = result.state;
    if (next.phase === 'FAILED_SAFE') {
      return next;
    }
    if (result.applied) {
      next = patchState(next, {
        bufferedIncrementals: Object.freeze(
          next.bufferedIncrementals.filter((entry) => entry.update.sequence !== row.update.sequence),
        ),
      });
    }
  }

  const active = state.recovery.activeRequest;
  const completedRequest: RecoveryRequest = Object.freeze({ ...active, status: 'COMPLETED' });

  if (next.openGap === null && next.phase !== 'SNAPSHOT_REQUIRED') {
    next = patchState(next, {
      phase: 'SYNCHRONIZED',
      bookAuthority: next.lastAppliedSequence !== null ? 'AUTHORITATIVE' : 'NON_AUTHORITATIVE',
      recovery: Object.freeze({
        ...next.recovery,
        activeRequest: completedRequest,
      }),
    });
  } else if (next.phase === 'GAP_DETECTED' || next.phase === 'RECOVERING') {
    next = patchState(next, {
      phase: 'SNAPSHOT_REQUIRED',
      recovery: Object.freeze({
        ...next.recovery,
        activeRequest: Object.freeze({ ...completedRequest, status: 'FAILED' }),
        lastFailureReason: 'Retransmission incomplete — snapshot required',
      }),
    });
  }

  return next;
}

export function isMarketBookAuthoritative(state: MarketFeedSequenceState): boolean {
  return state.bookAuthority === 'AUTHORITATIVE' && state.phase === 'SYNCHRONIZED';
}

export function assertFeedSafeForDownstream(state: MarketFeedSequenceState): boolean {
  return isMarketBookAuthoritative(state) && state.openGap === null;
}

function applyIncremental(
  state: MarketFeedSequenceState,
  update: MarketFeedIncrementalUpdate,
  phase: FeedRecoveryPhase,
  authority: 'AUTHORITATIVE' | 'NON_AUTHORITATIVE',
): MarketFeedSequenceState {
  const clearedGap =
    state.openGap !== null && update.sequence >= state.openGap.toSequence ? null : state.openGap;
  const nextPhase =
    clearedGap === null && phase !== 'FAILED_SAFE' && state.phase !== 'INITIALIZING' ? 'SYNCHRONIZED' : phase;
  const nextAuthority =
    clearedGap === null && nextPhase === 'SYNCHRONIZED' ? 'AUTHORITATIVE' : authority;
  return patchState(state, {
    phase: nextPhase,
    bookAuthority: nextAuthority,
    lastAppliedSequence: update.sequence,
    expectedNextSequence: update.sequence + 1,
    openGap: clearedGap,
    session: Object.freeze({
      ...state.session,
      sessionId: update.sessionId,
      sessionGeneration: update.sessionGeneration,
    }),
  });
}

function withBuffered(
  state: MarketFeedSequenceState,
  update: MarketFeedIncrementalUpdate,
  policy: MarketFeedRecoveryPolicy,
  anomalies: readonly SequenceAnomalyEvent[],
): MarketFeedSequenceState {
  const entry: BufferedIncremental = Object.freeze({
    update,
    bufferedAt: update.observedAt,
  });
  const buffered = Object.freeze([...state.bufferedIncrementals, entry]);
  let next = patchState(state, {
    bufferedIncrementals: buffered,
    recentAnomalies: mergeAnomalies(state.recentAnomalies, anomalies),
    bookAuthority: 'NON_AUTHORITATIVE',
  });

  if (buffered.length > policy.maxBufferedIncrementals) {
    next = patchState(next, {
      phase: 'FAILED_SAFE',
      recovery: Object.freeze({
        ...next.recovery,
        lastFailureReason: 'Buffered incremental policy exceeded',
      }),
    });
  }
  return next;
}

function withAnomalies(
  state: MarketFeedSequenceState,
  anomalies: readonly SequenceAnomalyEvent[],
): MarketFeedSequenceState {
  return patchState(state, { recentAnomalies: mergeAnomalies(state.recentAnomalies, anomalies) });
}

function mergeAnomalies(
  prior: readonly SequenceAnomalyEvent[],
  next: readonly SequenceAnomalyEvent[],
): readonly SequenceAnomalyEvent[] {
  return Object.freeze([...prior, ...next].slice(-32));
}

function patchState(
  state: MarketFeedSequenceState,
  patch: Partial<MarketFeedSequenceState>,
): MarketFeedSequenceState {
  return Object.freeze({ ...state, ...patch });
}
