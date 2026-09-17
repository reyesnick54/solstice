import { sameModelAndEvidence } from './model-routing.ts';
import type {
  DisagreementRecord,
  HeliosSpecialistRole,
  IndependenceAssessment,
  SpecialistRecommendation,
  SpecialistTaskOutput,
  SpecialistView,
} from './types.ts';

const SUPPORT: ReadonlySet<SpecialistRecommendation> = new Set(['SUPPORT', 'INVESTIGATE']);
const OPPOSE: ReadonlySet<SpecialistRecommendation> = new Set(['OPPOSE', 'ABANDON']);

function evidenceStrength(output: SpecialistTaskOutput): SpecialistView['evidenceStrength'] {
  if (output.contradictions.length > 0 && output.recommendation === 'OPPOSE') {
    return 'WEAK';
  }
  if (output.evidenceReferences.length === 0) {
    return 'UNSUPPORTED';
  }
  if ((output.confidence ?? 0) >= 0.75) {
    return 'STRONG';
  }
  if ((output.confidence ?? 0) >= 0.5) {
    return 'MODERATE';
  }
  return 'WEAK';
}

function toView(output: SpecialistTaskOutput): SpecialistView {
  return Object.freeze({
    role: output.specialistRole,
    recommendation: output.recommendation,
    summary: output.findings[0] ?? output.task,
    evidenceStrength: evidenceStrength(output),
    outputId: output.outputId,
  });
}

export function assessIndependence(outputs: readonly SpecialistTaskOutput[]): readonly IndependenceAssessment[] {
  const byEvidence = new Map<string, SpecialistTaskOutput[]>();
  for (const output of outputs) {
    for (const evidenceId of output.lineage.sharedEvidenceIds) {
      const bucket = byEvidence.get(evidenceId) ?? [];
      bucket.push(output);
      byEvidence.set(evidenceId, bucket);
    }
  }

  const assessments: IndependenceAssessment[] = [];
  for (const [evidenceId, bucket] of byEvidence.entries()) {
    const sourceRef = bucket[0]?.evidenceReferences.find((row) => row.evidenceId === evidenceId)?.sourceRef ?? evidenceId;
    let independent = 0;
    for (let i = 0; i < bucket.length; i += 1) {
      const left = bucket[i];
      if (!left) continue;
      let hasDistinctLineage = true;
      for (let j = 0; j < bucket.length; j += 1) {
        if (i === j) continue;
        const right = bucket[j];
        if (!right) continue;
        if (sameModelAndEvidence(left.lineage, right.lineage)) {
          hasDistinctLineage = false;
          break;
        }
      }
      if (hasDistinctLineage) {
        independent += 1;
      }
    }
    assessments.push(
      Object.freeze({
        evidenceId,
        sourceRef,
        corroborationCount: bucket.length,
        independentCorroborationCount: independent,
        sharedModelWarning: bucket.some((left, idx) =>
          bucket.some((right, jdx) => idx !== jdx && sameModelAndEvidence(left.lineage, right.lineage)),
        ),
        sharedEvidenceWarning: bucket.length > 1,
        treatedAsIndependent: independent >= 2,
      }),
    );
  }
  return Object.freeze(assessments);
}

export function collectDisagreements(outputs: readonly SpecialistTaskOutput[]): readonly DisagreementRecord[] {
  const researchOutputs = outputs.filter((row) => row.specialistRole !== 'META_ALLOCATOR');
  const topics = ['strategy-validity', 'evidence-quality', 'execution-feasibility'] as const;
  const records: DisagreementRecord[] = [];

  for (const topic of topics) {
    const supporting: SpecialistView[] = [];
    const opposing: SpecialistView[] = [];
    for (const output of researchOutputs) {
      const view = toView(output);
      if (SUPPORT.has(output.recommendation)) {
        supporting.push(view);
      }
      if (OPPOSE.has(output.recommendation)) {
        opposing.push(view);
      }
    }
    if (supporting.length === 0 && opposing.length === 0) {
      continue;
    }
    if (supporting.length > 0 && opposing.length > 0) {
      records.push(
        Object.freeze({
          topic,
          supportingViews: Object.freeze(supporting),
          opposingViews: Object.freeze(opposing),
          unresolvedQuestions: Object.freeze([`Resolve ${topic} disagreement before proposal.`]),
          evidenceStrength:
            supporting.some((row) => row.evidenceStrength === 'STRONG') &&
            opposing.some((row) => row.evidenceStrength === 'STRONG')
              ? 'MODERATE'
              : 'WEAK',
          resolveCostMicros: 100_000n,
          materiality: topic === 'evidence-quality' ? 'HIGH' : 'MEDIUM',
        }),
      );
    }
  }

  return Object.freeze(records);
}

export function missingRoles(
  routed: readonly HeliosSpecialistRole[],
  completed: readonly HeliosSpecialistRole[],
): readonly HeliosSpecialistRole[] {
  const done = new Set(completed);
  return Object.freeze(routed.filter((role) => !done.has(role)));
}
