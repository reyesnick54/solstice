/**
 * Policy-configurable anti-gaming caps for HIN economic value inputs.
 */

import type { HinProductCategory } from './categories.ts';
import type { HinMethodologyCaps } from './methodologies.ts';
import type { HinAnomalyFlag, HinContributionRecord, HinEconomicValueInput } from './types.ts';

export type HinCapWindow = {
  readonly subject: string;
  readonly category: HinProductCategory;
  readonly periodKey: string;
  readonly eventCount: number;
  readonly categoryTotal: bigint;
  readonly subjectTotal: bigint;
};

export class HinCapLedger {
  readonly caps: HinMethodologyCaps;
  private readonly bySubjectPeriod = new Map<string, bigint>();
  private readonly byCategoryPeriod = new Map<string, bigint>();
  private readonly eventCounts = new Map<string, number>();

  constructor(caps: HinMethodologyCaps) {
    this.caps = caps;
  }

  periodKey(observedAt: string): string {
    return observedAt.slice(0, 10);
  }

  apply(record: HinContributionRecord, value: HinEconomicValueInput): { readonly ok: true } | { readonly ok: false; readonly code: 'CAP_EXCEEDED' } {
    if (value.normalizedValue > this.caps.perEvent) {
      return { ok: false, code: 'CAP_EXCEEDED' };
    }
    const day = this.periodKey(record.observedAt);
    const subjectKey = `${record.subject}:${day}`;
    const categoryKey = `${record.subject}:${record.category}:${day}`;
    const subjectTotal = (this.bySubjectPeriod.get(subjectKey) ?? 0n) + value.normalizedValue;
    const categoryTotal = (this.byCategoryPeriod.get(categoryKey) ?? 0n) + value.normalizedValue;
    if (subjectTotal > this.caps.perSubjectPeriod || categoryTotal > this.caps.perCategoryPeriod) {
      return { ok: false, code: 'CAP_EXCEEDED' };
    }
    this.bySubjectPeriod.set(subjectKey, subjectTotal);
    this.byCategoryPeriod.set(categoryKey, categoryTotal);
    this.eventCounts.set(categoryKey, (this.eventCounts.get(categoryKey) ?? 0) + 1);
    return { ok: true };
  }

  snapshot(record: HinContributionRecord): HinCapWindow {
    const day = this.periodKey(record.observedAt);
    const subjectKey = `${record.subject}:${day}`;
    const categoryKey = `${record.subject}:${record.category}:${day}`;
    return Object.freeze({
      subject: record.subject,
      category: record.category,
      periodKey: day,
      eventCount: this.eventCounts.get(categoryKey) ?? 0,
      categoryTotal: this.byCategoryPeriod.get(categoryKey) ?? 0n,
      subjectTotal: this.bySubjectPeriod.get(subjectKey) ?? 0n,
    });
  }
}

export function detectQuantitySpike(input: {
  readonly contributionId: HinContributionRecord['contributionId'];
  readonly quantity: bigint;
  readonly typicalQuantity: bigint;
}): HinAnomalyFlag | null {
  if (input.typicalQuantity > 0n && input.quantity > input.typicalQuantity * 20n) {
    return Object.freeze({
      flagId: `anom_${input.contributionId}_spike`,
      contributionId: input.contributionId,
      code: 'QUANTITY_SPIKE',
      raisedBy: 'SYSTEM',
      determinesMint: false,
    });
  }
  return null;
}
