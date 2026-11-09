import type { UtcInstant } from '@solstice/domain';

import type { SealedDecisionRecord, ShadowLabCheckpoint } from '../types.ts';
import type {
  ShadowLabCampaignLease,
  ShadowLabCampaignRegistration,
  ShadowLabDecisionCommitInput,
  ShadowLabDecisionCommitResult,
  ShadowLabMaturedOutcome,
  ShadowLabPendingOutcome,
  ShadowLabShadowFill,
  ShadowLabStrategyVersionRecord,
} from './types.ts';

/**
 * Durable shadow-lab store port. PostgreSQL and in-memory implementations must
 * share fencing, idempotency, and fail-closed semantics.
 */
export type ShadowLabDurableStore = {
  readonly persistenceAvailable: boolean;

  registerCampaign(registration: ShadowLabCampaignRegistration): Promise<'OK' | 'DUPLICATE'>;
  registerStrategyVersion(record: ShadowLabStrategyVersionRecord): Promise<'OK' | 'DUPLICATE'>;

  tryAcquireLease(input: {
    readonly campaignId: string;
    readonly workerId: string;
    readonly now: UtcInstant;
    readonly leaseMs: number;
  }): Promise<ShadowLabCampaignLease | 'HELD_BY_OTHER' | 'PERSISTENCE_UNAVAILABLE'>;

  renewLease(input: {
    readonly campaignId: string;
    readonly workerId: string;
    readonly fencingToken: number;
    readonly now: UtcInstant;
    readonly leaseMs: number;
  }): Promise<'OK' | 'LEASE_LOST' | 'PERSISTENCE_UNAVAILABLE'>;

  releaseLease(input: {
    readonly campaignId: string;
    readonly workerId: string;
    readonly fencingToken: number;
  }): Promise<void>;

  commitSealedDecision(input: ShadowLabDecisionCommitInput): Promise<ShadowLabDecisionCommitResult>;

  listDecisions(campaignId: string): Promise<readonly SealedDecisionRecord[]>;
  getEvidenceHash(decisionId: string): Promise<string | undefined>;
  getCheckpoint(campaignId: string): Promise<ShadowLabCheckpoint | undefined>;

  recordShadowFill(fill: ShadowLabShadowFill): Promise<'OK' | 'DUPLICATE' | 'PERSISTENCE_UNAVAILABLE'>;
  enqueuePendingOutcome(outcome: ShadowLabPendingOutcome): Promise<'OK' | 'DUPLICATE' | 'PERSISTENCE_UNAVAILABLE'>;
  matureOutcome(input: {
    readonly outcome: ShadowLabMaturedOutcome;
    readonly fencingToken: number;
    readonly campaignId: string;
  }): Promise<'OK' | 'LEASE_LOST' | 'DUPLICATE' | 'PERSISTENCE_UNAVAILABLE'>;

  listPendingOutcomesReady(now: UtcInstant): Promise<readonly ShadowLabPendingOutcome[]>;
  recordDemotion(input: {
    readonly demotionId: string;
    readonly campaignId: string;
    readonly strategyId: string;
    readonly reason: string;
    readonly at: UtcInstant;
    readonly fencingToken: number;
  }): Promise<'OK' | 'LEASE_LOST' | 'PERSISTENCE_UNAVAILABLE'>;
};
