export const EARN11_STRATEGY_GENOME_MODULE =
  'packages/platform/src/helios/earnings-intelligence/earn11-strategy-genome.ts' as const;

export type EarningsStrategyGenome = {
  readonly genomeId: string;
  readonly version: string;
  readonly featureFlags: readonly string[];
  readonly entryThresholdBps: number;
  readonly exitThresholdBps: number;
};

export function materializeEarningsGenome(input: {
  readonly genomeId: string;
  readonly version: string;
  readonly featureFlags: readonly string[];
}): EarningsStrategyGenome {
  return Object.freeze({
    genomeId: input.genomeId,
    version: input.version,
    featureFlags: Object.freeze([...input.featureFlags]),
    entryThresholdBps: 5_500,
    exitThresholdBps: 4_500,
  });
}
