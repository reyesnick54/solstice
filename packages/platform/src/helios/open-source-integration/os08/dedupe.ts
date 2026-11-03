import type { UtcInstant } from '@solstice/domain';
import type { ResearchTriggerRunId } from './ids.ts';
import type { ResearchTriggerBudgetLimits } from './types.ts';
import type { TriggerRouterReasonCode } from './taxonomy.ts';

type IdempotencyRecord = {
  readonly runId: ResearchTriggerRunId;
  readonly recordedAt: UtcInstant;
};

type DedupeRecord = {
  readonly fingerprint: string;
  readonly runId: ResearchTriggerRunId;
  readonly expiresAtMs: number;
};

type CooldownRecord = {
  readonly expiresAtMs: number;
};

export class ResearchTriggerDedupe {
  private readonly limits: ResearchTriggerBudgetLimits;
  private readonly idempotency = new Map<string, IdempotencyRecord>();
  private readonly dedupe = new Map<string, DedupeRecord>();
  private readonly cooldowns = new Map<string, CooldownRecord>();

  constructor(limits: ResearchTriggerBudgetLimits) {
    this.limits = limits;
  }

  checkIdempotency(idempotencyKey: string): IdempotencyRecord | null {
    return this.idempotency.get(idempotencyKey) ?? null;
  }

  recordIdempotency(idempotencyKey: string, runId: ResearchTriggerRunId, now: UtcInstant): void {
    this.idempotency.set(idempotencyKey, Object.freeze({ runId, recordedAt: now }));
  }

  checkDedupe(fingerprint: string, nowMs: number): { readonly blocked: true; readonly reason: TriggerRouterReasonCode } | { readonly blocked: false } {
    this.pruneDedupe(nowMs);
    const existing = this.dedupe.get(fingerprint);
    if (existing && existing.expiresAtMs > nowMs) {
      return { blocked: true, reason: 'DEDUPE_WINDOW' };
    }
    return { blocked: false };
  }

  recordDedupe(fingerprint: string, runId: ResearchTriggerRunId, nowMs: number): void {
    this.dedupe.set(fingerprint, {
      fingerprint,
      runId,
      expiresAtMs: nowMs + this.limits.dedupeWindowSeconds * 1000,
    });
  }

  checkCooldown(cooldownKey: string, nowMs: number): { readonly blocked: true; readonly reason: TriggerRouterReasonCode } | { readonly blocked: false } {
    const row = this.cooldowns.get(cooldownKey);
    if (row && row.expiresAtMs > nowMs) {
      return { blocked: true, reason: 'COOLDOWN_ACTIVE' };
    }
    return { blocked: false };
  }

  recordCooldown(cooldownKey: string, cooldownSeconds: number, nowMs: number): void {
    const seconds = cooldownSeconds > 0 ? cooldownSeconds : this.limits.defaultCooldownSeconds;
    this.cooldowns.set(cooldownKey, { expiresAtMs: nowMs + seconds * 1000 });
  }

  private pruneDedupe(nowMs: number): void {
    for (const [key, row] of this.dedupe) {
      if (row.expiresAtMs <= nowMs) {
        this.dedupe.delete(key);
      }
    }
  }

  snapshot(): ResearchTriggerDedupeSnapshot {
    return Object.freeze({
      idempotency: Object.freeze(
        [...this.idempotency.entries()].map(([key, row]) =>
          Object.freeze({ key, runId: row.runId, recordedAt: row.recordedAt }),
        ),
      ),
      dedupe: Object.freeze(
        [...this.dedupe.values()].map((row) =>
          Object.freeze({
            fingerprint: row.fingerprint,
            runId: row.runId,
            expiresAtMs: row.expiresAtMs,
          }),
        ),
      ),
      cooldowns: Object.freeze(
        [...this.cooldowns.entries()].map(([key, row]) =>
          Object.freeze({ key, expiresAtMs: row.expiresAtMs }),
        ),
      ),
    });
  }

  restore(snapshot: ResearchTriggerDedupeSnapshot): void {
    this.idempotency.clear();
    this.dedupe.clear();
    this.cooldowns.clear();
    for (const row of snapshot.idempotency) {
      this.idempotency.set(row.key, Object.freeze({ runId: row.runId, recordedAt: row.recordedAt }));
    }
    for (const row of snapshot.dedupe) {
      this.dedupe.set(row.fingerprint, {
        fingerprint: row.fingerprint,
        runId: row.runId,
        expiresAtMs: row.expiresAtMs,
      });
    }
    for (const row of snapshot.cooldowns) {
      this.cooldowns.set(row.key, { expiresAtMs: row.expiresAtMs });
    }
  }
}

export type ResearchTriggerDedupeSnapshot = {
  readonly idempotency: readonly {
    readonly key: string;
    readonly runId: ResearchTriggerRunId;
    readonly recordedAt: UtcInstant;
  }[];
  readonly dedupe: readonly {
    readonly fingerprint: string;
    readonly runId: ResearchTriggerRunId;
    readonly expiresAtMs: number;
  }[];
  readonly cooldowns: readonly { readonly key: string; readonly expiresAtMs: number }[];
};
