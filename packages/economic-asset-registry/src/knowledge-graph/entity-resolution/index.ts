export {
  resolveDeterministic,
  scoreProbableMatch,
  probabilisticOutcome,
  isHighImpactIdentifier,
  type DeterministicResolutionInput,
} from './deterministic.ts';
export {
  createAiMatchSuggestion,
  canAutoApplySuggestion,
  applyAiSuggestion,
  type AiMatchSuggestionInput,
} from './probabilistic.ts';
export { runEntityResolutionPipeline, type EntityResolutionPipelineResult } from './pipeline.ts';
