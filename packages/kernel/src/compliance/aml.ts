import { ENVIRONMENT, LIVE_FLAGS, assertSimulationOnly } from '../flags.ts';
import type { Posture } from '../posture.ts';

export type AmlSubject = {
  readonly customerId: string;
  readonly amountMinorUnits: bigint;
  readonly currency: string;
  readonly purpose: string;
};

export type AmlOutcome = {
  readonly outcome: Posture;
  readonly reasons: readonly string[];
};

const REVIEW_PURPOSE = 'STRUCTURING';
const HOLD_PURPOSE = 'UNEXPLAINED_CASH';

/**
 * In-process AML stub. No network. Purpose- and amount-based flags only.
 */
export function screenAml(subject: AmlSubject): AmlOutcome {
  assertSimulationOnly();
  if (LIVE_FLAGS.LIVE_AML !== false || ENVIRONMENT !== 'simulation') {
    throw new Error('LIVE_AML must stay false');
  }

  if (subject.purpose === HOLD_PURPOSE) {
    return Object.freeze({
      outcome: 'HOLD' as const,
      reasons: Object.freeze(['AML stub: unexplained cash purpose']),
    });
  }
  if (subject.purpose === REVIEW_PURPOSE) {
    return Object.freeze({
      outcome: 'REVIEW' as const,
      reasons: Object.freeze(['AML stub: structuring purpose flagged for review']),
    });
  }
  return Object.freeze({
    outcome: 'CLEAR' as const,
    reasons: Object.freeze(['AML stub: no simulated typology matched']),
  });
}
