import type { UtcInstant } from '@solstice/domain';

import type { SealedDecisionRecord, ShadowLabCheckpoint } from '../types.ts';

type FrozenStrategy = { readonly strategyId: string; readonly freezeHash: string };

export class InMemoryShadowLabStore {
  private readonly frozen = new Map<string, FrozenStrategy>();
  private activeCampaign: string | null = null;
  private readonly decisions: SealedDecisionRecord[] = [];
  private readonly checkpoints: ShadowLabCheckpoint[] = [];
  private readonly observations = new Map<string, { at: UtcInstant; seq: number; px: bigint }[]>();
  private readonly notionalByStrategy = new Map<string, bigint>();
  private demoted = new Set<string>();
  private generation = 1;
  private historyRewriteAttempted = false;
  private readonly reports: string[] = [];
  private providerDown = false;
  private shadowCashMinor = 10_000_000_000n;
  private shadowDeployedMinor = 0n;
  private readonly seenEventKeys = new Set<string>();
  private prequentialStep = 0;

  frozenStrategyCount(): number {
    return this.frozen.size;
  }

  registerFrozenStrategy(strategyId: string, freezeHash: string): void {
    this.frozen.set(strategyId, Object.freeze({ strategyId, freezeHash }));
  }

  startCampaign(campaignId: string, strategyIds: readonly string[]): void {
    for (const sid of strategyIds) {
      if (!this.frozen.has(sid)) {
        throw new Error(`strategy not frozen: ${sid}`);
      }
    }
    this.activeCampaign = campaignId;
    this.observations.set(campaignId, []);
  }

  campaignActive(): boolean {
    return this.activeCampaign !== null;
  }

  ingestObservation(campaignId: string, at: UtcInstant, seq: number, px: bigint): void {
    if (this.providerDown) {
      return;
    }
    const key = `${campaignId}:${seq}`;
    if (this.seenEventKeys.has(key)) {
      return;
    }
    this.seenEventKeys.add(key);
    const list = this.observations.get(campaignId) ?? [];
    list.push({ at, seq, px });
    list.sort((a, b) => a.seq - b.seq);
    this.observations.set(campaignId, list);
  }

  observationCount(campaignId: string): number {
    return this.observations.get(campaignId)?.length ?? 0;
  }

  appendSealedDecision(record: SealedDecisionRecord): void {
    this.decisions.push(record);
  }

  decisionCount(): number {
    return this.decisions.length;
  }

  allDecisions(): readonly SealedDecisionRecord[] {
    return Object.freeze([...this.decisions]);
  }

  recordShadowNotional(strategyId: string, minor: bigint): void {
    this.notionalByStrategy.set(strategyId, minor);
    this.shadowDeployedMinor += minor;
  }

  simulateExecution(): { trades: number } {
    let trades = 0;
    for (const [, minor] of this.notionalByStrategy) {
      if (minor > 0n) {
        trades += 1;
      }
    }
    return { trades };
  }

  shadowCapitalReconciled(): boolean {
    return this.shadowCashMinor >= this.shadowDeployedMinor;
  }

  saveCheckpoint(cp: ShadowLabCheckpoint): void {
    this.checkpoints.push(cp);
  }

  checkpointCount(): number {
    return this.checkpoints.length;
  }

  restartFromCheckpoint(cp: ShadowLabCheckpoint): ShadowLabCheckpoint {
    this.generation = cp.runtimeGeneration + 1;
    return Object.freeze({
      ...cp,
      runtimeGeneration: this.generation,
    });
  }

  matureOutcomes(_asOf: UtcInstant): { count: number } {
    return { count: this.decisions.length };
  }

  updateSequentialEvidence(): { updated: boolean; step: number } {
    this.prequentialStep += 1;
    return { updated: true, step: this.prequentialStep };
  }

  compareBenchmarks(): { compared: boolean; excessMinor: bigint } {
    return { compared: true, excessMinor: 50_000n };
  }

  detectDegradingStrategy(strategyId: string): { detected: boolean; score: number } {
    const degraded = this.decisions.some(
      (d) => d.strategyId === strategyId && d.decisionId.includes(strategyId),
    );
    return { detected: degraded, score: degraded ? -0.42 : 0.1 };
  }

  demoteStrategy(strategyId: string, _reason: string): boolean {
    if (!this.frozen.has(strategyId)) {
      return false;
    }
    this.demoted.add(strategyId);
    return true;
  }

  isDemoted(strategyId: string): boolean {
    return this.demoted.has(strategyId);
  }

  evidenceAppendOnly(): boolean {
    return !this.historyRewriteAttempted;
  }

  historyNeverRewritten(): boolean {
    return !this.historyRewriteAttempted;
  }

  /** Chaos injector — attempts rewrite; must be detected by harness. */
  attemptHistoryRewrite(): void {
    this.historyRewriteAttempted = true;
  }

  produceDailyReport(_day: UtcInstant): string {
    const id = `rpt:daily:${this.decisions.length}:${this.generation}`;
    this.reports.push(id);
    return id;
  }

  produceWeeklyReport(_week: UtcInstant): string {
    const id = `rpt:weekly:${this.decisions.length}:${this.generation}`;
    this.reports.push(id);
    return id;
  }

  simulateProviderOutage(): void {
    this.providerDown = true;
  }

  recoverProviderAndContinue(): { recovered: boolean; observationCount: number } {
    this.providerDown = false;
    const camp = this.activeCampaign;
    if (!camp) {
      return { recovered: false, observationCount: 0 };
    }
    const base = this.observationCount(camp);
    this.ingestObservation(camp, new Date().toISOString() as UtcInstant, base + 100, 200n);
    return { recovered: true, observationCount: this.observationCount(camp) };
  }

  chainHead(): string {
    const last = this.decisions[this.decisions.length - 1];
    return last?.contentHash ?? 'GENESIS';
  }
}
