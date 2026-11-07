/**
 * Serializable DTOs for Strategy Lab research-period integrity gates (platform side).
 */

import type { UtcInstant } from '@solstice/domain';

import type { MarketDataQualityState } from './types.ts';

export type StrategyLabMd12ResearchPeriodSample = {
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly instrumentId: string;
  readonly quality: MarketDataQualityState;
};

export function toStrategyLabMd12ResearchPeriodSample(
  input: StrategyLabMd12ResearchPeriodSample,
): StrategyLabMd12ResearchPeriodSample {
  return Object.freeze({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    instrumentId: input.instrumentId,
    quality: input.quality,
  });
}

/** Portable quality snapshot for Strategy Lab gates (no platform import required on SL side). */
export function toStrategyLabMd12QualitySnapshot(quality: MarketDataQualityState) {
  return Object.freeze({
    instrumentId: quality.instrumentId,
    asOf: quality.asOf,
    compositeScorePpm: quality.compositeScorePpm,
    sufficientForResearch: quality.sufficientForResearch,
    components: Object.freeze({ ...quality.components }),
    openAnomalyCount: quality.openAnomalyIds.length,
  });
}
