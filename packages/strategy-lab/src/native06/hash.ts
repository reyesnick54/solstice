import { createHash } from 'node:crypto';

import type { Native06StrategyGenome, Native06StrategyGenomeLineage } from './types.ts';

export type Native06GenomeHashMaterial = Omit<Native06StrategyGenome, 'lineage'> & {
  readonly lineage: Omit<Native06StrategyGenomeLineage, 'genomeHash'>;
};

export function lineageWithoutGenomeHash(
  lineage: Native06StrategyGenomeLineage,
): Omit<Native06StrategyGenomeLineage, 'genomeHash'> {
  const { genomeHash: _genomeHash, ...rest } = lineage;
  return rest;
}

function canonicalGenomeBody(genome: Native06GenomeHashMaterial): string {
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

export function computeNative06GenomeHash(genome: Native06GenomeHashMaterial): string {
  return createHash('sha256').update(canonicalGenomeBody(genome)).digest('hex');
}

export function attachNative06GenomeHash(genome: Native06GenomeHashMaterial): Native06StrategyGenome {
  const genomeHash = computeNative06GenomeHash(genome);
  return Object.freeze({
    ...genome,
    lineage: Object.freeze({
      ...genome.lineage,
      genomeHash,
    }),
  });
}
