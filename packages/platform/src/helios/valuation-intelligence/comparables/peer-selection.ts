import { DEFAULT_VAL08_SEED, PEER_SELECTION_METHODS, type PeerSelectionMethod } from './taxonomy.ts';
import { euclideanDistance, invertDistanceToWeight } from './numeric.ts';
import { buildPeerSimilarityVector, similarityFeatureVector } from './similarity.ts';
import type { PeerCandidate, PeerSelectionMethodScore, PeerSelectionState } from './types.ts';
import type { UtcInstant } from '@solstice/domain';

export type PeerSelectionConfig = {
  readonly maxPeers: number;
  readonly seed: number;
};

export function runPeerSelection(
  valuationTimeUtc: UtcInstant,
  target: PeerCandidate,
  eligiblePeers: readonly PeerCandidate[],
  config: PeerSelectionConfig,
): PeerSelectionState {
  const targetSim = buildPeerSimilarityVector(target);
  const peerSims = eligiblePeers.map((p) => buildPeerSimilarityVector(p));

  const methodScores: PeerSelectionMethodScore[] = [];

  for (const peer of eligiblePeers) {
    const sim = peerSims.find((s) => s.peerId === peer.peerId)!;
    const features = similarityFeatureVector(targetSim, sim);

    const fundamentalsDistance = euclideanDistance(features, new Array(features.length).fill(0));
    methodScores.push(scoreRow('FUNDAMENTALS_DISTANCE', peer.peerId, fundamentalsDistance));

    const shrinkageMahalanobis = shrinkageMahalanobisDistance(features, config.seed);
    methodScores.push(scoreRow('SHRINKAGE_MAHALANOBIS', peer.peerId, shrinkageMahalanobis));

    const factorRisk = factorRiskDistance(target, peer);
    methodScores.push(scoreRow('FACTOR_RISK_DISTANCE', peer.peerId, factorRisk));
  }

  const fundamentalsRanked = rankByMethod(methodScores, 'FUNDAMENTALS_DISTANCE');
  for (const row of constrainedNearestNeighbors(fundamentalsRanked, config.maxPeers)) {
    methodScores.push(row);
  }

  const clusterScores = deterministicClustering(eligiblePeers, target, config.seed);
  methodScores.push(...clusterScores);

  const blended = blendPeerScores(methodScores, eligiblePeers.map((p) => p.peerId));
  for (const row of blended) {
    methodScores.push(row);
  }

  const weightMap: Record<string, number> = {};
  for (const peerId of eligiblePeers.map((p) => p.peerId)) {
    weightMap[peerId] = blended.find((b) => b.peerId === peerId)?.weight ?? 0;
  }

  const selectedPeerIds = Object.entries(weightMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, config.maxPeers)
    .map(([id]) => id);

  return Object.freeze({
    valuationTimeUtc,
    targetPeerId: target.peerId,
    methodScores: Object.freeze(methodScores),
    blendedWeights: Object.freeze(weightMap),
    selectedPeerIds: Object.freeze(selectedPeerIds),
    excludedPeers: Object.freeze([]),
    algorithmsUsed: PEER_SELECTION_METHODS,
  });
}

function scoreRow(method: PeerSelectionMethod, peerId: string, distance: number): PeerSelectionMethodScore {
  return Object.freeze({
    method,
    peerId,
    distance,
    rank: 0,
    weight: invertDistanceToWeight(distance),
  });
}

function rankByMethod(
  scores: readonly PeerSelectionMethodScore[],
  method: PeerSelectionMethod,
): readonly PeerSelectionMethodScore[] {
  const filtered = scores.filter((s) => s.method === method);
  const sorted = [...filtered].sort((a, b) => a.distance - b.distance);
  return Object.freeze(sorted.map((row, idx) => Object.freeze({ ...row, rank: idx + 1 })));
}

