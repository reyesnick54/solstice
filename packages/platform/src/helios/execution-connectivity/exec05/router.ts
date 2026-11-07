import type {
  ExecutionVenueCandidate,
  RoutingDecision,
  SmartRoutingRequest,
} from './types.ts';
import { EXEC05_SCHEMA } from './taxonomy.ts';
import { smartRoutingDecisionIdFor } from './ids.ts';
import { buildExecutionQualityEstimate, buildRoutingScorecard } from './scorecard.ts';
import type { ProhibitedSoleSelectionReason } from './taxonomy.ts';

type RankedCandidate = {
  readonly candidate: ExecutionVenueCandidate;
  readonly scorecard: ReturnType<typeof buildRoutingScorecard>;
  readonly quality: ReturnType<typeof buildExecutionQualityEstimate>;
};

function isEligible(candidate: ExecutionVenueCandidate): boolean {
  return (
    candidate.eligible &&
    candidate.ineligibleReasons.length === 0 &&
    candidate.venueHealth !== 'UNAVAILABLE' &&
    candidate.providerHealth !== 'UNAVAILABLE'
  );
}

function rankCandidates(request: SmartRoutingRequest): readonly RankedCandidate[] {
  const eligible = request.candidates.filter(isEligible);
  const ranked = eligible.map((candidate) =>
    Object.freeze({
      candidate,
      scorecard: buildRoutingScorecard({
        candidate,
        orderAction: request.orderAction,
        orderSizeMinorUnits: request.orderSizeMinorUnits,
        urgency: request.urgency,
      }),
      quality: buildExecutionQualityEstimate(candidate, request.orderSizeMinorUnits),
    }),
  );
  return Object.freeze(
    [...ranked].sort((a, b) => {
      if (a.scorecard.expectedImplementationCostBps !== b.scorecard.expectedImplementationCostBps) {
        return a.scorecard.expectedImplementationCostBps - b.scorecard.expectedImplementationCostBps;
      }
      if (a.quality.expectedFillProbabilityPpm !== b.quality.expectedFillProbabilityPpm) {
        return b.quality.expectedFillProbabilityPpm - a.quality.expectedFillProbabilityPpm;
      }
      return a.candidate.candidateId.localeCompare(b.candidate.candidateId);
    }),
  );
}

function wouldWinSolelyOnRebate(winner: RankedCandidate, pool: readonly RankedCandidate[]): boolean {
  if (pool.length <= 1) return false;
  const highestRebate = Math.max(...pool.map((row) => row.candidate.rebateBps));
  if (winner.candidate.rebateBps < highestRebate) return false;
  const costLeader = [...pool].sort(
    (a, b) => a.scorecard.expectedImplementationCostBps - b.scorecard.expectedImplementationCostBps,
  )[0]!;
  return costLeader.candidate.candidateId !== winner.candidate.candidateId;
}

function wouldWinSolelyOnCommercialPreference(winner: RankedCandidate, pool: readonly RankedCandidate[]): boolean {
  if (pool.length <= 1) return false;
  const bestRank = Math.min(...pool.map((row) => row.candidate.commercialPreferenceRank));
  if (winner.candidate.commercialPreferenceRank > bestRank) return false;
  const costLeader = [...pool].sort(
    (a, b) => a.scorecard.expectedImplementationCostBps - b.scorecard.expectedImplementationCostBps,
  )[0]!;
  return costLeader.candidate.candidateId !== winner.candidate.candidateId;
}

function wouldWinSolelyOnPaymentRevenue(winner: RankedCandidate, pool: readonly RankedCandidate[]): boolean {
  if (pool.length <= 1) return false;
  const highestPfof = Math.max(...pool.map((row) => row.candidate.paymentForOrderFlowBps));
  if (winner.candidate.paymentForOrderFlowBps < highestPfof) return false;
  const costLeader = [...pool].sort(
    (a, b) => a.scorecard.expectedImplementationCostBps - b.scorecard.expectedImplementationCostBps,
  )[0]!;
  return costLeader.candidate.candidateId !== winner.candidate.candidateId;
}

function applyProhibitedSoleGuards(
  ranked: readonly RankedCandidate[],
): { readonly selected: RankedCandidate | null; readonly guards: readonly ProhibitedSoleSelectionReason[] } {
  if (ranked.length === 0) {
    return Object.freeze({ selected: null, guards: Object.freeze([]) });
  }
  const guards: ProhibitedSoleSelectionReason[] = [];
  for (const row of ranked) {
    let blocked = false;
    if (wouldWinSolelyOnRebate(row, ranked)) {
      guards.push('REBATE_HIGHEST');
      blocked = true;
    }
    if (wouldWinSolelyOnPaymentRevenue(row, ranked)) {
      guards.push('PAYMENT_REVENUE_HIGHEST');
      blocked = true;
    }
    if (wouldWinSolelyOnCommercialPreference(row, ranked)) {
      guards.push('COMMERCIAL_PREFERENCE');
      blocked = true;
    }
    if (!blocked) {
      return Object.freeze({ selected: row, guards: Object.freeze(guards) });
    }
  }
  return Object.freeze({ selected: ranked[0] ?? null, guards: Object.freeze(guards) });
}

