import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import {
  coverageDriftBps,
  coverageStabilityBps,
  ratioBps,
  rollingMeanBps,
} from './formulas.ts';
import type {
  CoverageMetricSet,
  CoverageSliceAggregate,
  FeatureCoverageCell,
  MissingnessCountByReason,
  MissingnessReason,
} from './types.ts';
import { MISSINGNESS_REASONS } from './types.ts';

function emptyMissingnessCounts(): MissingnessCountByReason {
  const counts = Object.fromEntries(MISSINGNESS_REASONS.map((reason) => [reason, 0])) as Record<
    MissingnessReason,
    number
  >;
  return Object.freeze(counts);
}

function bumpMissingness(
  counts: MissingnessCountByReason,
  reason: MissingnessReason | null,
): MissingnessCountByReason {
  if (!reason) {
    return counts;
  }
  const next = { ...counts, [reason]: counts[reason] + 1 };
  return Object.freeze(next);
}

function cellKey(cell: FeatureCoverageCell): string {
  return `${cell.canonicalEntityId}|${cell.canonicalInstrumentId}|${cell.evaluationTimestamp}|${cell.featureId}`;
}

export function aggregateCoverageSlices(cells: readonly FeatureCoverageCell[]): readonly CoverageSliceAggregate[] {
  const slices = new Map<string, CoverageSliceAggregate>();

  function upsert(
    dimension: CoverageSliceAggregate['dimension'],
    dimensionValue: string,
    cell: FeatureCoverageCell,
  ): void {
    const sliceKey = `${dimension}:${dimensionValue}`;
    const prior = slices.get(sliceKey) ?? {
      sliceKey,
      dimension,
      dimensionValue,
      eligibleUniverseCount: 0,
      usableFeatureCount: 0,
      expectedCellCount: 0,
      coverageRatioBps: 0,
      missingnessByReason: emptyMissingnessCounts(),
    };
    const usable = cell.disposition === 'USABLE' ? 1 : 0;
    const missingnessByReason = bumpMissingness(prior.missingnessByReason, cell.missingnessReason);
    const next = {
      ...prior,
      eligibleUniverseCount: prior.eligibleUniverseCount + 1,
      usableFeatureCount: prior.usableFeatureCount + usable,
      expectedCellCount: prior.expectedCellCount + 1,
      missingnessByReason,
    };
    slices.set(sliceKey, next);
  }

  for (const cell of cells) {
    upsert('entity', cell.canonicalEntityId, cell);
    upsert('instrument', cell.canonicalInstrumentId, cell);
    upsert('timestamp', cell.evaluationTimestamp, cell);
    upsert('feature', cell.featureId, cell);
    if (cell.providerId) upsert('provider', cell.providerId, cell);
    if (cell.sector) upsert('sector', cell.sector, cell);
    if (cell.industry) upsert('industry', cell.industry, cell);
    if (cell.marketCapBucket) upsert('marketCapBucket', cell.marketCapBucket, cell);
    if (cell.liquidityBucket) upsert('liquidityBucket', cell.liquidityBucket, cell);
    if (cell.geography) upsert('geography', cell.geography, cell);
    if (cell.venue) upsert('venue', cell.venue, cell);
    if (cell.assetClass) upsert('assetClass', cell.assetClass, cell);
  }

  return Object.freeze(
    [...slices.values()].map((row) =>
      Object.freeze({
        ...row,
        coverageRatioBps: ratioBps(row.usableFeatureCount, row.expectedCellCount),
      }),
    ),
  );
}

export function computeCrossSectionalCoverageBps(
  cells: readonly FeatureCoverageCell[],
  eligibleUniverseCount: number,
  featureIds: readonly string[],
): number {
  if (eligibleUniverseCount <= 0) {
    return 0;
  }
  const byInstrument = new Map<string, Map<string, FeatureCoverageCell>>();
  for (const cell of cells) {
    const instrumentCells = byInstrument.get(cell.canonicalInstrumentId) ?? new Map<string, FeatureCoverageCell>();
    instrumentCells.set(cell.featureId, cell);
    byInstrument.set(cell.canonicalInstrumentId, instrumentCells);
  }
  let fullyCovered = 0;
  for (const instrumentCells of byInstrument.values()) {
    const allUsable = featureIds.every((featureId) => instrumentCells.get(featureId)?.disposition === 'USABLE');
    if (allUsable) {
      fullyCovered += 1;
    }
  }
  return ratioBps(fullyCovered, eligibleUniverseCount);
}

