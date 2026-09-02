import type { UtcInstant } from '../../../domain/src/time.ts';
import { matchSuggestionIdFor } from '../ids.ts';
import {
  isHighImpactIdentifier,
  probabilisticOutcome,
  scoreProbableMatch,
} from './deterministic.ts';
import type { EntityResolutionOutcome, ExternalIdentifier, MatchSuggestion } from '../types.ts';

export type AiMatchSuggestionInput = {
  readonly left: ExternalIdentifier;
  readonly right: ExternalIdentifier;
  readonly aiConfidence: number;
  readonly createdAt: UtcInstant;
  readonly rationale?: string;
};

/**
 * AI may suggest matches but never silently merge high-impact economic identities.
 */
export function createAiMatchSuggestion(input: AiMatchSuggestionInput): MatchSuggestion {
  const score = Math.max(scoreProbableMatch(input.left, input.right), input.aiConfidence);
  const suggestedOutcome = probabilisticOutcome(score);
  const highImpact = isHighImpactIdentifier(input.left) || isHighImpactIdentifier(input.right);
  const requiresGovernedReview =
    highImpact ||
    suggestedOutcome === 'POSSIBLE_MATCH' ||
    suggestedOutcome === 'PROBABLE_MATCH' ||
    suggestedOutcome === 'CONFLICT';

  return Object.freeze({
    suggestionId: matchSuggestionIdFor(`${input.left.system}:${input.left.id}:${input.right.system}:${input.right.id}`),
    leftIdentifier: Object.freeze({ ...input.left }),
    rightIdentifier: Object.freeze({ ...input.right }),
    suggestedOutcome,
    method: 'AI_ASSISTED',
    confidence: score,
    highImpact,
    requiresGovernedReview,
    createdAt: input.createdAt,
    autoApplied: false,
  });
}

export function canAutoApplySuggestion(suggestion: MatchSuggestion): boolean {
  if (suggestion.highImpact || suggestion.requiresGovernedReview) {
    return false;
  }
  return suggestion.suggestedOutcome === 'EXACT_MATCH' && suggestion.confidence >= 0.99;
}

export function applyAiSuggestion(
  suggestion: MatchSuggestion,
): { readonly applied: false; readonly reason: string } | { readonly applied: true; readonly outcome: EntityResolutionOutcome } {
  if (!canAutoApplySuggestion(suggestion)) {
    return Object.freeze({
      applied: false,
      reason: suggestion.highImpact
        ? 'high-impact identity cannot be auto-merged from AI suggestion'
        : 'governed review required for probabilistic match',
    });
  }
  return Object.freeze({ applied: true, outcome: suggestion.suggestedOutcome });
}
