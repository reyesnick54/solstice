import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import { sealForwardAlphaDecision } from '../seal.ts';
import { asForwardAlphaCampaignId, asForwardAlphaStrategyId } from '../ids.ts';
import type { ForwardAlphaEvidenceLane } from '../taxonomy.ts';
import type { ForwardCampaignRuntimePorts } from './ports.ts';
import type { CampaignRunContext } from './types.ts';

export function buildSimulationCampaignRuntimePorts(
  lane: ForwardAlphaEvidenceLane = 'FORWARD_PAPER',
): ForwardCampaignRuntimePorts {
  const strategyId = asForwardAlphaStrategyId('fstrat_alpha17_fixture');
  return Object.freeze({
    observe: ({ asOf }) => Object.freeze([`obs:${asOf}`]),
    buildPointInTimeState: ({ observationRefs, asOf }) =>
      Object.freeze({
        asOf,
        observationRefs,
        featureVersions: Object.freeze({ momentum_v1: '1.0.0' }),
        pitDigest: createHash('sha256').update(observationRefs.join(':')).digest('hex'),
      }),
    evaluateStrategies: ({ pit }) =>
      Object.freeze([
        Object.freeze({
          strategyId,
          boundaryKey: `bk:${pit.pitDigest.slice(0, 16)}`,
          signalDigest: createHash('sha256').update(pit.pitDigest).digest('hex'),
          eligibleForSeal: true,
        }),
      ]),
    sealBoundaryDecision: ({ context, evaluation, pit, sealedAt }) => {
      const decision = sealForwardAlphaDecision({
        campaignId: context.campaignId,
        strategyId: evaluation.strategyId,
        strategyVersion: 'alpha17-fixture',
        evidenceLane: lane,
        decisionAt: pit.asOf,
        earliestOutcomeKnowableAt: sealedAt,
        featureVersions: pit.featureVersions,
        observationDigests: [...pit.observationRefs],
        sealedAt,
        liveCapital: false,
      });
      return decision.decisionId;
    },
    executePaperShadow: ({ decisionId }) =>
      Object.freeze({
        executionRef: `exec:${decisionId}`,
        lane,
        simulated: true as const,
      }),
    scoreMaturedOutcome: () => true,
    updateEvidence: () => 'evidence:alpha17-fixture',
    checkDecay: () => Object.freeze({ degraded: false, detail: 'stable' }),
    checkPromotionDemotion: () =>
      Object.freeze({
        outcome: 'HOLD_REVIEW' as const,
        reason: 'fixture hold',
      }),
  });
}

export function sampleAlpha17CampaignId(suffix: string): ReturnType<typeof asForwardAlphaCampaignId> {
  return asForwardAlphaCampaignId(`fcamp_alpha17_${suffix}`);
}

export function fixtureCampaignContext(campaignId: string, registeredAt: UtcInstant): CampaignRunContext {
  const id = asForwardAlphaCampaignId(campaignId);
  return Object.freeze({
    schema: 'sunrey.helios.forward-alpha.campaign-orchestrator.v1',
    campaignId: id,
    evidenceLane: 'FORWARD_PAPER',
    runState: 'RUNNING',
    lastLoopPhase: null,
    lease: null,
    sealedDecisionIds: Object.freeze([]),
    sealedBoundaryDigests: Object.freeze({}),
    pendingOutcomes: Object.freeze([]),
    checkpointGeneration: 0,
    registeredAt,
    updatedAt: registeredAt,
    startedAt: registeredAt,
    lastPromotionVerdict: null,
  });
}