export function computeFeatureCompletenessBps(
  cells: readonly FeatureCoverageCell[],
  eligibleUniverseCount: number,
): Readonly<Record<string, number>> {
  const byFeature = new Map<string, number>();
  for (const cell of cells) {
    if (cell.disposition !== 'USABLE') {
      continue;
    }
    byFeature.set(cell.featureId, (byFeature.get(cell.featureId) ?? 0) + 1);
  }
  const out: Record<string, number> = {};
  for (const [featureId, usable] of byFeature.entries()) {
    out[featureId] = ratioBps(usable, eligibleUniverseCount);
  }
  return Object.freeze(out);
}

export function computeProviderCoverageBps(cells: readonly FeatureCoverageCell[]): Readonly<Record<string, number>> {
  const byProvider = new Map<string, { usable: number; expected: number }>();
  for (const cell of cells) {
    if (!cell.providerId) {
      continue;
    }
    const bucket = byProvider.get(cell.providerId) ?? { usable: 0, expected: 0 };
    bucket.expected += 1;
    if (cell.disposition === 'USABLE') {
      bucket.usable += 1;
    }
    byProvider.set(cell.providerId, bucket);
  }
  for (const cell of cells) {
    if (cell.missingnessReason !== 'PROVIDER_UNAVAILABLE' || !cell.providerId) {
      continue;
    }
    const bucket = byProvider.get(cell.providerId) ?? { usable: 0, expected: 0 };
    bucket.expected += 1;
    byProvider.set(cell.providerId, bucket);
  }
  const out: Record<string, number> = {};
  for (const [providerId, bucket] of byProvider.entries()) {
    out[providerId] = ratioBps(bucket.usable, bucket.expected);
  }
  return Object.freeze(out);
}

export function computeCoverageMetricSet(input: {
  readonly cells: readonly FeatureCoverageCell[];
  readonly eligibleUniverseCount: number;
  readonly featureIds: readonly string[];
  readonly rollingHistoryBps?: readonly number[];
  readonly baselineCoverageRatioBps?: number | null;
}): CoverageMetricSet {
  const usableFeatureCount = input.cells.filter((row) => row.disposition === 'USABLE').length;
  const expectedCellCount = input.cells.length;
  const coverageRatioBps = ratioBps(usableFeatureCount, expectedCellCount);
  const rollingCoverageRatioBps =
    input.rollingHistoryBps && input.rollingHistoryBps.length > 0
      ? rollingMeanBps([...input.rollingHistoryBps, coverageRatioBps])
      : null;
  const stabilityWindow = input.rollingHistoryBps
    ? [...input.rollingHistoryBps, coverageRatioBps]
    : [coverageRatioBps];
  return Object.freeze({
    coverageRatioBps,
    rollingCoverageRatioBps,
    providerCoverageRatioBps: computeProviderCoverageBps(input.cells),
    crossSectionalCoverageRatioBps: computeCrossSectionalCoverageBps(
      input.cells,
      input.eligibleUniverseCount,
      input.featureIds,
    ),
    featureCompletenessRatioBps: computeFeatureCompletenessBps(input.cells, input.eligibleUniverseCount),
    coverageStabilityBps: coverageStabilityBps(stabilityWindow),
    coverageDriftBps:
      input.baselineCoverageRatioBps === undefined || input.baselineCoverageRatioBps === null
        ? null
        : coverageDriftBps(input.baselineCoverageRatioBps, coverageRatioBps),
  });
}

export function tensorFingerprint(input: {
  readonly universeId: string;
  readonly evaluationTimestamp: UtcInstant;
  readonly featureIds: readonly string[];
  readonly cells: readonly FeatureCoverageCell[];
}): string {
  const material = JSON.stringify({
    universeId: input.universeId,
    evaluationTimestamp: input.evaluationTimestamp,
    featureIds: [...input.featureIds],
    cells: [...input.cells]
      .map((row) => ({
        key: cellKey(row),
        disposition: row.disposition,
        missingnessReason: row.missingnessReason,
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  });
  return createHash('sha256').update(material).digest('hex');
}

export function summarizeExclusions(cells: readonly FeatureCoverageCell[]): MissingnessCountByReason {
  let counts = emptyMissingnessCounts();
  for (const cell of cells) {
    counts = bumpMissingness(counts, cell.missingnessReason);
  }
  return counts;
}
