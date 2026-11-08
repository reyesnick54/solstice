import { ALPHA13_HIGH_RETURN_CORRELATION_SCALE } from './taxonomy.ts';
import type { AlphaBreadth, ForwardStrategyPortfolio } from './types.ts';

/** Canonical unordered pair id — must match interaction pairwise map keys. */
export function alpha13StrategyPairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function classifyBreadth(
  strategyCount: number,
  clusterCount: number,
  avgCorr: number,
): AlphaBreadth['classification'] {
  if (strategyCount <= 1) {
    return 'MANY_INDEPENDENT_EDGES';
  }
  const independenceRatio = clusterCount / strategyCount;
  if (independenceRatio >= 0.75 && avgCorr < 6_000) {
    return 'MANY_INDEPENDENT_EDGES';
  }
  if (independenceRatio <= 0.4 || avgCorr >= ALPHA13_HIGH_RETURN_CORRELATION_SCALE) {
    return 'ONE_EDGE_MANY_EXPRESSIONS';
  }
  return 'MIXED_INDEPENDENCE';
}

/**
 * Clusters strategies by return correlation to separate independent edges from
 * correlated expressions of one edge.
 */
export function computeAlphaBreadth(
  portfolio: ForwardStrategyPortfolio,
  pairwiseReturnCorrelationScale: Readonly<Record<string, number>>,
): AlphaBreadth {
  const legs = portfolio.legs;
  const strategyCount = legs.length;
  if (strategyCount === 0) {
    return Object.freeze({
      strategyCount: 0,
      independentEdgeClusterCount: 0,
      averagePairwiseCorrelationScale: 0,
      classification: 'MANY_INDEPENDENT_EDGES',
      breadthScoreBps: 0,
      correlatedExpressionBps: 0,
    });
  }

  const parent = legs.map((leg, index) => index);
  function find(i: number): number {
    let r = i;
    while (parent[r] !== r) {
      parent[r] = parent[parent[r]!]!;
      r = parent[r]!;
    }
    return r;
  }
  function unite(i: number, j: number): void {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) {
      parent[rj] = ri;
    }
  }

  let corrSum = 0;
  let pairCount = 0;
  for (let i = 0; i < legs.length; i += 1) {
    for (let j = i + 1; j < legs.length; j += 1) {
      const key = alpha13StrategyPairKey(legs[i]!.strategyId, legs[j]!.strategyId);
      const scale = pairwiseReturnCorrelationScale[key] ?? 0;
      corrSum += Math.abs(scale);
      pairCount += 1;
      if (scale >= ALPHA13_HIGH_RETURN_CORRELATION_SCALE) {
        unite(i, j);
      }
    }
  }

  const clusters = new Set<number>();
  for (let i = 0; i < legs.length; i += 1) {
    clusters.add(find(i));
  }
  const independentEdgeClusterCount = clusters.size;
  const averagePairwiseCorrelationScale = pairCount > 0 ? Math.round(corrSum / pairCount) : 0;
  const breadthScoreBps = Math.round((independentEdgeClusterCount * 10_000) / Math.max(1, strategyCount));
  const correlatedExpressionBps = Math.max(0, 10_000 - breadthScoreBps);
  const classification = classifyBreadth(strategyCount, independentEdgeClusterCount, averagePairwiseCorrelationScale);

  return Object.freeze({
    strategyCount,
    independentEdgeClusterCount,
    averagePairwiseCorrelationScale,
    classification,
    breadthScoreBps,
    correlatedExpressionBps,
  });
}
