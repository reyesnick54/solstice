/**
 * Wave 5 — Productive source reputation.
 *
 * Specializes Wave 4 source reputation for productive oracle providers.
 * Reputation may influence review thresholds. Reputation does NOT itself
 * establish truth.
 */

import type { ProductiveCategory } from '../types.ts';

export const REPUTATION_DOES_NOT_ESTABLISH_TRUTH = true as const;

export const REPUTATION_DIMENSIONS = [
  'data_integrity_history',
  'availability',
  'timeliness',
  'correction_rate',
  'source_independence',
  'schema_stability',
  'observed_disagreement',
  'verified_incident_history',
] as const;
export type ReputationDimension = (typeof REPUTATION_DIMENSIONS)[number];

export type ReputationDimensionScore = {
  readonly dimension: ReputationDimension;
  readonly score: number;
  readonly sampleCount: number;
  readonly lastUpdatedUtc: string;
};

export type ProductiveSourceReputation = {
  readonly schemaVersion: 1;
  readonly providerId: string;
  readonly sourceClass: string;
  readonly domain: ProductiveCategory | 'CROSS_DOMAIN';
  readonly dimensions: readonly ReputationDimensionScore[];
  readonly compositeScore: number;
  readonly reviewThresholdAdjustment: number;
  readonly establishesTruth: false;
};

export type ReputationInput = {
  readonly providerId: string;
  readonly sourceClass: string;
  readonly domain: ProductiveCategory | 'CROSS_DOMAIN';
  readonly acceptedObservations?: number;
  readonly rejectedObservations?: number;
  readonly conflictsParticipated?: number;
  readonly outageCount?: number;
  readonly schemaChangeCount?: number;
  readonly correctionCount?: number;
  readonly timelinessViolations?: number;
  readonly independenceScore?: number;
  readonly disagreementRate?: number;
  readonly verifiedIncidentCount?: number;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeProductiveSourceReputation(
  input: ReputationInput,
  nowUtc = new Date().toISOString(),
): ProductiveSourceReputation {
  const accepted = input.acceptedObservations ?? 0;
  const rejected = input.rejectedObservations ?? 0;
  const total = accepted + rejected;
  const integrityBase = total === 0 ? 50 : (accepted / total) * 100;

  const dimensions: ReputationDimensionScore[] = [
    Object.freeze({
      dimension: 'data_integrity_history' as const,
      score: clampScore(integrityBase - (input.verifiedIncidentCount ?? 0) * 10),
      sampleCount: total,
      lastUpdatedUtc: nowUtc,
    }),
    Object.freeze({
      dimension: 'availability' as const,
      score: clampScore(100 - (input.outageCount ?? 0) * 15),
      sampleCount: input.outageCount ?? 0,
      lastUpdatedUtc: nowUtc,
    }),
    Object.freeze({
      dimension: 'timeliness' as const,
      score: clampScore(100 - (input.timelinessViolations ?? 0) * 8),
      sampleCount: accepted,
      lastUpdatedUtc: nowUtc,
    }),
    Object.freeze({
      dimension: 'correction_rate' as const,
      score: clampScore(100 - (input.correctionCount ?? 0) * 5),
      sampleCount: input.correctionCount ?? 0,
      lastUpdatedUtc: nowUtc,
    }),
    Object.freeze({
      dimension: 'source_independence' as const,
      score: clampScore(input.independenceScore ?? 70),
      sampleCount: 1,
      lastUpdatedUtc: nowUtc,
    }),
    Object.freeze({
      dimension: 'schema_stability' as const,
      score: clampScore(100 - (input.schemaChangeCount ?? 0) * 12),
      sampleCount: input.schemaChangeCount ?? 0,
      lastUpdatedUtc: nowUtc,
    }),
    Object.freeze({
      dimension: 'observed_disagreement' as const,
      score: clampScore(100 - (input.disagreementRate ?? 0) * 100 - (input.conflictsParticipated ?? 0) * 5),
      sampleCount: input.conflictsParticipated ?? 0,
      lastUpdatedUtc: nowUtc,
    }),
    Object.freeze({
      dimension: 'verified_incident_history' as const,
      score: clampScore(100 - (input.verifiedIncidentCount ?? 0) * 20),
      sampleCount: input.verifiedIncidentCount ?? 0,
      lastUpdatedUtc: nowUtc,
    }),
  ];

  const compositeScore = clampScore(
    dimensions.reduce((sum, row) => sum + row.score, 0) / dimensions.length,
  );

  const reviewThresholdAdjustment = compositeScore < 40 ? 20 : compositeScore < 60 ? 10 : 0;

  return Object.freeze({
    schemaVersion: 1,
    providerId: input.providerId,
    sourceClass: input.sourceClass,
    domain: input.domain,
    dimensions,
    compositeScore,
    reviewThresholdAdjustment,
    establishesTruth: false,
  });
}

export class ProductiveSourceReputationRegistry {
  private readonly reputations = new Map<string, ProductiveSourceReputation>();

  private key(providerId: string, sourceClass: string): string {
    return `${providerId}:${sourceClass}`;
  }

  upsert(input: ReputationInput, nowUtc?: string): ProductiveSourceReputation {
    const reputation = computeProductiveSourceReputation(input, nowUtc);
    this.reputations.set(this.key(input.providerId, input.sourceClass), reputation);
    return reputation;
  }

  get(providerId: string, sourceClass: string): ProductiveSourceReputation | null {
    return this.reputations.get(this.key(providerId, sourceClass)) ?? null;
  }

  list(): readonly ProductiveSourceReputation[] {
    return [...this.reputations.values()];
  }

  degraded(threshold = 50): readonly ProductiveSourceReputation[] {
    return this.list().filter((row) => row.compositeScore < threshold);
  }
}
