/**
 * Time-weighted average balance (TWAB) over an Access epoch.
 *
 * Integrates piecewise-constant balances from checkpoints. Locked and
 * escrowed treatment is policy-driven — never double-counted with liquid.
 */

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import type { SubjectRef } from '../ids.ts';
import type { AccessEpoch, BalanceCheckpoint } from './types.ts';

export type TwabPolicy = {
  readonly includeLockedSunRey: boolean;
  readonly includeLockedMoonRey: boolean;
  readonly includeEscrowedSunRey: boolean;
  readonly includeEscrowedMoonRey: boolean;
};

export const DEFAULT_TWAB_POLICY: TwabPolicy = Object.freeze({
  includeLockedSunRey: false,
  includeLockedMoonRey: false,
  includeEscrowedSunRey: false,
  includeEscrowedMoonRey: false,
});

export function instantMs(instant: UtcInstant): bigint {
  return BigInt(Date.parse(instant));
}

function eligibleSunRey(checkpoint: BalanceCheckpoint, policy: TwabPolicy): bigint {
  let total = checkpoint.sunReyLiquid;
  if (policy.includeLockedSunRey) {
    total += checkpoint.sunReyLocked;
  }
  if (policy.includeEscrowedSunRey) {
    total += checkpoint.sunReyEscrowed;
  }
  return total;
}

function eligibleMoonRey(checkpoint: BalanceCheckpoint, policy: TwabPolicy): bigint {
  let total = checkpoint.moonReyLiquid;
  if (policy.includeLockedMoonRey) {
    total += checkpoint.moonReyLocked;
  }
  if (policy.includeEscrowedMoonRey) {
    total += checkpoint.moonReyEscrowed;
  }
  return total;
}

function sortCheckpoints(checkpoints: readonly BalanceCheckpoint[]): BalanceCheckpoint[] {
  return [...checkpoints].sort((left, right) => {
    const delta = instantMs(left.observedAt) - instantMs(right.observedAt);
    return delta < 0n ? -1 : delta > 0n ? 1 : 0;
  });
}

export type TwabResult = {
  readonly sunReyTwab: bigint;
  readonly moonReyTwab: bigint;
  readonly eligibleSunReyTwab: bigint;
  readonly eligibleMoonReyTwab: bigint;
};

/**
 * Compute TWAB from balance checkpoints spanning [epoch.startsAt, epoch.endsAt].
 * Requires at least one checkpoint; uses zero balance before first checkpoint.
 */
export function computeTwab(
  epoch: AccessEpoch,
  checkpoints: readonly BalanceCheckpoint[],
  policy: TwabPolicy = DEFAULT_TWAB_POLICY,
): TwabResult {
  const epochStart = instantMs(epoch.startsAt);
  const epochEnd = instantMs(epoch.endsAt);
  const duration = epochEnd - epochStart;
  if (duration <= 0n) {
    throw new RangeError('epoch duration must be positive');
  }

  const ordered = sortCheckpoints(checkpoints);
  const zeroCheckpoint: BalanceCheckpoint = Object.freeze({
    observedAt: epoch.startsAt,
    sunReyLiquid: 0n,
    moonReyLiquid: 0n,
    sunReyLocked: 0n,
    moonReyLocked: 0n,
    sunReyEscrowed: 0n,
    moonReyEscrowed: 0n,
  });

  const segments: BalanceCheckpoint[] =
    ordered.length === 0
      ? [zeroCheckpoint]
      : ordered[0]!.observedAt === epoch.startsAt
        ? ordered
        : [zeroCheckpoint, ...ordered];

  let sunReyWeighted = 0n;
  let moonReyWeighted = 0n;
  let eligibleSrWeighted = 0n;
  let eligibleMrWeighted = 0n;

  for (let index = 0; index < segments.length; index += 1) {
    const current = segments[index]!;
    const segmentStart = instantMs(current.observedAt);
    const segmentEnd =
      index + 1 < segments.length ? instantMs(segments[index + 1]!.observedAt) : epochEnd;
    const clampedStart = segmentStart < epochStart ? epochStart : segmentStart;
    const clampedEnd = segmentEnd > epochEnd ? epochEnd : segmentEnd;
    const segmentDuration = clampedEnd - clampedStart;
    if (segmentDuration <= 0n) {
      continue;
    }
    sunReyWeighted += current.sunReyLiquid * segmentDuration;
    moonReyWeighted += current.moonReyLiquid * segmentDuration;
    eligibleSrWeighted += eligibleSunRey(current, policy) * segmentDuration;
    eligibleMrWeighted += eligibleMoonRey(current, policy) * segmentDuration;
  }

  return Object.freeze({
    sunReyTwab: sunReyWeighted / duration,
    moonReyTwab: moonReyWeighted / duration,
    eligibleSunReyTwab: eligibleSrWeighted / duration,
    eligibleMoonReyTwab: eligibleMrWeighted / duration,
  });
}

export function checkpointAt(
  observedAt: UtcInstant,
  sunReyLiquid: bigint,
  moonReyLiquid: bigint,
  overrides: Partial<
    Pick<
      BalanceCheckpoint,
      'sunReyLocked' | 'moonReyLocked' | 'sunReyEscrowed' | 'moonReyEscrowed'
    >
  > = {},
): BalanceCheckpoint {
  return Object.freeze({
    observedAt,
    sunReyLiquid,
    moonReyLiquid,
    sunReyLocked: overrides.sunReyLocked ?? 0n,
    moonReyLocked: overrides.moonReyLocked ?? 0n,
    sunReyEscrowed: overrides.sunReyEscrowed ?? 0n,
    moonReyEscrowed: overrides.moonReyEscrowed ?? 0n,
  });
}

export function flatEpochCheckpoints(
  subjectRef: SubjectRef,
  epoch: AccessEpoch,
  sunReyLiquid: bigint,
  moonReyLiquid: bigint,
): readonly BalanceCheckpoint[] {
  void subjectRef;
  return Object.freeze([
    checkpointAt(epoch.startsAt, sunReyLiquid, moonReyLiquid),
    checkpointAt(epoch.endsAt, sunReyLiquid, moonReyLiquid),
  ]);
}

export function asInstantFromMs(ms: bigint): UtcInstant {
  return asUtcInstant(new Date(Number(ms)).toISOString());
}