function shrinkageMahalanobisDistance(features: readonly number[], seed: number): number {
  if (features.length === 0) return 1;
  const variance = features.reduce((s, v) => s + v * v, 0) / features.length;
  const shrinkage = 0.2 + (seed % 100) / 1000;
  const denom = Math.sqrt(variance + shrinkage);
  const norm = Math.sqrt(features.reduce((s, v) => s + v * v, 0));
  return denom > 0 ? norm / denom : norm;
}

function factorRiskDistance(target: PeerCandidate, peer: PeerCandidate): number {
  const t = target.market.factorExposures ?? {};
  const p = peer.market.factorExposures ?? {};
  const keys = new Set([...Object.keys(t), ...Object.keys(p)]);
  if (keys.size === 0) {
    const betaGap = Math.abs((target.market.beta ?? 1) - (peer.market.beta ?? 1));
    return betaGap;
  }
  let sum = 0;
  for (const key of keys) {
    const d = (t[key] ?? 0) - (p[key] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function constrainedNearestNeighbors(
  ranked: readonly PeerSelectionMethodScore[],
  maxPeers: number,
): readonly PeerSelectionMethodScore[] {
  return Object.freeze(
    ranked.slice(0, maxPeers).map((row) =>
      Object.freeze({
        ...row,
        method: 'CONSTRAINED_NEAREST_NEIGHBORS' as const,
        weight: invertDistanceToWeight(row.distance) * (1 + (maxPeers - row.rank) / maxPeers),
      }),
    ),
  );
}

function deterministicClustering(
  peers: readonly PeerCandidate[],
  target: PeerCandidate,
  seed: number,
): readonly PeerSelectionMethodScore[] {
  const k = Math.min(3, Math.max(1, peers.length));
  const centroids = peers.slice(0, k).map((p) => p.fundamentals.revenueGrowth ?? 0);
  const targetGrowth = target.fundamentals.revenueGrowth ?? 0;

  return Object.freeze(
    peers.map((peer, idx) => {
      const growth = peer.fundamentals.revenueGrowth ?? 0;
      const clusterId = idx % k;
      const centroid = centroids[clusterId] ?? 0;
      const distance = Math.abs(growth - centroid) + Math.abs(growth - targetGrowth) * 0.25 + (seed % 7) * 1e-6;
      return Object.freeze({
        method: 'DETERMINISTIC_CLUSTERING' as const,
        peerId: peer.peerId,
        distance,
        rank: 0,
        weight: invertDistanceToWeight(distance),
      });
    }),
  );
}

function blendPeerScores(
  scores: readonly PeerSelectionMethodScore[],
  peerIds: readonly string[],
): readonly PeerSelectionMethodScore[] {
  const methods: PeerSelectionMethod[] = [
    'FUNDAMENTALS_DISTANCE',
    'SHRINKAGE_MAHALANOBIS',
    'FACTOR_RISK_DISTANCE',
    'CONSTRAINED_NEAREST_NEIGHBORS',
    'DETERMINISTIC_CLUSTERING',
  ];
  const methodWeights = [0.25, 0.2, 0.15, 0.25, 0.15];

  return Object.freeze(
    peerIds.map((peerId) => {
      let blended = 0;
      let wSum = 0;
      for (let i = 0; i < methods.length; i++) {
        const method = methods[i]!;
        const mw = methodWeights[i]!;
        const row = scores.find((s) => s.method === method && s.peerId === peerId);
        if (row) {
          blended += row.weight * mw;
          wSum += mw;
        }
      }
      const weight = wSum > 0 ? blended / wSum : 0;
      return Object.freeze({
        method: 'BLENDED_PEER_SCORE' as const,
        peerId,
        distance: weight > 0 ? 1 / weight - 1 : 1e6,
        rank: 0,
        weight,
      });
    }),
  );
}

export const defaultPeerSelectionConfig = (maxPeers: number, seed?: number): PeerSelectionConfig =>
  Object.freeze({ maxPeers, seed: seed ?? DEFAULT_VAL08_SEED });
