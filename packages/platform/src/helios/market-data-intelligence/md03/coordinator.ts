import type { UtcInstant } from '@solstice/domain';
import { DEFAULT_MD03_DUAL_FEED_ARBITRATION, selectMd03ActiveFeedRole } from './dual-feed.ts';
import { applyMd03Incremental, initialMd03SequenceState } from './incremental.ts';
import { applyMd03RecoverySnapshot, openMd03RecoverySession } from './recovery.ts';
import type {
  Md03DualFeedArbitration,
  Md03FeedCoordinatorSnapshot,
  Md03IncrementalEnvelope,
  Md03RecoveryEnvelope,
  Md03RecoverySession,
  Md03SequenceState,
} from './types.ts';

export type Md03FeedCoordinator<TState, TPayload> = {
  readonly instrumentId: string;
  readonly primarySequence: Md03SequenceState;
  readonly secondarySequence: Md03SequenceState;
  readonly recovery: Md03RecoverySession | null;
  readonly state: TState;
  readonly arbitration: Md03DualFeedArbitration;
  readonly merge: (prior: TState, payload: TPayload, at: UtcInstant) => TState;
  readonly replace: (prior: TState, payload: TPayload, at: UtcInstant) => TState;
};

export function createMd03FeedCoordinator<TState, TPayload>(input: {
  readonly instrumentId: string;
  readonly initialState: TState;
  readonly merge: (prior: TState, payload: TPayload, at: UtcInstant) => TState;
  readonly replace: (prior: TState, payload: TPayload, at: UtcInstant) => TState;
  readonly arbitration?: Md03DualFeedArbitration;
}): Md03FeedCoordinator<TState, TPayload> {
  return Object.freeze({
    instrumentId: input.instrumentId,
    primarySequence: initialMd03SequenceState(),
    secondarySequence: initialMd03SequenceState(),
    recovery: null,
    state: input.initialState,
    arbitration: input.arbitration ?? DEFAULT_MD03_DUAL_FEED_ARBITRATION,
    merge: input.merge,
    replace: input.replace,
  });
}

function routeSequence(
  coordinator: Md03FeedCoordinator<unknown, unknown>,
  role: 'PRIMARY' | 'SECONDARY',
): Md03SequenceState {
  return role === 'PRIMARY' ? coordinator.primarySequence : coordinator.secondarySequence;
}

export function ingestMd03Incremental<TState, TPayload>(
  coordinator: Md03FeedCoordinator<TState, TPayload>,
  envelope: Md03IncrementalEnvelope<TPayload>,
): Md03FeedCoordinator<TState, TPayload> {
  const role = envelope.feed.role;
  const priorSeq = routeSequence(coordinator as Md03FeedCoordinator<unknown, unknown>, role);
  const applied = applyMd03Incremental({
    prior: coordinator.state,
    sequence: priorSeq,
    envelope,
    merge: coordinator.merge,
    applyOnGap: true,
  });
  const nextPrimary =
    role === 'PRIMARY' ? applied.sequence : coordinator.primarySequence;
  const nextSecondary =
    role === 'SECONDARY' ? applied.sequence : coordinator.secondarySequence;
  return Object.freeze({
    ...coordinator,
    state: applied.state,
    primarySequence: nextPrimary,
    secondarySequence: nextSecondary,
  });
}

export function ingestMd03Recovery<TState, TPayload>(
  coordinator: Md03FeedCoordinator<TState, TPayload>,
  envelope: Md03RecoveryEnvelope<TPayload>,
): Md03FeedCoordinator<TState, TPayload> {
  const activeRole = selectMd03ActiveFeedRole({
    primary: coordinator.primarySequence,
    secondary: coordinator.secondarySequence,
    arbitration: coordinator.arbitration,
    now: envelope.knowableAt,
  });
  const priorSeq = routeSequence(coordinator as Md03FeedCoordinator<unknown, unknown>, activeRole);
  const session =
    coordinator.recovery ??
    openMd03RecoverySession({
      instrumentId: coordinator.instrumentId,
      fromSequence: priorSeq.lastSequence > 0n ? priorSeq.lastSequence : null,
      requestedAt: envelope.knowableAt,
    });
  const recovered = applyMd03RecoverySnapshot({
    prior: coordinator.state,
    sequence: priorSeq,
    session,
    envelope,
    replace: coordinator.replace,
  });
  return Object.freeze({
    ...coordinator,
    state: recovered.state,
    recovery: recovered.session,
    primarySequence: activeRole === 'PRIMARY' ? recovered.sequence : coordinator.primarySequence,
    secondarySequence: activeRole === 'SECONDARY' ? recovered.sequence : coordinator.secondarySequence,
  });
}

export function snapshotMd03FeedCoordinator<TState, TPayload>(
  coordinator: Md03FeedCoordinator<TState, TPayload>,
  evaluatedAt: UtcInstant,
): Md03FeedCoordinatorSnapshot<TState> {
  const activeFeedRole = selectMd03ActiveFeedRole({
    primary: coordinator.primarySequence,
    secondary: coordinator.secondarySequence,
    arbitration: coordinator.arbitration,
    now: evaluatedAt,
  });
  return Object.freeze({
    instrumentId: coordinator.instrumentId,
    activeFeedRole,
    primary: coordinator.primarySequence,
    secondary: coordinator.secondarySequence,
    recovery: coordinator.recovery,
    state: coordinator.state,
    evaluatedAt,
  });
}
