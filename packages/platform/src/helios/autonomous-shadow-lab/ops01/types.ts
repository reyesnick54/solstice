import type { UtcInstant } from '@solstice/domain';

import type { SealedDecisionRecord, ShadowLabCheckpoint } from '../types.ts';
import type { ShadowLabRestartCrashPoint } from './taxonomy.ts';

export type ShadowLabCampaignRegistration = {
  readonly campaignId: string;
  readonly fingerprint: string;
  readonly strategyIds: readonly string[];
  readonly registeredAt: UtcInstant;
  readonly simulationOnly: true;
};

export type ShadowLabStrategyVersionRecord = {
  readonly strategyVersionId: string;
  readonly campaignId: string;
  readonly strategyId: string;
  readonly version: string;
  readonly freezeHash: string;
  readonly registeredAt: UtcInstant;
};

export type ShadowLabCampaignLease = {
  readonly campaignId: string;
  readonly workerId: string;
  readonly fencingToken: number;
  readonly acquiredAt: UtcInstant;
  readonly expiresAt: UtcInstant;
};

export type ShadowLabDecisionCommitInput = {
  readonly decision: SealedDecisionRecord;
  readonly evidenceHash: string;
  readonly checkpoint: ShadowLabCheckpoint;
  readonly outboxEventId: string;
  readonly outboxKind: string;
  readonly fencingToken: number;
  readonly workerId: string;
};

export type ShadowLabDecisionCommitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'DUPLICATE_DECISION' | 'DUPLICATE_EVIDENCE' | 'LEASE_LOST' | 'PERSISTENCE_UNAVAILABLE' };

export type ShadowLabShadowFill = {
  readonly fillId: string;
  readonly campaignId: string;
  readonly decisionId: string;
  readonly strategyId: string;
  readonly notionalMinor: bigint;
  readonly filledAt: UtcInstant;
  readonly environment: 'SHADOW';
};

export type ShadowLabPendingOutcome = {
  readonly outcomeId: string;
  readonly decisionId: string;
  readonly campaignId: string;
  readonly maturesAt: UtcInstant;
};

export type ShadowLabMaturedOutcome = {
  readonly outcomeId: string;
  readonly decisionId: string;
  readonly campaignId: string;
  readonly maturedAt: UtcInstant;
};

export type ShadowLabRuntimeHealth = {
  readonly schema: typeof import('./taxonomy.ts').HELIOS_DURABLE_SHADOW_LAB_RUNTIME_SCHEMA;
  readonly healthy: boolean;
  readonly persistenceAvailable: boolean;
  readonly activeCampaigns: number;
  readonly notes: readonly string[];
};

export type ShadowLabRuntimeReadiness = {
  readonly ready: boolean;
  readonly blockers: readonly string[];
};

export type ShadowLabRuntimeMetrics = {
  readonly decisionsSealed: number;
  readonly outcomesMatured: number;
  readonly shadowFills: number;
  readonly demotions: number;
  readonly leaseCollisions: number;
  readonly persistenceFailures: number;
};

export type ShadowLabRestartHarnessInput = {
  readonly campaignId: string;
  readonly now: UtcInstant;
  readonly strategyIds: readonly string[];
  readonly crashPoint: ShadowLabRestartCrashPoint;
};

export type ShadowLabRestartHarnessResult = {
  readonly crashPoint: ShadowLabRestartCrashPoint;
  readonly duplicateDecisionIds: readonly string[];
  readonly missingEvidenceHashes: readonly string[];
  readonly financialEffectsCreated: boolean;
  readonly passed: boolean;
};
