import type { UtcInstant } from '../../../domain/src/time.ts';
import { addMs } from '../../../config/src/clock.ts';

export type VelocityMetric =
  | 'TRANSFERS'
  | 'TRANSFER_AMOUNT'
  | 'NEW_BENEFICIARIES'
  | 'FAILED_AUTH'
  | 'HIGH_RISK_ACTIONS';

export type VelocitySnapshot = {
  readonly counterKey: string;
  readonly windowMs: number;
  readonly count: number;
  readonly amountMinor: string;
  readonly windowStartedAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type VelocityIncrement = {
  readonly subjectRef: string;
  readonly metric: VelocityMetric;
  readonly windowMs: number;
  readonly now: UtcInstant;
  readonly amountMinor?: bigint;
};

function keyOf(subjectRef: string, metric: VelocityMetric, windowMs: number): string {
  return `${subjectRef}:${metric}:${String(windowMs)}`;
}

/**
 * Rolling-window counters. Integer money only. Safe for single-process
 * increment; durable adapters persist the snapshot under a unique key.
 */
export class VelocityEngine {
  private readonly counters: Map<string, VelocitySnapshot>;

  constructor(counters: Map<string, VelocitySnapshot>) {
    this.counters = counters;
  }

  increment(input: VelocityIncrement): VelocitySnapshot {
    const counterKey = keyOf(input.subjectRef, input.metric, input.windowMs);
    const current = this.counters.get(counterKey);
    const amount = input.amountMinor ?? 0n;
    if (!current || input.now >= addMs(current.windowStartedAt, input.windowMs)) {
      const next: VelocitySnapshot = Object.freeze({
        counterKey,
        windowMs: input.windowMs,
        count: 1,
        amountMinor: amount.toString(),
        windowStartedAt: input.now,
        updatedAt: input.now,
      });
      this.counters.set(counterKey, next);
      return next;
    }
    const next: VelocitySnapshot = Object.freeze({
      ...current,
      count: current.count + 1,
      amountMinor: (BigInt(current.amountMinor) + amount).toString(),
      updatedAt: input.now,
    });
    this.counters.set(counterKey, next);
    return next;
  }

  read(subjectRef: string, metric: VelocityMetric, windowMs: number): VelocitySnapshot | undefined {
    return this.counters.get(keyOf(subjectRef, metric, windowMs));
  }

  triggered(
    subjectRef: string,
    metric: VelocityMetric,
    windowMs: number,
    maxCount: number,
    maxAmountMinor?: bigint,
  ): boolean {
    const row = this.read(subjectRef, metric, windowMs);
    if (!row) {
      return false;
    }
    if (row.count > maxCount) {
      return true;
    }
    if (maxAmountMinor !== undefined && BigInt(row.amountMinor) > maxAmountMinor) {
      return true;
    }
    return false;
  }
}
