/**
 * Online expert reliability — updated only after outcomes are known (strictly prior events).
 */

import type { UtcInstant } from '@solstice/domain';
import type { EarningsExpertKind } from './taxonomy.ts';
import type { EarningsExpertSignal, EarningsOutcomeRecord, ExpertReliabilityRecord } from './types.ts';
import { clampProbability } from './distributions.ts';
import { earningsDecimalToNumber, parseEarningsDecimal } from './numeric.ts';

const DEFAULT_RELIABILITY: ExpertReliabilityRecord = Object.freeze({
  expertKind: 'StreetExpectationExpert',
  ewmaBrier: 0.25,
  ewmaMae: 1,
  bayesianAlpha: 1,
  bayesianBeta: 1,
  sampleCount: 0,
  lastUpdatedAt: null,
});

export function defaultExpertReliability(expertKind: EarningsExpertKind): ExpertReliabilityRecord {
  return Object.freeze({ ...DEFAULT_RELIABILITY, expertKind });
}

function ewmaAlpha(sampleCount: number): number {
  return Math.min(0.15, 2 / (sampleCount + 3));
}

export function reliabilityWeight(record: ExpertReliabilityRecord): number {
  const bayesMean = record.bayesianAlpha / (record.bayesianAlpha + record.bayesianBeta);
  const brierFactor = 1 / (1 + record.ewmaBrier);
  const maeFactor = 1 / (1 + record.ewmaMae);
  const blended = 0.4 * bayesMean + 0.35 * brierFactor + 0.25 * maeFactor;
  return Math.min(1, Math.max(0.05, blended));
}

export function assertOutcomeStrictlyPrior(outcomeKnownAt: UtcInstant, updateAsOf: UtcInstant): boolean {
  return outcomeKnownAt < updateAsOf;
}

export function updateExpertReliabilityFromOutcome(input: {
  readonly record: ExpertReliabilityRecord;
  readonly signal: EarningsExpertSignal;
  readonly outcome: EarningsOutcomeRecord;
  readonly appliedAt: UtcInstant;
}): ExpertReliabilityRecord | null {
  if (!assertOutcomeStrictlyPrior(input.outcome.outcomeKnownAt, input.appliedAt)) {
    return null;
  }
  if (input.signal.evaluatedAt >= input.outcome.outcomeKnownAt) {
    return null;
  }

  const alpha = ewmaAlpha(input.record.sampleCount);
  const actualEps = parseEarningsDecimal(input.outcome.actualEps);
  if (!actualEps.ok) return null;

  const isProbabilityExpert = input.signal.primaryTargets.some(
    (target) =>
      target === 'beatProbability' ||
      target === 'revenueBeatProbability' ||
      target === 'guidanceRaiseProbability' ||
      target === 'guidanceCutProbability' ||
      target === 'earningsQualityRiskProbability' ||
      target === 'marginExpansionProbability',
  );

  const predictedBeat = clampProbability(input.signal.estimate);
  const actualBeat = input.outcome.beatConsensus ? 1 : 0;
  const brier = isProbabilityExpert ? (predictedBeat - actualBeat) ** 2 : input.record.ewmaBrier;

  const mae = Math.abs(input.signal.estimate - earningsDecimalToNumber(actualEps.scaled));
  const maeForUpdate = input.signal.primaryTargets.includes('nextQuarterEps') ? mae : input.record.ewmaMae;

  const success = (isProbabilityExpert ? brier < 0.2 : true) && maeForUpdate < 1;
  const nextAlpha = input.record.bayesianAlpha + (success ? 1 : 0);
  const nextBeta = input.record.bayesianBeta + (success ? 0 : 1);

  return Object.freeze({
    expertKind: input.record.expertKind,
    ewmaBrier: isProbabilityExpert
      ? (1 - alpha) * input.record.ewmaBrier + alpha * brier
      : input.record.ewmaBrier,
    ewmaMae: input.signal.primaryTargets.includes('nextQuarterEps')
      ? (1 - alpha) * input.record.ewmaMae + alpha * mae
      : input.record.ewmaMae,
    bayesianAlpha: nextAlpha,
    bayesianBeta: nextBeta,
    sampleCount: input.record.sampleCount + 1,
    lastUpdatedAt: input.appliedAt,
  });
}
