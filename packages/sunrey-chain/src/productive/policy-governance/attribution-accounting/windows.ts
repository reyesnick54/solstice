import type { AttributionEventObservation } from './types.ts';

/**
 * Half-open [from, until) so adjacent production cycles do not overlap.
 * 12:00–13:00 and 13:00–14:00 are distinct. 12:00–12:30 and 12:00–13:00 overlap.
 */
export function windowsOverlap(
  leftFrom: bigint,
  leftUntil: bigint,
  rightFrom: bigint,
  rightUntil: bigint,
): boolean {
  return leftFrom < rightUntil && rightFrom < leftUntil;
}

export function windowContains(
  outerFrom: bigint,
  outerUntil: bigint,
  innerFrom: bigint,
  innerUntil: bigint,
): boolean {
  return innerFrom >= outerFrom && innerUntil <= outerUntil && innerUntil > innerFrom;
}

export function observationsOverlap(
  left: AttributionEventObservation,
  right: AttributionEventObservation,
): boolean {
  return windowsOverlap(
    left.validFromUnixSeconds,
    left.validUntilUnixSeconds,
    right.validFromUnixSeconds,
    right.validUntilUnixSeconds,
  );
}

export function isAdjacentCycle(
  leftFrom: bigint,
  leftUntil: bigint,
  rightFrom: bigint,
  rightUntil: bigint,
): boolean {
  return leftUntil === rightFrom || rightUntil === leftFrom;
}
