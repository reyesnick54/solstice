import type { UtcInstant } from '@solstice/domain';

import type { ForwardAlphaCampaignId, ForwardAlphaDecisionId, ForwardAlphaStrategyId } from '../ids.ts';
import type { ForwardAlphaEvidenceLane } from '../taxonomy.ts';
import type { CampaignPromotionVerdict, CampaignRunContext } from './types.ts';

export type CampaignPointInTimeState = {
  readonly asOf: UtcInstant;
  readonly observationRefs: readonly string[];
  readonly featureVersions: Readonly<Record<string, string>>;
  readonly pitDigest: string;
};

export type CampaignStrategyEvaluation = {
  readonly strategyId: ForwardAlphaStrategyId;
  readonly boundaryKey: string;
  readonly signalDigest: string;
  readonly eligibleForSeal: boolean;
};

export type CampaignPaperShadowFill = {
  readonly executionRef: string;
  readonly lane: ForwardAlphaEvidenceLane;
  readonly simulated: true;
};

export type CampaignDecayVerdict = {
  readonly degraded: boolean;
  readonly detail: string;
};

export type ForwardCampaignRuntimePorts = {
  readonly observe: (input: {
    readonly campaignId: ForwardAlphaCampaignId;
    readonly asOf: UtcInstant;
  }) => readonly string[];
  readonly buildPointInTimeState: (input: {
    readonly campaignId: ForwardAlphaCampaignId;
    readonly observationRefs: readonly string[];
    readonly asOf: UtcInstant;
  }) => CampaignPointInTimeState;
  readonly evaluateStrategies: (input: {
    readonly campaignId: ForwardAlphaCampaignId;
    readonly pit: CampaignPointInTimeState;
  }) => readonly CampaignStrategyEvaluation[];
  readonly sealBoundaryDecision: (input: {
    readonly context: CampaignRunContext;
    readonly evaluation: CampaignStrategyEvaluation;
    readonly pit: CampaignPointInTimeState;
    readonly sealedAt: UtcInstant;
  }) => ForwardAlphaDecisionId | null;
  readonly executePaperShadow: (input: {
    readonly context: CampaignRunContext;
    readonly decisionId: ForwardAlphaDecisionId;
    readonly executedAt: UtcInstant;
  }) => CampaignPaperShadowFill;
  readonly scoreMaturedOutcome: (input: {
    readonly context: CampaignRunContext;
    readonly decisionId: ForwardAlphaDecisionId;
    readonly scoredAt: UtcInstant;
  }) => boolean;
  readonly updateEvidence: (input: {
    readonly context: CampaignRunContext;
    readonly updatedAt: UtcInstant;
  }) => string;
  readonly checkDecay: (input: { readonly context: CampaignRunContext }) => CampaignDecayVerdict;
  readonly checkPromotionDemotion: (input: {
    readonly context: CampaignRunContext;
    readonly decay: CampaignDecayVerdict;
  }) => CampaignPromotionVerdict;
};
