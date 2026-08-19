/**
 * Service outcomes and contribution lineage.
 *
 * SERVICES may represent realized economic service events. This family
 * does not score a person's worth, creditworthiness, or social value.
 * Human contributions that belong in the Human Economic Contribution
 * Registry are referenced, not duplicated.
 *
 * Human + automation mixes keep explicit lineage. Dual-coin allocation
 * is not guessed here.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import {
  HUMAN_WORTH_SCORING,
  type ServiceRefusal,
  type ServiceSourceObservation,
} from './types.ts';

export function evaluateServiceOutcome(
  observation: ServiceSourceObservation,
): Result<{ readonly humanWorthScoring: false; readonly dualCoinGuesswork: false }, ServiceRefusal> {
  if (observation.humanWorthScore !== undefined || HUMAN_WORTH_SCORING) {
    return err({
      code: 'HUMAN_WORTH_SCORING_FORBIDDEN',
      detail: 'this provider family does not value the intrinsic worth of a human worker',
    });
  }
  if (observation.extras && ('creditScore' in observation.extras || 'socialValue' in observation.extras || 'humanWorth' in observation.extras)) {
    return err({
      code: 'HUMAN_WORTH_SCORING_FORBIDDEN',
      detail: 'creditworthiness and social-value scores are not MoonRey service measurements',
    });
  }
  if (observation.contribution.dualCoinAllocatedByGuesswork) {
    return err({
      code: 'DUAL_COIN_GUESSWORK_FORBIDDEN',
      detail: 'preserve contribution lineage; do not guess dual-coin allocation',
    });
  }
  if (
    observation.serviceKind === 'MIXED_HUMAN_AUTOMATION' &&
    observation.contribution.issuesSunRey &&
    observation.contribution.issuesMoonRey
  ) {
    return err({
      code: 'DUAL_COIN_GUESSWORK_FORBIDDEN',
      detail: 'do not automatically issue both SunRey and MoonRey for the same event',
    });
  }
  return ok({ humanWorthScoring: false, dualCoinGuesswork: false });
}

export function humanWorthScoring(): false {
  return HUMAN_WORTH_SCORING;
}
