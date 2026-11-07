import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { ExecutionAlgorithmKind } from './taxonomy.ts';
import { HELIOS_EXEC07_TCA_SCHEMA } from './taxonomy.ts';
import { averageNullableBps, rateBps } from './numeric.ts';
import type { AlgorithmExecutionProfile, ExecutionQualityReport, VenueExecutionProfile } from './types.ts';

export function buildVenueExecutionProfile(input: {
  readonly venueId: string;
  readonly reports: readonly ExecutionQualityReport[];
  readonly computedAt: UtcInstant;
}): VenueExecutionProfile {
  const rows = input.reports.filter((row) => row.venueId === input.venueId);
  const sampleCount = rows.length;
  const profileId = `exec07_venue_${createHash('sha256').update(`${input.venueId}:${sampleCount}`).digest('hex').slice(0, 16)}`;
  const complete = rows.filter((row) => row.transactionCost.benchmarkConstructionComplete).length;
  return Object.freeze({
    profileId,
    schema: HELIOS_EXEC07_TCA_SCHEMA,
    venueId: input.venueId,
    sampleCount,
    avgSpreadCostBps: averageNullableBps(rows.map((row) => row.transactionCost.spreadCostBps)),
    avgSlippageBps: averageNullableBps(rows.map((row) => row.transactionCost.slippageBps)),
    avgImplementationShortfallBps: averageNullableBps(
      rows.map((row) => row.transactionCost.implementationShortfallBps),
    ),
    avgFillRateBps:
      sampleCount === 0
        ? 0
        : Math.round(
            rows.reduce((acc, row) => acc + row.transactionCost.operational.fillRateBps, 0) / sampleCount,
          ),
    avgPartialFillRateBps:
      sampleCount === 0
        ? 0
        : Math.round(
            rows.reduce((acc, row) => acc + row.transactionCost.operational.partialFillRateBps, 0) / sampleCount,
          ),
    avgRejectRateBps:
      sampleCount === 0
        ? 0
        : Math.round(rows.reduce((acc, row) => acc + row.transactionCost.operational.rejectRateBps, 0) / sampleCount),
    avgAdverseSelectionBps: averageNullableBps(
      rows.map((row) => row.transactionCost.operational.adverseSelectionBps),
    ),
    benchmarkConstructionCompleteRateBps: rateBps(complete, Math.max(1, sampleCount)),
    computedAt: input.computedAt,
  });
}

export function buildAlgorithmExecutionProfile(input: {
  readonly algorithmKind: ExecutionAlgorithmKind;
  readonly venueId: string | null;
  readonly reports: readonly ExecutionQualityReport[];
  readonly computedAt: UtcInstant;
}): AlgorithmExecutionProfile {
  const rows = input.reports.filter(
    (row) =>
      row.algorithmKind === input.algorithmKind &&
      (input.venueId == null || row.venueId === input.venueId),
  );
  const sampleCount = rows.length;
  const key = `${input.algorithmKind}:${input.venueId ?? 'ALL'}:${sampleCount}`;
  const profileId = `exec07_alg_${createHash('sha256').update(key).digest('hex').slice(0, 16)}`;
  return Object.freeze({
    profileId,
    schema: HELIOS_EXEC07_TCA_SCHEMA,
    algorithmKind: input.algorithmKind,
    venueId: input.venueId,
    sampleCount,
    avgSpreadCostBps: averageNullableBps(rows.map((row) => row.transactionCost.spreadCostBps)),
    avgTimingCostBps: averageNullableBps(rows.map((row) => row.transactionCost.timingCostBps)),
    avgPriceImprovementBps: averageNullableBps(rows.map((row) => row.transactionCost.priceImprovementBps)),
    avgImplementationShortfallBps: averageNullableBps(
      rows.map((row) => row.transactionCost.implementationShortfallBps),
    ),
    avgFillRateBps:
      sampleCount === 0
        ? 0
        : Math.round(
            rows.reduce((acc, row) => acc + row.transactionCost.operational.fillRateBps, 0) / sampleCount,
          ),
    computedAt: input.computedAt,
  });
}
