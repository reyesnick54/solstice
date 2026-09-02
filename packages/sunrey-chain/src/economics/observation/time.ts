/**
 * Wave 4 — temporal normalization for economic observations.
 *
 * Preserves the source observation window. Does not convert period
 * aggregates into instantaneous events.
 */

import { asUtcInstant, isUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type { NormalizationRejectionCode } from './types.ts';

export const TIME_NORMALIZATION_VERSION = 'sunrey.economic-observation.time.v1' as const;

export type ObservationTimeWindow = {
  readonly observedAt: UtcInstant;
  readonly periodStart: UtcInstant | null;
  readonly periodEnd: UtcInstant | null;
  readonly receivedAt: UtcInstant;
  readonly isInstantaneous: boolean;
  readonly isPeriodAggregate: boolean;
  readonly sourceTimezonePreserved: string | null;
};

export type RawTimeInput = {
  readonly observedAt?: string | null;
  readonly periodStart?: string | null;
  readonly periodEnd?: string | null;
  readonly receivedAt: string;
  readonly sourceTimezone?: string | null;
  readonly aggregationHint?: 'INSTANT' | 'PERIOD' | null;
};

export type TimeNormalizationResult =
  | { readonly ok: true; readonly value: ObservationTimeWindow }
  | { readonly ok: false; readonly code: NormalizationRejectionCode; readonly message: string };

export function normalizeObservationTime(input: RawTimeInput): TimeNormalizationResult {
  if (!isUtcInstant(input.receivedAt)) {
    return { ok: false, code: 'MISSING_TIME_CONTEXT', message: 'receivedAt must be a valid UTC instant' };
  }
  const receivedAt = asUtcInstant(input.receivedAt);

  const periodStart = input.periodStart && isUtcInstant(input.periodStart) ? asUtcInstant(input.periodStart) : null;
  const periodEnd = input.periodEnd && isUtcInstant(input.periodEnd) ? asUtcInstant(input.periodEnd) : null;

  if (periodStart && periodEnd && Date.parse(periodStart) > Date.parse(periodEnd)) {
    return { ok: false, code: 'INVALID_TIME_WINDOW', message: 'periodStart must precede periodEnd' };
  }

  let observedAt: UtcInstant;
  if (input.observedAt && isUtcInstant(input.observedAt)) {
    observedAt = asUtcInstant(input.observedAt);
  } else if (periodEnd) {
    observedAt = periodEnd;
  } else if (periodStart) {
    observedAt = periodStart;
  } else {
    return { ok: false, code: 'MISSING_TIME_CONTEXT', message: 'observedAt or period bounds are required' };
  }

  const isPeriodAggregate =
    input.aggregationHint === 'PERIOD' || (periodStart !== null && periodEnd !== null && periodStart !== periodEnd);
  const isInstantaneous = input.aggregationHint === 'INSTANT' || (!isPeriodAggregate && periodStart === null && periodEnd === null);

  if (isPeriodAggregate && periodStart === null) {
    return {
      ok: false,
      code: 'MISSING_TIME_CONTEXT',
      message: 'period aggregates require periodStart and periodEnd',
    };
  }
  if (isPeriodAggregate && periodEnd === null) {
    return {
      ok: false,
      code: 'MISSING_TIME_CONTEXT',
      message: 'period aggregates require periodStart and periodEnd',
    };
  }

  return {
    ok: true,
    value: Object.freeze({
      observedAt,
      periodStart,
      periodEnd,
      receivedAt,
      isInstantaneous,
      isPeriodAggregate,
      sourceTimezonePreserved: input.sourceTimezone ?? null,
    }),
  };
}

export function unixSecondsToUtcInstant(unixSeconds: bigint): UtcInstant {
  const ms = Number(unixSeconds) * 1000;
  return asUtcInstant(new Date(ms).toISOString());
}
