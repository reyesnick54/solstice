/**
 * Structural checks against circular economic feedback.
 *
 * Rejected loops:
 *   MoonRey market price → Productive Value → MoonRey issuance → MoonRey market price
 *   issuance quantity → scarcity reference → value → issuance quantity
 */

import { MOONREY_PRICE_SELF_REFERENCE_FORBIDDEN } from '../value-function/constitution.ts';
import { representativeScenario } from './scenarios.ts';
import type { FeedbackLoopFinding, MoonReyShadowScenario } from './types.ts';
import { evaluateGovernedV2 } from './v2.ts';

export const FORBIDDEN_FEEDBACK_LOOPS = [
  'MOONREY_PRICE_TO_VALUE_TO_ISSUANCE_TO_PRICE',
  'ISSUANCE_QUANTITY_TO_SCARCITY_TO_VALUE_TO_ISSUANCE',
] as const;

export function detectFeedbackLoops(scenario: MoonReyShadowScenario = representativeScenario('solar-energy')): FeedbackLoopFinding {
  const loops: string[] = [];
  if (scenario.poison?.moonreyMarketPriceSelfReference || !MOONREY_PRICE_SELF_REFERENCE_FORBIDDEN) {
    loops.push(FORBIDDEN_FEEDBACK_LOOPS[0]);
  }
  if (scenario.poison?.issuanceQuantityAsScarcity) {
    loops.push(FORBIDDEN_FEEDBACK_LOOPS[1]);
  }
  const evaluated = evaluateGovernedV2(
    loops.length === 0
      ? scenario
      : {
          ...scenario,
          poison: {
            ...scenario.poison,
            moonreyMarketPriceSelfReference: loops.includes(FORBIDDEN_FEEDBACK_LOOPS[0]),
            issuanceQuantityAsScarcity: loops.includes(FORBIDDEN_FEEDBACK_LOOPS[1]),
          },
        },
  );
  const rejected = loops.length === 0 ? true : !evaluated.valued;
  return Object.freeze({
    rejected: loops.length === 0 ? false : rejected,
    loops: Object.freeze(loops),
    reasonCodes: loops.length === 0 ? Object.freeze([]) : evaluated.reasonCodes,
  });
}

export function feedbackLoopCheckPassing(): boolean {
  const clean = detectFeedbackLoops(representativeScenario('solar-energy'));
  const price = detectFeedbackLoops({
    ...representativeScenario('solar-energy'),
    poison: { moonreyMarketPriceSelfReference: true },
  });
  const issuance = detectFeedbackLoops({
    ...representativeScenario('solar-energy'),
    poison: { issuanceQuantityAsScarcity: true },
  });
  return clean.loops.length === 0 && !clean.rejected && price.rejected && issuance.rejected;
}
