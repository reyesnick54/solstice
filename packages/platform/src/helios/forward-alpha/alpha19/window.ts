import type { UtcInstant } from '@solstice/domain';

import { horizonMsForId } from './horizons.ts';
import type { CanonicalOutcomeHorizonId } from './taxonomy.ts';
import type { OutcomeObservationWindow } from './types.ts';

export function buildOutcomeObservationWindow(input: {
  readonly decisionTime: UtcInstant;
  readonly horizonId: CanonicalOutcomeHorizonId;
}): OutcomeObservationWindow {
  const horizonMs = horizonMsForId(input.horizonId);
  const endMs = Date.parse(input.decisionTime) + horizonMs;
  const windowEnd = new Date(endMs).toISOString() as UtcInstant;
  return Object.freeze({
    decisionTime: input.decisionTime,
    windowStart: input.decisionTime,
    windowEnd,
    horizonId: input.horizonId,
    horizonMs,
  });
}

export function maturityInstant(decisionTime: UtcInstant, horizonMs: number): UtcInstant {
  return new Date(Date.parse(decisionTime) + horizonMs).toISOString() as UtcInstant;
}
