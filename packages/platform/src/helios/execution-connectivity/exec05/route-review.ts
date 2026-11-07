import type { UtcInstant } from '@solstice/domain';
import type { BestExecutionEvidence, VenuePeriodicMetrics } from './types.ts';
import { EXEC05_SCHEMA } from './taxonomy.ts';
import { bestExecutionEvidenceIdFor } from './ids.ts';

export type RouteReviewObservation = {
  readonly venueId: string;
  readonly providerId: string;
  readonly filled: boolean;
  readonly priceImprovementBps: number;
  readonly slippageBps: number;
  readonly rejected: boolean;
  readonly latencyMs: number;
  readonly canceled: boolean;
  readonly observedAt: UtcInstant;
};

function ppm(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.floor((numerator * 1_000_000) / denominator);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.floor((sum * 100) / values.length) / 100;
}

function p95Latency(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? 0;
}

function aggregateVenueMetrics(input: {
  readonly venueId: string;
  readonly providerId: string;
  readonly windowStart: UtcInstant;
  readonly windowEnd: UtcInstant;
  readonly observations: readonly RouteReviewObservation[];
}): VenuePeriodicMetrics {
  const rows = input.observations.filter(
    (row) => row.venueId === input.venueId && row.providerId === input.providerId,
  );
  const fillRatePpm = ppm(rows.filter((row) => row.filled).length, rows.length);
  const rejectRatePpm = ppm(rows.filter((row) => row.rejected).length, rows.length);
  const cancelRatePpm = ppm(rows.filter((row) => row.canceled).length, rows.length);
  return Object.freeze({
    venueId: input.venueId,
    providerId: input.providerId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    fillRatePpm,
    priceImprovementBpsMean: mean(rows.map((row) => row.priceImprovementBps)),
    slippageBpsMean: mean(rows.map((row) => row.slippageBps)),
    rejectRatePpm,
    latencyMsP95: p95Latency(rows.map((row) => row.latencyMs)),
    cancelRatePpm,
    sampleCount: rows.length,
  });
}

/** Periodic engineering route review — not legal best-execution certification. */
export function generateBestExecutionEvidence(input: {
  readonly windowStart: UtcInstant;
  readonly windowEnd: UtcInstant;
  readonly observations: readonly RouteReviewObservation[];
  readonly generatedAt: UtcInstant;
}): BestExecutionEvidence {
  const venueKeys = new Map<string, { venueId: string; providerId: string }>();
  for (const row of input.observations) {
    venueKeys.set(`${row.providerId}|${row.venueId}`, { venueId: row.venueId, providerId: row.providerId });
  }
  const venueMetrics = [...venueKeys.values()].map((key) =>
    aggregateVenueMetrics({
      venueId: key.venueId,
      providerId: key.providerId,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      observations: input.observations,
    }),
  );
  return Object.freeze({
    schema: EXEC05_SCHEMA,
    evidenceId: bestExecutionEvidenceIdFor(input.windowStart, input.windowEnd),
    reviewPeriodStart: input.windowStart,
    reviewPeriodEnd: input.windowEnd,
    venueMetrics: Object.freeze(venueMetrics),
    disclaimer: 'ENGINEERING_EVIDENCE_NOT_LEGAL_BEST_EXECUTION_CERTIFICATION',
    generatedAt: input.generatedAt,
  });
}
