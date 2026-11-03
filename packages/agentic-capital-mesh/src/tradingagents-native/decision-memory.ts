/**
 * Decision memory and research history (native port of TradingAgents memory/log.py semantics).
 */

import type { UtcInstant } from '../imports.ts';

export type DecisionMemoryEntry = {
  readonly entryId: string;
  readonly ticker: string;
  readonly tradeDate: string;
  readonly decisionText: string;
  readonly rating: string | null;
  readonly pending: boolean;
  readonly resolvedOn: string | null;
  readonly reflection: string | null;
  readonly recordedAt: UtcInstant;
};

export class TradingAgentsDecisionMemoryStore {
  private readonly entries: DecisionMemoryEntry[] = [];

  storeDecision(input: {
    readonly entryId: string;
    readonly ticker: string;
    readonly tradeDate: string;
    readonly decisionText: string;
    readonly rating?: string | null;
    readonly recordedAt: UtcInstant;
  }): boolean {
    const exists = this.entries.some((e) => e.tradeDate === input.tradeDate && e.ticker === input.ticker);
    if (exists) return false;
    this.entries.push(
      Object.freeze({
        entryId: input.entryId,
        ticker: input.ticker,
        tradeDate: input.tradeDate,
        decisionText: input.decisionText,
        rating: input.rating ?? null,
        pending: true,
        resolvedOn: null,
        reflection: null,
        recordedAt: input.recordedAt,
      }),
    );
    return true;
  }

  settleDecision(input: {
    readonly ticker: string;
    readonly tradeDate: string;
    readonly resolvedOn: string;
    readonly reflection: string;
  }): boolean {
    const idx = this.entries.findIndex(
      (e) => e.ticker === input.ticker && e.tradeDate === input.tradeDate && e.pending,
    );
    if (idx < 0) return false;
    const prev = this.entries[idx]!;
    this.entries[idx] = Object.freeze({
      ...prev,
      pending: false,
      resolvedOn: input.resolvedOn,
      reflection: input.reflection,
    });
    return true;
  }

  entriesSnapshot(): readonly DecisionMemoryEntry[] {
    return Object.freeze([...this.entries]);
  }

  pastContextForBacktest(input: {
    readonly ticker: string;
    readonly asOfTradeDate: string;
    readonly nSame?: number;
    readonly nCross?: number;
  }): string {
    const nSame = input.nSame ?? 5;
    const nCross = input.nCross ?? 3;
    const settled = this.entries.filter(
      (e) => !e.pending && e.resolvedOn != null && e.resolvedOn <= input.asOfTradeDate,
    );
    if (settled.length === 0) return '';

    const same: DecisionMemoryEntry[] = [];
    const cross: DecisionMemoryEntry[] = [];
    const ordered = [...settled].sort(
      (a, b) => b.tradeDate.localeCompare(a.tradeDate) || b.recordedAt.localeCompare(a.recordedAt),
    );
    for (const entry of ordered) {
      if (same.length >= nSame && cross.length >= nCross) break;
      if (entry.ticker === input.ticker && same.length < nSame) same.push(entry);
      else if (entry.ticker !== input.ticker && cross.length < nCross) cross.push(entry);
    }

    const parts: string[] = [];
    if (same.length > 0) {
      parts.push(`Past analyses of ${input.ticker} (most recent first):`);
      for (const e of same) {
        parts.push(`[${e.tradeDate}] ${e.reflection ?? e.decisionText}`);
      }
    }
    if (cross.length > 0) {
      parts.push('Recent cross-ticker lessons:');
      for (const e of cross) {
        parts.push(`[${e.ticker} ${e.tradeDate}] ${e.reflection ?? ''}`);
      }
    }
    return parts.join('\n\n');
  }
}
