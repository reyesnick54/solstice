import { median, weightedMean, weightedStdDev } from './numeric.ts';
import type {
  ComparableMultipleObservation,
  PeerConsensusStrength,
  PeerPanelFragility,
  PeerSelectionState,
  PeerValuationDispersion,
} from './types.ts';

export function computePeerValuationDispersion(
  observations: readonly ComparableMultipleObservation[],
): PeerValuationDispersion {
  const values = observations.map((o) => o.impliedEquityValue);
  const weights = observations.map((o) => o.compositeWeight);
  const mean = weightedMean(values, weights);
  const std = weightedStdDev(values, weights);
  const sorted = [...values].sort((a, b) => a - b);
  const p25 = percentile(sorted, 25);
  const p75 = percentile(sorted, 75);
  const cv = mean !== 0 ? std / Math.abs(mean) : 0;

  return Object.freeze({
    coefficientOfVariation: cv,
    interquartileRange: p75 - p25,
    weightedStdDev: std,
    peerCount: observations.length,
  });
}

export function computePeerConsensusStrength(
  observations: readonly ComparableMultipleObservation[],
  selection: PeerSelectionState,
): PeerConsensusStrength {
  const values = observations.map((o) => o.impliedEquityValue);
  const weights = observations.map((o) => o.compositeWeight);
  const med = median(values);
  const agreement = values.length
    ? values.filter((v) => Math.abs(v - med) / (Math.abs(med) || 1) < 0.15).length / values.length
    : 0;

  const blendedEntries = Object.entries(selection.blendedWeights).sort((a, b) => b[1] - a[1]);
  const dominantClusterShare = blendedEntries.slice(0, 3).reduce((s, [, w]) => s + w, 0);
  const totalWeight = blendedEntries.reduce((s, [, w]) => s + w, 0);
  const normalizedDominant = totalWeight > 0 ? dominantClusterShare / totalWeight : 0;

  const methodAgreement =
    selection.algorithmsUsed.length > 0
      ? selection.methodScores.filter((s) => s.method === 'BLENDED_PEER_SCORE').length /
        Math.max(1, selection.selectedPeerIds.length)
      : 0;

  const score = clamp01(0.5 * agreement + 0.3 * normalizedDominant + 0.2 * Math.min(1, methodAgreement));

  return Object.freeze({
    score,
    dominantClusterShare: normalizedDominant,
    methodAgreement: clamp01(methodAgreement),
  });
}

export function computePeerPanelFragility(
  observations: readonly ComparableMultipleObservation[],
  selection: PeerSelectionState,
  dispersion: PeerValuationDispersion,
): PeerPanelFragility {
  const weights = observations.map((o) => o.compositeWeight);
  const total = weights.reduce((a, b) => a + b, 0);
  const maxWeight = weights.length ? Math.max(...weights) : 0;
  const topPeerWeightShare = total > 0 ? maxWeight / total : 0;

  const exclusionSensitivity = selection.excludedPeers.length / Math.max(1, selection.selectedPeerIds.length);
  const dispersionDriver = dispersion.coefficientOfVariation > 0.35 ? 'high_dispersion' : null;
  const concentrationDriver = topPeerWeightShare > 0.35 ? 'peer_concentration' : null;
  const drivers = [dispersionDriver, concentrationDriver].filter((d): d is string => d !== null);

  const score = clamp01(0.4 * topPeerWeightShare + 0.35 * dispersion.coefficientOfVariation + 0.25 * exclusionSensitivity);

  return Object.freeze({
    score,
    topPeerWeightShare,
    exclusionSensitivity,
    drivers: Object.freeze(drivers),
  });
}

function percentile(sorted: readonly number[], pct: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const rank = (pct / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const weight = rank - lo;
  return sorted[lo]! * (1 - weight) + sorted[hi]! * weight;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
