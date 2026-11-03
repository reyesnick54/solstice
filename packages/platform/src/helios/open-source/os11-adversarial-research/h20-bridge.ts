import type { ResearchValueInput } from '../../meta-allocator/types.ts';
import type { ResearchConsensus, ResearchDisagreementMetric } from './types.ts';
import { MAX_REBUTTAL_ROUNDS } from './taxonomy.ts';

/**
 * Maps adversarial debate output into H20 research-value inputs without equating consensus with truth.
 */
export function enrichResearchValueWithDebate(input: {
  readonly base: ResearchValueInput;
  readonly metric: ResearchDisagreementMetric;
  readonly consensus: ResearchConsensus;
}): ResearchValueInput {
  const specialistDisagreement = input.metric.materialDisagreement;
  let unresolvedUncertainty = input.base.unresolvedUncertainty;
  if (input.metric.informationValueHint === 'HIGH' && !input.metric.lowValueDisagreement) {
    unresolvedUncertainty = 'HIGH';
  } else if (input.metric.lowValueDisagreement && unresolvedUncertainty === 'HIGH') {
    unresolvedUncertainty = 'MEDIUM';
  }

  let evidenceQuality = input.base.evidenceQuality;
  if (input.consensus.bearishEvidence.length > input.consensus.bullishEvidence.length) {
    if (evidenceQuality === 'HIGH') evidenceQuality = 'MEDIUM';
    else if (evidenceQuality === 'MEDIUM') evidenceQuality = 'LOW';
  }

  return Object.freeze({
    ...input.base,
    specialistDisagreement,
    unresolvedUncertainty,
    evidenceQuality,
  });
}

/**
 * Guards against infinite adversarial model fan-out when disagreement is low-value.
 */
export function permitAdditionalDebateRound(input: {
  readonly metric: ResearchDisagreementMetric;
  readonly completedRounds: number;
  readonly maxRounds?: number;
}): boolean {
  const maxRounds = input.maxRounds ?? MAX_REBUTTAL_ROUNDS;
  if (input.completedRounds >= maxRounds) {
    return false;
  }
  if (input.metric.lowValueDisagreement) {
    return false;
  }
  return input.metric.informationValueHint === 'HIGH' || input.metric.informationValueHint === 'MEDIUM';
}

export function debateBoostsInformationValue(metric: ResearchDisagreementMetric): boolean {
  return metric.informationValueHint === 'HIGH' && metric.materialDisagreement && !metric.lowValueDisagreement;
}
