import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { interpretMandateLanguage } from '../packages/agent/src/interpretation.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_H20_META_ALLOCATOR,
  HeliosMetaAllocatorService,
  InMemoryHeliosMetaAllocatorStore,
  META_ALLOCATOR_POLICY_VERSION,
  initialBudgetSnapshot,
  mandateBindingRefFromCompiled,
  metaAllocationCandidateIdFor,
  metaAllocationRunIdFor,
  sanitizeReuseForCustomer,
  validatePublicResearchReuse,
  workOrderIdFor,
  createEconomicWorkOrderDraft,
  type AccountStateReference,
  type EconomicWorkOrder,
  type MetaAllocationCandidateInput,
  type PortfolioContext,
  type TradingCostAssumptions,
  type WorkOrderScope,
} from '../packages/platform/src/helios/index.ts';
import { compileEconomicMandate, mandateDraftFromInterpretation } from '../packages/platform/src/mandate/compiler.ts';
import type { CompiledEconomicMandate } from '../packages/platform/src/mandate/types.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-17T10:00:00.000Z');

function activeMandate(subjectId: string): CompiledEconomicMandate {
  const interpretation = interpretMandateLanguage({
    subjectId,
    sourceText: 'Keep at least $8,000 liquid. Ask me before any movement over $1,000.',
    now: NOW,
  });
  if (!interpretation.ok) throw new Error('interpretation');
  const draft = mandateDraftFromInterpretation(interpretation.value, NOW);
  const compiled = compileEconomicMandate({ draft, now: NOW });
  if (!compiled.ok) throw new Error('compile');
  return Object.freeze({ ...compiled.value, state: 'ACTIVE' });
}

function baseScope(): WorkOrderScope {
  return Object.freeze({
    objectiveClasses: Object.freeze(['RESEARCH', 'FINANCIAL_PROPOSAL'] as const),
    activityClasses: Object.freeze(['RESEARCH', 'FINANCIAL_PROPOSAL'] as const),
    productClasses: Object.freeze(['CASH', 'EQUITIES', 'ETF'] as const),
    capitalCeiling: { minorUnits: '100000', currency: 'USD' },
    accountIds: Object.freeze(['acct_checking']),
    jurisdiction: 'US' as import('../packages/domain/src/jurisdiction.ts').Jurisdiction,
    horizonDays: 30,
    toolIds: Object.freeze(['tool_research']),
    modelIds: Object.freeze(['mdl_s3m']),
  });
}

function activeWorkOrder(customerId: string, subjectId: string, key = 'h20'): EconomicWorkOrder {
  const mandate = activeMandate(subjectId);
  const scope = baseScope();
  const workOrderId = workOrderIdFor(customerId, key);
  const draft = createEconomicWorkOrderDraft({
    workOrderId,
    customerId: asCustomerId(customerId),
    subjectId,
    growObjectiveId: 'grow_h20',
    requestedScope: scope,
    mandateRef: mandateBindingRefFromCompiled(mandate, asCustomerId(customerId), NOW),
    approvalRef: null,
    requiredApprovalClass: 'NONE',
    now: NOW,
  });
  return Object.freeze({
    ...draft,
    state: 'ACTIVE',
    effectiveScope: scope,
    activatedAt: NOW,
    updatedAt: NOW,
  });
}

function baseCosts(overrides: Partial<TradingCostAssumptions> = {}): TradingCostAssumptions {
  return Object.freeze({
    minimumOrderSizeMinor: '5000',
    spreadBps: 10,
    commissionMinor: '100',
    slippageBps: 5,
    inferenceCostMinor: '200',
    dataCostMinor: '50',
    currency: 'USD',
    ...overrides,
  });
}

function baseAccount(overrides: Partial<AccountStateReference> = {}): AccountStateReference {
  return Object.freeze({
    accountId: 'acct_h20',
    availableCashMinor: '100000',
    currency: 'USD',
    reservedCashMinor: '0',
    accountSizeMinor: '100000',
    stateVersion: 'acct_v1',
    capturedAt: NOW,
    ...overrides,
  });
}

