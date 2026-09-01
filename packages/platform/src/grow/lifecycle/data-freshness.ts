import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { DataFreshnessStatus } from './taxonomy.ts';

export type SourcedFact = {
  readonly source: string;
  readonly retrievedAt: UtcInstant;
  readonly effectiveAt?: UtcInstant;
  readonly freshness: DataFreshnessStatus;
  readonly staleReason?: string;
};

const AGING_MS = 15 * 60 * 1000;
const STALE_MS = 60 * 60 * 1000;

export function assessFreshness(input: {
  readonly retrievedAt: UtcInstant;
  readonly now: UtcInstant;
  readonly maxAgeMs?: number;
  readonly effectiveAt?: UtcInstant;
}): { readonly status: DataFreshnessStatus; readonly ageMs: number } {
  const ageMs = Date.parse(input.now) - Date.parse(input.retrievedAt);
  const threshold = input.maxAgeMs ?? STALE_MS;
  if (ageMs < AGING_MS) {
    return { status: 'CURRENT', ageMs };
  }
  if (ageMs < threshold) {
    return { status: 'AGING', ageMs };
  }
  return { status: 'STALE', ageMs };
}

export function sourcedFact(input: {
  readonly source: string;
  readonly retrievedAt: UtcInstant;
  readonly now: UtcInstant;
  readonly effectiveAt?: UtcInstant;
  readonly maxAgeMs?: number;
}): SourcedFact {
  const assessed = assessFreshness(input);
  return Object.freeze({
    source: input.source,
    retrievedAt: input.retrievedAt,
    ...(input.effectiveAt ? { effectiveAt: input.effectiveAt } : {}),
    freshness: assessed.status,
    ...(assessed.status === 'STALE'
      ? { staleReason: `fact older than ${String(input.maxAgeMs ?? STALE_MS)}ms` }
      : {}),
  });
}

export function staleDataBlocksProposal(facts: readonly SourcedFact[]): {
  readonly blocked: boolean;
  readonly staleSources: readonly string[];
  readonly labelRequired: boolean;
} {
  const stale = facts.filter((row) => row.freshness === 'STALE' || row.freshness === 'UNAVAILABLE');
  return Object.freeze({
    blocked: stale.some((row) => row.freshness === 'STALE'),
    staleSources: Object.freeze(stale.map((row) => row.source)),
    labelRequired: stale.length > 0,
  });
}
