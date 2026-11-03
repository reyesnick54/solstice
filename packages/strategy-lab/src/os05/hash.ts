import { createHash } from 'node:crypto';

import type { StrategyGenome } from './types.ts';

function canonicalGenomeBody(genome: Omit<StrategyGenome, 'lineage'> & { readonly lineage: Omit<StrategyGenome['lineage'], 'genomeHash'> }): string {
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

export function computeStrategyGenomeHash(
  genome: Omit<StrategyGenome, 'lineage'> & { readonly lineage: Omit<StrategyGenome['lineage'], 'genomeHash'> },
): string {
  return createHash('sha256').update(canonicalGenomeBody(genome)).digest('hex');
}

export function attachGenomeHash(
  genome: Omit<StrategyGenome, 'lineage'> & { readonly lineage: Omit<StrategyGenome['lineage'], 'genomeHash'> },
): StrategyGenome {
  const genomeHash = computeStrategyGenomeHash(genome);
  return Object.freeze({
    ...genome,
    lineage: Object.freeze({
      ...genome.lineage,
      genomeHash,
    }),
  });
}
