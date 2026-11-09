import { randomUUID } from 'node:crypto';

import type { Clock } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';

import {
  checkpointFromChain,
  contentHash,
  duplicateDecisionIds,
  sealDecision,
  verifyEvidenceChain,
} from '../simulation/evidence-chain.ts';
import { DEFAULT_CAMPAIGN_LEASE_MS, SHADOW_LAB_RUNTIME_EVENT_DECISION_SEALED } from './taxonomy.ts';
import type { ShadowLabDurableStore } from './ports.ts';
import type {
  ShadowLabCampaignRegistration,
  ShadowLabRuntimeMetrics,
  ShadowLabStrategyVersionRecord,
} from './types.ts';
import { InMemoryShadowLabDurableStore } from './store.ts';

export type RegisterCampaignInput = {
  readonly campaignId: string;
  readonly strategyIds: readonly string[];
  readonly freezeHashes: Readonly<Record<string, string>>;
};

export type ProduceSealedDecisionInput = {
  readonly campaignId: string;
  readonly strategyId: string;
  readonly knowableAt: UtcInstant;
  readonly recordedAt: UtcInstant;
  readonly sequence: number;
  readonly previousHash: string;
  readonly action: string;
};

export class HeliosDurableShadowLabRuntimeService {
  private readonly clock: Clock;
  readonly durableStore: ShadowLabDurableStore;
  private readonly workerId: string;
  private shuttingDown = false;
  private leaseCollisions = 0;
  private persistenceFailures = 0;
  private decisionsSealed = 0;
  private outcomesMatured = 0;
  private shadowFills = 0;
  private demotions = 0;

  constructor(input: {
    readonly clock: Clock;
    readonly store?: ShadowLabDurableStore;
    readonly workerId?: string;
  }) {
    this.clock = input.clock;
    this.durableStore = input.store ?? new InMemoryShadowLabDurableStore();
    this.workerId = input.workerId ?? `shadow-lab-${randomUUID().slice(0, 8)}`;
  }

  now(): UtcInstant {
    return this.clock.now();
  }

