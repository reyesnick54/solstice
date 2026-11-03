import type { BiasAssessment } from '../types.ts';

export type StrategyGenomeBiasSentinelRef = {
  readonly genomeId: string;
  readonly biasAssessmentId: string;
  readonly severity: BiasAssessment['severity'];
  readonly promotionBlocked: boolean;
};

export function attachBiasAssessmentToStrategyGenome(input: {
  readonly genomeId: string;
  readonly assessment: BiasAssessment;
  readonly promotionBlocked: boolean;
}): StrategyGenomeBiasSentinelRef {
  return Object.freeze({
    genomeId: input.genomeId,
    biasAssessmentId: input.assessment.assessmentId,
    severity: input.assessment.severity,
    promotionBlocked: input.promotionBlocked,
  });
}
