import { createHash } from 'node:crypto';

import type { GenomeNodeParams, StrategyGenome } from '../os05/types.ts';

import { behaviorVector } from './behavior-fingerprint.ts';
import { l1Distance } from './math.ts';
import { structuralDistance } from './semantic-fingerprint.ts';
import type {
  NoveltyDistanceWeights,
  PopulationDiversityArchiveEntry,
  StrategyBehaviorFingerprint,
  StrategySemanticFingerprint,
} from './types.ts';

export function parameterDistance(paramsA: GenomeNodeParams, paramsB: GenomeNodeParams): number {
  const ha = paramHashString(paramsA);
  const hb = paramHashString(paramsB);
  if (ha === hb) {
    return 0;
  }
  const keys = new Set<string>([...Object.keys(paramsA), ...Object.keys(paramsB)]);
  let sum = 0;
  let c = 0;
  for (const k of keys) {
    const va = paramsA[k];
    const vb = paramsB[k];
    if (va === undefined || vb === undefined) {
      sum += 1;
    } else if (typeof va === 'number' && typeof vb === 'number') {
      sum += Math.abs(va - vb) / (1 + Math.max(Math.abs(va), Math.abs(vb)));
    } else if (va !== vb) {
      sum += 1;
    }
    c += 1;
  }
  return c === 0 ? 1 : sum / c;
}

function paramHashString(params: GenomeNodeParams): string {
  const keys = Object.keys(params).sort();
  return createHash('sha256')
    .update(JSON.stringify(keys.map((k) => [k, params[k]])), 'utf8')
    .digest('hex');
}

export function behavioralDistance(a: StrategyBehaviorFingerprint, b: StrategyBehaviorFingerprint): number {
  return l1Distance(behaviorVector(a), behaviorVector(b));
}

export function combinedDistance(
  semA: StrategySemanticFingerprint,
  semB: StrategySemanticFingerprint,
  paramsA: GenomeNodeParams,
  paramsB: GenomeNodeParams,
  behaviorA: StrategyBehaviorFingerprint,
  behaviorB: StrategyBehaviorFingerprint,
  weights: NoveltyDistanceWeights,
): number {
  const s = structuralDistance(semA, semB);
  const p = parameterDistance(paramsA, paramsB);
  const b = behavioralDistance(behaviorA, behaviorB);
  const wSum = weights.structural + weights.parameter + weights.behavioral;
  if (wSum <= 0) {
    return 0;
  }
  return (weights.structural * s + weights.parameter * p + weights.behavioral * b) / wSum;
}

export function nearestNeighborInArchive(
  sem: StrategySemanticFingerprint,
  parameters: GenomeNodeParams,
  behavior: StrategyBehaviorFingerprint,
  archive: readonly PopulationDiversityArchiveEntry[],
  weights: NoveltyDistanceWeights,
): { readonly distance: number; readonly nearestGenomeId: string | null } {
  if (archive.length === 0) {
    return { distance: 1, nearestGenomeId: null };
  }
  let best = Number.POSITIVE_INFINITY;
  let bestId: string | null = null;
  for (const e of archive) {
    const d = combinedDistance(sem, e.semantic, parameters, e.parameters, behavior, e.behavior, weights);
    if (d < best) {
      best = d;
      bestId = e.genomeId;
    }
  }
  return { distance: best, nearestGenomeId: bestId };
}

export function genomeStructureParameterDistance(
  semA: StrategySemanticFingerprint,
  semB: StrategySemanticFingerprint,
  paramsA: GenomeNodeParams,
  paramsB: GenomeNodeParams,
  wStructural: number,
  wParameter: number,
): number {
  const s = structuralDistance(semA, semB);
  const p = parameterDistance(paramsA, paramsB);
  const w = wStructural + wParameter;
  if (w <= 0) {
    return 0;
  }
  return (wStructural * s + wParameter * p) / w;
}
