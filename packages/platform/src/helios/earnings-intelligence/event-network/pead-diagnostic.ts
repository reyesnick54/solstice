/**
 * PEAD conditional diagnostics — studies drift heterogeneity; not a naive post-surprise trade rule.
 */

import type { UtcInstant } from '@solstice/domain';
import { PEAD_RESEARCH_HORIZON_DAYS } from './taxonomy.ts';
import type {
  EarningsAttentionState,
  EarningsEventRecord,
  PeaDDriftObservation,
  PEADConditionalState,
} from './types.ts';
import type { LiquidityBucket, MarketCapBucket, MarketRegimeLabel } from './taxonomy.ts';

export type HistoricalDriftSample = {
  readonly horizonDays: number;
  readonly cumulativeDriftBps: number;
};

export type BuildPEADConditionalStateInput = {
  readonly event: EarningsEventRecord;
  readonly attentionState: EarningsAttentionState;
  readonly marketRegime?: MarketRegimeLabel;
  readonly firmSizeBucket?: MarketCapBucket;
  readonly liquidityBucket?: LiquidityBucket;
  readonly historicalDriftSamples?: readonly HistoricalDriftSample[];
  readonly evaluatedAt: UtcInstant;
};

function bucketDrift(
  samples: readonly HistoricalDriftSample[] | undefined,
  horizon: number,
): PeaDDriftObservation {
  const matching = (samples ?? []).filter((s) => s.horizonDays === horizon);
  if (matching.length === 0) {
    return Object.freeze({ horizonDays: horizon as PeaDDriftObservation['horizonDays'], cumulativeDriftBps: null, sampleCount: 0 });
  }
  const avg = Math.round(matching.reduce((a, b) => a + b.cumulativeDriftBps, 0) / matching.length);
  return Object.freeze({
    horizonDays: horizon as PeaDDriftObservation['horizonDays'],
    cumulativeDriftBps: avg,
    sampleCount: matching.length,
  });
}

/**
 * Explicitly rejects mapping positive surprise to a fixed 60-day buy instruction.
 */
export function isNaivePeadTradeRule(input: { readonly surpriseState: string; readonly action: string }): boolean {
  return input.surpriseState === 'BEAT' && input.action.toLowerCase().includes('buy') && input.action.includes('60');
}

export function buildPEADConditionalState(input: BuildPEADConditionalStateInput): PEADConditionalState {
  const historicalDriftByHorizon = PEAD_RESEARCH_HORIZON_DAYS.map((h) =>
    bucketDrift(input.historicalDriftSamples, h),
  );

  return Object.freeze({
    eventId: input.event.eventId,
    securityNodeId: input.event.securityNodeId,
    surpriseMagnitudeBps: input.event.surpriseMagnitudeBps,
    firmSizeBucket: input.firmSizeBucket ?? input.attentionState.marketCapBucket,
    liquidityBucket: input.liquidityBucket ?? input.attentionState.liquidityBucket,
    analystCoverage: input.attentionState.analystCoverage,
    analystRevisionSpeedHours: input.event.analystRevisionSpeedHours,
    attentionState: input.attentionState,
    optionsImpliedMoveBps: input.event.optionsImpliedMoveBps,
    transcriptSentimentScoreMilli: input.event.transcriptSentimentScoreMilli,
    sectorCode: input.event.industryCode,
    marketRegime: input.marketRegime ?? 'UNKNOWN',
    historicalDriftByHorizon: Object.freeze(historicalDriftByHorizon),
    researchOnly: true,
    grantsExecutionAuthority: false,
  });
}
