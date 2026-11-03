import { createHash } from 'node:crypto';

import type { StrategyGenome, StrategyGenomeLineage } from './types.ts';

export type StrategyGenomeHashMaterial = Omit<StrategyGenome, 'lineage'> & {
  readonly lineage: Omit<StrategyGenomeLineage, 'genomeHash'>;
};

export function lineageWithoutGenomeHash(
  lineage: StrategyGenomeLineage,
): Omit<StrategyGenomeLineage, 'genomeHash'> {
  const { genomeHash: _genomeHash, ...rest } = lineage;
  return rest;
}

function canonicalGenomeBody(genome: StrategyGenomeHashMaterial): string {
  return JSON.stringify(
    {
      schema: genome.schema,
      genomeId: genome.genomeId,
      version: genome.version,
      name: genome.name,
      hypothesis: genome.hypothesis,
      nodes: genome.nodes,
      parameters: genome.parameters,
      lineage: genome.lineage,
    },
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
  );
}

export function computeStrategyGenomeHash(genome: StrategyGenomeHashMaterial): string {
  return createHash('sha256').update(canonicalGenomeBody(genome)).digest('hex');
}

export function attachGenomeHash(genome: StrategyGenomeHashMaterial): StrategyGenome {
  const genomeHash = computeStrategyGenomeHash(genome);
  return Object.freeze({
    ...genome,
    lineage: Object.freeze({
      ...genome.lineage,
      genomeHash,
    }),
  });
}
