/**
 * ALPHA06 — paper promotion gate: do not promote when alpha vanishes under realistic execution.
 */

import type { Alpha06PromotionOutcome } from '../taxonomy.ts';
import { ALPHA06_RULE_FLAGS } from './taxonomy.ts';
import { alphaSurvivesAfterExecution, computeSignalToImplementationDecay } from './decay.ts';
import type { Alpha06ForwardScenario, Alpha06LaneReturn } from './types.ts';

export function evaluateAlpha06Promotion(input: {
  readonly scenario: Alpha06ForwardScenario;
  readonly lanes: readonly Alpha06LaneReturn[];
}): { readonly outcome: Alpha06PromotionOutcome; readonly promote: boolean; readonly decayBps: number | null } {
  const decayBps = computeSignalToImplementationDecay(input.lanes);
  const survives = alphaSurvivesAfterExecution(input.lanes);

  if (!survives && ALPHA06_RULE_FLAGS.DECAY_BLOCKS_PROMOTION_WHEN_ALPHA_GONE) {
    return Object.freeze({
      outcome: 'REJECT_DECAY',
      promote: false,
      decayBps,
    });
  }
  if (survives) {
    return Object.freeze({
      outcome: 'PROMOTE_PAPER',
      promote: true,
      decayBps,
    });
  }
  return Object.freeze({
    outcome: 'HOLD_REVIEW',
    promote: false,
    decayBps,
  });
}