  requestGracefulShutdown(): void {
    this.shuttingDown = true;
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  persistenceHealthy(): boolean {
    return this.durableStore.persistenceAvailable;
  }

  async registerCampaign(input: RegisterCampaignInput): Promise<'OK' | 'DUPLICATE' | 'PERSISTENCE_UNAVAILABLE'> {
    if (!this.durableStore.persistenceAvailable) {
      this.persistenceFailures += 1;
      return 'PERSISTENCE_UNAVAILABLE';
    }
    const now = this.now();
    const fingerprint = contentHash(
      [input.campaignId, ...input.strategyIds, JSON.stringify(input.freezeHashes)].join('|'),
    );
    const registration: ShadowLabCampaignRegistration = Object.freeze({
      campaignId: input.campaignId,
      fingerprint,
      strategyIds: Object.freeze([...input.strategyIds]),
      registeredAt: now,
      simulationOnly: true,
    });
    try {
      const reg = await this.durableStore.registerCampaign(registration);
      if (reg === 'DUPLICATE') {
        return 'DUPLICATE';
      }
      for (const strategyId of input.strategyIds) {
        const record: ShadowLabStrategyVersionRecord = Object.freeze({
          strategyVersionId: `svv_${input.campaignId}_${strategyId}_1`,
          campaignId: input.campaignId,
          strategyId,
          version: '1',
          freezeHash: input.freezeHashes[strategyId] ?? `freeze:${strategyId}`,
          registeredAt: now,
        });
        await this.durableStore.registerStrategyVersion(record);
      }
      return 'OK';
    } catch {
      this.persistenceFailures += 1;
      return 'PERSISTENCE_UNAVAILABLE';
    }
  }

  async acquireCampaignLease(campaignId: string): Promise<
    | { readonly ok: true; readonly fencingToken: number }
    | { readonly ok: false; readonly reason: 'HELD_BY_OTHER' | 'PERSISTENCE_UNAVAILABLE' | 'SHUTTING_DOWN' }
  > {
    if (this.shuttingDown) {
      return { ok: false, reason: 'SHUTTING_DOWN' };
    }
    const lease = await this.durableStore.tryAcquireLease({
      campaignId,
      workerId: this.workerId,
      now: this.now(),
      leaseMs: DEFAULT_CAMPAIGN_LEASE_MS,
    });
    if (lease === 'PERSISTENCE_UNAVAILABLE') {
      this.persistenceFailures += 1;
      return { ok: false, reason: 'PERSISTENCE_UNAVAILABLE' };
    }
    if (lease === 'HELD_BY_OTHER') {
      this.leaseCollisions += 1;
      return { ok: false, reason: 'HELD_BY_OTHER' };
    }
    return { ok: true, fencingToken: lease.fencingToken };
  }

  async sealDecision(input: ProduceSealedDecisionInput & { readonly fencingToken: number }): Promise<
    | { readonly ok: true; readonly decisionId: string; readonly contentHash: string }
    | { readonly ok: false; readonly reason: string }
  > {
    if (!this.durableStore.persistenceAvailable) {
      this.persistenceFailures += 1;
      return { ok: false, reason: 'PERSISTENCE_UNAVAILABLE' };
    }
    const decisionId = `sdec_${input.campaignId}_${input.strategyId}_${input.sequence}`;
    const sealed = sealDecision({
      decisionId,
      strategyId: input.strategyId,
      campaignId: input.campaignId,
      knowableAt: input.knowableAt,
      recordedAt: input.recordedAt,
      sequence: input.sequence,
      previousHash: input.previousHash,
      action: input.action,
    });
    const existing = await this.durableStore.listDecisions(input.campaignId);
    const chain = Object.freeze([...existing, sealed]);
    const checkpoint = checkpointFromChain(input.campaignId, chain, 1, input.recordedAt);
    const evidenceHash = contentHash(`${sealed.contentHash}|evidence`);
    const commit = await this.durableStore.commitSealedDecision({
      decision: sealed,
      evidenceHash,
      checkpoint,
      outboxEventId: `sevt_${decisionId}`,
      outboxKind: SHADOW_LAB_RUNTIME_EVENT_DECISION_SEALED,
      fencingToken: input.fencingToken,
      workerId: this.workerId,
    });
    if (!commit.ok) {
      if (commit.reason === 'PERSISTENCE_UNAVAILABLE') {
        this.persistenceFailures += 1;
      }
      return { ok: false, reason: commit.reason };
    }
    this.decisionsSealed += 1;
    return { ok: true, decisionId, contentHash: sealed.contentHash };
  }

  async executeShadowPaper(input: {
    readonly campaignId: string;
    readonly decisionId: string;
    readonly strategyId: string;
    readonly notionalMinor: bigint;
    readonly fencingToken: number;
  }): Promise<'OK' | 'LEASE_LOST' | 'PERSISTENCE_UNAVAILABLE' | 'DUPLICATE'> {
    if (!this.durableStore.persistenceAvailable) {
      this.persistenceFailures += 1;
      return 'PERSISTENCE_UNAVAILABLE';
    }
    const renew = await this.durableStore.renewLease({
      campaignId: input.campaignId,
      workerId: this.workerId,
      fencingToken: input.fencingToken,
      now: this.now(),
      leaseMs: DEFAULT_CAMPAIGN_LEASE_MS,
    });
    if (renew === 'LEASE_LOST') {
      return 'LEASE_LOST';
    }
    if (renew === 'PERSISTENCE_UNAVAILABLE') {
      this.persistenceFailures += 1;
      return 'PERSISTENCE_UNAVAILABLE';
    }
    const fillResult = await this.durableStore.recordShadowFill({
      fillId: `sfil_${input.decisionId}`,
      campaignId: input.campaignId,
      decisionId: input.decisionId,
      strategyId: input.strategyId,
      notionalMinor: input.notionalMinor,
      filledAt: this.now(),
      environment: 'SHADOW',
    });
    if (fillResult === 'OK') {
      this.shadowFills += 1;
    }
    return fillResult;
  }

  async processOutcomeMaturityQueue(fencingToken: number, campaignId: string): Promise<number> {
    if (!this.durableStore.persistenceAvailable) {
      this.persistenceFailures += 1;
      return 0;
    }
    const ready = await this.durableStore.listPendingOutcomesReady(this.now());
    let matured = 0;
    for (const pending of ready.filter((row) => row.campaignId === campaignId)) {
      const result = await this.durableStore.matureOutcome({
        campaignId,
        fencingToken,
        outcome: Object.freeze({
          outcomeId: pending.outcomeId.replace(/^sout_/, 'smat_'),
          decisionId: pending.decisionId,
          campaignId: pending.campaignId,
          maturedAt: this.now(),
        }),
      });
      if (result === 'OK') {
        matured += 1;
        this.outcomesMatured += 1;
      }
    }
    return matured;
  }

  async verifyCampaignEvidence(campaignId: string): Promise<{
    readonly chainIntact: boolean;
    readonly duplicateIds: readonly string[];
    readonly missingEvidence: readonly string[];
  }> {
    const decisions = await this.durableStore.listDecisions(campaignId);
    const missingEvidence: string[] = [];
    for (const decision of decisions) {
      const hash = await this.durableStore.getEvidenceHash(decision.decisionId);
      if (!hash) {
        missingEvidence.push(decision.decisionId);
      }
    }
    return Object.freeze({
      chainIntact: verifyEvidenceChain(decisions),
      duplicateIds: duplicateDecisionIds(decisions),
      missingEvidence: Object.freeze(missingEvidence),
    });
  }

  collectMetrics(): ShadowLabRuntimeMetrics {
    return Object.freeze({
      decisionsSealed: this.decisionsSealed,
      outcomesMatured: this.outcomesMatured,
      shadowFills: this.shadowFills,
      demotions: this.demotions,
      leaseCollisions: this.leaseCollisions,
      persistenceFailures: this.persistenceFailures,
    });
  }
}
