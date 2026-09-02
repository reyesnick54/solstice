import type { FabricProviderRegistration } from '../providers/registry.ts';

export type SourceReputationScore = {
  readonly providerId: string;
  readonly scoreBps: number;
  readonly sampleCount: number;
  readonly lastUpdatedUtc: string;
  readonly notes: readonly string[];
};

export type SourceReputationStore = {
  recordSuccess(providerId: string, atUtc: string): void;
  recordFailure(providerId: string, atUtc: string, reason: string): void;
  score(providerId: string): SourceReputationScore | undefined;
};

const DEFAULT_SCORE_BPS = 5000;

export function createSourceReputationStore(): SourceReputationStore {
  const scores = new Map<string, { successes: number; failures: number; notes: string[]; updated: string }>();

  return {
    recordSuccess(providerId, atUtc) {
      const entry = scores.get(providerId) ?? { successes: 0, failures: 0, notes: [], updated: atUtc };
      entry.successes += 1;
      entry.updated = atUtc;
      scores.set(providerId, entry);
    },
    recordFailure(providerId, atUtc, reason) {
      const entry = scores.get(providerId) ?? { successes: 0, failures: 0, notes: [], updated: atUtc };
      entry.failures += 1;
      entry.notes.push(reason);
      entry.updated = atUtc;
      scores.set(providerId, entry);
    },
    score(providerId) {
      const entry = scores.get(providerId);
      if (!entry) return undefined;
      const total = entry.successes + entry.failures;
      const scoreBps = total === 0 ? DEFAULT_SCORE_BPS : Math.round((entry.successes / total) * 10_000);
      return Object.freeze({
        providerId,
        scoreBps,
        sampleCount: total,
        lastUpdatedUtc: entry.updated,
        notes: Object.freeze([...entry.notes]),
      });
    },
  };
}

export function reputationWeight(registration: FabricProviderRegistration, score: SourceReputationScore | undefined): number {
  const tierBoost =
    registration.trustTier === 'trusted' ? 1.0 : registration.trustTier === 'certified' ? 0.8 : 0.5;
  const scoreFactor = score ? score.scoreBps / 10_000 : 0.5;
  return tierBoost * scoreFactor;
}