function basePortfolio(overrides: Partial<PortfolioContext> = {}): PortfolioContext {
  return Object.freeze({
    exposures: Object.freeze([]),
    sectorConcentrationBps: Object.freeze({}),
    currencyConcentrationBps: Object.freeze({ USD: 0 }),
    liquidityRequirementMinor: '10000',
    mandateConstraintRefs: Object.freeze([]),
    stateVersion: 'port_v1',
    ...overrides,
  });
}

function candidate(
  workOrder: EconomicWorkOrder,
  key: string,
  overrides: Partial<MetaAllocationCandidateInput> = {},
): MetaAllocationCandidateInput {
  const workOrderId = workOrder.workOrderId;
  return Object.freeze({
    candidateId: metaAllocationCandidateIdFor(workOrderId, key),
    workOrderId,
    customerId: workOrder.customerId,
    subjectId: workOrder.subjectId,
    instrumentId: 'SIM-ETF-1',
    sector: 'TECH',
    currency: 'USD',
    strategyCapsule: Object.freeze({
      strategyId: 'strat_h20',
      version: '1',
      qualificationState: 'QUALIFIED',
      validationEvidenceRefs: Object.freeze(['ev_strat_1']),
    }),
    researchValue: Object.freeze({
      evidenceQuality: 'HIGH',
      unresolvedUncertainty: 'LOW',
      specialistDisagreement: false,
      estimatedOpportunitySizeMinor: '50000',
      confidenceState: 'CALIBRATED',
      calibratedProbabilityBps: 6500,
      estimatedResearchCostMinor: '500',
      opportunityHalfLifeHours: 72,
      timeRemainingHours: 48,
      dataAvailable: true,
      accountSizeFeasible: true,
    }),
    specialistOutputs: Object.freeze([
      Object.freeze({
        specialistId: 'spec_market',
        role: 'MARKET_RESEARCH',
        stance: 'SUPPORTING',
        summary: 'Attractive setup',
        confidenceState: 'CALIBRATED',
        evidenceRefs: Object.freeze(['ev_1']),
      }),
    ]),
    evidenceRefs: Object.freeze(['ev_1', 'ev_2']),
    estimatedDeploymentMinor: '20000',
    liquidityState: 'ADEQUATE',
    costAssumptions: baseCosts(),
    publicResearchReuse: null,
    ...overrides,
  });
}

