import type { PeerCandidate, PeerSimilarityVector, SimilarityDimensionValue } from './types.ts';
import { PEER_SIMILARITY_DIMENSIONS, type PeerSimilarityDimension } from './taxonomy.ts';

const NUMERIC_DIMS: readonly PeerSimilarityDimension[] = [
  'marketCapitalization',
  'revenueScale',
  'revenueGrowth',
  'grossMargin',
  'operatingMargin',
  'ebitdaMargin',
  'fcfMargin',
  'roic',
  'capitalIntensity',
  'leverage',
  'beta',
  'cyclicality',
  'customerConcentration',
  'revenueRecurrence',
  'assetIntensity',
];

const CATEGORICAL_DIMS: readonly PeerSimilarityDimension[] = [
  'sector',
  'industry',
  'subindustry',
  'businessModel',
  'geography',
  'currency',
];

export function buildPeerSimilarityVector(peer: PeerCandidate): PeerSimilarityVector {
  const dimensions: Partial<Record<PeerSimilarityDimension, SimilarityDimensionValue>> = {};
  const populated: PeerSimilarityDimension[] = [];

  for (const dim of CATEGORICAL_DIMS) {
    const value = readCategorical(peer, dim);
    if (value !== undefined && value.length > 0) {
      dimensions[dim] = { kind: 'categorical', value };
      populated.push(dim);
    }
  }

  for (const dim of NUMERIC_DIMS) {
    const value = readNumeric(peer, dim);
    if (value !== undefined && Number.isFinite(value)) {
      const scale = dim === 'marketCapitalization' || dim === 'revenueScale' ? 'log' : 'linear';
      dimensions[dim] = { kind: 'numeric', value, scale };
      populated.push(dim);
    }
  }

  if (peer.market.factorExposures) {
    dimensions.factorExposures = {
      kind: 'numeric',
      value: Object.values(peer.market.factorExposures).reduce((a, b) => a + Math.abs(b), 0),
      scale: 'linear',
    };
    populated.push('factorExposures');
  }

  const coverage = populated.length / PEER_SIMILARITY_DIMENSIONS.length;
  return Object.freeze({
    peerId: peer.peerId,
    dimensions: Object.freeze(dimensions),
    populatedDimensions: Object.freeze(populated),
    dataQualityScore: coverage,
  });
}

function readCategorical(peer: PeerCandidate, dim: PeerSimilarityDimension): string | undefined {
  const c = peer.classification;
  switch (dim) {
    case 'sector':
      return c.sector;
    case 'industry':
      return c.industry;
    case 'subindustry':
      return c.subindustry;
    case 'businessModel':
      return c.businessModel;
    case 'geography':
      return c.geography;
    case 'currency':
      return c.currency;
    default:
      return undefined;
  }
}

function readNumeric(peer: PeerCandidate, dim: PeerSimilarityDimension): number | undefined {
  const f = peer.fundamentals;
  const m = peer.market;
  switch (dim) {
    case 'marketCapitalization':
      return m.marketCap;
    case 'revenueScale':
      return f.revenue;
    case 'revenueGrowth':
      return f.revenueGrowth;
    case 'grossMargin':
      return f.grossMargin;
    case 'operatingMargin':
      return f.operatingMargin;
    case 'ebitdaMargin':
      return f.ebitdaMargin;
    case 'fcfMargin':
      return f.fcfMargin;
    case 'roic':
      return f.roic;
    case 'capitalIntensity':
      return f.capitalIntensity;
    case 'leverage':
      return f.leverage;
    case 'beta':
      return m.beta;
    case 'cyclicality':
      return f.cyclicality;
    case 'customerConcentration':
      return f.customerConcentration;
    case 'revenueRecurrence':
      return f.revenueRecurrence;
    case 'assetIntensity':
      return f.assetIntensity;
    default:
      return undefined;
  }
}

export function similarityFeatureVector(
  target: PeerSimilarityVector,
  peer: PeerSimilarityVector,
): readonly number[] {
  const shared = target.populatedDimensions.filter((d) => peer.populatedDimensions.includes(d));
  if (shared.length === 0) return Object.freeze([1]);

  const features: number[] = [];
  for (const dim of shared) {
    const a = target.dimensions[dim];
    const b = peer.dimensions[dim];
    if (!a || !b) continue;
    if (a.kind === 'categorical' && b.kind === 'categorical') {
      features.push(a.value === b.value ? 0 : 1);
    } else if (a.kind === 'numeric' && b.kind === 'numeric') {
      const av = a.scale === 'log' ? Math.log10(Math.max(a.value, 1)) : a.value;
      const bv = b.scale === 'log' ? Math.log10(Math.max(b.value, 1)) : b.value;
      features.push(Math.abs(av - bv));
    }
  }
  return Object.freeze(features.length > 0 ? features : [1]);
}
