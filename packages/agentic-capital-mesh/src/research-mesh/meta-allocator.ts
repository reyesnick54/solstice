import { collectDisagreements, assessIndependence, missingRoles } from './disagreement.ts';
import type {
  HeliosSpecialistRole,
  MeshCompletionState,
  MetaAllocatorOutput,
  SpecialistRecommendation,
  SpecialistTaskOutput,
  SpecialistUsage,
  SpecialistView,
} from './types.ts';

function sumUsage(outputs: readonly SpecialistTaskOutput[]): SpecialistUsage {
  return Object.freeze(
    outputs.reduce(
      (acc, row) =>
        Object.freeze({
          inputTokens: acc.inputTokens + row.usage.inputTokens,
          outputTokens: acc.outputTokens + row.usage.outputTokens,
          inferenceCalls: acc.inferenceCalls + row.usage.inferenceCalls,
          toolCalls: acc.toolCalls + row.usage.toolCalls,
          costMicros: acc.costMicros + row.usage.costMicros,
          currency: row.usage.currency,
        }),
      {
        inputTokens: 0,
        outputTokens: 0,
        inferenceCalls: 0,
        toolCalls: 0,
        costMicros: 0n,
        currency: 'USD',
      },
    ),
  );
}

function aggregateRecommendation(outputs: readonly SpecialistTaskOutput[]): SpecialistRecommendation {
  const counts = new Map<SpecialistRecommendation, number>();
  for (const output of outputs) {
    counts.set(output.recommendation, (counts.get(output.recommendation) ?? 0) + 1);
  }
  if ((counts.get('OPPOSE') ?? 0) > 0 || (counts.get('ABANDON') ?? 0) > 0) {
    return 'INVESTIGATE';
  }
  if ((counts.get('SUPPORT') ?? 0) >= 2) {
    return 'SUPPORT';
  }
  if ((counts.get('WAIT') ?? 0) > 0) {
    return 'WAIT';
  }
  return 'INVESTIGATE';
}

function toViews(outputs: readonly SpecialistTaskOutput[], filter: (row: SpecialistTaskOutput) => boolean): readonly SpecialistView[] {
  return Object.freeze(
    outputs.filter(filter).map((row) =>
      Object.freeze({
        role: row.specialistRole,
        recommendation: row.recommendation,
        summary: row.findings[0] ?? row.task,
        evidenceStrength:
          row.evidenceReferences.length === 0
            ? ('UNSUPPORTED' as const)
            : (row.confidence ?? 0) >= 0.7
              ? ('STRONG' as const)
              : (row.confidence ?? 0) >= 0.5
                ? ('MODERATE' as const)
                : ('WEAK' as const),
        outputId: row.outputId,
      }),
    ),
  );
}

export function buildMetaAllocatorOutput(input: {
  readonly runId: string;
  readonly routedRoles: readonly HeliosSpecialistRole[];
  readonly outputs: readonly SpecialistTaskOutput[];
  readonly failedRoles: readonly HeliosSpecialistRole[];
  readonly timedOutRoles: readonly HeliosSpecialistRole[];
  readonly cancelledRoles: readonly HeliosSpecialistRole[];
}): MetaAllocatorOutput {
  const researchOutputs = input.outputs.filter((row) => row.specialistRole !== 'META_ALLOCATOR');
  const completedRoles = researchOutputs.map((row) => row.specialistRole);
  const missing = missingRoles(input.routedRoles, completedRoles);
  const disagreements = collectDisagreements(researchOutputs);
  const independenceAssessments = assessIndependence(researchOutputs);

  let completionState: MeshCompletionState = 'COMPLETE';
  if (input.cancelledRoles.length > 0) {
    completionState = 'PARTIAL';
  } else if (input.failedRoles.length > 0 || input.timedOutRoles.length > 0) {
    completionState = researchOutputs.length > 0 ? 'PARTIAL' : 'FAILED';
  } else if (missing.length > 0) {
    completionState = 'DEGRADED';
  } else if (researchOutputs.some((row) => row.recommendation === 'OPPOSE' && row.evidenceReferences.length === 0)) {
    completionState = 'INSUFFICIENT_EVIDENCE';
  }

  const recommendation = aggregateRecommendation(researchOutputs);
  const supportRecs = new Set<SpecialistRecommendation>(['SUPPORT', 'INVESTIGATE']);
  const opposeRecs = new Set<SpecialistRecommendation>(['OPPOSE', 'ABANDON']);

  return Object.freeze({
    outputId: `cmout_meta_${input.runId}`,
    completionState,
    recommendation,
    supportingViews: toViews(researchOutputs, (row) => supportRecs.has(row.recommendation)),
    opposingViews: toViews(researchOutputs, (row) => opposeRecs.has(row.recommendation)),
    disagreements,
    missingRoles: missing,
    failedRoles: Object.freeze([...input.failedRoles]),
    timedOutRoles: Object.freeze([...input.timedOutRoles]),
    cancelledRoles: Object.freeze([...input.cancelledRoles]),
    independenceAssessments,
    totalUsage: sumUsage(researchOutputs),
    summary: `Meta allocator synthesized ${researchOutputs.length} specialist outputs without averaging opinions.`,
    grantsFinancialAuthority: false as const,
  });
}