function matchDirected(
  request: SmartRoutingRequest,
): ExecutionVenueCandidate | null {
  const instruction = request.directedInstruction;
  if (!instruction) return null;
  return (
    request.candidates.find((row) => {
      if (row.venueId !== instruction.requiredVenueId) return false;
      if (instruction.requiredProviderId && row.providerId !== instruction.requiredProviderId) return false;
      if (instruction.requiredAccountId && row.accountId !== instruction.requiredAccountId) return false;
      return true;
    }) ?? null
  );
}

function rejectedIds(request: SmartRoutingRequest, selectedId: string | null): readonly string[] {
  return Object.freeze(
    request.candidates
      .filter((row) => row.candidateId !== selectedId)
      .map((row) => row.candidateId),
  );
}

/**
 * Smart order router — minimizes expected implementation cost with transparent score components.
 * Does not issue Execution Authority.
 */
export class SmartOrderRouter {
  route(request: SmartRoutingRequest): RoutingDecision {
    const decisionId = smartRoutingDecisionIdFor(request.requestId, request.at);
    const directed = matchDirected(request);

    if (request.directedInstruction) {
      if (!directed || !isEligible(directed)) {
        return Object.freeze({
          schema: EXEC05_SCHEMA,
          decisionId,
          requestId: request.requestId,
          outcome: 'DIRECTED_INELIGIBLE',
          selectionMode: 'DIRECTED',
          selectedCandidateId: null,
          selectedVenueId: request.directedInstruction.requiredVenueId,
          selectedProviderId: request.directedInstruction.requiredProviderId,
          selectedAccountId: request.directedInstruction.requiredAccountId,
          selectedRouteId: null,
          scorecard: null,
          qualityEstimate: null,
          rejectedCandidateIds: rejectedIds(request, null),
          selectionReason: 'Customer-directed venue is not eligible; routing fails closed.',
          prohibitedSoleGuardsApplied: Object.freeze([]),
          directedInstructionHonored: false,
          grantsExecutionAuthority: false,
          authorizesFinancialExecution: false,
          decidedAt: request.at,
        });
      }
      const scorecard = buildRoutingScorecard({
        candidate: directed,
        orderAction: request.orderAction,
        orderSizeMinorUnits: request.orderSizeMinorUnits,
        urgency: request.urgency,
      });
      const qualityEstimate = buildExecutionQualityEstimate(directed, request.orderSizeMinorUnits);
      return Object.freeze({
        schema: EXEC05_SCHEMA,
        decisionId,
        requestId: request.requestId,
        outcome: 'VENUE_SELECTED',
        selectionMode: 'DIRECTED',
        selectedCandidateId: directed.candidateId,
        selectedVenueId: directed.venueId,
        selectedProviderId: directed.providerId,
        selectedAccountId: directed.accountId,
        selectedRouteId: directed.routeId,
        scorecard,
        qualityEstimate,
        rejectedCandidateIds: rejectedIds(request, directed.candidateId),
        selectionReason:
          `DIRECTED: mandate ${request.directedInstruction.mandateRef} requires venue ${directed.venueId}; ` +
          'not represented as HELIOS cost optimization.',
        prohibitedSoleGuardsApplied: Object.freeze([]),
        directedInstructionHonored: true,
        grantsExecutionAuthority: false,
        authorizesFinancialExecution: false,
        decidedAt: request.at,
      });
    }

    const ranked = rankCandidates(request);
    const { selected, guards } = applyProhibitedSoleGuards(ranked);
    if (!selected) {
      return Object.freeze({
        schema: EXEC05_SCHEMA,
        decisionId,
        requestId: request.requestId,
        outcome: 'NO_ELIGIBLE_VENUE',
        selectionMode: 'HELIOS_OPTIMIZED',
        selectedCandidateId: null,
        selectedVenueId: null,
        selectedProviderId: null,
        selectedAccountId: null,
        selectedRouteId: null,
        scorecard: null,
        qualityEstimate: null,
        rejectedCandidateIds: rejectedIds(request, null),
        selectionReason: 'No eligible venue candidates for quality-aware routing.',
        prohibitedSoleGuardsApplied: Object.freeze(guards),
        directedInstructionHonored: false,
        grantsExecutionAuthority: false,
        authorizesFinancialExecution: false,
        decidedAt: request.at,
      });
    }

    return Object.freeze({
      schema: EXEC05_SCHEMA,
      decisionId,
      requestId: request.requestId,
      outcome: 'VENUE_SELECTED',
      selectionMode: 'HELIOS_OPTIMIZED',
      selectedCandidateId: selected.candidate.candidateId,
      selectedVenueId: selected.candidate.venueId,
      selectedProviderId: selected.candidate.providerId,
      selectedAccountId: selected.candidate.accountId,
      selectedRouteId: selected.candidate.routeId,
      scorecard: selected.scorecard,
      qualityEstimate: selected.quality,
      rejectedCandidateIds: rejectedIds(request, selected.candidate.candidateId),
      selectionReason:
        `HELIOS_OPTIMIZED: minimized expected implementation cost (${selected.scorecard.expectedImplementationCostBps} bps) ` +
        `with transparent scorecard for ${selected.candidate.venueId}.`,
      prohibitedSoleGuardsApplied: Object.freeze(guards),
      directedInstructionHonored: false,
      grantsExecutionAuthority: false,
      authorizesFinancialExecution: false,
      decidedAt: request.at,
    });
  }
}
