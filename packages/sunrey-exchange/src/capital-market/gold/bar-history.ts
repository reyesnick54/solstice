/**
 * M07 — Gold bar history with knowableAt semantics and no look-ahead.
 */

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type { CapitalMarketSessionStatus } from '../types.ts';
import type { GoldBarCandle, GoldBarInterval } from './types.ts';

const INTERVAL_MS: Readonly<Record<GoldBarInterval, number>> = Object.freeze({
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
});

export function intervalDurationMs(interval: GoldBarInterval): number {
  return INTERVAL_MS[interval];
}

export function alignPeriodStart(timestamp: UtcInstant, interval: GoldBarInterval): UtcInstant {
  const ms = Date.parse(timestamp);
  const duration = intervalDurationMs(interval);
  const aligned = Math.floor(ms / duration) * duration;
  return asUtcInstant(new Date(aligned).toISOString());
}

export function periodEndFromStart(periodStart: UtcInstant, interval: GoldBarInterval): UtcInstant {
  const startMs = Date.parse(periodStart);
  return asUtcInstant(new Date(startMs + intervalDurationMs(interval)).toISOString());
}

/** Bars are only knowable after their period closes — prevents look-ahead. */
export function computeBarKnowableAt(periodEnd: UtcInstant, arrivalDelayMs = 0): UtcInstant {
  const endMs = Date.parse(periodEnd);
  return asUtcInstant(new Date(endMs + arrivalDelayMs).toISOString());
}

export function isBarKnowableAt(evaluationTimeUtc: UtcInstant, bar: GoldBarCandle): boolean {
  const evalMs = Date.parse(evaluationTimeUtc);
  const knowableMs = Date.parse(bar.knowableAt);
  if (!Number.isFinite(evalMs) || !Number.isFinite(knowableMs)) {
    return false;
  }
  return evalMs >= knowableMs;
}

export function filterKnowableBars(
  bars: readonly GoldBarCandle[],
  evaluationTimeUtc: UtcInstant,
): readonly GoldBarCandle[] {
  return Object.freeze(bars.filter((bar) => isBarKnowableAt(evaluationTimeUtc, bar)));
}

export function assertOrderedBars(bars: readonly GoldBarCandle[]): boolean {
  for (let i = 1; i < bars.length; i++) {
    const prev = Date.parse(bars[i - 1]!.periodStart);
    const curr = Date.parse(bars[i]!.periodStart);
    if (!Number.isFinite(prev) || !Number.isFinite(curr) || curr <= prev) {
      return false;
    }
  }
  return true;
}

export function buildDeterministicGoldBars(input: {
  readonly identityId: string;
  readonly interval: GoldBarInterval;
  readonly from: UtcInstant;
  readonly to: UtcInstant;
  readonly nowUtc: UtcInstant;
  readonly basePriceMinorUnits: bigint;
  readonly providerId: string;
  readonly sessionStatus?: CapitalMarketSessionStatus;
}): readonly GoldBarCandle[] {
  const duration = intervalDurationMs(input.interval);
  const fromMs = Date.parse(input.from);
  const toMs = Date.parse(input.to);
  const nowMs = Date.parse(input.nowUtc);
  const sessionStatus = input.sessionStatus ?? 'OPEN';

  const candles: GoldBarCandle[] = [];
  let cursor = alignPeriodStart(input.from, input.interval);
  let cursorMs = Date.parse(cursor);
  let seed = input.basePriceMinorUnits;

  while (cursorMs < toMs) {
    const periodEnd = periodEndFromStart(cursor, input.interval);
    const periodEndMs = Date.parse(periodEnd);

    // No look-ahead: skip bars whose period has not yet closed.
    if (periodEndMs > nowMs) {
      break;
    }

    const knowableAt = computeBarKnowableAt(periodEnd, 1_000);

    const offset = BigInt((cursorMs / duration) % 97);
    const open = seed;
    const close = seed + offset;
    const high = close + 5n;
    const low = open - 3n;

    candles.push(
      Object.freeze({
        identityId: input.identityId,
        interval: input.interval,
        openMinorUnits: open,
        highMinorUnits: high,
        lowMinorUnits: low,
        closeMinorUnits: close,
        volumeUnits: 10_000n + offset * 100n,
        currency: 'USD',
        priceScale: 2,
        periodStart: cursor,
        periodEnd,
        marketTimestamp: periodEnd,
        knowableAt,
        providerId: input.providerId,
        sessionStatus,
      }),
    );

    seed = close;
    cursorMs += duration;
    cursor = asUtcInstant(new Date(cursorMs).toISOString());
  }

  return Object.freeze(candles);
}

export function sessionStatusForUtcHour(hourUtc: number): CapitalMarketSessionStatus {
  // COMEX gold electronic session approximates nearly-24h; brief maintenance window.
  if (hourUtc >= 17 && hourUtc < 18) {
    return 'CLOSED';
  }
  return 'OPEN';
}

export function staleAfterMsForInterval(interval: GoldBarInterval): number {
  const base = intervalDurationMs(interval);
  // Allow one full bar period plus a short publication delay before marking stale.
  return base + 900_000;
}

/** Reject a bar for live/trend use when its knowableAt is too far behind evaluation time. */
export function isBarStale(
  bar: GoldBarCandle,
  evaluationTimeUtc: UtcInstant,
  staleAfterMs?: number,
): boolean {
  const evalMs = Date.parse(evaluationTimeUtc);
  const knowableMs = Date.parse(bar.knowableAt);
  if (!Number.isFinite(evalMs) || !Number.isFinite(knowableMs)) {
    return true;
  }
  const threshold = staleAfterMs ?? staleAfterMsForInterval(bar.interval);
  return evalMs - knowableMs > threshold;
}

/** Returns the most recent bar only if it is not stale at evaluation time. */
export function rejectStaleLatestBar(
  bars: readonly GoldBarCandle[],
  evaluationTimeUtc: UtcInstant,
  staleAfterMs?: number,
): GoldBarCandle | null {
  if (bars.length === 0) {
    return null;
  }
  const latest = bars[bars.length - 1]!;
  return isBarStale(latest, evaluationTimeUtc, staleAfterMs) ? null : latest;
}
