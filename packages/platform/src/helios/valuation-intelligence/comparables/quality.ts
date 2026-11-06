import type { UtcInstant } from '@solstice/domain';

import type { PeerCandidate, PeerQualityAssessment, PeerSelectionState } from './types.ts';
import { buildPeerSimilarityVector } from './similarity.ts';

export function assessPeerQuality(
  valuationTimeUtc: UtcInstant,
  target: PeerCandidate,
  peer: PeerCandidate,
  selection: PeerSelectionState,
  regimeLabel?: string,
): PeerQualityAssessment {
  const sim = buildPeerSimilarityVector(peer);
  const targetSim = buildPeerSimilarityVector(target);
  const shared = sim.populatedDimensions.filter((d) => targetSim.populatedDimensions.includes(d));
  const similarityScore = shared.length / Math.max(1, targetSim.populatedDimensions.length);

  const fundamentalsCoverage = countFundamentalsFields(peer) / 12;
  const marketDataCoverage = countMarketFields(peer) / 5;

  const knowableMs = Date.parse(peer.knowableAt);
  const valuationMs = Date.parse(valuationTimeUtc);
  const recencyDays =
    Number.isFinite(knowableMs) && Number.isFinite(valuationMs)
      ? Math.max(0, (valuationMs - knowableMs) / (86400 * 1000))
      : 365;

  const regimeRelevance = regimeLabel && peer.fundamentals.cyclicality !== undefined
    ? 1 - Math.min(1, Math.abs(peer.fundamentals.cyclicality - 0.5))
    : 0.7;

  const weight = selection.blendedWeights[peer.peerId] ?? 0;
  const overallQuality = clamp01(
    0.35 * similarityScore + 0.25 * fundamentalsCoverage + 0.15 * marketDataCoverage + 0.15 * (1 - recencyDays / 400) + 0.1 * regimeRelevance,
  );

  const flags: string[] = [];
  if (weight < 0.05) flags.push('low_blended_weight');
  if (fundamentalsCoverage < 0.5) flags.push('sparse_fundamentals');
  if (recencyDays > 180) flags.push('stale_knowable');

  return Object.freeze({
    peerId: peer.peerId,
    similarityScore,
    fundamentalsCoverage,
    marketDataCoverage,
    recencyDays,
    regimeRelevance,
    overallQuality,
    flags: Object.freeze(flags),
  });
}

function countFundamentalsFields(peer: PeerCandidate): number {
  const f = peer.fundamentals;
  const fields = [
    f.revenue,
    f.netIncome,
    f.ebit,
    f.ebitda,
    f.fcf,
    f.bookEquity,
    f.grossMargin,
    f.operatingMargin,
    f.roic,
    f.revenueGrowth,
    f.leverage,
    f.investedCapital,
  ];
  return fields.filter((v) => v !== undefined && Number.isFinite(v)).length;
}

function countMarketFields(peer: PeerCandidate): number {
  const m = peer.market;
  const fields = [m.marketCap, m.enterpriseValue, m.price, m.beta, m.factorExposures];
  return fields.filter((v) => v !== undefined).length;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
