import type { UtcInstant } from '@solstice/domain';

import type { HeliosMultiAssetBarStorePort } from '../index-bars.ts';
import type { CorrelationCluster, CorrelationMatrix, CorrelationPair } from './types.ts';

const MIN_SAMPLES = 5;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function alignedLogReturns(
  barsA: readonly { readonly knowableAt: UtcInstant; readonly closeMinor: bigint }[],
  barsB: readonly { readonly knowableAt: UtcInstant; readonly closeMinor: bigint }[],
): readonly number[] {
  const byTimeB = new Map<string, bigint>();
  for (const bar of barsB) {
    byTimeB.set(bar.knowableAt, bar.closeMinor);
  }
  const returns: number[] = [];
  let prevA: bigint | null = null;
  let prevB: bigint | null = null;
  for (const bar of barsA) {
    const closeB = byTimeB.get(bar.knowableAt);
    if (closeB === undefined) {
      continue;
    }
    if (prevA !== null && prevB !== null && prevA > 0n && prevB > 0n && bar.closeMinor > 0n && closeB > 0n) {
      const retA = Math.log(Number(bar.closeMinor) / Number(prevA));
      const retB = Math.log(Number(closeB) / Number(prevB));
      if (Number.isFinite(retA) && Number.isFinite(retB)) {
        returns.push(retA - retB);
      }
    }
    prevA = bar.closeMinor;
    prevB = closeB;
  }
  return Object.freeze(returns);
}

function pearsonCorrelation(seriesA: readonly number[], seriesB: readonly number[]): number | null {
  if (seriesA.length !== seriesB.length || seriesA.length < MIN_SAMPLES) {
    return null;
  }
  const n = seriesA.length;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i += 1) {
    sumA += seriesA[i] ?? 0;
    sumB += seriesB[i] ?? 0;
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = (seriesA[i] ?? 0) - meanA;
    const db = (seriesB[i] ?? 0) - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) {
    return null;
  }
  return cov / Math.sqrt(varA * varB);
}

function computePairCorrelation(
  instrumentAId: string,
  instrumentBId: string,
  barStore: HeliosMultiAssetBarStorePort,
  asOf: UtcInstant,
): CorrelationPair {
  const barsA = barStore.barsFor(instrumentAId, asOf);
  const barsB = barStore.barsFor(instrumentBId, asOf);
  const returnsA: number[] = [];
  const returnsB: number[] = [];
  const byTimeB = new Map<string, bigint>();
  for (const bar of barsB) {
    byTimeB.set(bar.knowableAt, bar.closeMinor);
  }
  let prevA: bigint | null = null;
  let prevB: bigint | null = null;
  for (const bar of barsA) {
    const closeB = byTimeB.get(bar.knowableAt);
    if (closeB === undefined) {
      continue;
    }
    if (prevA !== null && prevB !== null && prevA > 0n && prevB > 0n && bar.closeMinor > 0n && closeB > 0n) {
      returnsA.push(Math.log(Number(bar.closeMinor) / Number(prevA)));
      returnsB.push(Math.log(Number(closeB) / Number(prevB)));
    }
    prevA = bar.closeMinor;
    prevB = closeB;
  }
  const sampleCount = Math.min(returnsA.length, returnsB.length);
  const correlation = pearsonCorrelation(returnsA.slice(0, sampleCount), returnsB.slice(0, sampleCount));
  return Object.freeze({
    instrumentAId,
    instrumentBId,
    correlation,
    sampleCount,
    method: correlation === null ? 'INSUFFICIENT_DATA' : 'PEARSON_LOG_RETURN',
    provenanceKind: 'MODEL_ESTIMATED',
    sourceRefs: Object.freeze([
      'helios:m17:bar_store',
      `helios:m17:pair:${pairKey(instrumentAId, instrumentBId)}`,
    ]),
  });
}

function buildClusters(pairs: readonly CorrelationPair[], instrumentIds: readonly string[]): readonly CorrelationCluster[] {
  const adjacency = new Map<string, Set<string>>();
  for (const id of instrumentIds) {
    adjacency.set(id, new Set());
  }
  for (const pair of pairs) {
    if (pair.correlation === null || pair.correlation < 0.6) {
      continue;
    }
    adjacency.get(pair.instrumentAId)?.add(pair.instrumentBId);
    adjacency.get(pair.instrumentBId)?.add(pair.instrumentAId);
  }
  const visited = new Set<string>();
  const clusters: CorrelationCluster[] = [];
  for (const start of instrumentIds) {
    if (visited.has(start)) {
      continue;
    }
    const queue = [start];
    const members: string[] = [];
    visited.add(start);
    while (queue.length > 0) {
      const current = queue.pop()!;
      members.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    if (members.length < 2) {
      continue;
    }
    const memberPairs = pairs.filter(
      (row) =>
        members.includes(row.instrumentAId) &&
        members.includes(row.instrumentBId) &&
        row.correlation !== null,
    );
    const averagePairwiseCorrelation =
      memberPairs.length === 0
        ? null
        : memberPairs.reduce((sum, row) => sum + (row.correlation ?? 0), 0) / memberPairs.length;
    clusters.push(
      Object.freeze({
        clusterId: `cluster_${members.slice().sort().join('_')}`,
        instrumentIds: Object.freeze([...members.sort()]),
        averagePairwiseCorrelation,
        provenanceKind: 'MODEL_ESTIMATED',
        sourceRefs: Object.freeze(['helios:m17:cluster_detection']),
      }),
    );
  }
  return Object.freeze(clusters);
}

export function computeCorrelationMatrix(input: {
  readonly asOf: UtcInstant;
  readonly instrumentIds: readonly string[];
  readonly barStore: HeliosMultiAssetBarStorePort;
}): CorrelationMatrix {
  const uniqueIds = Object.freeze([...new Set(input.instrumentIds)]);
  const pairs: CorrelationPair[] = [];
  for (let i = 0; i < uniqueIds.length; i += 1) {
    for (let j = i + 1; j < uniqueIds.length; j += 1) {
      const a = uniqueIds[i]!;
      const b = uniqueIds[j]!;
      pairs.push(computePairCorrelation(a, b, input.barStore, input.asOf));
    }
  }
  return Object.freeze({
    asOf: input.asOf,
    pairs: Object.freeze(pairs),
    clusters: buildClusters(pairs, uniqueIds),
    simulationOnly: true,
  });
}

export function lookupPairCorrelation(
  matrix: CorrelationMatrix,
  instrumentAId: string,
  instrumentBId: string,
): CorrelationPair | undefined {
  const key = pairKey(instrumentAId, instrumentBId);
  return matrix.pairs.find((row) => pairKey(row.instrumentAId, row.instrumentBId) === key);
}

/** @internal exported for tests */
export function __alignedLogReturnsForTest(
  barsA: readonly { readonly knowableAt: UtcInstant; readonly closeMinor: bigint }[],
  barsB: readonly { readonly knowableAt: UtcInstant; readonly closeMinor: bigint }[],
): readonly number[] {
  return alignedLogReturns(barsA, barsB);
}
