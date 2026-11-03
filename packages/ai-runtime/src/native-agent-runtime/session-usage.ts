import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AiUsageRecord } from '../usage.ts';

export type SessionUsageAggregate = {
  readonly sessionId: string;
  readonly inferenceCalls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostMicros: bigint;
  readonly lastRecordedAt: UtcInstant | null;
};

export class SessionUsageLedger {
  private readonly rows = new Map<string, SessionUsageAggregate>();

  record(sessionId: string, usage: AiUsageRecord): SessionUsageAggregate {
    const prior = this.rows.get(sessionId);
    const cost = BigInt(usage.estimatedCostMicros);
    const next: SessionUsageAggregate = Object.freeze({
      sessionId,
      inferenceCalls: (prior?.inferenceCalls ?? 0) + 1,
      inputTokens: (prior?.inputTokens ?? 0) + usage.inputTokens,
      outputTokens: (prior?.outputTokens ?? 0) + usage.outputTokens,
      estimatedCostMicros: (prior?.estimatedCostMicros ?? 0n) + cost,
      lastRecordedAt: usage.recordedAt,
    });
    this.rows.set(sessionId, next);
    return next;
  }

  snapshot(sessionId: string): SessionUsageAggregate | null {
    return this.rows.get(sessionId) ?? null;
  }
}
