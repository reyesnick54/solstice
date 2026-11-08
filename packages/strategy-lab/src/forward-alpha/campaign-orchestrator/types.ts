import type { UtcInstant } from '@solstice/domain';

import type { ForwardAlphaCampaignId, ForwardAlphaDecisionId } from '../ids.ts';
import type { ForwardAlphaEvidenceLane } from '../taxonomy.ts';
import type {
  CampaignLoopPhase,
  CampaignRunState,
  CampaignTriggerKind,
  CampaignWorkItemKind,
  HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_SCHEMA,
} from './taxonomy.ts';

export type CampaignLease = {
  readonly campaignId: ForwardAlphaCampaignId;
  readonly ownerId: string;
  readonly acquiredAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly leaseGeneration: number;
};

export type CampaignScheduledOutcome = {
  readonly scheduleId: string;
  readonly decisionId: ForwardAlphaDecisionId;
  readonly matureAt: UtcInstant;
  readonly sealed: boolean;
};

export type CampaignPromotionVerdict = {
  readonly outcome: 'PROMOTE_PAPER' | 'HOLD_REVIEW' | 'REJECT_DECAY' | 'DEMOTE' | 'NO_CHANGE';
  readonly reason: string;
};

export type CampaignRunContext = {
  readonly schema: typeof HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_SCHEMA;
  readonly campaignId: ForwardAlphaCampaignId;
  readonly evidenceLane: ForwardAlphaEvidenceLane;
  readonly runState: CampaignRunState;
  readonly lastLoopPhase: CampaignLoopPhase | null;
  readonly lease: CampaignLease | null;
  readonly sealedDecisionIds: readonly ForwardAlphaDecisionId[];
  readonly sealedBoundaryDigests: Readonly<Record<string, ForwardAlphaDecisionId>>;
  readonly pendingOutcomes: readonly CampaignScheduledOutcome[];
  readonly checkpointGeneration: number;
  readonly registeredAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly startedAt: UtcInstant | null;
  readonly lastPromotionVerdict: CampaignPromotionVerdict | null;
};

export type CampaignWorkItem = {
  readonly workItemId: string;
  readonly campaignId: ForwardAlphaCampaignId;
  readonly kind: CampaignWorkItemKind;
  readonly triggerKind: CampaignTriggerKind;
  readonly enqueuedAt: UtcInstant;
  readonly notBefore: UtcInstant;
  readonly boundaryKey: string | null;
  readonly outcomeScheduleId: string | null;
};

export type CampaignCheckpoint = {
  readonly checkpointId: string;
  readonly campaignId: ForwardAlphaCampaignId;
  readonly generation: number;
  readonly committedAt: UtcInstant;
  readonly runContext: CampaignRunContext;
  readonly pendingWork: readonly CampaignWorkItem[];
  readonly contentDigest: string;
};

export type CampaignLoopStepRecord = {
  readonly phase: CampaignLoopPhase;
  readonly completedAt: UtcInstant;
  readonly detail: string;
};

export type CampaignRuntimeTickResult = {
  readonly phasesCompleted: readonly CampaignLoopPhase[];
  readonly runContext: CampaignRunContext;
  readonly newDecisionsSealed: number;
  readonly outcomesScored: number;
  readonly checkpoint: CampaignCheckpoint | null;
  readonly workItemsScheduled: readonly CampaignWorkItem[];
};

export type CampaignOrchestratorFailure = {
  readonly code:
    | 'CAMPAIGN_NOT_FOUND'
    | 'INVALID_STATE'
    | 'LEASE_DENIED'
    | 'LEASE_STALE'
    | 'LEASE_LOST'
    | 'DECISION_REPLAY_BLOCKED'
    | 'WORK_ITEM_NOT_READY';
  readonly message: string;
};
