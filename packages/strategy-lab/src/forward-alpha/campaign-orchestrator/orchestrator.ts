import { randomUUID } from 'node:crypto';

import type { Clock } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';
import { err, ok, type Result } from '@solstice/domain';

import { asForwardAlphaCampaignId, type ForwardAlphaCampaignId } from '../ids.ts';
import type { ForwardAlphaEvidenceLane } from '../taxonomy.ts';
import { restoreCampaignFromCheckpoint } from './checkpoint.ts';
import { acquireCampaignLease, renewCampaignLease, releaseCampaignLease } from './lease.ts';
import type { ForwardCampaignRuntimePorts } from './ports.ts';
import { runCampaignRuntimePass } from './runtime.ts';
import { ForwardCampaignOrchestratorStore, type CampaignOrchestratorSnapshot } from './store.ts';
import { HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_SCHEMA } from './taxonomy.ts';
import type {
  CampaignOrchestratorFailure,
  CampaignRunContext,
  CampaignRuntimeTickResult,
  CampaignTriggerKind,
  CampaignWorkItem,
} from './types.ts';

export type RegisterForwardCampaignInput = {
  readonly campaignId: string;
  readonly evidenceLane: ForwardAlphaEvidenceLane;
  readonly registeredAt?: UtcInstant;
};

export type ForwardCampaignOrchestratorPorts = {
  readonly clock: Clock;
  readonly runtime: ForwardCampaignRuntimePorts;
  readonly outcomeHorizonMs?: number;
  readonly defaultLeaseMs?: number;
};

export class ForwardCampaignOrchestrator {
  readonly store = new ForwardCampaignOrchestratorStore();
  private readonly clock: Clock;
  private readonly runtime: ForwardCampaignRuntimePorts;
  private readonly outcomeHorizonMs: number;
  private readonly defaultLeaseMs: number;

  constructor(ports: ForwardCampaignOrchestratorPorts) {
    this.clock = ports.clock;
    this.runtime = ports.runtime;
    this.outcomeHorizonMs = ports.outcomeHorizonMs ?? 60_000;
    this.defaultLeaseMs = ports.defaultLeaseMs ?? 30_000;
  }

  now(): UtcInstant {
    return this.clock.now();
  }

  registerCampaign(input: RegisterForwardCampaignInput): CampaignRunContext {
    const campaignId = asForwardAlphaCampaignId(input.campaignId);
    const now = input.registeredAt ?? this.now();
    const context: CampaignRunContext = Object.freeze({
      schema: HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_SCHEMA,
      campaignId,
      evidenceLane: input.evidenceLane,
      runState: 'REGISTERED',
      lastLoopPhase: null,
      lease: null,
      sealedDecisionIds: Object.freeze([]),
      sealedBoundaryDigests: Object.freeze({}),
      pendingOutcomes: Object.freeze([]),
      checkpointGeneration: 0,
      registeredAt: now,
      updatedAt: now,
      startedAt: null,
      lastPromotionVerdict: null,
    });
    this.store.putContext(context);
    return context;
  }

  armCampaign(campaignId: ForwardAlphaCampaignId): CampaignRunContext | CampaignOrchestratorFailure {
    const row = this.store.getContext(campaignId);
    if (!row) return { code: 'CAMPAIGN_NOT_FOUND', message: 'campaign not registered' };
    if (row.runState !== 'REGISTERED') {
      return { code: 'INVALID_STATE', message: `cannot arm from ${row.runState}` };
    }
    const next = Object.freeze({
      ...row,
      runState: 'WAITING_FOR_START' as const,
      updatedAt: this.now(),
    });
    this.store.putContext(next);
    return next;
  }

  startCampaign(campaignId: ForwardAlphaCampaignId): CampaignRunContext | CampaignOrchestratorFailure {
    const row = this.store.getContext(campaignId);
    if (!row) return { code: 'CAMPAIGN_NOT_FOUND', message: 'campaign not registered' };
    if (row.runState !== 'WAITING_FOR_START' && row.runState !== 'PAUSED') {
      return { code: 'INVALID_STATE', message: `cannot start from ${row.runState}` };
    }
    const now = this.now();
    const next = Object.freeze({
      ...row,
      runState: 'RUNNING' as const,
      startedAt: row.startedAt ?? now,
      updatedAt: now,
    });
    this.store.putContext(next);
    return next;
  }

  pauseCampaign(campaignId: ForwardAlphaCampaignId): CampaignRunContext | CampaignOrchestratorFailure {
    const row = this.store.getContext(campaignId);
    if (!row) return { code: 'CAMPAIGN_NOT_FOUND', message: 'campaign not registered' };
    if (row.runState !== 'RUNNING' && row.runState !== 'DEGRADED') {
      return { code: 'INVALID_STATE', message: `cannot pause from ${row.runState}` };
    }
    const next = Object.freeze({ ...row, runState: 'PAUSED' as const, updatedAt: this.now() });
    this.store.putContext(next);
    return next;
  }

