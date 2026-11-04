/**
 * Multi-dimensional earnings surprise tensor builder.
 */

import { isFeatureVisibleAt } from '../../knowable-at.ts';
import { buildBeatQualityDecomposition } from './beat-quality.ts';
import { assertExpectationSnapshotPreEvent, dimensionKey, dispersionForSource, pointsForSource } from './expectation.ts';
import { computePeerNormalizations } from './peer-normalization.ts';
import {
  computeConsensusDispersionSue,
  computeGuidanceMidpointVsConsensus,
  computeGuidanceMidpointVsPrior,
  computeHistoricalSeasonalSue,
  computePriceScaledSurprise,
  computeRobustMedianSue,
} from './sue-methods.ts';
import {
  EARN03_FORMULA_VERSION,
  HELIOS_EARN03_SURPRISE_TENSOR_SCHEMA,
  methodsForDimension,
  type EarningsExpectationSource,
  type EarningsSurpriseDimension,
  type EarningsSurpriseMethod,
} from './taxonomy.ts';
import type {
  BuildSurpriseTensorInput,
  EarningsActualInput,
  EarningsSurpriseDecomposition,
  EarningsSurpriseQuality,
  EarningsSurpriseTensor,
  ExpectationDispersionInput,
  ExpectationPointInput,
  SeasonalHistoryInput,
} from './types.ts';

export function buildEarningsSurpriseTensor(input: BuildSurpriseTensorInput): EarningsSurpriseTensor {
  const cells: EarningsSurpriseDecomposition[] = [];
  const actualByKey = indexActuals(input.actuals);
  const seasonalByKey = indexSeasonal(input.seasonalHistory ?? []);

  for (const source of uniqueSources(input.expectationSnapshot)) {
    for (const dimension of dimensionsPresent(input.expectationSnapshot, source, actualByKey)) {
      const segmentIds = segmentIdsForDimension(input, dimension, source);
      for (const segmentId of segmentIds) {
        const methods = methodsForDimension(dimension);
        for (const method of methods) {
          const cell = computeCell({
            input,
            dimension,
            segmentId,
            method,
            source,
            actualByKey,
            seasonalByKey,
          });
          cells.push(cell);
        }
      }
    }
  }

  const beatQuality =
    input.beatQualityLines && input.reportedEpsBeatMinor !== null && input.reportedEpsBeatMinor !== undefined
      ? buildBeatQualityDecomposition({
          fiscalPeriod: input.fiscalPeriod,
          reportedEpsBeatMinor: input.reportedEpsBeatMinor,
          lines: input.beatQualityLines,
        })
      : null;

  const peerNormalizations = computePeerNormalizations({
    cells,
    peerGroups: input.peerGroups ?? {},
  });

  return Object.freeze({
    schema: HELIOS_EARN03_SURPRISE_TENSOR_SCHEMA,
    formulaVersion: EARN03_FORMULA_VERSION,
    canonicalEntityId: input.canonicalEntityId,
    fiscalPeriod: input.fiscalPeriod,
    evaluationTimeUtc: input.evaluationTimeUtc,
    preEventPriceMinor: input.preEventPriceMinor,
    expectationSnapshot: input.expectationSnapshot,
    cells: Object.freeze(cells),
    beatQuality,
    peerNormalizations: Object.freeze(peerNormalizations),
    grantsExecutionAuthority: false as const,
  });
}

type CellComputeContext = {
  readonly input: BuildSurpriseTensorInput;
  readonly dimension: EarningsSurpriseDimension;
  readonly segmentId: string | null;
  readonly method: EarningsSurpriseMethod;
  readonly source: EarningsExpectationSource;
  readonly actualByKey: Map<string, EarningsActualInput>;
  readonly seasonalByKey: Map<string, SeasonalHistoryInput>;
};

function computeCell(ctx: CellComputeContext): EarningsSurpriseDecomposition {
  const key = Object.freeze({
    dimension: ctx.dimension,
    segmentId: ctx.segmentId,
    method: ctx.method,
    expectationSource: ctx.source,
  });
  const quality = baseQuality(ctx);
  const actual = ctx.actualByKey.get(dimensionKey(ctx.dimension, ctx.segmentId, ctx.input.fiscalPeriod)) ?? null;
  const point = findPoint(ctx.input.expectationSnapshot, ctx.dimension, ctx.segmentId, ctx.source);
  const dispersion = findDispersion(ctx.input.expectationSnapshot, ctx.dimension, ctx.segmentId, ctx.source);

  if (!actual) {
    return unavailableCell(key, quality, 'missing actual');
  }
  const preEvent = assertExpectationSnapshotPreEvent({
    snapshot: ctx.input.expectationSnapshot,
    actualKnowableAt: actual.knowableAt,
  });
  if (!preEvent.ok) {
    return Object.freeze({
      key,
      rawDeltaMinor: null,
      rawDeltaScaled: null,
      standardizedScaled: null,
      calculable: false,
      quality: Object.freeze({
        ...quality,
        state: 'DEGRADED_STALE_EXPECTATION',
        notes: Object.freeze([preEvent.message]),
      }),
      grantsExecutionAuthority: false as const,
    });
  }
  if (!isFeatureVisibleAt(ctx.input.evaluationTimeUtc, actual.knowableAt)) {
    return unavailableCell(key, quality, 'actual not visible at evaluation time');
  }

  const result = applyMethod(ctx.method, {
    actual,
    point,
    dispersion,
    preEventPriceMinor: ctx.input.preEventPriceMinor,
    seasonal: ctx.seasonalByKey.get(seasonalKey(ctx.dimension, ctx.segmentId)) ?? null,
    snapshot: ctx.input.expectationSnapshot,
    source: ctx.source,
    fiscalPeriod: ctx.input.fiscalPeriod,
  });

  return Object.freeze({
    key,
    rawDeltaMinor: result.rawDeltaMinor,
    rawDeltaScaled: result.rawDeltaScaled,
    standardizedScaled: result.standardizedScaled,
    calculable: result.standardizedScaled !== null,
    quality: Object.freeze({
      ...quality,
      state: result.standardizedScaled !== null ? 'VALID' : 'DEGRADED_MISSING_INPUT',
      notes: Object.freeze(result.notes),
    }),
    grantsExecutionAuthority: false as const,
  });
}

