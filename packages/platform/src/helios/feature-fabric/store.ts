/**
 * Append-only store for SEC fundamental observations (no restatement overwrite).
 */

import type { SecFundamentalObservation, FinancialFactObservation } from '../../../../external-data/src/sec-fundamentals/types.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { filterKnowableObservations } from '../../../../external-data/src/sec-fundamentals/edgar-dataflow.ts';

export type FundamentalObservationStore = {
  append(observations: readonly SecFundamentalObservation[]): void;
  all(): readonly SecFundamentalObservation[];
  factsForEntity(entityId: string): readonly FinancialFactObservation[];
  knowableFactsAt(entityId: string, evaluationTimeUtc: UtcInstant): readonly FinancialFactObservation[];
  filingIdsForEntity(entityId: string): readonly string[];
};

export function createFundamentalObservationStore(): FundamentalObservationStore {
  const observations: SecFundamentalObservation[] = [];

  return {
    append(batch) {
      observations.push(...batch);
    },
    all() {
      return Object.freeze([...observations]);
    },
    factsForEntity(entityId) {
      return Object.freeze(
        observations.filter(
          (obs): obs is FinancialFactObservation =>
            obs.observationKind === 'financial_fact' && obs.canonicalEntityId === entityId,
        ),
      );
    },
    knowableFactsAt(entityId, evaluationTimeUtc) {
      const entityFacts = observations.filter(
        (obs): obs is FinancialFactObservation =>
          obs.observationKind === 'financial_fact' && obs.canonicalEntityId === entityId,
      );
      return filterKnowableObservations(entityFacts, evaluationTimeUtc);
    },
    filingIdsForEntity(entityId) {
      const ids = new Set(
        observations.filter((o) => o.canonicalEntityId === entityId).map((o) => o.filingId),
      );
      return Object.freeze([...ids]);
    },
  };
}

/** Select effective fact per concept+periodEnd at evaluation time (latest knowable filing wins). */
export function effectiveFactsAt(
  facts: readonly FinancialFactObservation[],
  evaluationTimeUtc: UtcInstant,
): readonly FinancialFactObservation[] {
  const knowable = filterKnowableObservations(facts, evaluationTimeUtc);
  const byKey = new Map<string, FinancialFactObservation>();
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