  claimCampaign(input: {
    readonly campaignId: ForwardAlphaCampaignId;
    readonly ownerId: string;
    readonly leaseMs?: number;
  }): CampaignRunContext | CampaignOrchestratorFailure {
    const row = this.store.getContext(input.campaignId);
    if (!row) return { code: 'CAMPAIGN_NOT_FOUND', message: 'campaign not registered' };
    const acquired = acquireCampaignLease({
      context: row,
      ownerId: input.ownerId,
      now: this.now(),
      leaseMs: input.leaseMs ?? this.defaultLeaseMs,
    });
    if ('code' in acquired) return acquired;
    this.store.putContext(acquired);
    return acquired;
  }

  renewLease(input: {
    readonly campaignId: ForwardAlphaCampaignId;
    readonly ownerId: string;
    readonly leaseGeneration: number;
    readonly leaseMs?: number;
  }): CampaignRunContext | CampaignOrchestratorFailure {
    const row = this.store.getContext(input.campaignId);
    if (!row) return { code: 'CAMPAIGN_NOT_FOUND', message: 'campaign not registered' };
    const renewed = renewCampaignLease({
      context: row,
      ownerId: input.ownerId,
      leaseGeneration: input.leaseGeneration,
      now: this.now(),
      leaseMs: input.leaseMs ?? this.defaultLeaseMs,
    });
    if ('code' in renewed) return renewed;
    this.store.putContext(renewed);
    return renewed;
  }

  releaseLease(input: {
    readonly campaignId: ForwardAlphaCampaignId;
    readonly ownerId: string;
    readonly leaseGeneration: number;
  }): CampaignRunContext | CampaignOrchestratorFailure {
    const row = this.store.getContext(input.campaignId);
    if (!row) return { code: 'CAMPAIGN_NOT_FOUND', message: 'campaign not registered' };
    const released = releaseCampaignLease(row, input.ownerId, input.leaseGeneration);
    this.store.putContext(released);
    return released;
  }

  enqueueTrigger(input: {
    readonly campaignId: ForwardAlphaCampaignId;
    readonly triggerKind: CampaignTriggerKind;
    readonly notBefore?: UtcInstant;
    readonly boundaryKey?: string | null;
  }): CampaignWorkItem | CampaignOrchestratorFailure {
    const row = this.store.getContext(input.campaignId);
    if (!row) return { code: 'CAMPAIGN_NOT_FOUND', message: 'campaign not registered' };
    const now = this.now();
    const item: CampaignWorkItem = Object.freeze({
      workItemId: `fwork_${randomUUID().slice(0, 12)}`,
      campaignId: input.campaignId,
      kind: 'RUN_LOOP',
      triggerKind: input.triggerKind,
      enqueuedAt: now,
      notBefore: input.notBefore ?? now,
      boundaryKey: input.boundaryKey ?? null,
      outcomeScheduleId: null,
    });
    this.store.enqueueWork(item);
    return item;
  }

  /**
   * Process up to `limit` due work items — returns when queue is empty or limit reached (no spin).
   */
  drainDueWork(input: {
    readonly ownerId: string;
    readonly limit?: number;
  }): readonly Result<CampaignRuntimeTickResult, CampaignOrchestratorFailure>[] {
    const now = this.now();
    const limit = input.limit ?? 8;
    const due = this.store.dequeueDueWork(now, limit);
    const results: Result<CampaignRuntimeTickResult, CampaignOrchestratorFailure>[] = [];
    for (const work of due) {
      const context = this.store.getContext(work.campaignId);
      if (!context) {
        results.push(err({ code: 'CAMPAIGN_NOT_FOUND', message: 'campaign missing for work item' }));
        continue;
      }
      const leaseGen = context.lease?.leaseGeneration;
      if (!leaseGen || context.lease?.ownerId !== input.ownerId) {
        results.push(err({ code: 'LEASE_LOST', message: 'active lease required to process work' }));
        this.store.enqueueWork(work);
        continue;
      }
      const pass = runCampaignRuntimePass({
        context,
        workItem: work,
        now,
        ownerId: input.ownerId,
        leaseGeneration: leaseGen,
        ports: this.runtime,
        pendingWork: this.store.listPendingWork(work.campaignId),
        outcomeHorizonMs: this.outcomeHorizonMs,
      });
      if (pass.ok) {
        this.store.putContext(pass.value.runContext);
        if (pass.value.checkpoint) {
          this.store.putCheckpoint(pass.value.checkpoint);
        }
        for (const scheduled of pass.value.workItemsScheduled) {
          this.store.enqueueWork(scheduled);
        }
      }
      results.push(pass);
    }
    return Object.freeze(results);
  }

  recoverFromLatestCheckpoint(
    campaignId: ForwardAlphaCampaignId,
  ): CampaignRunContext | CampaignOrchestratorFailure {
    const checkpoint = this.store.latestCheckpoint(campaignId);
    if (!checkpoint) {
      return { code: 'CAMPAIGN_NOT_FOUND', message: 'no checkpoint to recover' };
    }
    const restored = restoreCampaignFromCheckpoint(checkpoint);
    this.store.putContext(restored.runContext);
    for (const item of restored.pendingWork) {
      this.store.enqueueWork(item);
    }
    return restored.runContext;
  }

  exportSnapshot(): CampaignOrchestratorSnapshot {
    return this.store.snapshot();
  }

  loadSnapshot(snapshot: CampaignOrchestratorSnapshot): void {
    this.store.loadSnapshot(snapshot);
  }
}
