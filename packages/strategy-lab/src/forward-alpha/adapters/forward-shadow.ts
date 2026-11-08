import type { UtcInstant } from '@solstice/domain';

import type { ForwardShadowDecision, ForwardShadowRun } from '../../forward-shadow.ts';
import { asForwardAlphaCampaignId, asForwardAlphaStrategyId } from '../ids.ts';
import { sealForwardAlphaDecision } from '../seal.ts';
import type { ForwardAlphaDecision } from '../types.ts';

export const FORWARD_SHADOW_ALPHA01_EVIDENCE_LANE = 'FORWARD_SHADOW' as const;

export function forwardShadowRunToAlpha01CampaignRef(run: ForwardShadowRun): {
  readonly campaignId: ReturnType<typeof asForwardAlphaCampaignId>;
  readonly strategyId: ReturnType<typeof asForwardAlphaStrategyId>;
  readonly strategyVersion: string;
  readonly observationRef: string;
} {
  return Object.freeze({
    campaignId: asForwardAlphaCampaignId(`camp_fsh_${run.runId}`),
    strategyId: asForwardAlphaStrategyId(run.strategyId),
    strategyVersion: run.strategyVersion,
    observationRef: run.observationRef,
  });
}

export function projectForwardShadowDecisionToForwardAlpha(input: {
  readonly run: ForwardShadowRun;
  readonly decision: ForwardShadowDecision;
  readonly earliestOutcomeKnowableAt: UtcInstant;
  readonly featureVersions: Readonly<Record<string, string>>;
  readonly observationDigests: readonly string[];
  readonly sealedAt: UtcInstant;
}): ForwardAlphaDecision {
  const campaignRef = forwardShadowRunToAlpha01CampaignRef(input.run);
  return sealForwardAlphaDecision({
    campaignId: campaignRef.campaignId,
    strategyId: campaignRef.strategyId,
    strategyVersion: campaignRef.strategyVersion,
    evidenceLane: FORWARD_SHADOW_ALPHA01_EVIDENCE_LANE,
    decisionAt: input.decision.decisionTime,
    earliestOutcomeKnowableAt: input.earliestOutcomeKnowableAt,
    featureVersions: input.featureVersions,
    observationDigests: input.observationDigests,
    sealedAt: input.sealedAt,
    liveCapital: false,
  });
}
