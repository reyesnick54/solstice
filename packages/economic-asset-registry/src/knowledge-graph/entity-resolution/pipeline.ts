import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AliasRegistry } from '../alias-registry.ts';
import type { EntityResolutionRecord } from '../types.ts';
import { resolveDeterministic, type DeterministicResolutionInput } from './deterministic.ts';
import { createAiMatchSuggestion } from './probabilistic.ts';
import type { ExternalIdentifier, MatchSuggestion } from '../types.ts';

export type EntityResolutionPipelineResult = {
  readonly deterministic: EntityResolutionRecord;
  readonly suggestions: readonly MatchSuggestion[];
};

export function runEntityResolutionPipeline(
  input: DeterministicResolutionInput,
  aliasRegistry: AliasRegistry,
  probabilisticCandidates?: readonly ExternalIdentifier[],
): EntityResolutionPipelineResult {
  const deterministic = resolveDeterministic(input, aliasRegistry);
  const suggestions: MatchSuggestion[] = [];

  if (probabilisticCandidates && probabilisticCandidates.length > 0) {
    const primary = input.identifiers[0];
    if (primary) {
      for (const candidate of probabilisticCandidates) {
        suggestions.push(
          createAiMatchSuggestion({
            left: primary,
            right: candidate,
            aiConfidence: 0.6,
            createdAt: input.createdAt,
          }),
        );
      }
    }
  }

  return Object.freeze({
    deterministic,
    suggestions: Object.freeze(suggestions),
  });
}
