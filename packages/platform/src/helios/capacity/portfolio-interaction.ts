/**
 * HELIOS H33 — portfolio concurrency and capital reservation scenarios.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import {
  HeliosMetaAllocatorService,
  InMemoryHeliosMetaAllocatorStore,
  initialBudgetSnapshot,
  metaAllocationCandidateIdFor,
  metaAllocationRunIdFor,
  type AccountStateReference,
  type EconomicWorkOrder,
  type MetaAllocationCandidateInput,
  type PortfolioContext,
  type TradingCostAssumptions,
  type WorkOrderScope,
} from '../index.ts';
import type { PortfolioInteractionResult } from './types.ts';

function parseMinor(value: string): bigint {
  return BigInt(value);
}

function sumClaimsMinor(claims: readonly { readonly claimedCapitalMinor: string }[]): bigint {
  let total = 0n;
  for (const claim of claims) {
    total += parseMinor(claim.claimedCapitalMinor);
  }
  return total;
}

export function buildPortfolioInteractionCandidate(
  workOrder: EconomicWorkOrder,
  key: string,
  deploymentMinor: string,
  overrides: Partial<MetaAllocationCandidateInput> = {},
): MetaAllocationCandidateInput {
  return Object.freeze({
    candidateId: metaAllocationCandidateIdFor(workOrder.workOrderId, key),
    workOrderId: workOrder.workOrderId,
    customerId: workOrder.customerId,
    subjectId: workOrder.subjectId,
    instrumentId: 'SIM-ETF-1',
    sector: 'TECH',
    currency: 'USD',
    strategyCapsule: Object.freeze({
      strategyId: `strat_${key}`,
      version: '1',
      qualificationState: 'QUALIFIED',
      validationEvidenceRefs: Object.freeze([`ev_${key}`]),
    }),
    researchValue: Object.freeze({
      evidenceQuality: 'HIGH',
      unresolvedUncertainty: 'LOW',
      specialistDisagreement: false,
      estimatedOpportunitySizeMinor: deploymentMinor,
      confidenceState: 'CALIBRATED',
      calibratedProbabilityBps: 6500,
      estimatedResearchCostMinor: '200',
      opportunityHalfLifeHours: 72,
      timeRemainingHours: 48,
      dataAvailable: true,
      accountSizeFeasible: true,
    }),
    specialistOutputs: Object.freeze([]),
    evidenceRefs: Object.freeze([`ev_${key}`]),
    estimatedDeploymentMinor: deploymentMinor,
    liquidityState: 'ADEQUATE',
    costAssumptions: Object.freeze({
      minimumOrderSizeMinor: '1000',
      spreadBps: 10,
      commissionMinor: '100',
      slippageBps: 5,
      inferenceCostMinor: '150',
      dataCostMinor: '50',
      currency: 'USD',
    } satisfies TradingCostAssumptions),
    publicResearchReuse: null,
    ...overrides,
  });
}

export function runTripleStrategyCapitalRace(input: {
  readonly workOrder: EconomicWorkOrder;
  readonly availableMinor: string;
  readonly perStrategyMinor: string;
  readonly liquidityRequirementMinor: string;
  readonly now: UtcInstant;
}): PortfolioInteractionResult {
  const service = new HeliosMetaAllocatorService();
  const budget = initialBudgetSnapshot({
    ceilingAmount: '5000',
    unitKind: 'MONETARY_MINOR',
    currency: 'USD',
  });
  const account: AccountStateReference = Object.freeze({
    accountId: 'acct_h33_race',
    availableCashMinor: input.availableMinor,
    currency: 'USD',
    reservedCashMinor: '0',
    accountSizeMinor: input.availableMinor,
    stateVersion: 'acct_v1',
    capturedAt: input.now,
  });
  const portfolio: PortfolioContext = Object.freeze({
    exposures: Object.freeze([]),
    sectorConcentrationBps: Object.freeze({}),
    currencyConcentrationBps: Object.freeze({ USD: 0 }),
    liquidityRequirementMinor: input.liquidityRequirementMinor,
    mandateConstraintRefs: Object.freeze([]),
    stateVersion: 'port_v1',
  });

  const candidates = [
    buildPortfolioInteractionCandidate(input.workOrder, 's1', input.perStrategyMinor),
    buildPortfolioInteractionCandidate(input.workOrder, 's2', input.perStrategyMinor, {
      sector: 'HEALTH',
      instrumentId: 'SIM-ETF-2',
    }),
    buildPortfolioInteractionCandidate(input.workOrder, 's3', input.perStrategyMinor, {
      sector: 'ENERGY',
      instrumentId: 'SIM-ETF-3',
    }),
  ];

  const result = service.evaluate({
    runId: metaAllocationRunIdFor(input.workOrder.workOrderId, 'h33_race'),
    workOrder: input.workOrder,
    candidates,
    researchBudget: budget,
    accountState: account,
    portfolio,
    maxSectorConcentrationBps: 9000,
    now: input.now,
  });

  const blockers: string[] = [];
  if (!result.ok) {
    blockers.push(result.error.message);
    return Object.freeze({
      scenario: 'triple_strategy_capital_race',
      passed: false,
      totalClaimedMinor: '0',
      availableMinor: input.availableMinor,
      reservedMinor: '0',
      blockers: Object.freeze(blockers),
    });
  }

  const totalClaimed = sumClaimsMinor(result.value.coordinationClaims);
  const available = parseMinor(input.availableMinor);
  const perStrategy = parseMinor(input.perStrategyMinor);
  const tripleRequest = perStrategy * 3n;

  if (totalClaimed > available) {
    blockers.push(`overspend: claimed ${totalClaimed} > available ${available}`);
  }
  if (totalClaimed > tripleRequest) {
    blockers.push(`triple_overallocation: claimed ${totalClaimed} > combined request ${tripleRequest}`);
  }

  const proposeCount = result.value.decisions.filter((row) => row.disposition === 'PROPOSE').length;
  if (proposeCount > 2) {
    blockers.push(`too many concurrent full proposals: ${proposeCount}`);
  }

  return Object.freeze({
    scenario: 'triple_strategy_capital_race',
    passed: blockers.length === 0,
    totalClaimedMinor: totalClaimed.toString(),
    availableMinor: input.availableMinor,
    reservedMinor: '0',
    blockers: Object.freeze(blockers),
  });
}

export function runWithdrawalDuringCapitalRequest(input: {
  readonly workOrder: EconomicWorkOrder;
  readonly availableMinor: string;
  readonly withdrawalMinor: string;
  readonly perStrategyMinor: string;
  readonly now: UtcInstant;
}): PortfolioInteractionResult {
  const store = new InMemoryHeliosMetaAllocatorStore();
  const service = new HeliosMetaAllocatorService({ store });
  const budget = initialBudgetSnapshot({
    ceilingAmount: '5000',
    unitKind: 'MONETARY_MINOR',
    currency: 'USD',
  });
  const account: AccountStateReference = Object.freeze({
    accountId: 'acct_h33_withdraw',
    availableCashMinor: input.availableMinor,
    currency: 'USD',
    reservedCashMinor: '0',
    accountSizeMinor: input.availableMinor,
    stateVersion: 'acct_v1',
    capturedAt: input.now,
  });
  const portfolio: PortfolioContext = Object.freeze({
    exposures: Object.freeze([]),
    sectorConcentrationBps: Object.freeze({}),
    currencyConcentrationBps: Object.freeze({ USD: 0 }),
    liquidityRequirementMinor: '2000',
    mandateConstraintRefs: Object.freeze([]),
    stateVersion: 'port_v1',
  });

  const first = service.evaluate({
    runId: metaAllocationRunIdFor(input.workOrder.workOrderId, 'h33_wd_a'),
    workOrder: input.workOrder,
    candidates: [buildPortfolioInteractionCandidate(input.workOrder, 'wd1', input.perStrategyMinor)],
    researchBudget: budget,
    accountState: account,
    portfolio,
    maxSectorConcentrationBps: 9000,
    now: input.now,
  });

  const blockers: string[] = [];
  if (!first.ok) {
    blockers.push(first.error.message);
    return Object.freeze({
      scenario: 'withdrawal_during_capital_request',
      passed: false,
      totalClaimedMinor: '0',
      availableMinor: input.availableMinor,
      reservedMinor: '0',
      blockers: Object.freeze(blockers),
    });
  }

  const claimedAfterFirst = sumClaimsMinor(first.value.coordinationClaims);
  const postWithdrawalAvailable = parseMinor(input.availableMinor) - parseMinor(input.withdrawalMinor);
  if (postWithdrawalAvailable < 0n) {
    blockers.push('withdrawal exceeds available');
  }

  const reducedAccount: AccountStateReference = Object.freeze({
    ...account,
    availableCashMinor: postWithdrawalAvailable.toString(),
  });

  const second = service.evaluate({
    runId: metaAllocationRunIdFor(input.workOrder.workOrderId, 'h33_wd_b'),
    workOrder: input.workOrder,
    candidates: [
      buildPortfolioInteractionCandidate(input.workOrder, 'wd2', input.perStrategyMinor, {
        sector: 'HEALTH',
      }),
    ],
    researchBudget: budget,
    accountState: reducedAccount,
    portfolio,
    maxSectorConcentrationBps: 9000,
    now: input.now,
  });

  if (!second.ok) {
    blockers.push(second.error.message);
  } else {
    const totalAfterSecond = claimedAfterFirst + sumClaimsMinor(second.value.coordinationClaims);
    const availableAfterWithdrawal = postWithdrawalAvailable - 2000n;
    if (totalAfterSecond > availableAfterWithdrawal && second.value.coordinationClaims.length > 0) {
      blockers.push(
        `post-withdrawal over-allocation: total ${totalAfterSecond} > ${availableAfterWithdrawal}`,
      );
    }
  }

  return Object.freeze({
    scenario: 'withdrawal_during_capital_request',
    passed: blockers.length === 0,
    totalClaimedMinor: claimedAfterFirst.toString(),
    availableMinor: postWithdrawalAvailable.toString(),
    reservedMinor: input.withdrawalMinor,
    blockers: Object.freeze(blockers),
  });
}

export function runAllPortfolioInteractionScenarios(input: {
  readonly workOrder: EconomicWorkOrder;
  readonly now: UtcInstant;
}): readonly PortfolioInteractionResult[] {
  return Object.freeze([
    runTripleStrategyCapitalRace({
      workOrder: input.workOrder,
      availableMinor: '1000000',
      perStrategyMinor: '500000',
      liquidityRequirementMinor: '200000',
      now: input.now,
    }),
    runWithdrawalDuringCapitalRequest({
      workOrder: input.workOrder,
      availableMinor: '1000000',
      withdrawalMinor: '300000',
      perStrategyMinor: '400000',
      now: input.now,
    }),
  ]);
}

