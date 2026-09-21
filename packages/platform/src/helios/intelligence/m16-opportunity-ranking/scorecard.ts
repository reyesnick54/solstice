/**
 * HELIOS Multi-Asset M16 — deterministic opportunity scorecard builder.
 *
 * Does not invent expected-return numbers without capsule/strategy evidence.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  OpportunityRankingFactorInput,
  OpportunityScorecard,
  ScorecardFactorValue,
} from './types.ts';
import {
  type OpportunityRankingVersion,
  type RankingWeights,
  type ScorecardFactorId,
  weightsForVersion,
} from './taxonomy.ts';

function clamp(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function bpsToScore(bps: number, invert = false): number {
  const normalized = clamp(Math.round(bps / 100));
  return invert ? 100 - normalized : normalized;
}

function hoursUntil(expiresAt: UtcInstant, now: UtcInstant): number {
  const ms = new Date(expiresAt).getTime() - new Date(now).getTime();
  return Math.max(0, ms / 3_600_000);
}

function buildFactor(
  factorId: ScorecardFactorId,
  weight: number,
  score: number | null,
  evidenceRef: string | null,
  explanation: string,
  rejectionReason: string | null = null,
): ScorecardFactorValue {
  const rejected = score === null;
  const effectiveScore = rejected ? 0 : score;
  return Object.freeze({
    factorId,
    score: rejected ? null : effectiveScore,
    weight,
    weightedContribution: rejected ? 0 : Math.round((effectiveScore * weight) / 100),
    evidenceRef,
    explanation,
    rejected,
    rejectionReason,
  });
}

export function buildOpportunityScorecard(input: {
  readonly scorecardId: string;
  readonly opportunityId: string;
  readonly rankingVersion: OpportunityRankingVersion;
  readonly factors: OpportunityRankingFactorInput;
  readonly now: UtcInstant;
  readonly weights?: RankingWeights;
}): OpportunityScorecard {
  const weights = input.weights ?? weightsForVersion(input.rankingVersion);
  const f = input.factors;
  const factorValues: ScorecardFactorValue[] = [];

  factorValues.push(
    buildFactor(
      'strategyConfidence',
      weights.strategyConfidence,
      f.strategyConfidenceBps === null ? null : bpsToScore(f.strategyConfidenceBps),
      f.evidenceRefs[0] ?? null,
      'strategy capsule confidence from qualification evidence',
    ),
  );

  const histScore =
    f.historicalQualificationState === 'QUALIFIED'
      ? 100
      : f.historicalQualificationState === 'PAPER'
        ? 85
        : f.historicalQualificationState === 'SHADOW'
          ? 70
          : f.historicalQualificationState === 'NONE'
            ? null
            : null;
  factorValues.push(
    buildFactor(
      'historicalQualification',
      weights.historicalQualification,
      histScore,
      f.evidenceRefs.find((r) => r.includes('qualification')) ?? f.evidenceRefs[0] ?? null,
      'Strategy Lab historical qualification state',
      histScore === null ? 'no historical qualification evidence' : null,
    ),
  );

  factorValues.push(
    buildFactor(
      'regimeCompatibility',
      weights.regimeCompatibility,
      f.regimeCompatibility.score,
      null,
      f.regimeCompatibility.reason,
    ),
  );

  factorValues.push(
    buildFactor(
      'expectedReward',
      weights.expectedReward,
      f.expectedRewardEvidenceBps === null ? null : bpsToScore(f.expectedRewardEvidenceBps),
      f.expectedRewardEvidenceBps === null ? null : (f.evidenceRefs.find((r) => r.includes('reward')) ?? null),
      'expected reward from strategy capsule evidence only',
      f.expectedRewardEvidenceBps === null ? 'no evidence-backed expected reward' : null,
    ),
  );

  factorValues.push(
    buildFactor(
      'expectedDownside',
      weights.expectedDownside,
      f.expectedDownsideEvidenceBps === null ? null : bpsToScore(f.expectedDownsideEvidenceBps, true),
      f.expectedDownsideEvidenceBps === null ? null : (f.evidenceRefs.find((r) => r.includes('downside')) ?? null),
      'expected downside from strategy capsule evidence only',
      f.expectedDownsideEvidenceBps === null ? 'no evidence-backed expected downside' : null,
    ),
  );

  factorValues.push(
    buildFactor(
      'realizedVolatility',
      weights.realizedVolatility,
      f.realizedVolatilityBps === null ? null : bpsToScore(f.realizedVolatilityBps, true),
      null,
      'realized volatility penalty',
      f.realizedVolatilityBps === null ? 'volatility evidence missing' : null,
    ),
  );

  factorValues.push(
    buildFactor(
      'liquidity',
      weights.liquidity,
      f.liquidityScore,
      null,
      'liquidity posture score',
      f.liquidityScore === null ? 'liquidity score unavailable' : null,
    ),
  );

  factorValues.push(
    buildFactor(
      'spread',
      weights.spread,
      f.spreadBps === null ? null : bpsToScore(f.spreadBps, true),
      null,
      'spread cost penalty',
      f.spreadBps === null ? 'spread evidence missing' : null,
    ),
  );

  factorValues.push(
    buildFactor(
      'estimatedFees',
      weights.estimatedFees,
      f.estimatedFeesBps === null ? null : bpsToScore(f.estimatedFeesBps, true),
      null,
      'estimated fee penalty',
      f.estimatedFeesBps === null ? 'fee estimate missing' : null,
    ),
  );

  factorValues.push(
    buildFactor(
      'estimatedSlippage',
      weights.estimatedSlippage,
      f.estimatedSlippageBps === null ? null : bpsToScore(f.estimatedSlippageBps, true),
      null,
      'estimated slippage penalty',
      f.estimatedSlippageBps === null ? 'slippage estimate missing' : null,
    ),
  );

  factorValues.push(
    buildFactor(
      'dataQuality',
      weights.dataQuality,
      f.dataQualityScore,
      null,
      'market data quality score',
      f.dataQualityScore === null ? 'data quality score unavailable' : null,
    ),
  );

  factorValues.push(
    buildFactor(
      'evidenceQuality',
      weights.evidenceQuality,
      f.evidenceQualityScore,
      f.evidenceRefs[0] ?? null,
      'evidence quality from admissible refs',
      f.evidenceQualityScore === null ? 'evidence quality score unavailable' : null,
    ),
  );

  factorValues.push(
    buildFactor(
      'signalFreshness',
      weights.signalFreshness,
      f.signalFreshnessScore,
      null,
      'signal freshness score',
      f.signalFreshnessScore === null ? 'signal freshness unavailable' : null,
    ),
  );

  const corrPenalty = clamp(Math.round(f.correlationPenaltyBps / 100));
  factorValues.push(
    buildFactor(
      'correlationExposure',
      weights.correlationExposure,
      100 - corrPenalty,
      f.correlationWarnings[0]?.correlatedWith[0] ?? null,
      'correlation exposure penalty from cross-asset graph',
    ),
  );

  let capitalScore: number | null = null;
  if (f.capitalRequirementMinor !== null && f.availableCapitalMinor !== null) {
    const req = BigInt(f.capitalRequirementMinor);
    const avail = BigInt(f.availableCapitalMinor);
    capitalScore = req <= avail ? 100 : avail <= 0n ? 0 : clamp(Number((avail * 100n) / req));
  }
  factorValues.push(
    buildFactor(
      'capitalRequirement',
      weights.capitalRequirement,
      capitalScore,
      null,
      'capital requirement fit',
      capitalScore === null ? 'capital requirement unknown' : null,
    ),
  );

  factorValues.push(
    buildFactor(
      'providerAvailability',
      weights.providerAvailability,
      f.providerAvailable ? 100 : 0,
      null,
      f.providerAvailable ? 'provider route available' : 'provider unavailable',
    ),
  );

  factorValues.push(
    buildFactor(
      'executionReadiness',
      weights.executionReadiness,
      f.executionReady ? 100 : 20,
      null,
      f.executionReady ? 'execution route ready' : 'execution not ready',
    ),
  );

  const hoursLeft = hoursUntil(f.expiresAt, input.now);
  const expiryScore = hoursLeft <= 0 ? 0 : hoursLeft >= 72 ? 100 : clamp(Math.round((hoursLeft / 72) * 100));
  factorValues.push(
    buildFactor(
      'timeToExpiry',
      weights.timeToExpiry,
      expiryScore,
      null,
      `time remaining until opportunity expiry (${hoursLeft.toFixed(1)}h)`,
    ),
  );

  const totalWeight = factorValues.reduce((sum, fv) => sum + (fv.rejected ? 0 : fv.weight), 0);
  const compositeRaw = factorValues.reduce((sum, fv) => sum + fv.weightedContribution, 0);
  const compositeScore = totalWeight > 0 ? clamp(Math.round((compositeRaw * 100) / totalWeight)) : 0;

  const rejectedFactors = Object.freeze(
    factorValues.filter((fv) => fv.rejected).map((fv) => fv.factorId),
  ) as readonly ScorecardFactorId[];

  factorValues.sort((a, b) => a.factorId.localeCompare(b.factorId));

  return Object.freeze({
    scorecardId: input.scorecardId,
    opportunityId: input.opportunityId,
    rankingVersion: input.rankingVersion,
    factors: Object.freeze(factorValues),
    compositeScore,
    rejectedFactors,
    computedAt: input.now,
  });
}
