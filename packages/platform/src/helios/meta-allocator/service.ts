import { randomUUID } from 'node:crypto';

import type { EvidenceVault } from '@solstice/evidence';
import { err, ok, type Result, type UtcInstant } from '@solstice/domain';
import { computeRemainingBudget } from '../budget.ts';
import { recordConfidencePrediction } from './calibration.ts';
import { allocateCompetingCapital, rankCandidatesForCapital } from './capital-coordination.ts';
import { evaluateCandidateFeasibility } from './feasibility.ts';
import { sealMetaAllocatorDecision, sealMetaAllocatorRun } from './evidence.ts';
import {
  asCapitalRecommendationId,
  asResearchSpendRecommendationId,
  metaAllocationDecisionIdFor,
} from './ids.ts';
import { evaluatePortfolioConstraints } from './portfolio.ts';
import {
  combineReasonCodes,
  evaluateCapitalRecommendation,
  evaluateMetaDisposition,
  evidenceSufficientForProposal,
  META_ALLOCATOR_POLICY_VERSION,
} from './policy.ts';
import { evaluateResearchValue, researchSpendFromAssessment } from './research-value.ts';
import { sanitizeReuseForCustomer, validatePublicResearchReuse } from './research-reuse.ts';
import { InMemoryHeliosMetaAllocatorStore } from './store.ts';
import type {
  CapitalAllocationRecommendation,
  CostAttributionRecord,
  MetaAllocationDecision,
  MetaAllocationEvaluateInput,
  MetaAllocationRunResult,
  MetaAllocatorFailure,
  MetaAllocationCandidateInput,
} from './types.ts';

function parseMinor(value: string): bigint {
  return BigInt(value);
}

function budgetStateRef(snapshot: MetaAllocationEvaluateInput['researchBudget']): string {
  return `${snapshot.unitKind}:${snapshot.remainingBudget}:${snapshot.authorizedCeiling}`;
}

export class HeliosMetaAllocatorService {
  private readonly evidence?: EvidenceVault;
  private readonly store: InMemoryHeliosMetaAllocatorStore;

  constructor(options?: { readonly evidence?: EvidenceVault; readonly store?: InMemoryHeliosMetaAllocatorStore }) {
    if (options?.evidence !== undefined) {
      this.evidence = options.evidence;
    }
    this.store = options?.store ?? new InMemoryHeliosMetaAllocatorStore();
  }

  getStore(): InMemoryHeliosMetaAllocatorStore {
    return this.store;
  }

