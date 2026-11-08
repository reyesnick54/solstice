import type { ForwardAlphaEvidenceLane } from './taxonomy.ts';

export const FORWARD_ALPHA_CAMPAIGN_SCHEMA = 'helios.forward-alpha.campaign.v1' as const;

export type ForwardAlphaCampaignId = string & { readonly __brand: 'ForwardAlphaCampaignId' };
export type ForwardAlphaStrategyId = string & { readonly __brand: 'ForwardAlphaStrategyId' };
export type ForwardAlphaDecisionId = string & { readonly __brand: 'ForwardAlphaDecisionId' };
export type ForwardAlphaObservationId = string & { readonly __brand: 'ForwardAlphaObservationId' };
export type ForwardAlphaOutcomeId = string & { readonly __brand: 'ForwardAlphaOutcomeId' };
export type ForwardAlphaEvidenceId = string & { readonly __brand: 'ForwardAlphaEvidenceId' };
export type ForwardAlphaManifestId = string & { readonly __brand: 'ForwardAlphaManifestId' };

export function asForwardAlphaCampaignId(value: string): ForwardAlphaCampaignId {
  return value as ForwardAlphaCampaignId;
}

export function asForwardAlphaStrategyId(value: string): ForwardAlphaStrategyId {
  return value as ForwardAlphaStrategyId;
}

export function asForwardAlphaDecisionId(value: string): ForwardAlphaDecisionId {
  return value as ForwardAlphaDecisionId;
}

export function asForwardAlphaObservationId(value: string): ForwardAlphaObservationId {
  return value as ForwardAlphaObservationId;
}

export function asForwardAlphaOutcomeId(value: string): ForwardAlphaOutcomeId {
  return value as ForwardAlphaOutcomeId;
}

export function asForwardAlphaEvidenceId(value: string): ForwardAlphaEvidenceId {
  return value as ForwardAlphaEvidenceId;
}

export function asForwardAlphaManifestId(value: string): ForwardAlphaManifestId {
  return value as ForwardAlphaManifestId;
}

export function forwardAlphaDecisionMaterial(input: {
  readonly campaignId: ForwardAlphaCampaignId;
  readonly lane: ForwardAlphaEvidenceLane;
  readonly decisionAt: string;
  readonly strategyVersion: string;
  readonly featureVersionsDigest: string;
  readonly marketDataSequenceDigest: string;
}): string {
  return [
    input.campaignId,
    input.lane,
    input.decisionAt,
    input.strategyVersion,
    input.featureVersionsDigest,
    input.marketDataSequenceDigest,
  ].join('|');
}
