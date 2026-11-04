import type {
  ConsensusErrorEstimate,
  ManagementAnswerQuality,
  NoveltyFeatures,
  ToneFeatureBundle,
} from './types.ts';

/**
 * Deterministic, probabilistic consensus-error direction estimate inspired by
 * "What Analysts Miss: Predicting Consensus Forecast Errors from Earnings Calls".
 * This is evidence-weighted scoring only — not a causal claim.
 */
export function estimateConsensusError(input: {
  readonly features: ToneFeatureBundle;
  readonly answerQuality: ManagementAnswerQuality;
  readonly novelty: NoveltyFeatures | null;
}): ConsensusErrorEstimate {
  const supporting: string[] = [];
  let score = 0;

  if (input.features.forwardLookingScore > 0.35 && input.features.specificityScore > 0.35) {
    score += 0.35;
    supporting.push('forward_looking_with_specificity');
  }
  if (input.features.hedgingScore > 0.4) {
    score -= 0.25;
    supporting.push('elevated_hedging');
  }
  if (input.features.managementAnalystToneGap > 0.25) {
    score += 0.15;
    supporting.push('management_analyst_tone_gap');
  }
  if (input.answerQuality.aggregateNumericContent > 0.25) {
    score += 0.2;
    supporting.push('numeric_rich_answers');
  }
  if (input.answerQuality.answeredQuestionRatio < 0.5) {
    score -= 0.1;
    supporting.push('low_answered_question_ratio');
  }
  if (input.novelty && input.novelty.semanticNovelty > 0.45) {
    score += 0.15;
    supporting.push('semantic_novelty');
  }
  if (input.features.demandIntensity > 0.35 && input.features.pricingIntensity > 0.25) {
    score += 0.1;
    supporting.push('demand_pricing_language');
  }

  const expectedSignOfConsensusError = score > 0.12 ? 1 : score < -0.12 ? -1 : 0;
  const confidence = Math.min(0.95, Math.max(0.05, Math.abs(score) + 0.15));

  return Object.freeze({
    expectedSignOfConsensusError,
    confidence,
    supportingTranscriptFeatures: Object.freeze(supporting),
    probabilisticOnly: true,
  });
}
