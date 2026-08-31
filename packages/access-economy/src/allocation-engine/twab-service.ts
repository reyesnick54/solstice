/**
 * Time-weighted average balance service for Access allocation.
 * Reuses canonical ACCESS-15 TWAB integration — read-only against token state.
 */

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import type { SubjectRef } from '../ids.ts';
import {
  computeTwab,
  checkpointAt,
  flatEpochCheckpoints,
} from '../dual-token-allocation/twab.ts';
import type { BalanceCheckpoint } from '../dual-token-allocation/types.ts';
import type { ParticipantAllocationInput, TokenBalanceReaderPort } from './types.ts';

export type TimeWeightedBalance = {
  readonly subjectRef: SubjectRef;
  readonly sunReyTwab: bigint;
  readonly moonReyTwab: bigint;
  readonly eligibleSunReyTwab: bigint;
  readonly eligibleMoonReyTwab: bigint;
  readonly windowStart: UtcInstant;
  readonly windowEnd: UtcInstant;
};

export function epochFromWindow(
  epochId: string,
  periodStart: UtcInstant,
  periodEnd: UtcInstant,
): {
  readonly epochId: string;
  readonly policyVersion: string;
  readonly cadence: 'MONTHLY';
  readonly startsAt: UtcInstant;
  readonly endsAt: UtcInstant;
  readonly snapshotCutoff: UtcInstant;
  readonly allocationFinalizedAt: null;
  readonly status: 'ALLOCATING';
} {
  return Object.freeze({
    epochId,
    policyVersion: 'allocation-engine',
    cadence: 'MONTHLY',
    startsAt: periodStart,
    endsAt: periodEnd,
    snapshotCutoff: periodEnd,
    allocationFinalizedAt: null,
    status: 'ALLOCATING',
  });
}

export function resolveCheckpoints(
  participant: ParticipantAllocationInput,
  periodStart: UtcInstant,
  periodEnd: UtcInstant,
  balanceReader?: TokenBalanceReaderPort,
): readonly BalanceCheckpoint[] {
  if (participant.checkpoints) {
    return participant.checkpoints;
  }
  if (balanceReader) {
    return balanceReader.checkpointsFor(participant.subjectRef, periodStart, periodEnd);
  }
  const epoch = epochFromWindow('twab-window', periodStart, periodEnd);
  return flatEpochCheckpoints(
    participant.subjectRef,
    epoch,
    participant.sunReyLiquid ?? 0n,
    participant.moonReyLiquid ?? 0n,
  );
}

export function computeTimeWeightedBalance(input: {
  readonly subjectRef: SubjectRef;
  readonly checkpoints: readonly BalanceCheckpoint[];
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
}): TimeWeightedBalance {
  const epoch = epochFromWindow('twab', input.periodStart, input.periodEnd);
  const twab = computeTwab(epoch, input.checkpoints);
  return Object.freeze({
    subjectRef: input.subjectRef,
    sunReyTwab: twab.sunReyTwab,
    moonReyTwab: twab.moonReyTwab,
    eligibleSunReyTwab: twab.eligibleSunReyTwab,
    eligibleMoonReyTwab: twab.eligibleMoonReyTwab,
    windowStart: input.periodStart,
    windowEnd: input.periodEnd,
  });
}

export function checkpointAtInstant(
  observedAt: UtcInstant,
  sunReyLiquid: bigint,
  moonReyLiquid: bigint,
): BalanceCheckpoint {
  return checkpointAt(observedAt, sunReyLiquid, moonReyLiquid);
}

export function windowEndFromStart(periodStart: UtcInstant, windowDays: number): UtcInstant {
  const startMs = Date.parse(periodStart);
  const endMs = startMs + windowDays * 24 * 60 * 60 * 1000 - 1;
  return asUtcInstant(new Date(endMs).toISOString());
}
