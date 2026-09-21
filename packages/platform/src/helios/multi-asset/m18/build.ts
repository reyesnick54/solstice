import type { UtcInstant } from '@solstice/domain';

import { resolveInstrumentEconomicMetadata } from './economic-relationships/metadata.ts';
import type { CorrelationCluster, CorrelationMatrix } from '../m17/types.ts';
import type {
  AppliedEconomicRelationship,
  ExposureAggregate,
  ExposureContribution,
  ExposureDimension,
  ExposureProvenanceKind,
  InstrumentExposureMetadata,
  PortfolioExposureGraph,
  PortfolioExposureGraphBuildInput,
  PortfolioPositionFact,
} from './types.ts';

const RESERVED_UNCOMPUTED_DIMENSIONS = new Set<ExposureDimension>([
  'DURATION',
  'RATES',
  'OPTIONS_GREEKS',
  'GEOGRAPHIC',
]);

function absBig(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function bps(numerator: bigint, denominator: bigint): number {
  if (denominator === 0n) {
    return 0;
  }
  return Number((numerator * 10_000n) / denominator);
}

function openPositions(positions: readonly PortfolioPositionFact[]): readonly PortfolioPositionFact[] {
  return Object.freeze(
    positions.filter((row) => row.status === 'OPEN' && row.marketValueMinor !== 0n),
  );
}

function contribution(input: ExposureContribution): ExposureContribution {
  return Object.freeze(input);
}

function aggregateRows(
  rows: readonly ExposureContribution[],
  totalGross: bigint,
): Partial<Record<ExposureDimension, readonly ExposureAggregate[]>> {
  const grouped = new Map<string, ExposureContribution[]>();
  for (const row of rows) {
    const key = `${row.dimension}::${row.bucketKey}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }
  const out: Partial<Record<ExposureDimension, readonly ExposureAggregate[]>> = {};
  for (const [key, bucket] of grouped) {
    const [dimension, bucketKey] = key.split('::') as [ExposureDimension, string];
    const net = bucket.reduce((sum, row) => sum + row.signedExposureMinor, 0n);
    const gross = bucket.reduce((sum, row) => sum + row.grossExposureMinor, 0n);
    const provenanceKind = bucket.some((row) => row.provenanceKind === 'MODEL_ESTIMATED')
      ? 'MODEL_ESTIMATED'
      : bucket.some((row) => row.provenanceKind === 'DERIVED')
        ? 'DERIVED'
        : 'DIRECTLY_MEASURED';
    const sourceRefs = Object.freeze([...new Set(bucket.flatMap((row) => row.sourceRefs))]);
    const rowsForDimension = [...(out[dimension] ?? [])];
    rowsForDimension.push(
      Object.freeze({
        dimension,
        bucketKey,
        netExposureMinor: net,
        grossExposureMinor: gross,
        concentrationBps: bps(gross, totalGross),
        provenanceKind,
        sourceRefs,
      }),
    );
    out[dimension] = rowsForDimension;
  }
  for (const dimension of Object.keys(out) as ExposureDimension[]) {
    out[dimension] = Object.freeze(out[dimension]!);
  }
  return out;
}

function addFactorContributions(
  position: PortfolioPositionFact,
  instrument: InstrumentExposureMetadata,
  totalGross: bigint,
  rows: ExposureContribution[],
): void {
  const signed = position.side === 'SHORT' ? -position.marketValueMinor : position.marketValueMinor;
  const gross = absBig(position.marketValueMinor);
  const base = {
    positionId: position.positionId,
    instrumentId: position.instrumentId,
    signedExposureMinor: signed,
    grossExposureMinor: gross,
  };

  rows.push(
    contribution({
      ...base,
      contributionId: `${position.positionId}:instrument`,
      dimension: 'INSTRUMENT_EXPOSURE',
      bucketKey: position.instrumentId,
      provenanceKind: 'DIRECTLY_MEASURED',
      sourceRefs: Object.freeze(['helios:m18:position_market_value', ...instrument.sourceRefs]),
    }),
    contribution({
      ...base,
      contributionId: `${position.positionId}:asset_class`,
      dimension: 'ASSET_CLASS_EXPOSURE',
      bucketKey: instrument.assetClass,
      provenanceKind: 'DERIVED',
      sourceRefs: Object.freeze(['helios:m18:asset_class', ...instrument.sourceRefs]),
    }),
    contribution({
      ...base,
      contributionId: `${position.positionId}:gross`,
      dimension: 'GROSS_EXPOSURE',
      bucketKey: 'PORTFOLIO',
      provenanceKind: 'DIRECTLY_MEASURED',
      sourceRefs: Object.freeze(['helios:m18:gross']),
    }),
    contribution({
      ...base,
      contributionId: `${position.positionId}:net`,
      dimension: 'NET_EXPOSURE',
      bucketKey: 'PORTFOLIO',
      provenanceKind: 'DIRECTLY_MEASURED',
      sourceRefs: Object.freeze(['helios:m18:net']),
    }),
    contribution({
      ...base,
      contributionId: `${position.positionId}:long_short`,
      dimension: position.side === 'LONG' ? 'LONG_EXPOSURE' : 'SHORT_EXPOSURE',
      bucketKey: position.side,
      provenanceKind: 'DIRECTLY_MEASURED',
      sourceRefs: Object.freeze(['helios:m18:side']),
    }),
    contribution({
      ...base,
      contributionId: `${position.positionId}:currency`,
      dimension: 'CURRENCY_EXPOSURE',
      bucketKey: position.currency,
      provenanceKind: 'DERIVED',
      sourceRefs: Object.freeze(['helios:m18:currency', ...instrument.sourceRefs]),
    }),
    contribution({
      ...base,
      contributionId: `${position.positionId}:venue`,
      dimension: 'VENUE_CONCENTRATION',
      bucketKey: position.venueId,
      provenanceKind: 'DIRECTLY_MEASURED',
      sourceRefs: Object.freeze(['helios:m18:venue', position.providerId]),
    }),
    contribution({
      ...base,
      contributionId: `${position.positionId}:strategy`,
      dimension: 'STRATEGY_CONCENTRATION',
      bucketKey: position.strategyId,
      provenanceKind: 'DIRECTLY_MEASURED',
      sourceRefs: Object.freeze(['helios:m18:strategy']),
    }),
  );

  if (position.currency === 'USD' || instrument.tradingCurrency === 'USD' || instrument.settlementCurrency === 'USD') {
    rows.push(
      contribution({
        ...base,
        contributionId: `${position.positionId}:usd`,
        dimension: 'USD_EXPOSURE',
        bucketKey: 'USD',
        provenanceKind: 'DERIVED',
        sourceRefs: Object.freeze(['helios:m18:usd_leg']),
      }),
    );
  }

  const economic = resolveInstrumentEconomicMetadata(position.instrumentId);
  if (economic?.sector) {
    rows.push(
      contribution({
        ...base,
        contributionId: `${position.positionId}:sector`,
        dimension: 'SECTOR_EXPOSURE',
        bucketKey: economic.sector,
        provenanceKind: 'DERIVED',
        sourceRefs: Object.freeze([...economic.sourceRefs, 'helios:m18:sector']),
      }),
    );
  }
  if (economic?.factorTags.includes('TECHNOLOGY') || economic?.factorTags.includes('GROWTH')) {
    rows.push(
      contribution({
        ...base,
        contributionId: `${position.positionId}:tech_growth`,
        dimension: 'TECHNOLOGY_GROWTH_EXPOSURE',
        bucketKey: 'TECHNOLOGY_GROWTH',
        provenanceKind: 'DERIVED',
        sourceRefs: Object.freeze([...economic.sourceRefs, 'helios:m18:tech_growth']),
      }),
    );
  }
  if (economic?.factorTags.includes('CRYPTO') || instrument.assetClass === 'CRYPTO_SPOT') {
    rows.push(
      contribution({
        ...base,
        contributionId: `${position.positionId}:crypto`,
        dimension: 'CRYPTO_EXPOSURE',
        bucketKey: 'CRYPTO',
        provenanceKind: instrument.assetClass === 'CRYPTO_SPOT' ? 'DIRECTLY_MEASURED' : 'DERIVED',
        sourceRefs: Object.freeze([...(economic?.sourceRefs ?? instrument.sourceRefs), 'helios:m18:crypto']),
      }),
    );
  }
  if (economic?.factorTags.includes('METALS') || instrument.symbol === 'GLD' || instrument.symbol === 'GOLD') {
    rows.push(
      contribution({
        ...base,
        contributionId: `${position.positionId}:gold_metals`,
        dimension: 'GOLD_METALS_EXPOSURE',
        bucketKey: 'GOLD_METALS',
        provenanceKind: 'DERIVED',
        sourceRefs: Object.freeze([...(economic?.sourceRefs ?? instrument.sourceRefs), 'helios:m18:gold_metals']),
      }),
    );
  }
  if (economic?.factorTags.includes('ENERGY')) {
    rows.push(
      contribution({
        ...base,
        contributionId: `${position.positionId}:energy`,
        dimension: 'ENERGY_EXPOSURE',
        bucketKey: 'ENERGY',
        provenanceKind: 'DERIVED',
        sourceRefs: Object.freeze([...economic.sourceRefs, 'helios:m18:energy']),
      }),
    );
  }
  if (economic?.factorTags.includes('COMMODITY') || instrument.assetClass === 'COMMODITY' || instrument.assetClass === 'FUTURE') {
    rows.push(
      contribution({
        ...base,
        contributionId: `${position.positionId}:commodity`,
        dimension: 'COMMODITY_EXPOSURE',
        bucketKey: 'COMMODITY',
        provenanceKind: 'DERIVED',
        sourceRefs: Object.freeze([...(economic?.sourceRefs ?? instrument.sourceRefs), 'helios:m18:commodity']),
      }),
    );
  }
  if (economic?.volatilitySensitivity) {
    rows.push(
      contribution({
        ...base,
        contributionId: `${position.positionId}:volatility`,
        dimension: 'VOLATILITY_EXPOSURE',
        bucketKey: economic.volatilitySensitivity,
        provenanceKind: 'MODEL_ESTIMATED',
        sourceRefs: Object.freeze([...economic.sourceRefs, 'helios:m18:volatility_sensitivity']),
      }),
    );
  }
  if (economic?.equityBetaToBenchmark !== null && economic?.equityBetaToBenchmark !== undefined) {
    const betaScaled = BigInt(Math.round(Number(gross) * economic.equityBetaToBenchmark));
    rows.push(
      contribution({
        positionId: position.positionId,
        instrumentId: position.instrumentId,
        contributionId: `${position.positionId}:equity_beta`,
        dimension: 'EQUITY_BETA',
        bucketKey: economic.benchmarkInstrumentId ?? 'MARKET',
        signedExposureMinor: position.side === 'SHORT' ? -betaScaled : betaScaled,
        grossExposureMinor: betaScaled,
        provenanceKind: 'MODEL_ESTIMATED',
        sourceRefs: Object.freeze([...economic.sourceRefs, 'helios:m18:equity_beta']),
      }),
    );
  }

  for (const dimension of RESERVED_UNCOMPUTED_DIMENSIONS) {
    void dimension;
  }
  void totalGross;
}

function applyRelationships(
  positions: readonly PortfolioPositionFact[],
  economicRelationships: PortfolioExposureGraphBuildInput['economicRelationships'],
): readonly AppliedEconomicRelationship[] {
  const positionIdsByInstrument = new Map<string, string[]>();
  for (const position of positions) {
    const rows = positionIdsByInstrument.get(position.instrumentId) ?? [];
    rows.push(position.positionId);
    positionIdsByInstrument.set(position.instrumentId, rows);
  }
  const applied: AppliedEconomicRelationship[] = [];
  for (const rel of economicRelationships.relationships) {
    const fromPositions = positionIdsByInstrument.get(rel.fromInstrumentId) ?? [];
    const toPositions = positionIdsByInstrument.get(rel.toInstrumentId) ?? [];
    if (fromPositions.length === 0 && toPositions.length === 0) {
      continue;
    }
    applied.push(
      Object.freeze({
        relationshipId: rel.relationshipId,
        kind: rel.kind,
        fromInstrumentId: rel.fromInstrumentId,
        toInstrumentId: rel.toInstrumentId,
        contributingPositionIds: Object.freeze([...fromPositions, ...toPositions]),
        provenanceKind: rel.provenanceKind,
        sourceRefs: rel.sourceRefs,
      }),
    );
  }
  return Object.freeze(applied);
}

function selectTopCluster(matrix: CorrelationMatrix | null | undefined): CorrelationCluster | null {
  if (!matrix || matrix.clusters.length === 0) {
    return null;
  }
  return [...matrix.clusters].sort((a, b) => {
    const sizeDelta = b.instrumentIds.length - a.instrumentIds.length;
    if (sizeDelta !== 0) {
      return sizeDelta;
    }
    return (b.averagePairwiseCorrelation ?? 0) - (a.averagePairwiseCorrelation ?? 0);
  })[0] ?? null;
}

export function buildPortfolioExposureGraph(input: PortfolioExposureGraphBuildInput): PortfolioExposureGraph {
  const instrumentsById = new Map(input.instruments.map((row) => [row.instrumentId, row]));
  const active = openPositions(input.positions);
  const contributions: ExposureContribution[] = [];
  const totalGross = active.reduce((sum, row) => sum + absBig(row.marketValueMinor), 0n);
  const totalNet = active.reduce(
    (sum, row) => sum + (row.side === 'SHORT' ? -row.marketValueMinor : row.marketValueMinor),
    0n,
  );

  for (const position of active) {
    const instrument = instrumentsById.get(position.instrumentId);
    if (!instrument) {
      continue;
    }
    addFactorContributions(position, instrument, totalGross, contributions);
  }

  return Object.freeze({
    graphId: input.graphId,
    portfolioId: input.portfolioId,
    asOf: input.asOf,
    reportingCurrency: input.reportingCurrency,
    totalGrossExposureMinor: totalGross,
    totalNetExposureMinor: totalNet,
    positions: active,
    contributions: Object.freeze(contributions),
    aggregates: Object.freeze(aggregateRows(contributions, totalGross)),
    correlationMatrix: input.correlationMatrix ?? null,
    topCorrelatedCluster: selectTopCluster(input.correlationMatrix),
    economicRelationships: input.economicRelationships,
    appliedRelationships: applyRelationships(active, input.economicRelationships),
    simulationOnly: true,
  });
}

export function positionFromProposedTrade(
  positionId: string,
  trade: {
    readonly instrumentId: string;
    readonly strategyId: string;
    readonly venueId: string;
    readonly providerId: string;
    readonly assetClass: string;
    readonly currency: string;
    readonly side: 'BUY' | 'SELL';
    readonly quantityUnits: bigint;
    readonly marketValueMinor: bigint;
  },
  asOf: UtcInstant,
): PortfolioPositionFact {
  return Object.freeze({
    positionId,
    instrumentId: trade.instrumentId,
    strategyId: trade.strategyId,
    venueId: trade.venueId,
    providerId: trade.providerId,
    assetClass: trade.assetClass,
    currency: trade.currency,
    quantityUnits: trade.quantityUnits,
    marketValueMinor: absBig(trade.marketValueMinor),
    side: trade.side === 'SELL' ? 'SHORT' : 'LONG',
    status: 'OPEN',
    openedAt: asOf,
    closedAt: null,
  });
}

export function mergePartialFill(
  position: PortfolioPositionFact,
  fillQuantityUnits: bigint,
  fillMarketValueMinor: bigint,
): PortfolioPositionFact {
  return Object.freeze({
    ...position,
    quantityUnits: position.quantityUnits + fillQuantityUnits,
    marketValueMinor: position.marketValueMinor + fillMarketValueMinor,
  });
}

export function closePosition(position: PortfolioPositionFact, closedAt: UtcInstant): PortfolioPositionFact {
  return Object.freeze({
    ...position,
    status: 'CLOSED',
    marketValueMinor: 0n,
    quantityUnits: 0n,
    closedAt,
  });
}
