/**
 * ACCESS-15 — Access participation snapshot types.
 *
 * Participation weighting consumes only settled SunRey balance history.
 * Personal data categories, health information, preferences, identity traits,
 * and research participation labels must never enter this surface.
 */

import type { SubjectRef } from '../ids.ts';

export type SrBalanceObservationId = `srbal_${string}`;
export type AccessEpochId = `accepoch_${string}`;
export type ParticipationSnapshotId = `accpart_${string}`;

export type SrBalanceObservation = Readonly<{
  readonly observationId: SrBalanceObservationId;
  readonly subjectRef: SubjectRef;
  readonly observedAt: string;
  /** Settled SunRey balance in minor units at observation time. */
  readonly balanceMinor: bigint;
  readonly sourceRef: string;
  readonly sourceKind: 'SETTLED_TRANSFER' | 'SETTLED_ISSUANCE' | 'OPENING_BALANCE';
}>;

export type AccessParticipationEpoch = Readonly<{
  readonly epochId: AccessEpochId;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly closedAt: string | null;
}>;

/** ACCESS-15 participation snapshot — SR TWAB only. */
export type AccessParticipationSnapshot = Readonly<{
  readonly snapshotId: ParticipationSnapshotId;
  readonly epochId: AccessEpochId;
  readonly subjectRef: SubjectRef;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly srTwabMinor: bigint;
  readonly observationCount: number;
  readonly computedAt: string;
  readonly inputsRestrictedTo: 'SETTLED_SR_BALANCE_HISTORY_ONLY';
  readonly dataBonusApplied: false;
}>;

export type ParticipationFailureCode =
  | 'FORBIDDEN_PARTICIPATION_INPUT'
  | 'INVALID_OBSERVATION'
  | 'INVALID_EPOCH_WINDOW'
  | 'SUBJECT_MISMATCH'
  | 'EPOCH_NOT_CLOSED'
  | 'DUPLICATE_OBSERVATION';

export type ParticipationFailure = Readonly<{
  readonly code: ParticipationFailureCode;
  readonly message: string;
}>;
