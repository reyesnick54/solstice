/**
 * Strategy Lab — reject research windows with insufficient market-data integrity (MD12).
 */

import type { UtcInstant } from '@solstice/domain';

export const STRATEGY_LAB_MD12_RESEARCH_INTEGRITY_SCHEMA = 'strategy-lab.md12-research-integrity.v1' as const;

export type StrategyLabMd12QualityComponents = {
  readonly freshnessPpm: bigint;
  readonly bookIntegrityPpm: bigint;
  readonly tradeIntegrityPpm: bigint;
  readonly sequenceIntegrityPpm: bigint;
  readonly corroborationPpm: bigint;
  readonly anomalyPenaltyPpm: bigint;
};

export type StrategyLabMd12QualitySnapshot = {
  readonly instrumentId: string;
  readonly asOf: UtcInstant;
  readonly compositeScorePpm: bigint;
  readonly sufficientForResearch: boolean;
  readonly components: StrategyLabMd12QualityComponents;
  readonly openAnomalyCount: number;
};

export type StrategyLabMd12ResearchPeriodGateInput = {
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly samples: readonly StrategyLabMd12QualitySnapshot[];
  readonly minCompositePpm?: bigint;
  readonly minSufficientSampleSharePpm?: bigint;
};

export type StrategyLabMd12ResearchPeriodGateResult = {
  readonly schema: typeof STRATEGY_LAB_MD12_RESEARCH_INTEGRITY_SCHEMA;
  readonly admitted: boolean;
  readonly reason: string | null;
  readonly insufficientSampleSharePpm: bigint;
  readonly medianCompositePpm: bigint;
  readonly blockers: readonly string[];
};

const DEFAULT_MIN_COMPOSITE_PPM = 600_000n;
const DEFAULT_MIN_SUFFICIENT_SHARE_PPM = 800_000n; // 80% of samples must be research-grade

export function evaluateMd12ResearchPeriodIntegrity(
  input: StrategyLabMd12ResearchPeriodGateInput,
): StrategyLabMd12ResearchPeriodGateResult {
  const minComposite = input.minCompositePpm ?? DEFAULT_MIN_COMPOSITE_PPM;
  const minShare = input.minSufficientSampleSharePpm ?? DEFAULT_MIN_SUFFICIENT_SHARE_PPM;
  const blockers: string[] = [];

  if (input.samples.length === 0) {
    blockers.push('no_quality_samples');
    return freezeGate({
      admitted: false,
      reason: 'INSUFFICIENT_MARKET_DATA_INTEGRITY',
      insufficientSampleSharePpm: 0n,
      medianCompositePpm: 0n,
      blockers: Object.freeze(blockers),
    });
  }

  const sufficient = input.samples.filter((row) => row.sufficientForResearch);
  const sufficientSharePpm = (BigInt(sufficient.length) * 1_000_000n) / BigInt(input.samples.length);

  const composites = [...input.samples.map((row) => row.compositeScorePpm)].sort((a, b) =>
    a === b ? 0 : a < b ? -1 : 1,
  );
  const medianCompositePpm = composites[Math.floor(composites.length / 2)] ?? 0n;

  if (sufficientSharePpm < minShare) {
    blockers.push('insufficient_sufficient_sample_share');
  }
  if (medianCompositePpm < minComposite) {
    blockers.push('median_composite_below_threshold');
  }

  const admitted = blockers.length === 0;
  return freezeGate({
    admitted,
    reason: admitted ? null : 'INSUFFICIENT_MARKET_DATA_INTEGRITY',
    insufficientSampleSharePpm: 1_000_000n - sufficientSharePpm,
    medianCompositePpm,
    blockers: Object.freeze(blockers),
  });
}

function freezeGate(
  input: Omit<StrategyLabMd12ResearchPeriodGateResult, 'schema'>,
): StrategyLabMd12ResearchPeriodGateResult {
  return Object.freeze({
    schema: STRATEGY_LAB_MD12_RESEARCH_INTEGRITY_SCHEMA,
    ...input,
  });
}
