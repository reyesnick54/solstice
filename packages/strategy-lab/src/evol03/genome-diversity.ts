import { RATIO_UNIT, ratioFromUnits, type Ratio } from '@solstice/risk';
import type { StrategyGenome } from '../os05/types.ts';
import type { ParentSimilarityAssessment } from './types.ts';

function nodeSignature(node: StrategyGenome['nodes'][number]): string {
  return `${node.kind}:${node.nodeId}:${'catalogRef' in node ? node.catalogRef : ''}`;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): Ratio {
  if (a.size === 0 && b.size === 0) {
    return ratioFromUnits(RATIO_UNIT);
  }
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) {
      inter += 1;
    }
  }
  const union = a.size + b.size - inter;
  if (union === 0) {
    return ratioFromUnits(0n);
  }
  return ratioFromUnits((BigInt(inter) * RATIO_UNIT) / BigInt(union));
}

function parameterKeyOverlap(a: StrategyGenome['parameters'], b: StrategyGenome['parameters']): Ratio {
  const keysA = new Set(Object.keys(a));
  const keysB = new Set(Object.keys(b));
  return jaccardSimilarity(keysA, keysB);
}

/**
 * Compare two genomes by structural overlap (nodes + parameter keys).
 * Near-identical pairs should not be crossed repeatedly in evolution.
 */
export function assessParentPairSimilarity(input: {
  readonly parentA: StrategyGenome;
  readonly parentB: StrategyGenome;
  readonly nearIdenticalThreshold: Ratio;
}): ParentSimilarityAssessment {
  const sigA = new Set(input.parentA.nodes.map(nodeSignature));
  const sigB = new Set(input.parentB.nodes.map(nodeSignature));
  const nodeSim = jaccardSimilarity(sigA, sigB);
  const paramOverlap = parameterKeyOverlap(input.parentA.parameters, input.parentB.parameters);
  const combinedNumerator = nodeSim.units * 7n + paramOverlap.units * 3n;
  const combined = ratioFromUnits(combinedNumerator / 10n);
  const nearIdenticalParents = combined.units >= input.nearIdenticalThreshold.units;
  return Object.freeze({
    parentA: input.parentA.genomeId,
    parentB: input.parentB.genomeId,
    jaccardNodeSimilarity: nodeSim,
    parameterKeyOverlap: paramOverlap,
    combinedSimilarity: combined,
    nearIdenticalParents,
  });
}
