/**
 * HELIOS Multi-Asset M16 → H20 Meta Allocator bridge.
 *
 * Only allocation-review-eligible opportunities may be handed to Meta Allocator.
 * Risk/Compliance/Execution retain final independent authority.
 */

import type { UtcInstant } from '@solstice/domain';
import { metaAllocationCandidateIdFor } from '../../meta-allocator/ids.ts';
import type { MetaAllocationCandidateInput, TradingCostAssumptions } from '../../meta-allocator/types.ts';
import type { RankedOpportunity, RankingRunResult } from './types.ts';

export type MetaAllocatorHandoffResult = {
  readonly eligible: readonly MetaAllocationCandidateInput[];
  readonly withheld: readonly { readonly opportunityId: string; readonly reason: string }[];
  readonly grantsExecutionAuthority: false;
};

export function bridgeRankedOpportunitiesToMetaAllocator(input: {
  readonly rankingResult: RankingRunResult;
  readonly defaultCosts: TradingCostAssumptions;
  readonly now: UtcInstant;
}): MetaAllocatorHandoffResult {
  const eligible: MetaAllocationCandidateInput[] = [];
  const withheld: { opportunityId: string; reason: string }[] = [];

  for (const opp of input.rankingResult.opportunities) {
    if (!opp.metaAllocatorHandoffEligible) {
      withheld.push(
        Object.freeze({
          opportunityId: opp.opportunityId,
          reason: `output state ${opp.outputState} not eligible for meta allocator handoff`,
        }),
      );
      continue;
    }
    if (opp.outputState !== 'QUALIFIED_FOR_ALLOCATION_REVIEW') {
      withheld.push(
        Object.freeze({
          opportunityId: opp.opportunityId,
          reason: 'rank does not confer allocation permission',
        }),
      );
      continue;
    }
    eligible.push(mapToMetaAllocatorCandidate(opp, input.defaultCosts, input.now));
  }

  eligible.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  withheld.sort((a, b) => a.opportunityId.localeCompare(b.opportunityId));

  return Object.freeze({
    eligible: Object.freeze(eligible),
    withheld: Object.freeze(withheld),
    grantsExecutionAuthority: false as const,
  });
}

function mapToMetaAllocatorCandidate(
  opp: RankedOpportunity,
  costs: TradingCostAssumptions,
  now: UtcInstant,
): MetaAllocationCandidateInput {
  const instrumentId = opp.instrumentIds[0] ?? 'UNKNOWN';
  const rewardFactor = opp.scorecard.factors.find((f) => f.factorId === 'expectedReward');
  const evidenceQualityScore =
    opp.scorecard.factors.find((f) => f.factorId === 'evidenceQuality')?.score ?? 50;

  return Object.freeze({
    candidateId: metaAllocationCandidateIdFor(opp.workOrderId, opp.opportunityId),
    workOrderId: opp.workOrderId,
    customerId: opp.customerId,
    subjectId: opp.subjectId,
    instrumentId,
    sector: opp.strategyFamily,
    currency: 'USD',
    strategyCapsule: Object.freeze({
      strategyId: opp.strategyId,
      version: '1',
      qualificationState: 'QUALIFIED',
      validationEvidenceRefs: opp.evidenceRefs,
    }),
    researchValue: Object.freeze({
      evidenceQuality:
        evidenceQualityScore >= 80 ? 'HIGH' : evidenceQualityScore >= 50 ? 'MEDIUM' : 'LOW',
      unresolvedUncertainty: opp.regimeMatch.compatible ? 'LOW' : 'MEDIUM',
      specialistDisagreement: false,
      estimatedOpportunitySizeMinor: '10000',
      confidenceState: opp.regimeMatch.compatible ? 'CALIBRATED' : 'LOW_CONFIDENCE',
      calibratedProbabilityBps: rewardFactor?.score !== null ? rewardFactor!.score! * 100 : null,
      estimatedResearchCostMinor: costs.inferenceCostMinor,
      opportunityHalfLifeHours: 48,
      timeRemainingHours: 24,
      dataAvailable: opp.dataQualityWarnings.every((w) => w.severity !== 'FAIL'),
      accountSizeFeasible: true,
    }),
    specialistOutputs: Object.freeze([]),
    evidenceRefs: opp.evidenceRefs,
    estimatedDeploymentMinor: '10000',
    liquidityState:
      (opp.scorecard.factors.find((f) => f.factorId === 'liquidity')?.score ?? 0) >= 50
        ? 'ADEQUATE'
        : 'THIN',
    costAssumptions: costs,
  });
}
