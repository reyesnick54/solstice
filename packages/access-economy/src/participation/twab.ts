/**
 * ACCESS-15 — Time-weighted average SunRey balance (TWAB).
 *
 * Only settled SR balance observations participate. No data-derived weighting.
 */

import type { SrBalanceObservation } from './types.ts';

export type TwabSegment = Readonly<{
  readonly balanceMinor: bigint;
  readonly durationMs: number;
}>;

export function computeSrTwab(
  observations: readonly SrBalanceObservation[],
  windowStart: string,
  windowEnd: string,
): { readonly twabMinor: bigint; readonly segments: readonly TwabSegment[] } {
  const startMs = Date.parse(windowStart);
  const endMs = Date.parse(windowEnd);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error('invalid epoch window for TWAB');
  }
  const sorted = [...observations]
    .filter((row) => Date.parse(row.observedAt) <= endMs)
    .sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt));

  const segments: TwabSegment[] = [];
  let cursorMs = startMs;
  let currentBalance = 0n;

  for (const observation of sorted) {
    const observedMs = Date.parse(observation.observedAt);
    if (observedMs < startMs) {
      currentBalance = observation.balanceMinor;
      continue;
    }
    if (observedMs <= cursorMs) {
      currentBalance = observation.balanceMinor;
      continue;
    }
    segments.push({
      balanceMinor: currentBalance,
      durationMs: observedMs - cursorMs,
    });
    cursorMs = observedMs;
    currentBalance = observation.balanceMinor;
  }
  if (cursorMs < endMs) {
    segments.push({
      balanceMinor: currentBalance,
      durationMs: endMs - cursorMs,
    });
  }

  const totalDuration = segments.reduce((sum, row) => sum + row.durationMs, 0);
  if (totalDuration <= 0) {
    return { twabMinor: 0n, segments: Object.freeze(segments) };
  }
  const weighted = segments.reduce(
    (sum, row) => sum + row.balanceMinor * BigInt(row.durationMs),
    0n,
  );
  const twabMinor = weighted / BigInt(totalDuration);
  return { twabMinor, segments: Object.freeze(segments) };
}
