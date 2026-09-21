/**
 * Deterministic macro event calculations — no LLM involvement.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  MacroEventRelevanceWindow,
  MacroEventSurprise,
  MacroEventValueObservation,
} from './types.ts';
import type { EventRelevanceState } from './taxonomy.ts';

export function computeSurprise(input: {
  readonly metricId: string;
  readonly expected: readonly MacroEventValueObservation[];
  readonly actual: readonly MacroEventValueObservation[];
  readonly computedAt: UtcInstant;
}): MacroEventSurprise | null {
  const expected = input.expected.find((v) => v.metricId === input.metricId && v.layer === 'source_fact')
    ?? input.expected.find((v) => v.metricId === input.metricId && v.layer === 'structured_observation')
    ?? input.expected.find((v) => v.metricId === input.metricId);
  const actual = input.actual.find((v) => v.metricId === input.metricId && v.layer === 'source_fact')
    ?? input.actual.find((v) => v.metricId === input.metricId && v.layer === 'structured_observation')
    ?? input.actual.find((v) => v.metricId === input.metricId);

  if (!expected && !actual) return null;
  if (!actual) return null;

  if (expected?.valueMinorUnits !== null && expected?.valueMinorUnits !== undefined
    && actual?.valueMinorUnits !== null && actual?.valueMinorUnits !== undefined) {
    return Object.freeze({
      metricId: input.metricId,
      expected,
      actual,
      surpriseMinorUnits: actual.valueMinorUnits - expected.valueMinorUnits,
      surpriseText: null,
      calculable: true,
      computedAt: input.computedAt,
      layer: 'structured_observation',
    });
  }

  if (expected?.valueText && actual?.valueText) {
    return Object.freeze({
      metricId: input.metricId,
      expected,
      actual,
      surpriseMinorUnits: null,
      surpriseText: `${actual.valueText} vs expected ${expected.valueText}`,
      calculable: true,
      computedAt: input.computedAt,
      layer: 'structured_observation',
    });
  }

  return Object.freeze({
    metricId: input.metricId,
    expected: expected ?? null,
    actual: actual ?? null,
    surpriseMinorUnits: null,
    surpriseText: null,
    calculable: false,
    computedAt: input.computedAt,
    layer: 'structured_observation',
  });
}

export function resolveEventRelevanceState(input: {
  readonly scheduledTime: UtcInstant | null;
  readonly observedTime: UtcInstant | null;
  readonly relevanceWindow: MacroEventRelevanceWindow;
  readonly asOf: UtcInstant;
}): EventRelevanceState {
  const anchor = input.observedTime ?? input.scheduledTime;
  if (!anchor) return 'UNKNOWN';

  const anchorMs = Date.parse(anchor);
  const asOfMs = Date.parse(input.asOf);
  const preMs = input.relevanceWindow.preEventMinutes * 60_000;
  const postMs = input.relevanceWindow.postEventMinutes * 60_000;
  const windowStart = anchorMs - preMs;
  const windowEnd = anchorMs + postMs;

  if (asOfMs < windowStart) return 'UPCOMING';
  if (asOfMs <= windowEnd) return 'ACTIVE';
  if (asOfMs > Date.parse(input.relevanceWindow.expiresAt)) return 'EXPIRED';
  if (asOfMs > windowEnd) return 'EXPIRED';
  return 'UNKNOWN';
}

export function minutesUntilScheduled(scheduledTime: UtcInstant | null, asOf: UtcInstant): number | null {
  if (!scheduledTime) return null;
  const delta = Date.parse(scheduledTime) - Date.parse(asOf);
  return Math.round(delta / 60_000);
}

export function isEventStale(input: {
  readonly relevanceWindow: MacroEventRelevanceWindow;
  readonly asOf: UtcInstant;
}): boolean {
  return Date.parse(input.asOf) > Date.parse(input.relevanceWindow.expiresAt);
}

export function isHighImpactDomain(domain: string): boolean {
  return [
    'central_bank_decision',
    'inflation_release',
    'employment_release',
    'opec_event',
    'geopolitical_market_event',
  ].includes(domain);
}
