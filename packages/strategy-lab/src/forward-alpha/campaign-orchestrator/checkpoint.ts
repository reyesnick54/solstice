import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import type { ForwardAlphaCampaignId } from '../ids.ts';
import type { CampaignCheckpoint, CampaignRunContext, CampaignWorkItem } from './types.ts';

function digestMaterial(input: {
  readonly campaignId: ForwardAlphaCampaignId;
  readonly generation: number;
  readonly runContext: CampaignRunContext;
  readonly pendingWork: readonly CampaignWorkItem[];
}): string {
  const payload = JSON.stringify({
    campaignId: input.campaignId,
    generation: input.generation,
    runState: input.runContext.runState,
    sealed: input.runContext.sealedDecisionIds,
    boundaries: input.runContext.sealedBoundaryDigests,
    pendingOutcomes: input.runContext.pendingOutcomes.map((row) => row.scheduleId),
    work: input.pendingWork.map((row) => row.workItemId),
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function commitCampaignCheckpoint(input: {
  readonly runContext: CampaignRunContext;
  readonly pendingWork: readonly CampaignWorkItem[];
  readonly now: UtcInstant;
}): { readonly checkpoint: CampaignCheckpoint; readonly runContext: CampaignRunContext } {
  const generation = input.runContext.checkpointGeneration + 1;
  const contentDigest = digestMaterial({
    campaignId: input.runContext.campaignId,
    generation,
    runContext: input.runContext,
    pendingWork: input.pendingWork,
  });
  const checkpointId = `fccp_${contentDigest.slice(0, 20)}`;
  const checkpoint: CampaignCheckpoint = Object.freeze({
    checkpointId,
    campaignId: input.runContext.campaignId,
    generation,
    committedAt: input.now,
    runContext: input.runContext,
    pendingWork: Object.freeze([...input.pendingWork]),
    contentDigest,
  });
  const runContext = Object.freeze({
    ...input.runContext,
    checkpointGeneration: generation,
    updatedAt: input.now,
  });
  return Object.freeze({ checkpoint, runContext });
}

export function restoreCampaignFromCheckpoint(checkpoint: CampaignCheckpoint): {
  readonly runContext: CampaignRunContext;
  readonly pendingWork: readonly CampaignWorkItem[];
} {
  return Object.freeze({
    runContext: Object.freeze({
      ...checkpoint.runContext,
      runState: checkpoint.runContext.runState === 'RUNNING' ? ('RECOVERING' as const) : checkpoint.runContext.runState,
    }),
    pendingWork: checkpoint.pendingWork,
  });
}

export function consequentialTransition(prev: CampaignRunContext, next: CampaignRunContext): boolean {
  if (prev.runState !== next.runState) return true;
  if (prev.sealedDecisionIds.length !== next.sealedDecisionIds.length) return true;
  if (prev.pendingOutcomes.length !== next.pendingOutcomes.length) return true;
  if (prev.lastLoopPhase !== next.lastLoopPhase) return true;
  if (prev.lastPromotionVerdict?.outcome !== next.lastPromotionVerdict?.outcome) return true;
  return false;
}
