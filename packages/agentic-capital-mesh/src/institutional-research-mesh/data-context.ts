import { err, ok, type Result } from '../imports.ts';
import { invokeMeshTool } from '../tools.ts';
import type { CapitalContext } from '../types.ts';
import type { EvidenceReference } from '../research-mesh/types.ts';

export const INSTITUTIONAL_RESEARCH_READ_TOOLS = Object.freeze([
  'getPortfolio',
  'getMarketSnapshot',
  'getRiskSnapshot',
  'getMandate',
  'getGrowthPlan',
  'getEconomicValueSnapshot',
  'getInstrumentMetadata',
  'getRdtReadiness',
] as const);

export type InstitutionalResearchReadTool = (typeof INSTITUTIONAL_RESEARCH_READ_TOOLS)[number];

export type HeliosResearchDataSnapshot = {
  readonly subjectId: string;
  readonly contextRef: string;
  readonly evidenceBundle: readonly EvidenceReference[];
  readonly reads: Readonly<Partial<Record<InstitutionalResearchReadTool, unknown>>>;
};

export function loadHeliosResearchData(input: {
  readonly context: CapitalContext;
  readonly subjectId: string;
  readonly contextRef: string;
  readonly evidenceBundle: readonly EvidenceReference[];
  readonly tools?: readonly InstitutionalResearchReadTool[];
}): Result<HeliosResearchDataSnapshot, { readonly code: 'SUBJECT_MISMATCH' | 'DATA_ACCESS_REFUSED'; readonly message: string }> {
  if (input.context.subjectId !== input.subjectId) {
    return err({
      code: 'SUBJECT_MISMATCH',
      message: 'CapitalContext is subject-bound; institutional research refused cross-subject reads',
    });
  }
  const tools = input.tools ?? INSTITUTIONAL_RESEARCH_READ_TOOLS;
  const reads: Partial<Record<InstitutionalResearchReadTool, unknown>> = {};
  for (const tool of tools) {
    const result = invokeMeshTool(input.context, input.subjectId, tool);
    if (!result.ok) {
      return err({ code: 'DATA_ACCESS_REFUSED', message: result.error.message });
    }
    reads[tool] = result.value.payload;
  }
  return ok(
    Object.freeze({
      subjectId: input.subjectId,
      contextRef: input.contextRef,
      evidenceBundle: Object.freeze([...input.evidenceBundle]),
      reads: Object.freeze(reads),
    }),
  );
}

export function sourceRefsFromEvidence(
  evidenceBundle: readonly EvidenceReference[],
): readonly { readonly sourceRef: string; readonly evidenceId: string; readonly sourceKind: EvidenceReference['sourceKind']; readonly informationTime: EvidenceReference['observedAt'] }[] {
  return Object.freeze(
    evidenceBundle.map((row) =>
      Object.freeze({
        sourceRef: row.sourceRef,
        evidenceId: row.evidenceId,
        sourceKind: row.sourceKind,
        informationTime: row.observedAt,
      }),
    ),
  );
}
