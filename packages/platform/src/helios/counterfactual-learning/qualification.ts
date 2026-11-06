import type { UtcInstant } from '@solstice/domain';

import { assessOverlapForOpe } from './overlap-assessment.ts';
import { HELIOS_CF03_POLICY_PROPENSITY_QUALIFIED } from './taxonomy.ts';
import type { BehaviorPolicySnapshot, OverlapAssessment, PolicySupportStateGate, ProbabilityRational } from './types.ts';

export type Cf03PolicyPropensityQualification = {
  readonly marker: typeof HELIOS_CF03_POLICY_PROPENSITY_QUALIFIED | null;
  readonly overlap: OverlapAssessment;
  readonly gate: PolicySupportStateGate;
};

export function evaluateCf03PolicyPropensityQualification(input: {
  readonly decidedAtUtc: UtcInstant;
  readonly behavior: BehaviorPolicySnapshot;
  readonly evaluationPropensityMasses: ReadonlyMap<string, ProbabilityRational>;
}): Cf03PolicyPropensityQualification {
  const { overlap, gate } = assessOverlapForOpe(input);
  const marker = gate.counterfactualOpeEstimationPermitted ? HELIOS_CF03_POLICY_PROPENSITY_QUALIFIED : null;
  return { marker, overlap, gate };
}
