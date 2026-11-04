/**
 * In-memory earnings intelligence store (domain foundation — not durable persistence).
 */

import type {
  EarningsEvent,
  EarningsIntelligenceArtifact,
  EarningsIntelligenceStoreSnapshot,
} from './types.ts';
import { filterKnowableEarningsArtifacts } from './knowable-at.ts';
import type { UtcInstant } from '@solstice/domain';
import type { EarningsEventId } from './types.ts';

export type EarningsIntelligenceStore = {
  upsertEvent(event: EarningsEvent): void;
  appendObservation(observation: Exclude<EarningsIntelligenceArtifact, EarningsEvent>): void;
  snapshot(): EarningsIntelligenceStoreSnapshot;
  snapshotKnowableAt(evaluationTime: UtcInstant): EarningsIntelligenceStoreSnapshot;
  getEvent(eventId: EarningsEventId): EarningsEvent | null;
};

export function createEarningsIntelligenceStore(): EarningsIntelligenceStore {
  const events = new Map<string, EarningsEvent>();
  const observations: Exclude<EarningsIntelligenceArtifact, EarningsEvent>[] = [];

  return {
    upsertEvent(event) {
      events.set(event.eventId, Object.freeze({ ...event }));
    },
    appendObservation(observation) {
      observations.push(Object.freeze({ ...observation }));
    },
    snapshot() {
      return Object.freeze({
        events: Object.freeze([...events.values()]),
        observations: Object.freeze([...observations]),
      });
    },
    snapshotKnowableAt(evaluationTime) {
      return Object.freeze({
        events: filterKnowableEarningsArtifacts(evaluationTime, [...events.values()]),
        observations: filterKnowableEarningsArtifacts(evaluationTime, observations),
      });
    },
    getEvent(eventId) {
      return events.get(eventId) ?? null;
    },
  };
}
