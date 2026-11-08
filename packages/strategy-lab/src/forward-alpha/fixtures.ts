import { asUtcInstant } from '@solstice/domain';

import {
  asForwardAlphaCampaignId,
  asForwardAlphaEvidenceId,
  asForwardAlphaOutcomeId,
  asForwardAlphaStrategyId,
} from './ids.ts';
import { aggregateForwardAlphaEvidence, buildForwardAlphaManifest } from './manifest.ts';
import { sealForwardAlphaDecision } from './seal.ts';
import { resolveForwardAlphaStatus } from './qualification.ts';
import type { ForwardAlphaCampaign, ForwardAlphaStrategy } from './types.ts';

const FIXTURE_NOW = asUtcInstant('2026-06-01T15:00:00.000Z');
const FIXTURE_OUTCOME_KNOWABLE = asUtcInstant('2026-06-01T16:00:00.000Z');

export function buildAlpha01FixtureStrategy(): ForwardAlphaStrategy {
  return Object.freeze({
    strategyId: asForwardAlphaStrategyId('strat_alpha01_fixture'),
    strategyVersion: 'v1-fixture',
    versionFrozen: true,
    versionFrozenAt: FIXTURE_NOW,
    featureVersions: Object.freeze({ feature_fabric: 'faf-fixture-1', capsule: 'cap-fixture-1' }),
    capsuleFingerprint: 'sha256:fixture-capsule',
  });
}

export function buildAlpha01FixtureCampaign(): ForwardAlphaCampaign {
  const strategy = buildAlpha01FixtureStrategy();
  return Object.freeze({
    campaignId: asForwardAlphaCampaignId('camp_alpha01_fixture'),
    strategy,
    primaryLane: 'FORWARD_SHADOW',
    status: 'FORWARD_CAMPAIGN_READY',
    openedAt: FIXTURE_NOW,
    closedAt: null,
    observationRef: 'obs_fixture_forward_shadow',
    sendsOrders: false,
    changesInvestmentState: false,
    financialEffectCreated: false,
  });
}

/** Synthetic fixture capped at FORWARD_CAMPAIGN_READY / accumulating — never FORWARD_ALPHA_SUPPORTED. */
export function buildAlpha01SyntheticFixtureManifest() {
  const campaign = buildAlpha01FixtureCampaign();
  const decision = sealForwardAlphaDecision({
    campaignId: campaign.campaignId,
    strategyId: campaign.strategy.strategyId,
    strategyVersion: campaign.strategy.strategyVersion,
    evidenceLane: 'FORWARD_SHADOW',
    decisionAt: FIXTURE_NOW,
    earliestOutcomeKnowableAt: FIXTURE_OUTCOME_KNOWABLE,
    featureVersions: campaign.strategy.featureVersions,
    observationDigests: ['obs-seq-1', 'obs-seq-2'],
    sealedAt: FIXTURE_NOW,
  });
  const outcome = Object.freeze({
    outcomeId: asForwardAlphaOutcomeId('fout_fixture_1'),
    decisionId: decision.decisionId,
    observedAt: FIXTURE_OUTCOME_KNOWABLE,
    netEconomicsMinor: 50_000n,
    tradingCostMinor: 5_000n,
    notes: 'synthetic forward shadow fixture',
  });
  const evidence = aggregateForwardAlphaEvidence({
    evidenceId: asForwardAlphaEvidenceId('fev_fixture_shadow'),
    campaignId: campaign.campaignId,
    lane: 'FORWARD_SHADOW',
    decisions: [decision],
    outcomes: [outcome],
    syntheticFixture: true,
  });
  const { status } = resolveForwardAlphaStatus({
    architectureQualified: true,
    campaignConfigured: true,
    accumulatingForwardEvidence: true,
    edgeCandidateMetricsPass: true,
    forwardAlphaSupportedEvidence: true,
    forwardRobustnessSupported: true,
    paperImplementationSupported: false,
    liveCapitalEvidence: false,
    syntheticFixture: true,
    architectureTestOnly: false,
  });
  return buildForwardAlphaManifest({
    campaign: Object.freeze({ ...campaign, status }),
    evidenceByLane: Object.freeze({ FORWARD_SHADOW: evidence }),
    statusesReached: Object.freeze([status]),
    syntheticFixture: true,
    qualified: true,
    materializedAt: FIXTURE_NOW,
  });
}
