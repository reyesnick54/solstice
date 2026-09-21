/**
 * HELIOS Multi-Asset M16 — multi-asset opportunity ranking engine.
 *
 * Deterministic, versioned, explainable. Does NOT authorize or execute trades.
 * Rank is not permission to trade.
 */

import type {
  OpportunityOutputState,
  OpportunityRankingEvaluateInput,
  RankedOpportunity,
  RankingRunResult,
} from './types.ts';
import { buildOpportunityScorecard } from './scorecard.ts';
import type { OpportunityRankingVersion } from './taxonomy.ts';

const ALLOCATION_REVIEW_MIN_SCORE = 72;
const HIGH_PRIORITY_RESEARCH_MIN_SCORE = 60;
const WATCH_MIN_SCORE = 45;

function deriveOutputState(input: {
  readonly compositeScore: number;
  readonly expired: boolean;
  readonly insufficientEvidence: boolean;
  readonly rejectedHard: boolean;
  readonly providerAvailable: boolean;
  readonly executionReady: boolean;
  readonly stale: boolean;
  readonly highCorrelation: boolean;
}): OpportunityOutputState {
  if (input.expired) return 'EXPIRED';
  if (input.insufficientEvidence) return 'INSUFFICIENT_EVIDENCE';
  if (input.rejectedHard) return 'REJECT';
  if (input.stale) return 'WAIT';
  if (!input.providerAvailable) return 'WAIT';
  if (input.compositeScore >= ALLOCATION_REVIEW_MIN_SCORE && input.executionReady) {
    if (input.highCorrelation) return 'WATCH';
    return 'QUALIFIED_FOR_ALLOCATION_REVIEW';
  }
  if (input.highCorrelation && input.compositeScore >= WATCH_MIN_SCORE) return 'WATCH';
  if (input.compositeScore >= HIGH_PRIORITY_RESEARCH_MIN_SCORE) return 'HIGH_PRIORITY_RESEARCH';
  if (input.compositeScore >= WATCH_MIN_SCORE) return 'WATCH';
  return 'WAIT';
}

function isInsufficientEvidence(rejectedCount: number, evidenceQuality: number | null): boolean {
  if (evidenceQuality !== null && evidenceQuality < 20) return true;
  return rejectedCount >= 8;
}

function isStale(signalFreshness: number | null): boolean {
  return signalFreshness !== null && signalFreshness < 25;
}

function isHighCorrelation(correlationPenaltyBps: number): boolean {
  return correlationPenaltyBps >= 7000;
}

function isRejectedHard(factors: {
  readonly liquidityScore: number | null;
  readonly dataQualityScore: number | null;
  readonly providerAvailable: boolean;
}): boolean {
  if (factors.liquidityScore !== null && factors.liquidityScore < 10) return true;
  if (factors.dataQualityScore !== null && factors.dataQualityScore < 15) return true;
  return false;
}

function allocationReviewEligible(
  outputState: OpportunityOutputState,
  compositeScore: number,
  executionReady: boolean,
  providerAvailable: boolean,
  insufficientEvidence: boolean,
): boolean {
  return (
    outputState === 'QUALIFIED_FOR_ALLOCATION_REVIEW' &&
    compositeScore >= ALLOCATION_REVIEW_MIN_SCORE &&
    executionReady &&
    providerAvailable &&
    !insufficientEvidence
  );
}

export function rankOpportunities(input: OpportunityRankingEvaluateInput): RankingRunResult {
  const ranked: RankedOpportunity[] = [];

  for (const item of input.candidates) {
    const { candidate, factors } = item;
    const expired = candidate.expiresAt <= input.now;
    const scorecard = buildOpportunityScorecard({
      scorecardId: `sc_${input.runId}_${candidate.opportunityId}`,
      opportunityId: candidate.opportunityId,
      rankingVersion: input.rankingVersion,
      factors,
      now: input.now,
    });

    const insufficientEvidence = isInsufficientEvidence(
      scorecard.rejectedFactors.length,
      factors.evidenceQualityScore,
    );
    const stale = isStale(factors.signalFreshnessScore);
    const highCorrelation = isHighCorrelation(factors.correlationPenaltyBps);
    const rejectedHard = isRejectedHard({
      liquidityScore: factors.liquidityScore,
      dataQualityScore: factors.dataQualityScore,
      providerAvailable: factors.providerAvailable,
    });

    const outputState = deriveOutputState({
      compositeScore: scorecard.compositeScore,
      expired,
      insufficientEvidence,
      rejectedHard,
      providerAvailable: factors.providerAvailable,
      executionReady: factors.executionReady,
      stale,
      highCorrelation,
    });

    const reviewEligible =
      !highCorrelation &&
      allocationReviewEligible(
        outputState,
        scorecard.compositeScore,
        factors.executionReady,
        factors.providerAvailable,
        insufficientEvidence,
      );

    ranked.push(
      Object.freeze({
        opportunityId: candidate.opportunityId,
        candidateId: candidate.candidateId,
        workOrderId: candidate.workOrderId,
        customerId: candidate.customerId,
        subjectId: candidate.subjectId,
        instrumentIds: candidate.instrumentIds,
        strategyFamily: candidate.strategyFamily,
        strategyId: candidate.strategyId,
        outputState,
        rank: null,
        scorecard,
        evidenceRefs: Object.freeze([...candidate.evidenceRefs, ...factors.evidenceRefs]),
        correlationWarnings: Object.freeze([...factors.correlationWarnings]),
        dataQualityWarnings: Object.freeze([...factors.dataQualityWarnings]),
        regimeMatch: factors.regimeCompatibility,
        allocationReviewEligible: reviewEligible,
        metaAllocatorHandoffEligible: reviewEligible,
        expiresAt: candidate.expiresAt,
        rankedAt: input.now,
        rankingVersion: input.rankingVersion,
        grantsExecutionAuthority: false as const,
        authorizesFinancialExecution: false as const,
        rankIsNotTradePermission: true as const,
      }),
    );
  }

  const rankable = ranked.filter((r) => r.outputState !== 'EXPIRED' && r.outputState !== 'REJECT');
  rankable.sort((left, right) => {
    if (left.scorecard.compositeScore !== right.scorecard.compositeScore) {
      return right.scorecard.compositeScore - left.scorecard.compositeScore;
    }
    return left.opportunityId.localeCompare(right.opportunityId);
  });

  const rankById = new Map<string, number>();
  rankable.forEach((item, index) => rankById.set(item.opportunityId, index + 1));

  const withRanks = ranked.map((item) =>
    Object.freeze({
      ...item,
      rank: rankById.get(item.opportunityId) ?? null,
    }),
  );
  withRanks.sort((a, b) => a.opportunityId.localeCompare(b.opportunityId));

  const evidenceRefs = Object.freeze([
    ...new Set(withRanks.flatMap((r) => [...r.evidenceRefs])),
  ].sort());

  return Object.freeze({
    runId: input.runId,
    rankingVersion: input.rankingVersion,
    workOrderId: input.workOrderId,
    customerId: input.customerId,
    opportunities: Object.freeze(withRanks),
    evidenceRefs,
    rankedAt: input.now,
    grantsExecutionAuthority: false as const,
    authorizesFinancialExecution: false as const,
  });
}

export function rankingFingerprint(
  result: RankingRunResult,
  version: OpportunityRankingVersion,
): string {
  const parts = result.opportunities.map(
    (o) => `${o.opportunityId}:${o.rank ?? 'null'}:${o.scorecard.compositeScore}:${o.outputState}`,
  );
  parts.sort();
  return `${version}|${parts.join('|')}`;
}
