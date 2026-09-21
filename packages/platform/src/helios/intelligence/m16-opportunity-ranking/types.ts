import type { CustomerId, UtcInstant } from '@solstice/domain';
import type { EconomicWorkOrderId } from '../../ids.ts';
import type { StrategyFamilyId } from '../m13-regime/taxonomy.ts';
import type { RegimeCompatibilityResult } from '../m13-regime/types.ts';
import type { CorrelationWarning } from '../m14-opportunity-graph/types.ts';
import type { AssembledOpportunityCandidate } from '../m15-opportunity-assembly/types.ts';
import type {
  OpportunityOutputState,
  OpportunityRankingVersion,
  ScorecardFactorId,
} from './taxonomy.ts';

export type ScorecardFactorValue = {
  readonly factorId: ScorecardFactorId;
  readonly score: number | null;
  readonly weight: number;
  readonly weightedContribution: number;
  readonly evidenceRef: string | null;
  readonly explanation: string;
  readonly rejected: boolean;
  readonly rejectionReason: string | null;
};

export type OpportunityScorecard = {
  readonly scorecardId: string;
  readonly opportunityId: string;
  readonly rankingVersion: OpportunityRankingVersion;
  readonly factors: readonly ScorecardFactorValue[];
  readonly compositeScore: number;
  readonly rejectedFactors: readonly ScorecardFactorId[];
  readonly computedAt: UtcInstant;
};

export type DataQualityWarning = {
  readonly code: string;
  readonly message: string;
  readonly severity: 'WARN' | 'FAIL';
};

export type RankedOpportunity = {
  readonly opportunityId: string;
  readonly candidateId: string;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly subjectId: string;
  readonly instrumentIds: readonly string[];
  readonly strategyFamily: StrategyFamilyId;
  readonly strategyId: string;
  readonly outputState: OpportunityOutputState;
  readonly rank: number | null;
  readonly scorecard: OpportunityScorecard;
  readonly evidenceRefs: readonly string[];
  readonly correlationWarnings: readonly CorrelationWarning[];
  readonly dataQualityWarnings: readonly DataQualityWarning[];
  readonly regimeMatch: RegimeCompatibilityResult;
  readonly allocationReviewEligible: boolean;
  readonly metaAllocatorHandoffEligible: boolean;
  readonly expiresAt: UtcInstant;
  readonly rankedAt: UtcInstant;
  readonly rankingVersion: OpportunityRankingVersion;
  readonly grantsExecutionAuthority: false;
  readonly authorizesFinancialExecution: false;
  readonly rankIsNotTradePermission: true;
};

export type RankingRunResult = {
  readonly runId: string;
  readonly rankingVersion: OpportunityRankingVersion;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly opportunities: readonly RankedOpportunity[];
  readonly evidenceRefs: readonly string[];
  readonly rankedAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
  readonly authorizesFinancialExecution: false;
};

/** Evidence-backed factor inputs. LLM research may supply evidence refs but not final rank. */
export type OpportunityRankingFactorInput = {
  readonly strategyConfidenceBps: number | null;
  readonly historicalQualificationState: 'QUALIFIED' | 'SHADOW' | 'PAPER' | 'NONE';
  readonly regimeCompatibility: RegimeCompatibilityResult;
  readonly expectedRewardEvidenceBps: number | null;
  readonly expectedDownsideEvidenceBps: number | null;
  readonly realizedVolatilityBps: number | null;
  readonly liquidityScore: number | null;
  readonly spreadBps: number | null;
  readonly estimatedFeesBps: number | null;
  readonly estimatedSlippageBps: number | null;
  readonly dataQualityScore: number | null;
  readonly evidenceQualityScore: number | null;
  readonly signalFreshnessScore: number | null;
  readonly correlationPenaltyBps: number;
  readonly capitalRequirementMinor: string | null;
  readonly availableCapitalMinor: string | null;
  readonly providerAvailable: boolean;
  readonly executionReady: boolean;
  readonly expiresAt: UtcInstant;
  readonly dataQualityWarnings: readonly DataQualityWarning[];
  readonly correlationWarnings: readonly CorrelationWarning[];
  readonly evidenceRefs: readonly string[];
};

export type OpportunityRankingCandidateInput = {
  readonly candidate: AssembledOpportunityCandidate;
  readonly factors: OpportunityRankingFactorInput;
};

export type OpportunityRankingEvaluateInput = {
  readonly runId: string;
  readonly rankingVersion: OpportunityRankingVersion;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly candidates: readonly OpportunityRankingCandidateInput[];
  readonly now: UtcInstant;
};

export type OpportunityRankingStoreSnapshot = {
  readonly runs: readonly RankingRunResult[];
};
