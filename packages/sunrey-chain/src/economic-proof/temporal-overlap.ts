import type { UtcInstant } from '../../../domain/src/time.ts';

export type TemporalWindow = {
  readonly validFromUtc: UtcInstant;
  readonly validUntilUtc: UtcInstant | null;
};

export type TemporalOverlapKind =
  | 'NONE'
  | 'EXACT'
  | 'PARTIAL'
  | 'CONTAINS'
  | 'CONTAINED_BY'
  | 'ADJACENT';

function toEpochMs(isoUtc: string): number {
  return Date.parse(isoUtc);
}

function windowEndMs(window: TemporalWindow): number {
  if (window.validUntilUtc) {
    return toEpochMs(window.validUntilUtc);
  }
  return toEpochMs(window.validFromUtc) + 86_400_000;
}

/**
 * Half-open [from, until) interval overlap — aligned with Chunk 122 attribution windows.
 */
export function temporalWindowsOverlap(left: TemporalWindow, right: TemporalWindow): boolean {
  const leftFrom = toEpochMs(left.validFromUtc);
  const leftUntil = windowEndMs(left);
  const rightFrom = toEpochMs(right.validFromUtc);
  const rightUntil = windowEndMs(right);
  return leftFrom < rightUntil && rightFrom < leftUntil;
}

export function temporalWindowContains(outer: TemporalWindow, inner: TemporalWindow): boolean {
  const outerFrom = toEpochMs(outer.validFromUtc);
  const outerUntil = windowEndMs(outer);
  const innerFrom = toEpochMs(inner.validFromUtc);
  const innerUntil = windowEndMs(inner);
  return innerFrom >= outerFrom && innerUntil <= outerUntil && innerUntil > innerFrom;
}

export function classifyTemporalOverlap(left: TemporalWindow, right: TemporalWindow): TemporalOverlapKind {
  const leftFrom = left.validFromUtc;
  const leftUntil = left.validUntilUtc;
  const rightFrom = right.validFromUtc;
  const rightUntil = right.validUntilUtc;

  if (leftFrom === rightFrom && leftUntil === rightUntil) {
    return 'EXACT';
  }

  if (temporalWindowContains(left, right)) {
    return 'CONTAINS';
  }
  if (temporalWindowContains(right, left)) {
    return 'CONTAINED_BY';
  }
  if (temporalWindowsOverlap(left, right)) {
    return 'PARTIAL';
  }

  const leftEnd = windowEndMs(left);
  const rightStart = toEpochMs(right.validFromUtc);
  const rightEnd = windowEndMs(right);
  const leftStart = toEpochMs(left.validFromUtc);
  if (leftEnd === rightStart || rightEnd === leftStart) {
    return 'ADJACENT';
  }

  return 'NONE';
}

/**
 * Detects when a finer-grained reporting window overlaps a coarser aggregate
 * (e.g. hourly energy record inside a daily total).
 */
export function isAggregationTemporalRelationship(
  left: TemporalWindow,
  right: TemporalWindow,
): 'AGGREGATE_OF' | 'COMPONENT_OF' | null {
  const kind = classifyTemporalOverlap(left, right);
  if (kind === 'CONTAINS') {
    return 'AGGREGATE_OF';
  }
  if (kind === 'CONTAINED_BY') {
    return 'COMPONENT_OF';
  }
  return null;
}

export function intervalDurationMs(window: TemporalWindow): number {
  return windowEndMs(window) - toEpochMs(window.validFromUtc);
}
