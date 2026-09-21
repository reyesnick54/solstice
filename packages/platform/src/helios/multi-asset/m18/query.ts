import type { CorrelationCluster } from '../m17/types.ts';
import type { ExposureAggregate, ExposureDimension, PortfolioExposureGraph } from './types.ts';

function aggregateFor(
  graph: PortfolioExposureGraph,
  dimension: ExposureDimension,
  bucketKey?: string,
): readonly ExposureAggregate[] {
  const rows = graph.aggregates[dimension] ?? [];
  if (bucketKey === undefined) {
    return rows;
  }
  return Object.freeze(rows.filter((row) => row.bucketKey === bucketKey));
}

export function queryTotalExposureMinor(
  graph: PortfolioExposureGraph,
  dimension: ExposureDimension,
  bucketKey?: string,
): { readonly net: bigint; readonly gross: bigint } {
  const rows = aggregateFor(graph, dimension, bucketKey);
  const net = rows.reduce((sum, row) => sum + row.netExposureMinor, 0n);
  const gross = rows.reduce((sum, row) => sum + row.grossExposureMinor, 0n);
  return Object.freeze({ net, gross });
}

export function queryConcentrationBps(
  graph: PortfolioExposureGraph,
  dimension: ExposureDimension,
  bucketKey: string,
): number {
  const row = aggregateFor(graph, dimension, bucketKey)[0];
  return row?.concentrationBps ?? 0;
}

export function queryTopCorrelatedCluster(graph: PortfolioExposureGraph): CorrelationCluster | null {
  return graph.topCorrelatedCluster;
}

export function queryStrategyConcentration(graph: PortfolioExposureGraph): readonly ExposureAggregate[] {
  return aggregateFor(graph, 'STRATEGY_CONCENTRATION');
}

export function queryVenueConcentration(graph: PortfolioExposureGraph): readonly ExposureAggregate[] {
  return aggregateFor(graph, 'VENUE_CONCENTRATION');
}

export function queryTechnologyGrowthExposureMinor(graph: PortfolioExposureGraph): bigint {
  return queryTotalExposureMinor(graph, 'TECHNOLOGY_GROWTH_EXPOSURE', 'TECHNOLOGY_GROWTH').gross;
}

export function queryCryptoExposureMinor(graph: PortfolioExposureGraph): bigint {
  return queryTotalExposureMinor(graph, 'CRYPTO_EXPOSURE', 'CRYPTO').gross;
}

export function queryGoldExposureMinor(graph: PortfolioExposureGraph): bigint {
  return queryTotalExposureMinor(graph, 'GOLD_METALS_EXPOSURE', 'GOLD_METALS').gross;
}

export function queryOilExposureMinor(graph: PortfolioExposureGraph): bigint {
  return queryTotalExposureMinor(graph, 'ENERGY_EXPOSURE', 'ENERGY').gross;
}

export function queryUsdExposureMinor(graph: PortfolioExposureGraph): bigint {
  return queryTotalExposureMinor(graph, 'USD_EXPOSURE', 'USD').gross;
}

export function queryProvenanceKinds(
  graph: PortfolioExposureGraph,
  dimension: ExposureDimension,
): readonly string[] {
  const rows = graph.contributions.filter((row) => row.dimension === dimension);
  return Object.freeze([...new Set(rows.map((row) => row.provenanceKind))]);
}
