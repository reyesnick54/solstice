export const VAL11_STRATEGY_GENOME_MODULE =
  'packages/platform/src/helios/valuation-intelligence/val12/val11-strategy-genome.ts' as const;

export type ValuationStrategyGenome = {
  readonly genomeId: string;
  readonly version: string;
  readonly featureFlags: readonly string[];
  readonly researchOnly: true;
  readonly autoPromoteFromValuation: false;
};

export function materializeValuationGenome(input: {
  readonly genomeId: string;
  readonly version: string;
  readonly featureFlags: readonly string[];
}): ValuationStrategyGenome {
  return Object.freeze({
    genomeId: input.genomeId,
    version: input.version,
    featureFlags: Object.freeze([...input.featureFlags]),
    researchOnly: true,
    autoPromoteFromValuation: false,
  });
}