describe('HELIOS H20 Meta Allocator', () => {
  it('architecture guard: meta allocator does not bypass canonical authority', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const metaFindings = findings.filter((row) => row.file.includes('meta-allocator'));
    assert.equal(metaFindings.length, 0, metaFindings.map((row) => row.message).join('; '));
  });

  it('simulation posture unchanged', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('1. research budget low -> no excessive research', () => {
    const service = new HeliosMetaAllocatorService();
    const workOrder = activeWorkOrder('cust_h20_1', 'id_h20_1');
    const budget = initialBudgetSnapshot({ ceilingAmount: '600', unitKind: 'MONETARY_MINOR', currency: 'USD' });
    const result = service.evaluate({
      runId: metaAllocationRunIdFor(workOrder.workOrderId, 'run1'),
      workOrder,
      candidates: [candidate(workOrder, 'c1')],
      researchBudget: budget,
      accountState: baseAccount(),
      portfolio: basePortfolio(),
      maxSectorConcentrationBps: 4000,
      now: NOW,
    });
    assert.ok(result.ok);
    const decision = result.value.decisions[0]!;
    assert.ok(['DO_NOT_RESEARCH', 'RESEARCH_MINIMAL'].includes(decision.researchSpend.decision));
    assert.ok(decision.researchSpend.reasonCodes.includes('BUDGET_LOW'));
  });

  it('2. cheap high-value research -> investigate', () => {
    const service = new HeliosMetaAllocatorService();
    const workOrder = activeWorkOrder('cust_h20_2', 'id_h20_2');
    const budget = initialBudgetSnapshot({ ceilingAmount: '10000', unitKind: 'MONETARY_MINOR', currency: 'USD' });
    const c = candidate(workOrder, 'c2', {
      researchValue: Object.freeze({
        evidenceQuality: 'LOW',
        unresolvedUncertainty: 'HIGH',
        specialistDisagreement: true,
        estimatedOpportunitySizeMinor: '200000',
        confidenceState: 'LOW_CONFIDENCE',
        calibratedProbabilityBps: null,
        estimatedResearchCostMinor: '300',
        opportunityHalfLifeHours: 96,
        timeRemainingHours: 80,
        dataAvailable: true,
        accountSizeFeasible: true,
      }),
      strategyCapsule: Object.freeze({
        strategyId: 'strat_h20',
        version: '1',
        qualificationState: 'NEEDS_VALIDATION',
        validationEvidenceRefs: Object.freeze([]),
      }),
    });
    const result = service.evaluate({
      runId: metaAllocationRunIdFor(workOrder.workOrderId, 'run2'),
      workOrder,
      candidates: [c],
      researchBudget: budget,
      accountState: baseAccount(),
      portfolio: basePortfolio(),
      maxSectorConcentrationBps: 4000,
      now: NOW,
    });
    assert.ok(result.ok);
    const decision = result.value.decisions[0]!;
    assert.equal(decision.disposition, 'INVESTIGATE');
    assert.ok(['RESEARCH_STANDARD', 'RESEARCH_DEEPER', 'RESEARCH_MINIMAL'].includes(decision.researchSpend.decision));
  });

  it('3. insufficient evidence -> no proposal', () => {
    const service = new HeliosMetaAllocatorService();
    const workOrder = activeWorkOrder('cust_h20_3', 'id_h20_3');
    const budget = initialBudgetSnapshot({ ceilingAmount: '5000', unitKind: 'MONETARY_MINOR', currency: 'USD' });
    const c = candidate(workOrder, 'c3', {
      researchValue: Object.freeze({
        evidenceQuality: 'INSUFFICIENT',
        unresolvedUncertainty: 'HIGH',
        specialistDisagreement: false,
        estimatedOpportunitySizeMinor: '50000',
        confidenceState: 'UNKNOWN',
        calibratedProbabilityBps: null,
        estimatedResearchCostMinor: '500',
        opportunityHalfLifeHours: 72,
        timeRemainingHours: 48,
        dataAvailable: true,
        accountSizeFeasible: true,
      }),
    });
    const result = service.evaluate({
      runId: metaAllocationRunIdFor(workOrder.workOrderId, 'run3'),
      workOrder,
      candidates: [c],
      researchBudget: budget,
      accountState: baseAccount(),
      portfolio: basePortfolio(),
      maxSectorConcentrationBps: 4000,
      now: NOW,
    });
    assert.ok(result.ok);
    const decision = result.value.decisions[0]!;
    assert.notEqual(decision.disposition, 'PROPOSE');
    assert.ok(decision.reasonCodes.includes('INSUFFICIENT_EVIDENCE'));
  });

  it('4. strategy unqualified -> no proposal', () => {
    const service = new HeliosMetaAllocatorService();
    const workOrder = activeWorkOrder('cust_h20_4', 'id_h20_4');
    const budget = initialBudgetSnapshot({ ceilingAmount: '5000', unitKind: 'MONETARY_MINOR', currency: 'USD' });
    const c = candidate(workOrder, 'c4', {
      strategyCapsule: Object.freeze({
        strategyId: 'strat_bad',
        version: '1',
        qualificationState: 'UNQUALIFIED',
        validationEvidenceRefs: Object.freeze([]),
      }),
    });
    const result = service.evaluate({
      runId: metaAllocationRunIdFor(workOrder.workOrderId, 'run4'),
      workOrder,
      candidates: [c],
      researchBudget: budget,
      accountState: baseAccount(),
      portfolio: basePortfolio(),
      maxSectorConcentrationBps: 4000,
      now: NOW,
    });
    assert.ok(result.ok);
    const decision = result.value.decisions[0]!;
    assert.notEqual(decision.disposition, 'PROPOSE');
    assert.ok(decision.reasonCodes.includes('STRATEGY_UNQUALIFIED'));
  });

  it('5. account too small -> no economically irrational deployment', () => {
    const service = new HeliosMetaAllocatorService();
    const workOrder = activeWorkOrder('cust_h20_5', 'id_h20_5');
    const budget = initialBudgetSnapshot({ ceilingAmount: '5000', unitKind: 'MONETARY_MINOR', currency: 'USD' });
    const c = candidate(workOrder, 'c5', {
      estimatedDeploymentMinor: '3000',
      costAssumptions: baseCosts({ minimumOrderSizeMinor: '5000' }),
    });
    const result = service.evaluate({
      runId: metaAllocationRunIdFor(workOrder.workOrderId, 'run5'),
      workOrder,
      candidates: [c],
      researchBudget: budget,
      accountState: baseAccount({ accountSizeMinor: '4000', availableCashMinor: '4000' }),
      portfolio: basePortfolio(),
      maxSectorConcentrationBps: 4000,
      now: NOW,
    });
    assert.ok(result.ok);
    const decision = result.value.decisions[0]!;
    assert.notEqual(decision.disposition, 'PROPOSE');
    assert.ok(decision.reasonCodes.includes('ACCOUNT_TOO_SMALL'));
  });

  it('6. costs consume edge -> no action', () => {
    const service = new HeliosMetaAllocatorService();
    const workOrder = activeWorkOrder('cust_h20_6', 'id_h20_6');
    const budget = initialBudgetSnapshot({ ceilingAmount: '5000', unitKind: 'MONETARY_MINOR', currency: 'USD' });
    const c = candidate(workOrder, 'c6', {
      estimatedDeploymentMinor: '10000',
      costAssumptions: baseCosts({
        commissionMinor: '5000',
        inferenceCostMinor: '3000',
        dataCostMinor: '2000',
        spreadBps: 500,
        slippageBps: 500,
      }),
    });
    const result = service.evaluate({
      runId: metaAllocationRunIdFor(workOrder.workOrderId, 'run6'),
      workOrder,
      candidates: [c],
      researchBudget: budget,
      accountState: baseAccount(),
      portfolio: basePortfolio(),
      maxSectorConcentrationBps: 4000,
      now: NOW,
    });
    assert.ok(result.ok);
    const decision = result.value.decisions[0]!;
    assert.notEqual(decision.disposition, 'PROPOSE');
    assert.ok(decision.reasonCodes.includes('COSTS_CONSUME_EDGE'));
  });

  it('7. insufficient liquidity -> reject/wait', () => {
    const service = new HeliosMetaAllocatorService();
    const workOrder = activeWorkOrder('cust_h20_7', 'id_h20_7');
    const budget = initialBudgetSnapshot({ ceilingAmount: '5000', unitKind: 'MONETARY_MINOR', currency: 'USD' });
    const c = candidate(workOrder, 'c7', { liquidityState: 'INSUFFICIENT' });
    const result = service.evaluate({
      runId: metaAllocationRunIdFor(workOrder.workOrderId, 'run7'),
      workOrder,
      candidates: [c],
      researchBudget: budget,
      accountState: baseAccount(),
      portfolio: basePortfolio(),
      maxSectorConcentrationBps: 4000,
      now: NOW,
    });
    assert.ok(result.ok);
    const decision = result.value.decisions[0]!;
    assert.notEqual(decision.disposition, 'PROPOSE');
    assert.ok(decision.reasonCodes.includes('INSUFFICIENT_LIQUIDITY'));
  });

  it('8. concentration limit -> narrow/reject', () => {
    const service = new HeliosMetaAllocatorService();
    const workOrder = activeWorkOrder('cust_h20_8', 'id_h20_8');
    const budget = initialBudgetSnapshot({ ceilingAmount: '5000', unitKind: 'MONETARY_MINOR', currency: 'USD' });
    const c = candidate(workOrder, 'c8', { sector: 'TECH', estimatedDeploymentMinor: '50000' });
    const result = service.evaluate({
      runId: metaAllocationRunIdFor(workOrder.workOrderId, 'run8'),
      workOrder,
      candidates: [c],
      researchBudget: budget,
      accountState: baseAccount(),
      portfolio: basePortfolio({
        sectorConcentrationBps: Object.freeze({ TECH: 4000 }),
      }),
      maxSectorConcentrationBps: 4000,
      now: NOW,
    });
    assert.ok(result.ok);
    const decision = result.value.decisions[0]!;
    assert.ok(decision.reasonCodes.includes('CONCENTRATION_LIMIT'));
    assert.notEqual(decision.disposition, 'PROPOSE');
  });

  it('9. two candidates compete for same capital', () => {
    const service = new HeliosMetaAllocatorService();
    const workOrder = activeWorkOrder('cust_h20_9', 'id_h20_9');
    const budget = initialBudgetSnapshot({ ceilingAmount: '5000', unitKind: 'MONETARY_MINOR', currency: 'USD' });
    const c1 = candidate(workOrder, 'c9a', { estimatedDeploymentMinor: '25000', sector: 'TECH' });
    const c2 = candidate(workOrder, 'c9b', {
      estimatedDeploymentMinor: '25000',
      sector: 'HEALTH',
      researchValue: Object.freeze({
        ...c1.researchValue,
        estimatedOpportunitySizeMinor: '20000',
      }),
    });
    const result = service.evaluate({
      runId: metaAllocationRunIdFor(workOrder.workOrderId, 'run9'),
      workOrder,
      candidates: [c1, c2],
      researchBudget: budget,
      accountState: baseAccount({ availableCashMinor: '29000' }),
      portfolio: basePortfolio({ liquidityRequirementMinor: '3000' }),
      maxSectorConcentrationBps: 9000,
      now: NOW,
    });
    assert.ok(result.ok);
    assert.equal(result.value.coordinationClaims.length, 1);
    const winners = result.value.decisions.filter((row) => row.disposition === 'PROPOSE');
    assert.equal(winners.length, 1);
    const losers = result.value.decisions.filter((row) => row.disposition === 'WAIT');
    assert.equal(losers.length, 1);
  });

  it('10. same cash not double-counted across runs', () => {
    const store = new InMemoryHeliosMetaAllocatorStore();
    const service = new HeliosMetaAllocatorService({ store });
    const workOrder = activeWorkOrder('cust_h20_10', 'id_h20_10');
    const budget = initialBudgetSnapshot({ ceilingAmount: '5000', unitKind: 'MONETARY_MINOR', currency: 'USD' });
    const account = baseAccount({ availableCashMinor: '50000' });
    const c1 = candidate(workOrder, 'c10a', { estimatedDeploymentMinor: '46000' });
    const first = service.evaluate({
      runId: metaAllocationRunIdFor(workOrder.workOrderId, 'run10a'),
      workOrder,
      candidates: [c1],
      researchBudget: budget,
      accountState: account,
      portfolio: basePortfolio({ liquidityRequirementMinor: '3000' }),
      maxSectorConcentrationBps: 8000,
      now: NOW,
    });
    assert.ok(first.ok);
    assert.equal(first.value.coordinationClaims.length, 1);

    const c2 = candidate(workOrder, 'c10b', { estimatedDeploymentMinor: '46000' });
    const second = service.evaluate({
      runId: metaAllocationRunIdFor(workOrder.workOrderId, 'run10b'),
      workOrder,
      candidates: [c2],
      researchBudget: budget,
      accountState: account,
      portfolio: basePortfolio({ liquidityRequirementMinor: '3000' }),
      maxSectorConcentrationBps: 8000,
      now: NOW,
    });
    assert.ok(second.ok);
    const secondDecision = second.value.decisions[0]!;
    assert.notEqual(secondDecision.disposition, 'PROPOSE');
    assert.ok(['WAIT', 'NO_ACTION'].includes(secondDecision.disposition));
    assert.equal(second.value.coordinationClaims.length, 0);
  });

  it('11. all candidates bad -> hold cash', () => {
    const service = new HeliosMetaAllocatorService();
    const workOrder = activeWorkOrder('cust_h20_11', 'id_h20_11');
    const budget = initialBudgetSnapshot({ ceilingAmount: '5000', unitKind: 'MONETARY_MINOR', currency: 'USD' });
    const bad = candidate(workOrder, 'c11', {
      strategyCapsule: Object.freeze({
        strategyId: 'bad',
        version: '1',
        qualificationState: 'REJECTED',
        validationEvidenceRefs: Object.freeze([]),
      }),
      liquidityState: 'INSUFFICIENT',
    });
    const result = service.evaluate({
      runId: metaAllocationRunIdFor(workOrder.workOrderId, 'run11'),
      workOrder,
      candidates: [bad],
      researchBudget: budget,
      accountState: baseAccount(),
      portfolio: basePortfolio(),
      maxSectorConcentrationBps: 4000,
      now: NOW,
    });
    assert.ok(result.ok);
    assert.equal(result.value.holdCash, true);
    assert.ok(result.value.decisions.every((row) => row.disposition !== 'PROPOSE'));
  });

  it('12. unknown confidence handled explicitly', () => {
    const service = new HeliosMetaAllocatorService();
    const workOrder = activeWorkOrder('cust_h20_12', 'id_h20_12');
    const budget = initialBudgetSnapshot({ ceilingAmount: '5000', unitKind: 'MONETARY_MINOR', currency: 'USD' });
    const c = candidate(workOrder, 'c12', {
      researchValue: Object.freeze({
        evidenceQuality: 'MEDIUM',
        unresolvedUncertainty: 'HIGH',
        specialistDisagreement: false,
        estimatedOpportunitySizeMinor: '50000',
        confidenceState: 'UNKNOWN',
        calibratedProbabilityBps: null,
        estimatedResearchCostMinor: '500',
        opportunityHalfLifeHours: 72,
        timeRemainingHours: 48,
        dataAvailable: true,
        accountSizeFeasible: true,
      }),
    });
    const result = service.evaluate({
      runId: metaAllocationRunIdFor(workOrder.workOrderId, 'run12'),
      workOrder,
      candidates: [c],
      researchBudget: budget,
      accountState: baseAccount(),
      portfolio: basePortfolio(),
      maxSectorConcentrationBps: 4000,
      now: NOW,
    });
    assert.ok(result.ok);
    const decision = result.value.decisions[0]!;
    assert.ok(decision.reasonCodes.includes('UNKNOWN_CONFIDENCE'));
    assert.notEqual(decision.disposition, 'PROPOSE');
  });

  it('13. public research reuse does not leak private data', () => {
    const reuse = sanitizeReuseForCustomer(
      Object.freeze({
        reuseId: 'reuse_1',
        sourceResearchId: 'pub_research_1',
        provenanceRef: 'prov_public',
        rights: 'PUBLIC',
        marginalCostMinor: '50',
        freshnessExpiresAt: asUtcInstant('2026-09-18T10:00:00.000Z'),
        customerContextLeaked: false,
      }),
      'cust_h20_13',
    );
    const check = validatePublicResearchReuse(reuse, 'cust_h20_13', NOW);
    assert.ok(check.ok);
    const privateReuse = Object.freeze({
      ...reuse,
      rights: 'CUSTOMER_PRIVATE' as const,
    });
    const blocked = validatePublicResearchReuse(privateReuse, 'cust_h20_14', NOW);
    assert.equal(blocked.ok, false);
  });

  it('14. recommendation itself has no financial effect', () => {
    const service = new HeliosMetaAllocatorService();
    const workOrder = activeWorkOrder('cust_h20_14', 'id_h20_14');
    const budget = initialBudgetSnapshot({ ceilingAmount: '5000', unitKind: 'MONETARY_MINOR', currency: 'USD' });
    const result = service.evaluate({
      runId: metaAllocationRunIdFor(workOrder.workOrderId, 'run14'),
      workOrder,
      candidates: [candidate(workOrder, 'c14')],
      researchBudget: budget,
      accountState: baseAccount(),
      portfolio: basePortfolio(),
      maxSectorConcentrationBps: 4000,
      now: NOW,
    });
    assert.ok(result.ok);
    assert.equal(result.value.grantsFinancialEffect, false);
    for (const decision of result.value.decisions) {
      assert.equal(decision.grantsFinancialEffect, false);
      assert.equal(decision.postsReservation, false);
      if (decision.capitalRecommendation) {
        assert.equal(decision.capitalRecommendation.grantsFinancialEffect, false);
        assert.equal(decision.capitalRecommendation.postsReservation, false);
      }
    }
  });

  it('15. restart persistence via store snapshot', () => {
    const store = new InMemoryHeliosMetaAllocatorStore();
    const service = new HeliosMetaAllocatorService({ store });
    const workOrder = activeWorkOrder('cust_h20_15', 'id_h20_15');
    const budget = initialBudgetSnapshot({ ceilingAmount: '5000', unitKind: 'MONETARY_MINOR', currency: 'USD' });
    const runId = metaAllocationRunIdFor(workOrder.workOrderId, 'run15');
    const result = service.evaluate({
      runId,
      workOrder,
      candidates: [candidate(workOrder, 'c15')],
      researchBudget: budget,
      accountState: baseAccount(),
      portfolio: basePortfolio(),
      maxSectorConcentrationBps: 4000,
      now: NOW,
    });
    assert.ok(result.ok);
    const snapshot = store.snapshot();
    const restored = new InMemoryHeliosMetaAllocatorStore();
    restored.restore(snapshot);
    assert.equal(restored.getRun(runId)?.runId, runId);
    assert.ok(restored.listDecisionsForCustomer(workOrder.customerId).length > 0);
  });

  it('16. customer isolation', () => {
    const store = new InMemoryHeliosMetaAllocatorStore();
    const service = new HeliosMetaAllocatorService({ store });
    const workOrderA = activeWorkOrder('cust_h20_a', 'id_h20_a');
    const workOrderB = activeWorkOrder('cust_h20_b', 'id_h20_b');
    const budget = initialBudgetSnapshot({ ceilingAmount: '5000', unitKind: 'MONETARY_MINOR', currency: 'USD' });
    service.evaluate({
      runId: metaAllocationRunIdFor(workOrderA.workOrderId, 'runA'),
      workOrder: workOrderA,
      candidates: [candidate(workOrderA, 'cA')],
      researchBudget: budget,
      accountState: baseAccount(),
      portfolio: basePortfolio(),
      maxSectorConcentrationBps: 4000,
      now: NOW,
    });
    service.evaluate({
      runId: metaAllocationRunIdFor(workOrderB.workOrderId, 'runB'),
      workOrder: workOrderB,
      candidates: [candidate(workOrderB, 'cB')],
      researchBudget: budget,
      accountState: baseAccount(),
      portfolio: basePortfolio(),
      maxSectorConcentrationBps: 4000,
      now: NOW,
    });
    assert.equal(store.listDecisionsForCustomer(asCustomerId('cust_h20_a')).length, 1);
    assert.equal(store.listDecisionsForCustomer(asCustomerId('cust_h20_b')).length, 1);
    assert.equal(store.listDecisionsForCustomer(asCustomerId('cust_other')).length, 0);
  });

  it('canonical binding marker and policy version', () => {
    assert.equal(HELIOS_H20_META_ALLOCATOR, 'HELIOS_H20_META_ALLOCATOR');
    assert.equal(META_ALLOCATOR_POLICY_VERSION, 'HELIOS_META_ALLOCATOR_POLICY_V1');
  });

  it('CASE A-E tradeoff scenarios via disposition mapping', () => {
    const service = new HeliosMetaAllocatorService();
    const workOrder = activeWorkOrder('cust_h20_cases', 'id_h20_cases');
    const budget = initialBudgetSnapshot({ ceilingAmount: '10000', unitKind: 'MONETARY_MINOR', currency: 'USD' });

    const caseA = candidate(workOrder, 'caseA', {
      researchValue: Object.freeze({
        evidenceQuality: 'LOW',
        unresolvedUncertainty: 'HIGH',
        specialistDisagreement: true,
        estimatedOpportunitySizeMinor: '300000',
        confidenceState: 'LOW_CONFIDENCE',
        calibratedProbabilityBps: null,
        estimatedResearchCostMinor: '200',
        opportunityHalfLifeHours: 120,
        timeRemainingHours: 100,
        dataAvailable: true,
        accountSizeFeasible: true,
      }),
      strategyCapsule: Object.freeze({
        strategyId: 's',
        version: '1',
        qualificationState: 'NEEDS_VALIDATION',
        validationEvidenceRefs: Object.freeze([]),
      }),
    });
    const caseAResult = service.evaluate({
      runId: metaAllocationRunIdFor(workOrder.workOrderId, 'caseA'),
      workOrder,
      candidates: [caseA],
      researchBudget: budget,
      accountState: baseAccount(),
      portfolio: basePortfolio(),
      maxSectorConcentrationBps: 4000,
      now: NOW,
    });
    assert.ok(caseAResult.ok);
    assert.equal(caseAResult.value.decisions[0]!.disposition, 'INVESTIGATE');

    const caseC = candidate(workOrder, 'caseC');
    const caseCResult = service.evaluate({
      runId: metaAllocationRunIdFor(workOrder.workOrderId, 'caseC'),
      workOrder,
      candidates: [caseC],
      researchBudget: budget,
      accountState: baseAccount(),
      portfolio: basePortfolio(),
      maxSectorConcentrationBps: 8000,
      now: NOW,
    });
    assert.ok(caseCResult.ok);
    assert.equal(caseCResult.value.decisions[0]!.disposition, 'PROPOSE');
  });
});
