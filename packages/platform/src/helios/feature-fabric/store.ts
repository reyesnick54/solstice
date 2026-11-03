/**
 * Append-only store for fundamental facts (no restatement overwrite).
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { FundamentalFactRecord } from './types.ts';

export type FundamentalObservationStore = {
  appendFacts(facts: readonly FundamentalFactRecord[]): void;
  allFacts(): readonly FundamentalFactRecord[];
  factsForEntity(entityId: string): readonly FundamentalFactRecord[];
  knowableFactsAt(entityId: string, evaluationTimeUtc: UtcInstant): readonly FundamentalFactRecord[];
  filingIdsForEntity(entityId: string): readonly string[];
};

export function filterKnowableFacts<T extends { readonly knowableAt: UtcInstant }>(
  rows: readonly T[],
  evaluationTimeUtc: UtcInstant,
): readonly T[] {
  const evalMs = Date.parse(evaluationTimeUtc);
  if (!Number.isFinite(evalMs)) {
    return Object.freeze([]);
  }
  return Object.freeze(
    rows.filter((row) => {
      const knowMs = Date.parse(row.knowableAt);
      return Number.isFinite(knowMs) && knowMs <= evalMs;
    }),
  );
}

export function createFundamentalObservationStore(): FundamentalObservationStore {
  const facts: FundamentalFactRecord[] = [];

  return {
    appendFacts(batch) {
      facts.push(...batch);
    },
    allFacts() {
      return Object.freeze([...facts]);
    },
    factsForEntity(entityId) {
      return Object.freeze(facts.filter((f) => f.canonicalEntityId === entityId));
    },
    knowableFactsAt(entityId, evaluationTimeUtc) {
      return filterKnowableFacts(
        facts.filter((f) => f.canonicalEntityId === entityId),
        evaluationTimeUtc,
      );
    },
    filingIdsForEntity(entityId) {
      const ids = new Set(facts.filter((f) => f.canonicalEntityId === entityId).map((f) => f.filingId));
      return Object.freeze([...ids]);
    },
  };
}

/** Select effective fact per concept+periodEnd at evaluation time (latest knowable filing wins). */
export function effectiveFactsAt(
  facts: readonly FundamentalFactRecord[],
  evaluationTimeUtc: UtcInstant,
): readonly FundamentalFactRecord[] {
  const knowable = filterKnowableFacts(facts, evaluationTimeUtc);
  const byKey = new Map<string, FundamentalFactRecord>();
  for (const fact of knowable) {
    const key = `${fact.concept}:${fact.periodEnd}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, fact);
      continue;
    }
    const existingMs = Date.parse(existing.knowableAt);
    const factMs = Date.parse(fact.knowableAt);
    if (factMs >= existingMs) {
      byKey.set(key, fact);
    }
  }
  return Object.freeze([...byKey.values()]);
}