  evaluate(input: MetaAllocationEvaluateInput): Result<MetaAllocationRunResult, MetaAllocatorFailure> {
    if (input.workOrder.state !== 'ACTIVE') {
      return err({ code: 'WORK_ORDER_INACTIVE', message: 'work order must be ACTIVE for meta allocation' });
    }
    if (input.candidates.length === 0) {
      return err({ code: 'EMPTY_CANDIDATES', message: 'at least one candidate required' });
    }
    for (const candidate of input.candidates) {
      if (candidate.customerId !== input.workOrder.customerId) {
        return err({ code: 'CUSTOMER_MISMATCH', message: 'candidate customer must match work order' });
      }
    }

    const validityHours = input.validityHours ?? 24;
    const expiresAt = new Date(new Date(input.now).getTime() + validityHours * 3600_000).toISOString() as UtcInstant;
    const currency = input.accountState.currency;
    const budgetRef = budgetStateRef(input.researchBudget);

    const priorClaims = this.store
      .listRunsForCustomer(input.workOrder.customerId)
      .filter((run) => run.runId !== input.runId)
      .flatMap((run) => [...run.coordinationClaims])
      .filter((claim) => claim.currency === currency);

    const grossAvailableCash =
      parseMinor(input.accountState.availableCashMinor) - parseMinor(input.accountState.reservedCashMinor);
    let priorClaimedTotal = 0n;
    for (const claim of priorClaims) {
      priorClaimedTotal += parseMinor(claim.claimedCapitalMinor);
    }
    let availableCash = grossAvailableCash - priorClaimedTotal;
    if (availableCash < 0n) {
      availableCash = 0n;
    }

    const preliminary: {
      candidate: MetaAllocationCandidateInput;
      decision: MetaAllocationDecision;
      propose: boolean;
      requestedMinor: bigint;
    }[] = [];

    for (const candidate of input.candidates) {
      const reuse =
        candidate.publicResearchReuse != null
          ? sanitizeReuseForCustomer(candidate.publicResearchReuse, candidate.customerId)
          : null;
      if (reuse) {
        const reuseCheck = validatePublicResearchReuse(reuse, candidate.customerId, input.now);
        if (!reuseCheck.ok) {
          return err({ code: 'INVALID_INPUT', message: reuseCheck.reason });
        }
      }

      const researchAssessment = evaluateResearchValue(candidate.researchValue, input.researchBudget, reuse);
      const spendChoice = researchSpendFromAssessment(researchAssessment, candidate.researchValue, input.researchBudget);
      const feasibility = evaluateCandidateFeasibility(candidate, input.accountState, availableCash);
      const portfolio = evaluatePortfolioConstraints(
        candidate,
        input.portfolio,
        availableCash,
        input.maxSectorConcentrationBps,
        parseMinor(candidate.estimatedDeploymentMinor),
      );
      const evidenceOk = evidenceSufficientForProposal(
        candidate.researchValue.evidenceQuality,
        candidate.researchValue.confidenceState,
      );
      const capitalEval = evaluateCapitalRecommendation(
        candidate.strategyCapsule.qualificationState,
        feasibility,
        evidenceOk,
        portfolio.allowed,
      );

      const researchSpend = Object.freeze({
        recommendationId: asResearchSpendRecommendationId(`msr_${randomUUID()}`),
        decision: spendChoice.decision,
        maxResearchSpendMinor: spendChoice.maxSpendMinor,
        currency: input.researchBudget.currency ?? currency,
        assessment: researchAssessment,
        budgetSnapshotRef: budgetRef,
        reasonCodes: Object.freeze([...researchAssessment.reasonCodes]),
        expiresAt,
      });

      let capitalRecommendation: CapitalAllocationRecommendation | null = null;
      if (capitalEval.recommendation === 'PROPOSE' && portfolio.allowed) {
        const maxCapital = parseMinor(portfolio.adjustedMaxCapitalMinor);
        const pctBps =
          availableCash > 0n ? Number((maxCapital * 10000n) / availableCash) : 0;
        capitalRecommendation = Object.freeze({
          recommendationId: asCapitalRecommendationId(`mcr_${randomUUID()}`),
          candidateId: candidate.candidateId,
          workOrderId: candidate.workOrderId,
          customerId: candidate.customerId,
          strategyCapsule: candidate.strategyCapsule,
          availableCapitalRef: input.accountState,
          recommendedMaxCapitalMinor: portfolio.adjustedMaxCapitalMinor,
          recommendedPercentageBps: pctBps,
          expectedHoldingHorizonDays: input.workOrder.effectiveScope?.horizonDays ?? 30,
          costAssumptions: candidate.costAssumptions,
          liquidityState: candidate.liquidityState,
          concentrationImpactBps: portfolio.concentrationImpactBps,
          supportingOutputs: Object.freeze(
            candidate.specialistOutputs.filter((row) => row.stance === 'SUPPORTING'),
          ),
          opposingOutputs: Object.freeze(
            candidate.specialistOutputs.filter((row) => row.stance === 'OPPOSING'),
          ),
          uncertainty: candidate.researchValue.confidenceState,
          validityExpiresAt: expiresAt,
          recommendation: capitalEval.recommendation,
          reasonCodes: Object.freeze(capitalEval.reasonCodes),
          grantsFinancialEffect: false,
          postsReservation: false,
        });
      }

      const disposition = evaluateMetaDisposition({
        researchSpend: spendChoice.decision,
        researchAssessment,
        capitalRecommendation: capitalEval.recommendation,
        strategyState: candidate.strategyCapsule.qualificationState,
        feasibility,
      });

      const reasonCodes = combineReasonCodes(
        researchAssessment.reasonCodes,
        feasibility.reasonCodes,
        portfolio.reasonCodes,
        capitalEval.reasonCodes,
      );

      const decisionId = metaAllocationDecisionIdFor(input.runId, candidate.candidateId);
      const evidenceRefs: string[] = [...candidate.evidenceRefs];
      const specialistOutputRefs = candidate.specialistOutputs.map((row) => row.specialistId);

      const decision: MetaAllocationDecision = Object.freeze({
        decisionId,
        runId: input.runId,
        candidateId: candidate.candidateId,
        workOrderId: candidate.workOrderId,
        customerId: candidate.customerId,
        disposition,
        researchSpend,
        capitalRecommendation,
        feasibility: Object.freeze({ ...feasibility, concentrationImpactBps: portfolio.concentrationImpactBps }),
        reasonCodes,
        policyVersion: META_ALLOCATOR_POLICY_VERSION,
        evidenceRefs: Object.freeze(evidenceRefs),
        specialistOutputRefs: Object.freeze(specialistOutputRefs),
        accountStateRef: input.accountState,
        budgetStateRef: budgetRef,
        decidedAt: input.now,
        expiresAt,
        grantsFinancialEffect: false,
        postsReservation: false,
      });

      const sealed = sealMetaAllocatorDecision(this.evidence, decision);
      if (sealed) {
        evidenceRefs.push(sealed);
      }

      this.store.addCalibrationRecord(
        recordConfidencePrediction({
          candidateId: candidate.candidateId,
          predictedConfidenceState: candidate.researchValue.confidenceState,
          predictedProbabilityBps: candidate.researchValue.calibratedProbabilityBps,
          now: input.now,
        }),
      );

      const costRecords: CostAttributionRecord[] = [
        Object.freeze({
          class: 'RESEARCH_COST',
          amountMinor: researchSpend.maxResearchSpendMinor,
          currency: researchSpend.currency,
          candidateId: candidate.candidateId,
          recordedAt: input.now,
        }),
        Object.freeze({
          class: 'TRADING_COST',
          amountMinor: feasibility.estimatedTotalCostMinor,
          currency: candidate.costAssumptions.currency,
          candidateId: candidate.candidateId,
          recordedAt: input.now,
        }),
      ];
      for (const record of costRecords) {
        this.store.addCostRecord(record);
      }

      preliminary.push({
        candidate,
        decision,
        propose: capitalEval.recommendation === 'PROPOSE' && capitalRecommendation != null,
        requestedMinor: parseMinor(portfolio.adjustedMaxCapitalMinor),
      });
    }

    const ranked = rankCandidatesForCapital(
      preliminary.map((row) => ({
        candidate: row.candidate,
        requestedMinor: row.requestedMinor,
        propose: row.propose,
      })),
    );

    const coordination = allocateCompetingCapital({
      ranked,
      availableCashMinor: availableCash,
      existingClaims: Object.freeze([]),
      currency,
    });

    const decisions = preliminary.map((row) => {
      const allocated = coordination.allocations.get(row.candidate.candidateId);
      if (!row.propose || allocated == null || allocated <= 0n) {
        if (row.decision.disposition === 'PROPOSE') {
          return Object.freeze({
            ...row.decision,
            disposition: 'WAIT' as const,
            reasonCodes: combineReasonCodes(row.decision.reasonCodes, ['CAPITAL_ALREADY_CLAIMED', 'COMPETING_CANDIDATE_PRIORITY']),
            capitalRecommendation: row.decision.capitalRecommendation
              ? Object.freeze({
                  ...row.decision.capitalRecommendation,
                  recommendation: 'WAIT' as const,
                  recommendedMaxCapitalMinor: '0',
                  recommendedPercentageBps: 0,
                })
              : null,
          });
        }
        return row.decision;
      }
      if (row.decision.capitalRecommendation) {
        const pctBps = availableCash > 0n ? Number((allocated * 10000n) / availableCash) : 0;
        return Object.freeze({
          ...row.decision,
          capitalRecommendation: Object.freeze({
            ...row.decision.capitalRecommendation,
            recommendedMaxCapitalMinor: allocated.toString(),
            recommendedPercentageBps: pctBps,
          }),
        });
      }
      return row.decision;
    });

    const anyPropose = decisions.some((row) => row.disposition === 'PROPOSE');
    const holdCash = !anyPropose;
    const reasonCodes = holdCash ? (['NO_QUALIFYING_CANDIDATES', 'HOLD_CASH'] as const) : ([] as const);

    const run: MetaAllocationRunResult = Object.freeze({
      runId: input.runId,
      workOrderId: input.workOrder.workOrderId,
      customerId: input.workOrder.customerId,
      decisions: Object.freeze(decisions),
      coordinationClaims: coordination.claims,
      unallocatedCashMinor: coordination.unallocatedCashMinor,
      currency,
      holdCash,
      decidedAt: input.now,
      policyVersion: META_ALLOCATOR_POLICY_VERSION,
      grantsFinancialEffect: false,
    });

    sealMetaAllocatorRun(this.evidence, run);
    this.store.putRun(run);

    void reasonCodes;
    void computeRemainingBudget;

    return ok(run);
  }
}
