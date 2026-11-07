import type { UtcInstant } from '@solstice/domain';
import type { Md03RecoveryEnvelope, Md03RecoverySession, Md03SequenceState } from './types.ts';
import type { Md03RecoveryPhase } from './taxonomy.ts';
import { initialMd03SequenceState } from './incremental.ts';

export function openMd03RecoverySession(input: {
  readonly instrumentId: string;
  readonly fromSequence: bigint | null;
  readonly requestedAt: UtcInstant;
}): Md03RecoverySession {
  return Object.freeze({
    instrumentId: input.instrumentId,
    phase: 'RECOVERY_REQUESTED',
    requestedAt: input.requestedAt,
    recoveredAt: null,
    fromSequence: input.fromSequence,
    toSequence: null,
  });
}

export function advanceMd03RecoveryPhase(
  session: Md03RecoverySession,
  phase: Md03RecoveryPhase,
): Md03RecoverySession {
  return Object.freeze({ ...session, phase });
}

/**
 * Apply a CME-style market recovery snapshot, resetting sequence tracking to the snapshot boundary.
 */
export function applyMd03RecoverySnapshot<TState, TPayload>(input: {
  readonly prior: TState;
  readonly sequence: Md03SequenceState;
  readonly session: Md03RecoverySession | null;
  readonly envelope: Md03RecoveryEnvelope<TPayload>;
  readonly replace: (prior: TState, payload: TPayload, at: UtcInstant) => TState;
}): {
  readonly state: TState;
  readonly sequence: Md03SequenceState;
  readonly session: Md03RecoverySession;
} {
  const nextState = input.replace(input.prior, input.envelope.payload, input.envelope.knowableAt);
  const nextSequence: Md03SequenceState = Object.freeze({
    lastSequence: input.envelope.snapshotSequence,
    lastAppliedAt: input.envelope.knowableAt,
    gapCount: input.sequence.gapCount,
    duplicateCount: input.sequence.duplicateCount,
  });
  const base =
    input.session ??
    openMd03RecoverySession({
      instrumentId: input.envelope.instrumentId,
      fromSequence: input.sequence.lastSequence > 0n ? input.sequence.lastSequence : null,
      requestedAt: input.envelope.knowableAt,
    });
  const session: Md03RecoverySession = Object.freeze({
    ...advanceMd03RecoveryPhase(base, 'RECOVERED'),
    recoveredAt: input.envelope.knowableAt,
    toSequence: input.envelope.snapshotSequence,
  });
  return Object.freeze({ state: nextState, sequence: nextSequence, session });
}

export function resetSequenceAfterRecoveryFailure(): Md03SequenceState {
  return initialMd03SequenceState();
}
