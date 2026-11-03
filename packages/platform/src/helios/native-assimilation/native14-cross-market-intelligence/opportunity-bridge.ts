import type { UtcInstant } from '@solstice/domain';
import type { EconomicWorkOrderId } from '../../ids.ts';
import type { AssembledOpportunityCandidate } from '../../intelligence/m15-opportunity-assembly/types.ts';
import type { OpportunityRankingCandidateInput } from '../../intelligence/m16-opportunity-ranking/types.ts';
import type { RegimeCompatibilityResult } from '../../intelligence/m13-regime/types.ts';
import type { CrossMarketDislocation, CrossMarketOpportunityCandidateBundle } from './types.ts';
import type { CrossMarketResearchTriggerKind } from './taxonomy.ts';

function strategyFamilyForTrigger(kind: CrossMarketResearchTriggerKind | null): AssembledOpportunityCandidate['strategyFamily'] {
  return 'AGENTIC_RESEARCH';
}

function sectorForTrigger(kind: CrossMarketResearchTriggerKind | null): string {
  if (kind === 'CRYPTO_RESEARCH') return 'CRYPTO';
  if (kind === 'MACRO_RESEARCH') return 'MACRO';
  return 'CROSS_MARKET';
}

export function crossMarketDislocationToOpportunityCandidate(input: {
  readonly dislocation: CrossMarketDislocation;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: AssembledOpportunityCandidate['customerId'];
  readonly subjectId: string;
  readonly instrumentIds: readonly string[];
  readonly now: UtcInstant;
  readonly expiresAt: UtcInstant;
}): CrossMarketOpportunityCandidateBundle {
  const kind = input.dislocation.researchTriggerKind;
  const opportunityId = `opp_cm_${input.dislocation.dislocationId}`;
  const candidate: AssembledOpportunityCandidate = Object.freeze({
    opportunityId,
    candidateId: `cand_${opportunityId}`,
    workOrderId: input.workOrderId,
    customerId: input.customerId,
    subjectId: input.subjectId,
    source: 'CROSS_MARKET_INTELLIGENCE_NATIVE14',
    strategyFamily: strategyFamilyForTrigger(kind),
    strategyId: `native14_${kind ?? 'generic'}_research`,
    strategyVersion: '1.0.0',
    instrumentIds: input.instrumentIds,
    assetClass: kind === 'CRYPTO_RESEARCH' ? 'crypto' : 'multi_asset',
    sector: sectorForTrigger(kind),
    evidenceRefs: Object.freeze([
      ...input.dislocation.evidenceRefs,
      `ev_native14_dislocation:${input.dislocation.dislocationId}`,
    ]),
    envelopeRef: null,
    discoveredAt: input.now,
    expiresAt: input.expiresAt,
    grantsExecutionAuthority: false as const,
    authorizesFinancialExecution: false as const,
  });

  return Object.freeze({
    opportunityId,
    candidate,
    dislocationId: input.dislocation.dislocationId,
    evidenceRefs: candidate.evidenceRefs,
    grantsExecutionAuthority: false as const,
    authorizesFinancialExecution: false as const,
    correlationIsNotTradeSignal: true as const,
  });
}

export function crossMarketBundleToM16CandidateInput(input: {
  readonly bundle: CrossMarketOpportunityCandidateBundle;
  readonly regimeMatch: RegimeCompatibilityResult;
  readonly expiresAt: UtcInstant;
}): OpportunityRankingCandidateInput {
  const evidenceCount = input.bundle.evidenceRefs.length;
  return Object.freeze({
    candidate: input.bundle.candidate,
    factors: Object.freeze({
      strategyConfidenceBps: Math.min(7500, 4000 + evidenceCount * 400),
      historicalQualificationState: 'NONE',
      regimeCompatibility: input.regimeMatch,
      expectedRewardEvidenceBps: null,
      expectedDownsideEvidenceBps: null,
      realizedVolatilityBps: null,
      liquidityScore: 0.7,
      spreadBps: 12,
      estimatedFeesBps: 8,
      estimatedSlippageBps: 10,
      dataQualityScore: 0.85,
      evidenceQualityScore: Math.min(1, 0.5 + evidenceCount * 0.08),
      signalFreshnessScore: 0.9,
      correlationPenaltyBps: 0,
      capitalRequirementMinor: null,
      availableCapitalMinor: null,
      providerAvailable: true,
      executionReady: false,
      expiresAt: input.expiresAt,
      dataQualityWarnings: Object.freeze([]),
      correlationWarnings: Object.freeze([]),
      evidenceRefs: input.bundle.evidenceRefs,
    }),
  });
}