function applyMethod(
  method: EarningsSurpriseMethod,
  ctx: {
    readonly actual: EarningsActualInput;
    readonly point: ExpectationPointInput | null;
    readonly dispersion: ExpectationDispersionInput | null;
    readonly preEventPriceMinor: bigint | null;
    readonly seasonal: SeasonalHistoryInput | null;
    readonly snapshot: BuildSurpriseTensorInput['expectationSnapshot'];
    readonly source: EarningsExpectationSource;
    readonly fiscalPeriod: string;
  },
): {
  readonly standardizedScaled: number | null;
  readonly rawDeltaMinor: bigint | null;
  readonly rawDeltaScaled: number | null;
  readonly notes: readonly string[];
} {
  switch (method) {
    case 'CONSENSUS_DISPERSION_SUE':
    case 'REVENUE_MARGIN_STANDARDIZED': {
      const sue = computeConsensusDispersionSue({
        actualMinor: ctx.actual.valueMinor,
        actualScaled: ctx.actual.valueScaled,
        expectedMinor: ctx.point?.valueMinor ?? null,
        expectedScaled: ctx.point?.valueScaled ?? null,
        dispersionMinor: ctx.dispersion?.dispersionMinor ?? null,
        dispersionScaled: ctx.dispersion?.dispersionScaled ?? null,
        dimension: ctx.actual.dimension,
      });
      return { ...sue, notes: Object.freeze([]) };
    }
    case 'PRICE_SCALED_SURPRISE': {
      const sue = computePriceScaledSurprise({
        actualMinor: ctx.actual.valueMinor,
        expectedMinor: ctx.point?.valueMinor ?? null,
        preEventPriceMinor: ctx.preEventPriceMinor,
      });
      return { ...sue, rawDeltaScaled: null, notes: Object.freeze([]) };
    }
    case 'HISTORICAL_SEASONAL_SUE': {
      const expectedMinor = ctx.point?.valueMinor ?? null;
      const currentDelta =
        ctx.actual.valueMinor !== null && expectedMinor !== null
          ? ctx.actual.valueMinor - expectedMinor
          : null;
      const sue = computeHistoricalSeasonalSue({
        currentDeltaMinor: currentDelta,
        historicalDeltasMinor: ctx.seasonal?.quarterlyDeltasMinor ?? [],
      });
      return { ...sue, rawDeltaScaled: null, notes: Object.freeze([]) };
    }
    case 'ROBUST_MEDIAN_SUE': {
      const sue = computeRobustMedianSue({
        actualMinor: ctx.actual.valueMinor,
        actualScaled: ctx.actual.valueScaled,
        medianMinor: ctx.dispersion?.medianMinor ?? null,
        medianScaled: ctx.dispersion?.medianScaled ?? null,
        dispersionMinor: ctx.dispersion?.dispersionMinor ?? null,
        dispersionScaled: ctx.dispersion?.dispersionScaled ?? null,
        dimension: ctx.actual.dimension,
      });
      return { ...sue, notes: Object.freeze([]) };
    }
    case 'GUIDANCE_MIDPOINT_VS_PRIOR': {
      const prior = findPointForFiscal(
        ctx.snapshot,
        'GUIDANCE',
        null,
        ctx.source,
        `${ctx.fiscalPeriod}::prior_guidance`,
      );
      const sue = computeGuidanceMidpointVsPrior({
        newMidMinor: ctx.actual.valueMinor,
        priorMidMinor: prior?.valueMinor ?? null,
      });
      return { ...sue, rawDeltaScaled: null, notes: Object.freeze([]) };
    }
    case 'GUIDANCE_MIDPOINT_VS_CONSENSUS': {
      const street = pointsForSource(ctx.snapshot, 'STREET_CONSENSUS').find(
        (row) => row.dimension === 'GUIDANCE' && row.fiscalPeriod === ctx.fiscalPeriod,
      );
      const streetDisp = dispersionForSource(ctx.snapshot, 'STREET_CONSENSUS').find(
        (row) => row.dimension === 'GUIDANCE' && row.fiscalPeriod === ctx.fiscalPeriod,
      );
      const sue = computeGuidanceMidpointVsConsensus({
        newMidMinor: ctx.actual.valueMinor,
        consensusMinor: street?.valueMinor ?? null,
        dispersionMinor: streetDisp?.dispersionMinor ?? null,
      });
      return { ...sue, notes: Object.freeze([]) };
    }
    default: {
      const exhaustive: never = method;
      throw new Error(`unsupported method ${exhaustive}`);
    }
  }
}

