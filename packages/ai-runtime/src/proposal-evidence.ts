import type { AiFailureCode, AiProviderKind } from './taxonomy.ts';
import type { AiProviderFailure, AiStructuredGrowthAgentProposal, AiToolIntent } from './types.ts';

export type ToolRunReference = {
  readonly toolRunId: string;
  readonly toolName: string;
  readonly completed: true;
};

export function toolRunReferenceForIntent(intent: AiToolIntent): ToolRunReference {
  return Object.freeze({
    toolRunId: intent.intentId,
    toolName: intent.name,
    completed: true,
  });
}

/**
 * A growth proposal that cites tool-backed evidence must reference real tool-run
 * identifiers. Model narrative alone cannot satisfy evidence requirements.
 */
export function validateGrowthProposalEvidenceBinding(input: {
  readonly proposal: AiStructuredGrowthAgentProposal;
  readonly completedToolRuns: readonly ToolRunReference[];
}):
  | { readonly ok: true; readonly proposal: AiStructuredGrowthAgentProposal }
  | AiProviderFailure {
  const completedIds = new Set(input.completedToolRuns.map((row) => row.toolRunId));
  const missingEvidence: string[] = [];
  for (const evidenceRef of input.proposal.evidence) {
    if (evidenceRef.startsWith('tool:')) {
      const toolRunId = evidenceRef.slice('tool:'.length);
      if (!completedIds.has(toolRunId)) {
        missingEvidence.push(evidenceRef);
      }
    }
  }
  const missingProviderRefs: string[] = [];
  for (const providerRef of input.proposal.providerDataReferences) {
    if (!completedIds.has(providerRef) && !input.proposal.evidence.includes(`tool:${providerRef}`)) {
      missingProviderRefs.push(providerRef);
    }
  }
  if (missingEvidence.length > 0 || missingProviderRefs.length > 0) {
    return fail(
      'INVALID_STRUCTURED_OUTPUT',
      'growth proposal evidence must reference completed tool runs; model narrative is not evidence',
    );
  }
  return { ok: true, proposal: input.proposal };
}

export function bindGrowthProposalEvidence(input: {
  readonly proposal: AiStructuredGrowthAgentProposal;
  readonly completedToolRuns: readonly ToolRunReference[];
}):
  | { readonly ok: true; readonly proposal: AiStructuredGrowthAgentProposal }
  | AiProviderFailure {
  const validated = validateGrowthProposalEvidenceBinding(input);
  if (!validated.ok) {
    return validated;
  }
  const evidence = Object.freeze([
    ...input.proposal.evidence,
    ...input.completedToolRuns.map((row) => `tool:${row.toolRunId}`),
  ]);
  return {
    ok: true,
    proposal: Object.freeze({
      ...input.proposal,
      evidence,
      providerDataReferences: Object.freeze(
        input.proposal.providerDataReferences.filter((ref) =>
          input.completedToolRuns.some((row) => row.toolRunId === ref),
        ),
      ),
    }),
  };
}

function fail(code: AiFailureCode, detail: string, providerKind: AiProviderKind | null = 'LOCAL_TEST'): AiProviderFailure {
  return { ok: false, code, detail, providerKind };
}
