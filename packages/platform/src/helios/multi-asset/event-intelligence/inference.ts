/**
 * LLM inference proposals — research only; never silently promoted to facts.
 */

import type { UtcInstant } from '@solstice/domain';
import type { MacroEventModelRoute } from './taxonomy.ts';
import type { MacroEventInferenceProposal } from './types.ts';

export function routeMacroEventModel(input: {
  readonly containsPrivateContext: boolean;
  readonly requiresCalculation: boolean;
}): MacroEventModelRoute {
  if (input.requiresCalculation) return 'DETERMINISTIC';
  if (input.containsPrivateContext) return 'S3M_PRIVATE_CONTEXT';
  return 'GROK_PUBLIC_RESEARCH';
}

export function createInferenceProposal(input: {
  readonly proposalId: string;
  readonly eventId: string;
  readonly statement: string;
  readonly knowledgeLayer: 'model_inference' | 'agent_hypothesis';
  readonly modelRoute: MacroEventModelRoute;
  readonly citedEvidenceIds: readonly string[];
  readonly knownEvidenceIds: ReadonlySet<string>;
  readonly evaluatedAt: UtcInstant;
}): MacroEventInferenceProposal {
  const unsupported = input.citedEvidenceIds.some((id) => !input.knownEvidenceIds.has(id));

  return Object.freeze({
    proposalId: input.proposalId,
    eventId: input.eventId,
    statement: input.statement,
    knowledgeLayer: input.knowledgeLayer,
    modelRoute: input.modelRoute,
    citedEvidenceIds: Object.freeze([...input.citedEvidenceIds]),
    unsupported,
    evaluatedAt: input.evaluatedAt,
    grantsExecutionAuthority: false,
  });
}

/** Guard: LLM outputs must never be ingested as canonical facts. */
export function assertNotInferenceAsFact(layer: string): void {
  if (layer === 'model_inference' || layer === 'agent_hypothesis') {
    throw new Error('LLM_INFERENCE_CANNOT_BECOME_FACT');
  }
}
