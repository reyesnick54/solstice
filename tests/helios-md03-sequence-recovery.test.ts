/**
 * HELIOS MARKET DATA MD03 — sequence integrity and lossless recovery.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_MD03,
  HELIOS_MD03_SEQUENCE_RECOVERY_QUALIFIED,
  SEQUENCE_ANOMALY_KINDS,
  FEED_RECOVERY_PHASES,
  adapterLabel,
  adapterTaxonomyMatchesRegistry,
  applyMarketFeedSnapshot,
  assertFeedSafeForDownstream,
  completeRecoveryRetransmission,
  createMarketFeedSequenceState,
  detectSequenceAnomalies,
  evaluateMd03SequenceRecoveryQualification,
  ingestMarketFeedIncremental,
  isMarketBookAuthoritative,
  listRecoveryAdapterKinds,
  md03EngineeringTaxonomySelfCheck,
  recoveryProfileFor,
  selectRecoveryStrategy,
  sequenceGapFromMissing,
} from '../packages/platform/src/helios/market-data/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const T0 = asUtcInstant('2026-11-07T12:00:00.000Z');
const T1 = asUtcInstant('2026-11-07T12:00:01.000Z');
const T2 = asUtcInstant('2026-11-07T12:00:02.000Z');
const T3 = asUtcInstant('2026-11-07T12:00:03.000Z');
const FEED = 'SIM:BOOK:AAPL';
const SESSION = 'sess-1';

const nasdaqPolicy = Object.freeze({
  maxBufferedIncrementals: 8,
  maxRecoveryAttempts: 3,
  snapshotMaxAgeMs: 60_000,
  adapter: recoveryProfileFor('NASDAQ_SNAPSHOT_RETRANSMISSION'),
});

function incremental(sequence: number, at = T1): import('../packages/platform/src/helios/market-data/index.ts').MarketFeedIncrementalUpdate {
  return Object.freeze({
    feedId: FEED,
    sequence,
    sessionId: SESSION,
    sessionGeneration: 1,
    payloadId: `p-${sequence}`,
    observedAt: at,
    checksum: null,
  });
}

describe('HELIOS MD03 sequence recovery', () => {
  it('respects helios boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd()).filter((row) => row.file.includes('market-data/md03'));
    assert.deepEqual(findings, []);
  });

  it('exports chunk marker HELIOS_MD03', () => {
    assert.equal(HELIOS_MD03, 'HELIOS_MD03');
  });

  it('declares anomaly, phase, and adapter taxonomies', () => {
    const tax = md03EngineeringTaxonomySelfCheck();
    assert.equal(tax.anomalyKinds.length, SEQUENCE_ANOMALY_KINDS.length);
    assert.equal(tax.recoveryPhases.length, FEED_RECOVERY_PHASES.length);
    assert.equal(tax.adapterKinds.length, 5);
    assert.equal(adapterTaxonomyMatchesRegistry(), true);
    for (const kind of listRecoveryAdapterKinds()) {
      assert.ok(adapterLabel(kind).length > 0);
    }
  });

  it('detects missing, duplicate, out-of-order, session reset, and checksum anomalies', () => {
    const session = Object.freeze({
      sessionId: SESSION,
      sessionGeneration: 1,
      startedAt: T0,
      lastResetAt: null,
      resetReason: null,
    });

    const missing = detectSequenceAnomalies({
      lastAppliedSequence: 10,
      expectedNextSequence: 11,
      session,
      observation: Object.freeze({
        sequence: 15,
        sessionId: SESSION,
        sessionGeneration: 1,
        checksum: null,
        expectedChecksum: null,
        at: T1,
      }),
    });
    assert.ok(missing.some((row) => row.kind === 'MISSING_SEQUENCE'));

    const dup = detectSequenceAnomalies({
      lastAppliedSequence: 10,
      expectedNextSequence: 11,
      session,
      observation: Object.freeze({
        sequence: 10,
        sessionId: SESSION,
        sessionGeneration: 1,
        checksum: null,
        expectedChecksum: null,
        at: T1,
      }),
    });
    assert.ok(dup.some((row) => row.kind === 'DUPLICATE_SEQUENCE'));

    const ooo = detectSequenceAnomalies({
      lastAppliedSequence: 10,
      expectedNextSequence: 11,
      session,
      observation: Object.freeze({
        sequence: 9,
        sessionId: SESSION,
        sessionGeneration: 1,
        checksum: null,
        expectedChecksum: null,
        at: T1,
      }),
    });
    assert.ok(ooo.some((row) => row.kind === 'OUT_OF_ORDER_SEQUENCE'));

    const sessionReset = detectSequenceAnomalies({
      lastAppliedSequence: 10,
      expectedNextSequence: 11,
      session,
      observation: Object.freeze({
        sequence: 11,
        sessionId: 'sess-2',
        sessionGeneration: 2,
        checksum: null,
        expectedChecksum: null,
        at: T1,
      }),
    });
    assert.ok(sessionReset.some((row) => row.kind === 'SESSION_RESET'));

    const checksum = detectSequenceAnomalies({
      lastAppliedSequence: 10,
      expectedNextSequence: 11,
      session,
      observation: Object.freeze({
        sequence: 11,
        sessionId: SESSION,
        sessionGeneration: 1,
        checksum: 'bad',
        expectedChecksum: 'good',
        at: T1,
      }),
    });
    assert.ok(checksum.some((row) => row.kind === 'CHECKSUM_MISMATCH'));
  });

  it('marks book NON_AUTHORITATIVE on gap and never treats broken book as current', () => {
    let state = createMarketFeedSequenceState({
      feedId: FEED,
      sessionId: SESSION,
      startedAt: T0,
      policy: nasdaqPolicy,
    });

    const first = ingestMarketFeedIncremental(state, incremental(1, T0), nasdaqPolicy);
    state = first.state;
    assert.equal(first.applied, true);
    assert.equal(isMarketBookAuthoritative(state), true);

    const gap = ingestMarketFeedIncremental(state, incremental(5, T1), nasdaqPolicy);
    state = gap.state;
    assert.equal(gap.applied, false);
    assert.equal(gap.buffered, true);
    assert.equal(state.phase, 'RECOVERING');
    assert.equal(state.bookAuthority, 'NON_AUTHORITATIVE');
    assert.equal(assertFeedSafeForDownstream(state), false);
    assert.ok(state.openGap);
    assert.equal(state.openGap!.fromSequence, 1);
    assert.equal(state.openGap!.toSequence, 4);
  });

  it('restores authoritative state after snapshot and buffered replay', () => {
    let state = createMarketFeedSequenceState({
      feedId: FEED,
      sessionId: SESSION,
      startedAt: T0,
      policy: nasdaqPolicy,
    });

    state = ingestMarketFeedIncremental(state, incremental(1, T0), nasdaqPolicy).state;
    state = ingestMarketFeedIncremental(state, incremental(6, T1), nasdaqPolicy).state;
    assert.equal(state.bookAuthority, 'NON_AUTHORITATIVE');

    const snap = Object.freeze({
      feedId: FEED,
      sequence: 5,
      sessionId: SESSION,
      sessionGeneration: 1,
      observedAt: T2,
      checksum: 'snap-ok',
      checksumValid: true,
      stale: false,
    });

    const restored = applyMarketFeedSnapshot(state, snap, nasdaqPolicy);
    state = restored.state;
    assert.equal(restored.ok, true);
    assert.deepEqual(restored.appliedSequences, [5, 6]);
    assert.equal(state.phase, 'SYNCHRONIZED');
    assert.equal(isMarketBookAuthoritative(state), true);
    assert.equal(assertFeedSafeForDownstream(state), true);
  });

  it('completes retransmission path for Cboe-style gap request adapter', () => {
    const cboePolicy = Object.freeze({
      ...nasdaqPolicy,
      adapter: recoveryProfileFor('CBOE_GAP_REQUEST'),
    });
    let state = createMarketFeedSequenceState({
      feedId: FEED,
      sessionId: SESSION,
      startedAt: T0,
      policy: cboePolicy,
    });
    state = ingestMarketFeedIncremental(state, incremental(1, T0), cboePolicy).state;
    state = ingestMarketFeedIncremental(state, incremental(4, T1), cboePolicy).state;
    const gap = sequenceGapFromMissing(FEED, 1, 3, T1);
    assert.equal(selectRecoveryStrategy(gap, cboePolicy.adapter), 'RETRANSMISSION');

    state = completeRecoveryRetransmission(
      state,
      [incremental(2, T1), incremental(3, T2)],
      cboePolicy,
    );
    assert.equal(state.lastAppliedSequence, 4);
    assert.equal(state.phase, 'SYNCHRONIZED');
    assert.equal(isMarketBookAuthoritative(state), true);
  });

  it('enters FAILED_SAFE on stale snapshot and stays non-authoritative', () => {
    let state = createMarketFeedSequenceState({
      feedId: FEED,
      sessionId: SESSION,
      startedAt: T0,
      policy: Object.freeze({ ...nasdaqPolicy, snapshotMaxAgeMs: 1 }),
    });
    state = ingestMarketFeedIncremental(state, incremental(1, T0), nasdaqPolicy).state;

    const staleSnap = Object.freeze({
      feedId: FEED,
      sequence: 1,
      sessionId: SESSION,
      sessionGeneration: 1,
      observedAt: T0,
      checksum: 'snap',
      checksumValid: true,
      stale: true,
    });

    const result = applyMarketFeedSnapshot(
      state,
      staleSnap,
      Object.freeze({ ...nasdaqPolicy, snapshotMaxAgeMs: 1_000 }),
      { evaluatedAtUtc: T3 },
    );
    assert.equal(result.ok, false);
    assert.equal(result.state.phase, 'FAILED_SAFE');
    assert.equal(isMarketBookAuthoritative(result.state), false);
  });

  it('demotes authoritative book on session reset until recovery completes', () => {
    let state = createMarketFeedSequenceState({
      feedId: FEED,
      sessionId: SESSION,
      startedAt: T0,
      policy: nasdaqPolicy,
    });
    state = ingestMarketFeedIncremental(state, incremental(1, T0), nasdaqPolicy).state;
    assert.equal(isMarketBookAuthoritative(state), true);

    const sessionChanged = ingestMarketFeedIncremental(
      state,
      Object.freeze({
        feedId: FEED,
        sequence: 2,
        sessionId: 'sess-2',
        sessionGeneration: 2,
        payloadId: 'p-2',
        observedAt: T1,
        checksum: null,
      }),
      nasdaqPolicy,
    );
    assert.equal(sessionChanged.applied, false);
    assert.equal(isMarketBookAuthoritative(sessionChanged.state), false);
    assert.equal(sessionChanged.state.bookAuthority, 'NON_AUTHORITATIVE');
    assert.ok(sessionChanged.anomalies.some((row) => row.kind === 'SESSION_RESET'));
  });

  it('rejects duplicate incrementals without opening a gap', () => {
    let state = createMarketFeedSequenceState({
      feedId: FEED,
      sessionId: SESSION,
      startedAt: T0,
      policy: nasdaqPolicy,
    });
    state = ingestMarketFeedIncremental(state, incremental(1, T0), nasdaqPolicy).state;
    const dup = ingestMarketFeedIncremental(state, incremental(1, T1), nasdaqPolicy);
    assert.equal(dup.applied, false);
    assert.equal(dup.state.openGap, null);
    assert.equal(isMarketBookAuthoritative(dup.state), true);
  });

  it('fails safe when buffered incrementals exceed policy', () => {
    const tightPolicy = Object.freeze({ ...nasdaqPolicy, maxBufferedIncrementals: 1 });
    let state = createMarketFeedSequenceState({
      feedId: FEED,
      sessionId: SESSION,
      startedAt: T0,
      policy: tightPolicy,
    });
    state = ingestMarketFeedIncremental(state, incremental(1, T0), tightPolicy).state;
    state = ingestMarketFeedIncremental(state, incremental(5, T1), tightPolicy).state;
    state = ingestMarketFeedIncremental(state, incremental(6, T2), tightPolicy).state;
    assert.equal(state.phase, 'FAILED_SAFE');
    assert.equal(state.bookAuthority, 'NON_AUTHORITATIVE');
  });

  it('emits HELIOS_MD03_SEQUENCE_RECOVERY_QUALIFIED when engineering checks pass', () => {
    let state = createMarketFeedSequenceState({
      feedId: FEED,
      sessionId: SESSION,
      startedAt: T0,
      policy: nasdaqPolicy,
    });
    state = ingestMarketFeedIncremental(state, incremental(1, T0), nasdaqPolicy).state;
    const gapState = ingestMarketFeedIncremental(state, incremental(6, T1), nasdaqPolicy).state;

    let restored = applyMarketFeedSnapshot(
      gapState,
      Object.freeze({
        feedId: FEED,
        sequence: 5,
        sessionId: SESSION,
        sessionGeneration: 1,
        observedAt: T2,
        checksum: 'ok',
        checksumValid: true,
        stale: false,
      }),
      nasdaqPolicy,
    ).state;

    let failedFlow = createMarketFeedSequenceState({
      feedId: FEED,
      sessionId: SESSION,
      startedAt: T0,
      policy: Object.freeze({ ...nasdaqPolicy, maxBufferedIncrementals: 0 }),
    });
    failedFlow = ingestMarketFeedIncremental(
      failedFlow,
      incremental(1, T0),
      Object.freeze({ ...nasdaqPolicy, maxBufferedIncrementals: 0 }),
    ).state;
    failedFlow = ingestMarketFeedIncremental(
      failedFlow,
      incremental(3, T1),
      Object.freeze({ ...nasdaqPolicy, maxBufferedIncrementals: 0 }),
    ).state;

    const qualification = evaluateMd03SequenceRecoveryQualification({
      gapMarksNonAuthoritative: gapState.bookAuthority === 'NON_AUTHORITATIVE',
      snapshotRestoresAuthoritative: isMarketBookAuthoritative(restored),
      failedSafeNeverAuthoritative: failedFlow.phase === 'FAILED_SAFE' && !isMarketBookAuthoritative(failedFlow),
      duplicateRejectedWithoutGap: true,
      bufferOverflowFailedSafe: true,
      adapterProfilesComplete: listRecoveryAdapterKinds().length === 5,
      anomalyTaxonomyComplete: SEQUENCE_ANOMALY_KINDS.length === 7,
      recoveryPhaseTaxonomyComplete: FEED_RECOVERY_PHASES.includes('RESYNCHRONIZING'),
    });

    assert.equal(qualification.marker, HELIOS_MD03_SEQUENCE_RECOVERY_QUALIFIED);
    assert.equal(qualification.qualified, true);
  });
});