function baseQuality(ctx: CellComputeContext): EarningsSurpriseQuality {
  return Object.freeze({
    state: 'UNAVAILABLE',
    expectationSource: ctx.source,
    expectationSnapshotId: ctx.input.expectationSnapshot.snapshotId,
    knowableAt: ctx.input.expectationSnapshot.knowableAt,
    notes: Object.freeze([]),
  });
}

function unavailableCell(
  key: EarningsSurpriseDecomposition['key'],
  quality: EarningsSurpriseQuality,
  note: string,
): EarningsSurpriseDecomposition {
  return Object.freeze({
    key,
    rawDeltaMinor: null,
    rawDeltaScaled: null,
    standardizedScaled: null,
    calculable: false,
    quality: Object.freeze({
      ...quality,
      state: 'UNAVAILABLE',
      notes: Object.freeze([note]),
    }),
    grantsExecutionAuthority: false as const,
  });
}

function indexActuals(actuals: readonly EarningsActualInput[]): Map<string, EarningsActualInput> {
  const map = new Map<string, EarningsActualInput>();
  for (const row of actuals) {
    map.set(dimensionKey(row.dimension, row.segmentId, row.fiscalPeriod), row);
  }
  return map;
}

function indexSeasonal(rows: readonly SeasonalHistoryInput[]): Map<string, SeasonalHistoryInput> {
  const map = new Map<string, SeasonalHistoryInput>();
  for (const row of rows) {
    map.set(seasonalKey(row.dimension, row.segmentId), row);
  }
  return map;
}

function seasonalKey(dimension: EarningsSurpriseDimension, segmentId: string | null): string {
  return `${dimension}|${segmentId ?? 'consolidated'}`;
}

function uniqueSources(snapshot: BuildSurpriseTensorInput['expectationSnapshot']): EarningsExpectationSource[] {
  const set = new Set<EarningsExpectationSource>();
  for (const row of snapshot.points) set.add(row.source);
  for (const row of snapshot.dispersions) set.add(row.source);
  return [...set];
}

function dimensionsPresent(
  snapshot: BuildSurpriseTensorInput['expectationSnapshot'],
  source: EarningsExpectationSource,
  actualByKey: Map<string, EarningsActualInput>,
): EarningsSurpriseDimension[] {
  const set = new Set<EarningsSurpriseDimension>();
  for (const row of snapshot.points) {
    if (row.source === source) set.add(row.dimension);
  }
  for (const row of actualByKey.values()) {
    set.add(row.dimension);
  }
  return [...set];
}

function segmentIdsForDimension(
  input: BuildSurpriseTensorInput,
  dimension: EarningsSurpriseDimension,
  source: EarningsExpectationSource,
): readonly (string | null)[] {
  const set = new Set<string | null>();
  for (const row of input.expectationSnapshot.points) {
    if (row.dimension === dimension && row.source === source) set.add(row.segmentId);
  }
  for (const row of input.actuals) {
    if (row.dimension === dimension) set.add(row.segmentId);
  }
  if (set.size === 0) set.add(null);
  return Object.freeze([...set]);
}

function findPoint(
  snapshot: BuildSurpriseTensorInput['expectationSnapshot'],
  dimension: EarningsSurpriseDimension,
  segmentId: string | null,
  source: EarningsExpectationSource,
): ExpectationPointInput | null {
  return findPointForFiscal(snapshot, dimension, segmentId, source, snapshot.fiscalPeriod);
}

function findPointForFiscal(
  snapshot: BuildSurpriseTensorInput['expectationSnapshot'],
  dimension: EarningsSurpriseDimension,
  segmentId: string | null,
  source: EarningsExpectationSource,
  fiscalPeriod: string,
): ExpectationPointInput | null {
  return (
    snapshot.points.find(
      (row) =>
        row.dimension === dimension &&
        row.segmentId === segmentId &&
        row.fiscalPeriod === fiscalPeriod &&
        row.source === source,
    ) ?? null
  );
}

function findDispersion(
  snapshot: BuildSurpriseTensorInput['expectationSnapshot'],
  dimension: EarningsSurpriseDimension,
  segmentId: string | null,
  source: EarningsExpectationSource,
): ExpectationDispersionInput | null {
  return (
    snapshot.dispersions.find(
      (row) =>
        row.dimension === dimension &&
        row.segmentId === segmentId &&
        row.fiscalPeriod === snapshot.fiscalPeriod &&
        row.source === source,
    ) ?? null
  );
}
