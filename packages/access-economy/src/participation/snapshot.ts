import { createHash } from 'node:crypto';

import { asUtcInstant } from '../../../domain/src/time.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { SubjectRef } from '../ids.ts';
import { assertParticipationInputBoundary } from './invariants.ts';
import { computeSrTwab } from './twab.ts';
import type {
  AccessEpochId,
  AccessParticipationEpoch,
  AccessParticipationSnapshot,
  ParticipationFailure,
  ParticipationSnapshotId,
  SrBalanceObservation,
  SrBalanceObservationId,
} from './types.ts';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function srBalanceObservationIdFor(seed: string): SrBalanceObservationId {
  return `srbal_${sha256(seed).slice(0, 24)}` as SrBalanceObservationId;
}

export function participationSnapshotIdFor(epochId: AccessEpochId, subjectRef: SubjectRef): ParticipationSnapshotId {
  return `accpart_${sha256(`${epochId}:${subjectRef}`).slice(0, 24)}` as ParticipationSnapshotId;
}

export type AccessParticipationStore = {
  readonly epochs: Map<AccessEpochId, AccessParticipationEpoch>;
  readonly observations: Map<SrBalanceObservationId, SrBalanceObservation>;
  readonly snapshots: Map<ParticipationSnapshotId, AccessParticipationSnapshot>;
  readonly observationReplay: Set<string>;
};

export function createAccessParticipationStore(): AccessParticipationStore {
  return {
    epochs: new Map(),
    observations: new Map(),
    snapshots: new Map(),
    observationReplay: new Set(),
  };
}

export class AccessParticipationSnapshotService {
  private readonly store: AccessParticipationStore;

  constructor(store: AccessParticipationStore = createAccessParticipationStore()) {
    this.store = store;
  }

  registerEpoch(epoch: AccessParticipationEpoch): Result<AccessParticipationEpoch, ParticipationFailure> {
    const boundary = assertParticipationInputBoundary(epoch);
    if (boundary) {
      return err({
        code: 'FORBIDDEN_PARTICIPATION_INPUT',
        message: `epoch contains forbidden participation input: ${boundary}`,
      });
    }
    if (Date.parse(epoch.windowStart) >= Date.parse(epoch.windowEnd)) {
      return err({ code: 'INVALID_EPOCH_WINDOW', message: 'epoch window must be positive' });
    }
    this.store.epochs.set(epoch.epochId, Object.freeze(epoch));
    return ok(epoch);
  }

  closeEpoch(epochId: AccessEpochId, closedAt: string): Result<AccessParticipationEpoch, ParticipationFailure> {
    const current = this.store.epochs.get(epochId);
    if (!current) {
      return err({ code: 'INVALID_EPOCH_WINDOW', message: 'epoch is unknown' });
    }
    const closed = Object.freeze({ ...current, closedAt: asUtcInstant(closedAt) });
    this.store.epochs.set(epochId, closed);
    return ok(closed);
  }

  recordSettledBalanceObservation(input: {
    readonly subjectRef: SubjectRef;
    readonly observedAt: string;
    readonly balanceMinor: bigint;
    readonly sourceRef: string;
    readonly sourceKind: SrBalanceObservation['sourceKind'];
    readonly replayKey: string;
  }): Result<SrBalanceObservation, ParticipationFailure> {
    const boundary = assertParticipationInputBoundary(input);
    if (boundary) {
      return err({
        code: 'FORBIDDEN_PARTICIPATION_INPUT',
        message: `observation contains forbidden participation input: ${boundary}`,
      });
    }
    if (input.balanceMinor < 0n) {
      return err({ code: 'INVALID_OBSERVATION', message: 'balance cannot be negative' });
    }
    if (this.store.observationReplay.has(input.replayKey)) {
      return err({ code: 'DUPLICATE_OBSERVATION', message: 'duplicate balance observation is denied' });
    }
    const observation = Object.freeze({
      observationId: srBalanceObservationIdFor(input.replayKey),
      subjectRef: input.subjectRef,
      observedAt: asUtcInstant(input.observedAt),
      balanceMinor: input.balanceMinor,
      sourceRef: input.sourceRef,
      sourceKind: input.sourceKind,
    });
    this.store.observations.set(observation.observationId, observation);
    this.store.observationReplay.add(input.replayKey);
    return ok(observation);
  }

  buildSnapshot(input: {
    readonly epochId: AccessEpochId;
    readonly subjectRef: SubjectRef;
    readonly computedAt: string;
  }): Result<AccessParticipationSnapshot, ParticipationFailure> {
    const boundary = assertParticipationInputBoundary(input);
    if (boundary) {
      return err({
        code: 'FORBIDDEN_PARTICIPATION_INPUT',
        message: `snapshot input contains forbidden participation field: ${boundary}`,
      });
    }
    const epoch = this.store.epochs.get(input.epochId);
    if (!epoch?.closedAt) {
      return err({ code: 'EPOCH_NOT_CLOSED', message: 'participation snapshot requires a closed epoch' });
    }
    const observations = [...this.store.observations.values()].filter(
      (row) => row.subjectRef === input.subjectRef,
    );
    const { twabMinor } = computeSrTwab(observations, epoch.windowStart, epoch.windowEnd);
    const snapshot = Object.freeze({
      snapshotId: participationSnapshotIdFor(input.epochId, input.subjectRef),
      epochId: input.epochId,
      subjectRef: input.subjectRef,
      windowStart: epoch.windowStart,
      windowEnd: epoch.windowEnd,
      srTwabMinor: twabMinor,
      observationCount: observations.length,
      computedAt: asUtcInstant(input.computedAt),
      inputsRestrictedTo: 'SETTLED_SR_BALANCE_HISTORY_ONLY' as const,
      dataBonusApplied: false as const,
    });
    this.store.snapshots.set(snapshot.snapshotId, snapshot);
    return ok(snapshot);
  }

  listObservations(subjectRef: SubjectRef): readonly SrBalanceObservation[] {
    return Object.freeze(
      [...this.store.observations.values()].filter((row) => row.subjectRef === subjectRef),
    );
  }

  getSnapshot(snapshotId: ParticipationSnapshotId): AccessParticipationSnapshot | undefined {
    return this.store.snapshots.get(snapshotId);
  }
}
