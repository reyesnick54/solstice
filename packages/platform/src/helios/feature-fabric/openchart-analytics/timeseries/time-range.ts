/**
 * Fixed and ongoing time ranges (OpenChart `common/timeseries/timeRange` semantics).
 */

export type TimeRange =
  | { readonly fromMs: number; readonly toMs: number }
  | { readonly fromMs: number; readonly toMs: 'now' };

export type TimeRangeValidation =
  | { readonly ok: true; readonly range: TimeRange }
  | { readonly ok: false; readonly code: string; readonly message: string };

function isSafeIntegerMs(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function parseTimeRange(input: {
  readonly from: unknown;
  readonly to: unknown;
}): TimeRangeValidation {
  if (input.from === undefined || input.to === undefined) {
    return { ok: false, code: 'INCOMPLETE_RANGE', message: 'from and to are required' };
  }
  if (!isSafeIntegerMs(input.from)) {
    return { ok: false, code: 'INVALID_FROM', message: 'from must be a safe integer epoch millisecond' };
  }
  if (input.to === 'now') {
    return Object.freeze({ ok: true, range: Object.freeze({ fromMs: input.from, toMs: 'now' as const }) });
  }
  if (!isSafeIntegerMs(input.to)) {
    return { ok: false, code: 'INVALID_TO', message: 'to must be a safe integer or "now"' };
  }
  if (input.from >= input.to) {
    return { ok: false, code: 'INVERTED_RANGE', message: 'from must precede to' };
  }
  return Object.freeze({
    ok: true,
    range: Object.freeze({ fromMs: input.from, toMs: input.to }),
  });
}

/** Inclusive start, exclusive end for numeric `to`. */
export function barTimeInRange(timeMs: number, range: TimeRange, nowMs: number): boolean {
  const toExclusive = range.toMs === 'now' ? nowMs : range.toMs;
  return timeMs >= range.fromMs && timeMs < toExclusive;
}
