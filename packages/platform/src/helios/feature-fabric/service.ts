/**
 * HELIOS point-in-time fundamental feature fabric service.
 */

import type { SecFundamentalObservation } from '../../../../external-data/src/sec-fundamentals/types.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { buildPointInTimeFundamentalSnapshot } from './features.ts';
import { createFundamentalObservationStore, type FundamentalObservationStore } from './store.ts';
import type { PointInTimeFundamentalSnapshot } from './types.ts';

export type HeliosFundamentalFeatureFabric = {
  ingest(observations: readonly SecFundamentalObservation[]): void;
  snapshotAt(input: {
    readonly canonicalEntityId: string;
    readonly evaluationTimeUtc: UtcInstant;
    readonly reportPeriod: string;
    readonly priorReportPeriod?: string | null;
  }): PointInTimeFundamentalSnapshot;
  store(): FundamentalObservationStore;
};

export function createHeliosFundamentalFeatureFabric(): HeliosFundamentalFeatureFabric {
  const store = createFundamentalObservationStore();

  return {
    ingest(observations) {
      store.append(observations);
    },
    snapshotAt(input) {
      const allFacts = store.knowableFactsAt(input.canonicalEntityId, input.evaluationTimeUtc);
      const periodFacts = allFacts.filter((f) => f.periodEnd === input.reportPeriod);
      const priorFacts = input.priorReportPeriod
        ? allFacts.filter((f) => f.periodEnd === input.priorReportPeriod)
        : [];
      return buildPointInTimeFundamentalSnapshot({
        canonicalEntityId: input.canonicalEntityId,
        evaluationTimeUtc: input.evaluationTimeUtc,
        facts: periodFacts,
        priorPeriodFacts: priorFacts,
      });
    },
    store() {
      return store;
    },
  };
}
