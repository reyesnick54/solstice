import type { UtcInstant } from '@solstice/domain';

import type { PrequentialDecision, PrequentialOutcome, PrequentialScore } from './types.ts';
import type { PrequentialPredictedLabel } from './taxonomy.ts';

function directionFromDelta(priorMinor: string, realizedMinor: string): PrequentialPredictedLabel {
  const prior = BigInt(priorMinor);
  const realized = BigInt(realizedMinor);
  if (realized > prior) {
    return 'UP';
  }
  if (realized < prior) {
    return 'DOWN';
  }
  return 'FLAT';
}

export function scorePrequentialDecision(input: {
  readonly decision: PrequentialDecision;
  readonly outcome: PrequentialOutcome;
  readonly scoredAt: UtcInstant;
}): PrequentialScore {
  const prior = BigInt(input.decision.predictedReferenceMidMinor);
  const realized = BigInt(input.outcome.realizedMidMinor);
  const signedErrorBps =
    prior === 0n
      ? 0
      : Number(((realized - prior) * 10_000n) / prior);
  const realizedDirection = directionFromDelta(
    input.decision.predictedReferenceMidMinor,
    input.outcome.realizedMidMinor,
  );
  const directionHit =
    input.decision.predictedLabel === 'FLAT'
      ? realizedDirection === 'FLAT'
      : input.decision.predictedLabel === realizedDirection;
  return Object.freeze({
    scoredAt: input.scoredAt,
    signedErrorBps,
    directionHit,
    scoringRuleId: 'mid_direction_v1',
  });
}
