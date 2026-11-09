import type { UtcInstant } from '@solstice/domain';

import type { SealedDecisionRecord, ShadowLabCheckpoint } from '../types.ts';
import { DEFAULT_CAMPAIGN_LEASE_MS } from './taxonomy.ts';
import type { ShadowLabDurableStore } from './ports.ts';
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

function addMs(at: UtcInstant, ms: number): UtcInstant {
  return new Date(Date.parse(at) + ms).toISOString() as UtcInstant;
}

export class InMemoryShadowLabDurableStore implements ShadowLabDurableStore {
  readonly persistenceAvailable: boolean;

  private readonly campaigns = new Map<string, ShadowLabCampaignRegistration>();
  private readonly strategyVersions = new Map<string, ShadowLabStrategyVersionRecord>();
  private readonly leases = new Map<string, ShadowLabCampaignLease>();
  private readonly decisions = new Map<string, SealedDecisionRecord>();
  private readonly evidenceByDecision = new Map<string, string>();
  private readonly evidenceHashes = new Set<string>();
  private readonly checkpoints = new Map<string, ShadowLabCheckpoint>();
  private readonly fills = new Map<string, ShadowLabShadowFill>();
  private readonly pendingOutcomes = new Map<string, ShadowLabPendingOutcome>();
  private readonly maturedOutcomes = new Map<string, ShadowLabMaturedOutcome>();
  private readonly demotions: { demotionId: string; campaignId: string; strategyId: string; reason: string; at: UtcInstant }[] = [];
  private readonly outbox: { eventId: string; campaignId: string; kind: string }[] = [];
  private simulateUnavailable = false;

  constructor(input?: { readonly persistenceAvailable?: boolean }) {
    this.persistenceAvailable = input?.persistenceAvailable ?? true;
  }

  setPersistenceUnavailable(unavailable: boolean): void {
    this.simulateUnavailable = unavailable;
  }

  private checkAvailable(): boolean {
    return this.persistenceAvailable && !this.simulateUnavailable;
  }

  async registerCampaign(registration: ShadowLabCampaignRegistration): Promise<'OK' | 'DUPLICATE'> {
    if (!this.checkAvailable()) {
      throw new Error('PERSISTENCE_UNAVAILABLE');
    }
    if (this.campaigns.has(registration.campaignId)) {
      return 'DUPLICATE';
    }
    this.campaigns.set(registration.campaignId, registration);
    return 'OK';
  }

  async registerStrategyVersion(record: ShadowLabStrategyVersionRecord): Promise<'OK' | 'DUPLICATE'> {
    if (!this.checkAvailable()) {
      throw new Error('PERSISTENCE_UNAVAILABLE');
    }
    if (this.strategyVersions.has(record.strategyVersionId)) {
      return 'DUPLICATE';
    }
    this.strategyVersions.set(record.strategyVersionId, record);
    return 'OK';
  }

  async tryAcquireLease(input: {
    readonly campaignId: string;
    readonly workerId: string;
    readonly now: UtcInstant;
    readonly leaseMs: number;
  }): Promise<ShadowLabCampaignLease | 'HELD_BY_OTHER' | 'PERSISTENCE_UNAVAILABLE'> {
    if (!this.checkAvailable()) {
      return 'PERSISTENCE_UNAVAILABLE';
    }
    const existing = this.leases.get(input.campaignId);
    const leaseMs = input.leaseMs || DEFAULT_CAMPAIGN_LEASE_MS;
    if (existing && Date.parse(existing.expiresAt) > Date.parse(input.now) && existing.workerId !== input.workerId) {
      return 'HELD_BY_OTHER';
    }
    const fencingToken = (existing?.fencingToken ?? 0) + 1;
    const lease: ShadowLabCampaignLease = Object.freeze({
      campaignId: input.campaignId,
      workerId: input.workerId,
      fencingToken,
      acquiredAt: input.now,
      expiresAt: addMs(input.now, leaseMs),
    });
    this.leases.set(input.campaignId, lease);
    return lease;
  }

  async renewLease(input: {
    readonly campaignId: string;
    readonly workerId: string;
    readonly fencingToken: number;
    readonly now: UtcInstant;
    readonly leaseMs: number;
  }): Promise<'OK' | 'LEASE_LOST' | 'PERSISTENCE_UNAVAILABLE'> {
    if (!this.checkAvailable()) {
      return 'PERSISTENCE_UNAVAILABLE';
    }
    const existing = this.leases.get(input.campaignId);
    if (!existing || existing.workerId !== input.workerId || existing.fencingToken !== input.fencingToken) {
      return 'LEASE_LOST';
    }
    this.leases.set(
      input.campaignId,
      Object.freeze({
        ...existing,
        expiresAt: addMs(input.now, input.leaseMs || DEFAULT_CAMPAIGN_LEASE_MS),
      }),
    );
    return 'OK';
  }

  async releaseLease(input: {
    readonly campaignId: string;
    readonly workerId: string;
    readonly fencingToken: number;
  }): Promise<void> {
    const existing = this.leases.get(input.campaignId);
    if (existing?.workerId === input.workerId && existing.fencingToken === input.fencingToken) {
      this.leases.delete(input.campaignId);
    }
  }

