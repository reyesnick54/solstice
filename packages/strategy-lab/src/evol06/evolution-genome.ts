import { attachGenomeHash } from '../os05/hash.ts';
import type { StrategyGenomeId } from '../os05/ids.ts';
import type { GenomeNodeParams, GenomeParamValue, StrategyGenome } from '../os05/types.ts';
import { nextGenomeVersion } from './evolution-worker.ts';
import type { StrategyIslandId } from './taxonomy.ts';

function cloneNodes(nodes: StrategyGenome['nodes']): StrategyGenome['nodes'] {
  return Object.freeze(nodes.map((n) => Object.freeze({ ...n })));
}

function cloneParams(params: GenomeNodeParams): GenomeNodeParams {
  return Object.freeze({ ...params });
}

/**
 * Exploit: poor candidate inherits donor graph structure (nodes); keeps recipient identity and bumps version.
 */
export function copyStructureFromDonor(
  recipient: StrategyGenome,
  donor: StrategyGenome,
  opts: {
    readonly mutationReason: string;
    readonly parentGenomeIds: readonly StrategyGenomeId[];
  },
): StrategyGenome {
  return attachGenomeHash({
    schema: recipient.schema,
    genomeId: recipient.genomeId,
    version: nextGenomeVersion(recipient.version),
    name: recipient.name,
    hypothesis: recipient.hypothesis,
    nodes: cloneNodes(donor.nodes),
    parameters: cloneParams(recipient.parameters),
    lineage: {
      ...recipient.lineage,
      parentGenomeIds: Object.freeze(opts.parentGenomeIds),
      mutationReason: opts.mutationReason,
    },
  });
}

function bumpNumericParam(params: GenomeNodeParams, salt: number): GenomeNodeParams {
  const keys = Object.keys(params);
  if (keys.length === 0) {
    return params;
  }
  const pick = keys[salt % keys.length]!;
  const val = params[pick];
  if (typeof val === 'number') {
    const delta = ((salt % 7) - 3) * 0.01;
    return Object.freeze({ ...params, [pick]: val + delta });
  }
  if (typeof val === 'boolean') {
    return Object.freeze({ ...params, [pick]: !val });
  }
  return Object.freeze({ ...params, [pick]: `${val}_m${salt}` });
}

/**
 * Explore: in-policy mutation of genome parameters (declarative bag only).
 */
export function mutateGenomeParameters(genome: StrategyGenome, salt: number): StrategyGenome {
  const nextParams = bumpNumericParam(genome.parameters, salt);
  return attachGenomeHash({
    schema: genome.schema,
    genomeId: genome.genomeId,
    version: nextGenomeVersion(genome.version),
    name: genome.name,
    hypothesis: genome.hypothesis,
    nodes: cloneNodes(genome.nodes),
    parameters: nextParams,
    lineage: {
      ...genome.lineage,
      parentGenomeIds: Object.freeze([genome.genomeId]),
      mutationReason: `EVOL06_PARAMETER_MUTATION:${salt}`,
    },
  });
}

export function mergeParametersFromDonor(
  recipient: StrategyGenome,
  donor: StrategyGenome,
  opts: { readonly mutationReason: string; readonly parentGenomeIds: readonly StrategyGenomeId[] },
): StrategyGenome {
  const merged: Record<string, GenomeParamValue> = {
    ...donor.parameters,
    ...recipient.parameters,
  };
  return attachGenomeHash({
    schema: recipient.schema,
    genomeId: recipient.genomeId,
    version: nextGenomeVersion(recipient.version),
    name: recipient.name,
    hypothesis: recipient.hypothesis,
    nodes: cloneNodes(recipient.nodes),
    parameters: Object.freeze(merged),
    lineage: {
      ...recipient.lineage,
      parentGenomeIds: Object.freeze(opts.parentGenomeIds),
      mutationReason: opts.mutationReason,
    },
  });
}

export function crossIslandDonorIsland(
  workerIsland: StrategyIslandId,
  allIslands: readonly StrategyIslandId[],
  random: () => number,
): StrategyIslandId | null {
  const others = allIslands.filter((i) => i !== workerIsland);
  if (others.length === 0) return null;
  return others[Math.floor(random() * others.length)]!;
}
