/**
 * Investment-research interpretation layer — separate from raw Wave 6 opportunity providers.
 * Does not treat posting-count growth as universally bullish.
 */

import type { WorkforceExpansionState, WorkforceResearchInterpretation, HiringQualityState } from './types.ts';
import type { UtcInstant } from '@solstice/domain';
import { WORKFORCE_RESEARCH_PREDICTION_TARGETS, type WorkforceOperationalStance } from './taxonomy.ts';

export function interpretWorkforceForResearch(input: {
  readonly firmKey: string;
  readonly evaluationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly expansion: WorkforceExpansionState | null;
  readonly quality: HiringQualityState | null;
  readonly adjustedPostingGrowthMoMBps: number | null;
}): WorkforceResearchInterpretation {
  const cautions: string[] = [
    'job_posting_growth_is_not_universally_bullish',
    'provider_coverage_skews_toward_digital_employers',
    'motive_estimates_are_heuristic_not_certain',
  ];

  let stance: WorkforceOperationalStance = 'NEUTRAL';
  const narrativeParts: string[] = [];

  if (input.quality && input.quality.band === 'LOW_SIGNAL') {
    stance = 'INSUFFICIENT_COVERAGE';
    narrativeParts.push('Coverage too thin for firm-level operational inference.');
  } else if (input.expansion) {
    const growth = input.adjustedPostingGrowthMoMBps;
    const motive = input.expansion.estimatedMotive;
    if (motive === 'REPLACEMENT' || motive === 'TURNOVER') {
      stance = 'CAUTIOUSLY_NEGATIVE';
      narrativeParts.push('Posting momentum aligns with replacement/turnover, not necessarily net expansion.');
      cautions.push('replacement_hiring_can_coincide_with_cost_pressure');
    } else if (motive === 'EXPANSION' && growth != null && growth > 1_000) {
      stance = 'CAUTIOUSLY_POSITIVE';
      narrativeParts.push('Breadth and location signals lean expansion, but require fundamentals corroboration.');
    } else if (motive === 'SEASONAL') {
      stance = 'MIXED';
      narrativeParts.push('Seasonal industry cycle may explain posting lift without structural demand change.');
    } else if (growth != null && growth > 2_000) {
      stance = 'MIXED';
      narrativeParts.push('Strong posting growth observed; motive uncertain — avoid one-sided bullish read.');
    }
  }

  return Object.freeze({
    interpretationId: `workforce_interp:${input.firmKey}:${input.evaluationTime}`,
    firmKey: input.firmKey,
    evaluationTime: input.evaluationTime,
    operationalStance: stance,
    postingGrowthNotUniversallyBullish: true,
    linkedPredictionTargets: WORKFORCE_RESEARCH_PREDICTION_TARGETS,
    narrative: narrativeParts.join(' ') || 'Neutral workforce posting posture pending corroboration.',
    cautions: Object.freeze(cautions),
    grantsExecutionAuthority: false,
    knowableAt: input.knowableAt,
  });
}