  async commitSealedDecision(input: ShadowLabDecisionCommitInput): Promise<ShadowLabDecisionCommitResult> {
    if (!this.checkAvailable()) {
      return { ok: false, reason: 'PERSISTENCE_UNAVAILABLE' };
    }
    const lease = this.leases.get(input.decision.campaignId);
    if (!lease || lease.fencingToken !== input.fencingToken || lease.workerId !== input.workerId) {
      return { ok: false, reason: 'LEASE_LOST' };
    }
    if (this.decisions.has(input.decision.decisionId)) {
      return { ok: false, reason: 'DUPLICATE_DECISION' };
    }
    if (this.evidenceHashes.has(input.evidenceHash)) {
      return { ok: false, reason: 'DUPLICATE_EVIDENCE' };
    }
    this.decisions.set(input.decision.decisionId, input.decision);
    this.evidenceByDecision.set(input.decision.decisionId, input.evidenceHash);
    this.evidenceHashes.add(input.evidenceHash);
    this.checkpoints.set(input.decision.campaignId, input.checkpoint);
    this.outbox.push({
      eventId: input.outboxEventId,
      campaignId: input.decision.campaignId,
      kind: input.outboxKind,
    });
    return { ok: true };
  }

  async listDecisions(campaignId: string): Promise<readonly SealedDecisionRecord[]> {
    return Object.freeze(
      [...this.decisions.values()].filter((row) => row.campaignId === campaignId),
    );
  }

  async getEvidenceHash(decisionId: string): Promise<string | undefined> {
    return this.evidenceByDecision.get(decisionId);
  }

  async getCheckpoint(campaignId: string): Promise<ShadowLabCheckpoint | undefined> {
    return this.checkpoints.get(campaignId);
  }

  async recordShadowFill(fill: ShadowLabShadowFill): Promise<'OK' | 'DUPLICATE' | 'PERSISTENCE_UNAVAILABLE'> {
    if (!this.checkAvailable()) {
      return 'PERSISTENCE_UNAVAILABLE';
    }
    if (this.fills.has(fill.fillId)) {
      return 'DUPLICATE';
    }
    this.fills.set(fill.fillId, fill);
    return 'OK';
  }

  async enqueuePendingOutcome(outcome: ShadowLabPendingOutcome): Promise<'OK' | 'DUPLICATE' | 'PERSISTENCE_UNAVAILABLE'> {
    if (!this.checkAvailable()) {
      return 'PERSISTENCE_UNAVAILABLE';
    }
    if (this.pendingOutcomes.has(outcome.outcomeId) || this.maturedOutcomes.has(outcome.outcomeId)) {
      return 'DUPLICATE';
    }
    this.pendingOutcomes.set(outcome.outcomeId, outcome);
    return 'OK';
  }

  async matureOutcome(input: {
    readonly outcome: ShadowLabMaturedOutcome;
    readonly fencingToken: number;
    readonly campaignId: string;
  }): Promise<'OK' | 'LEASE_LOST' | 'DUPLICATE' | 'PERSISTENCE_UNAVAILABLE'> {
    if (!this.checkAvailable()) {
      return 'PERSISTENCE_UNAVAILABLE';
    }
    const lease = this.leases.get(input.campaignId);
    if (!lease || lease.fencingToken !== input.fencingToken) {
      return 'LEASE_LOST';
    }
    if (this.maturedOutcomes.has(input.outcome.outcomeId)) {
      return 'DUPLICATE';
    }
    this.pendingOutcomes.delete(input.outcome.outcomeId);
    this.maturedOutcomes.set(input.outcome.outcomeId, input.outcome);
    return 'OK';
  }

  async listPendingOutcomesReady(now: UtcInstant): Promise<readonly ShadowLabPendingOutcome[]> {
    return Object.freeze(
      [...this.pendingOutcomes.values()].filter((row) => Date.parse(row.maturesAt) <= Date.parse(now)),
    );
  }

  async recordDemotion(input: {
    readonly demotionId: string;
    readonly campaignId: string;
    readonly strategyId: string;
    readonly reason: string;
    readonly at: UtcInstant;
    readonly fencingToken: number;
  }): Promise<'OK' | 'LEASE_LOST' | 'PERSISTENCE_UNAVAILABLE'> {
    if (!this.checkAvailable()) {
      return 'PERSISTENCE_UNAVAILABLE';
    }
    const lease = this.leases.get(input.campaignId);
    if (!lease || lease.fencingToken !== input.fencingToken) {
      return 'LEASE_LOST';
    }
    this.demotions.push({
      demotionId: input.demotionId,
      campaignId: input.campaignId,
      strategyId: input.strategyId,
      reason: input.reason,
      at: input.at,
    });
    return 'OK';
  }

  /** Test introspection */
  outboxCount(): number {
    return this.outbox.length;
  }

  demotionCount(): number {
    return this.demotions.length;
  }

  fillCount(): number {
    return this.fills.size;
  }
}
