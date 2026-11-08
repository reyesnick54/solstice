import type { ResearchReactivationGate } from './taxonomy.ts';
import type { ResearchKillDecision } from './types.ts';

export type ResearchReactivationInput = {
  readonly hasNewEvidence: boolean;
  readonly hasExplicitGovernancePolicy: boolean;
  readonly hasNewVersionOrCampaign: boolean;
};

export function evaluateResearchReactivationEligibility(
  priorKill: ResearchKillDecision | null,
  input: ResearchReactivationInput,
): { readonly eligible: boolean; readonly satisfied: readonly ResearchReactivationGate[] } {
  if (!priorKill?.killRequired) {
    return Object.freeze({ eligible: true, satisfied: Object.freeze([]) });
  }

  const satisfied: ResearchReactivationGate[] = [];
  if (input.hasNewEvidence) satisfied.push('NEW_EVIDENCE');
  if (input.hasExplicitGovernancePolicy) satisfied.push('EXPLICIT_GOVERNANCE_POLICY');
  if (input.hasNewVersionOrCampaign) satisfied.push('NEW_VERSION_OR_CAMPAIGN');

  return Object.freeze({
    eligible: satisfied.length > 0,
    satisfied: Object.freeze(satisfied),
  });
}
