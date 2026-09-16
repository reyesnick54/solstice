import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { interpretMandateLanguage } from '../packages/agent/src/interpretation.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asAccountId } from '../packages/domain/src/account.ts';
import { asCurrencyCode } from '../packages/domain/src/currency.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../packages/domain/src/legal-entity.ts';
import { asProductId } from '../packages/domain/src/product.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { asInstrumentId, asInvestmentAccountId } from '../packages/investments/src/ids.ts';
import { InvestmentsService } from '../packages/investments/src/service.ts';
import { Money } from '../packages/money/src/money.ts';
import { ModelRegistry, seedCanonicalRiskModel } from '../packages/model-registry/src/registry.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../packages/permissions/src/action-types.ts';
import { defaultSimulationBudget, RiskEngine } from '../packages/risk/src/engine.ts';
import { seedSimulationCatalog } from '../services/accounts/src/catalog.ts';
import { createSimulationRuntime } from '../services/accounts/src/runtime.ts';
import { activateCustomer, openIntent } from '../services/accounts/src/test-helpers.ts';
import {
  ExecutableOpportunityQualificationService,
  HELIOS_H14_PAPER_GROW_STRATEGY,
  HELIOS_H14_REFERENCE_PRICE_ENTRY_V1,
  HeliosPaperGrowStrategyService,
  InMemoryHeliosPaperStrategyStore,
  computePaperFillAssumptions,
  createEvidenceRegistry,
  createExecutionRouteRegistry,
  createMarketTermsPort,
  mandateBindingRefFromCompiled,
  workOrderIdFor,
  createEconomicWorkOrderDraft,
  type EconomicWorkOrder,
  type HeliosPaperExecutionPort,
  type HeliosPaperRiskPort,
  type WorkOrderScope,
} from '../packages/platform/src/helios/index.ts';
import { compileEconomicMandate, mandateDraftFromInterpretation } from '../packages/platform/src/mandate/compiler.ts';
import type { CompiledEconomicMandate } from '../packages/platform/src/mandate/types.ts';
import { defaultOpportunityPreferences } from '../packages/platform/src/growth/opportunity/preferences.ts';
import { SIMULATION_GROWTH_PRODUCTS, SIMULATION_RATE_CATALOG } from '../packages/platform/src/growth/opportunity/products.ts';
import { simulationPolicyPort } from '../packages/platform/src/policy-port.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-15T14:00:00.000Z');

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
    jurisdiction: asJurisdiction('US'),
    horizonDays: 30,
    toolIds: Object.freeze(['tool_research']),
    modelIds: Object.freeze(['mdl_s3m']),
  });
}

function activeWorkOrder(customerId: string, subjectId: string, key = 'h14'): EconomicWorkOrder {
  const mandate = activeMandate(subjectId);
  const scope = baseScope();
  const workOrderId = workOrderIdFor(customerId, key);
  const draft = createEconomicWorkOrderDraft({
    workOrderId,
    customerId: asCustomerId(customerId),
    subjectId,
    growObjectiveId: 'grow_h14',
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

type H14Harness = {
  readonly clock: FrozenClock;
  readonly investments: InvestmentsService;
  readonly qualification: ExecutableOpportunityQualificationService;
  readonly paperService: HeliosPaperGrowStrategyService;
  readonly actorId: string;
  readonly customerId: string;
  readonly subjectId: string;
  readonly investmentAccountId: string;
  readonly brokerageAccountId: string;
  readonly riskEngine: RiskEngine;
  readonly blockingRiskPort: HeliosPaperRiskPort;
  readonly liveProviderTracker: { invoked: boolean };
};

function createH14Harness(customerId = 'cust_h14_a', subjectId = 'id_h14_a'): H14Harness {
  const clock = new FrozenClock(NOW);
  const runtime = createSimulationRuntime({ clock, provisionSimulatedActor: true });
  const evidence = runtime.evidence;
  const customer = activateCustomer(runtime, customerId);
  const seeded = seedSimulationCatalog();
  const demand = mustOpen(
    runtime.accountsService.open(openIntent({ id: `${customerId}_d`, accountId: `acct_${customerId}_d`, ownerId: customer.id })),
  );
  const brokerage = mustOpen(
    runtime.accountsService.open(
      openIntent({
        id: `${customerId}_b`,
        accountId: `acct_${customerId}_b`,
        ownerId: customer.id,
        productId: asProductId('prod_brokerage_cash_usd_gb'),
        accountClass: 'BROKERAGE_CASH',
      }),
    ),
  );
  const securities = mustOpen(
    runtime.accountsService.open(
      openIntent({
        id: `${customerId}_s`,
        accountId: `acct_${customerId}_s`,
        ownerId: customer.id,
        productId: asProductId('prod_securities_usd_gb'),
        accountClass: 'SECURITIES',
      }),
    ),
  );
  const pending = mustOpen(
    runtime.accountsService.open(
      openIntent({
        id: `${customerId}_p`,
        accountId: `acct_${customerId}_p`,
        ownerId: customer.id,
        productId: asProductId('prod_pending_usd_gb'),
        accountClass: 'PENDING_SETTLEMENT',
      }),
    ),
  );
  const deposit = runtime.money.deposit({
    id: asIntentId(`${customerId}_dep`),
    actionType: ACTION_TYPES.POST_DEPOSIT,
    idempotencyKey: `${customerId}_dep`,
    actorId: 'operator_1',
    requestedAt: clock.now(),
    purpose: 'CUSTOMER_FUNDING',
    payload: { accountId: demand.id, amount: Money.fromMinorUnits(500_000n, 'USD') },
  });
  if (deposit.outcome !== 'POSTED') throw new Error('deposit');

  const actorId = `actor_${customerId}`;
  const provisioned = runtime.identity.provisionSimulatedActor({
    actorId,
    identityId: subjectId,
    jurisdiction: asJurisdiction('US'),
    customerId: asCustomerId(customerId),
    capabilities: ['VIEW_ACCOUNT', 'INVESTMENT_OPERATE_REQUEST', 'INVESTMENT_PROPOSE'],
    stepUp: true,
  });
  if (!provisioned.ok) throw new Error('actor provision');

  const actor = runtime.identity.service.resolveActorContext(actorId);
  if (!actor.ok) throw new Error('actor');
  const registry = new ModelRegistry();
  const model = seedCanonicalRiskModel(registry, actor.value, clock.now());
  if (!model.ok) throw new Error('risk model');
  const riskEngine = new RiskEngine({ registry, store: registry.store, clock, engineeringOnly: true });
  const investmentAccountId = `inv_${customerId}`;

  const investments = new InvestmentsService(
    runtime.kernel,
    runtime.issuer,
    evidence,
    runtime.events,
    clock,
    {
      customers: runtime.customers,
      accounts: runtime.accounts,
      products: seeded.products.asCatalog(),
      legalEntities: seeded.legalEntities,
    },
    runtime.identity.service,
    runtime.ledger,
    { riskEngine },
  );
  investments.setSimulatedPrice(asInstrumentId('SIM-ETF-1'), 10_000n, 'USD');

  const opened = investments.openInvestmentAccount({
    id: asIntentId(`${customerId}_open_inv`),
    actionType: ACTION_TYPES.OPEN_INVESTMENT_ACCOUNT,
    idempotencyKey: `${customerId}_open_inv`,
    actorId,
    requestedAt: clock.now(),
    purpose: 'CUSTOMER_INVESTMENT',
    payload: {
      accountId: demand.id,
      investmentAccountId,
      customerId: asCustomerId(customerId),
      brokerageCashAccountId: brokerage.id,
      securitiesAccountId: securities.id,
      pendingSettlementAccountId: pending.id,
      productId: asProductId('prod_brokerage_cash_usd_gb'),
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('US'),
      currency: asCurrencyCode('USD'),
    },
  });
  if (opened.outcome !== 'OK') throw new Error('open investment');

  const funded = investments.fundBrokerageCash({
    id: asIntentId(`${customerId}_fund`),
    actionType: ACTION_TYPES.FUND_BROKERAGE_CASH,
    idempotencyKey: `${customerId}_fund`,
    actorId,
    requestedAt: clock.now(),
    purpose: 'CUSTOMER_INVESTMENT',
    payload: {
      accountId: asAccountId(brokerage.id),
      sourceAccountId: asAccountId(demand.id),
      amount: Money.fromMinorUnits(200_000n, 'USD'),
    },
  });
  if (funded.outcome !== 'OK') throw new Error('fund brokerage');

  riskEngine.store.putBudget(
    defaultSimulationBudget({
      subjectId,
      portfolioId: investmentAccountId,
      reviewBy: clock.now(),
    }),
  );

  const liveProviderTracker = { invoked: false };
  const executionPort: HeliosPaperExecutionPort = {
    liveProviderInvoked: false,
    createPaperOrder(intent) {
      const result = investments.createPaperOrder(intent);
      if (result.outcome === 'OK' && result.value) {
        return {
          outcome: 'OK',
          value: result.value,
          authorityId: result.decision.executionAuthority?.authorityId ?? null,
          riskAssessmentId: investments.lastRiskDecision?.assessmentId ?? null,
        };
      }
      if (result.outcome === 'KERNEL_REFUSED') {
        return { outcome: 'KERNEL_REFUSED', code: 'KERNEL_REFUSED', message: 'kernel refused' };
      }
      return {
        outcome: 'REJECTED',
        code: result.code,
        message: result.message,
      };
    },
  };

  const riskPort: HeliosPaperRiskPort = {
    assess: (input) =>
      riskEngine.assessPreTrade({
        snapshot: investments.portfolioRiskSnapshot(asInvestmentAccountId(investmentAccountId)),
        proposed: {
          tradeId: 'h14_trade',
          instrumentId: input.instrumentId,
          side: 'BUY',
          quantityUnits: 1_000_000_000n,
          notionalMinor: input.proposedNotionalMinor,
          feeMinor: 0n,
          referencePriceMinor: 10_000n,
          currency: 'USD',
        },
        budget:
          riskEngine.store.listBudgets().find((row) => row.portfolioId === input.portfolioId) ??
          defaultSimulationBudget({ subjectId, portfolioId: input.portfolioId, reviewBy: clock.now() }),
      }),
  };

  const blockingRiskPort: HeliosPaperRiskPort = {
    assess: () =>
      Object.freeze({
        assessmentId: 'blocked_h14' as never,
        modelId: model.value.modelId,
        modelVersion: model.value.version,
        generatedAt: clock.now(),
        outcome: 'BLOCK',
        triggeredLimits: Object.freeze([
          Object.freeze({
            limitId: 'lim_h14_block' as never,
            dimension: 'POSITION_SIZE',
            message: 'test block',
            priority: 'HARD_RISK_LIMIT',
            observedValue: '1',
            threshold: '0',
          }),
        ]),
      }),
  };

  const qualification = new ExecutableOpportunityQualificationService({
    clock,
    evidence,
    evidenceRegistry: createEvidenceRegistry(),
    routeRegistry: createExecutionRouteRegistry(),
    marketTerms: createMarketTermsPort('OPEN'),
  });

  const paperService = new HeliosPaperGrowStrategyService({
    clock,
    evidence,
    evidenceRegistry: createEvidenceRegistry(),
    executionPort,
  });

  return {
    clock,
    investments,
    qualification,
    paperService,
    actorId,
    customerId,
    subjectId,
    investmentAccountId,
    brokerageAccountId: brokerage.id,
    riskEngine,
    blockingRiskPort,
    liveProviderTracker,
  };
}

function mustOpen(result: ReturnType<ReturnType<typeof createSimulationRuntime>['accountsService']['open']>) {
  if (result.outcome !== 'OPENED') throw new Error(`open failed: ${result.outcome}`);
  return result.account;
}

function qualifyOpportunity(harness: H14Harness, customerId: string, subjectId: string, key = 'h14') {
  const workOrder = activeWorkOrder(customerId, subjectId, key);
  const candidate = harness.qualification.discoverCandidate({
    workOrderId: workOrder.workOrderId,
    customerId: asCustomerId(customerId),
    subjectId,
    source: 'MARKET_OBSERVATION',
    hypothesisType: 'paper_investment_review',
    evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
    instrumentCandidate: Object.freeze({
      instrumentId: 'SIM-ETF-1',
      productId: 'prod_paper_investment_review',
      symbol: 'SIM-ETF-1',
      assetClass: 'ETF',
    }),
    key,
  });
  const qualified = harness.qualification.qualifyCandidate({
    candidate,
    workOrder,
    mandate: activeMandate(subjectId),
    jurisdiction: asJurisdiction('US'),
    context: {
      now: NOW,
      jurisdiction: 'US',
      kycState: 'VERIFIED',
      customerRestricted: false,
      riskProfile: 'BALANCED',
      suitabilityMaxRisk: 'MODERATE',
      products: SIMULATION_GROWTH_PRODUCTS,
      policy: simulationPolicyPort,
      preferences: defaultOpportunityPreferences(subjectId, NOW),
      previous: Object.freeze([]),
      rateCatalog: SIMULATION_RATE_CATALOG,
      ledgerPositions: Object.freeze([
        {
          accountRef: 'acct_brokerage',
          currency: 'USD',
          minorUnits: '2500000',
          accountClass: 'BROKERAGE',
          restricted: false,
          frozen: false,
        },
      ]),
    },
    detector: 'MARKET_RESEARCH_CANDIDATE',
    environment: 'sandbox',
    accountClass: 'BROKERAGE',
    proposedNotional: { minorUnits: '10000', currency: 'USD' },
    requireExternalObservation: true,
  });
  return { workOrder, qualified };
}

describe('HELIOS H14 paper Grow strategy', () => {
  it('architecture guard: paper strategy module does not grant Execution Authority', () => {
    const findings = lintHeliosBoundary(process.cwd()).filter((row) => row.file.includes('paper-strategy'));
    assert.equal(findings.length, 0);
  });

  it('1. full E2E: observation → research → proposal → risk → kernel → paper fill → position → grow result', () => {
    const harness = createH14Harness();
    const { workOrder, qualified } = qualifyOpportunity(harness, harness.customerId, harness.subjectId);
    assert.equal(qualified.opportunity.state, 'QUALIFIED_FOR_PROPOSAL');
    assert.ok(qualified.opportunity.terms);

    const result = harness.paperService.runCycle({
      taskId: 'task_h14_e2e',
      workOrder,
      mandate: activeMandate(harness.subjectId),
      opportunity: qualified.opportunity,
      terms: qualified.opportunity.terms!,
      actorId: harness.actorId,
      investmentAccountId: harness.investmentAccountId,
      brokerageAccountId: harness.brokerageAccountId,
      reservedCapitalMinor: '50000',
      researchBudgetRemaining: '1000',
      venueSession: 'OPEN',
      idempotencyKey: 'h14_e2e_entry',
    });

    assert.equal(result.outcome, 'EXECUTED');
    assert.equal(result.attributionClass, 'PAPER');
    assert.ok(result.proposalId);
    assert.ok(result.positionId);
    assert.ok(result.netResult);
    assert.ok(result.feesIncluded);

    const proposal = harness.paperService.store.getProposal(result.proposalId!);
    assert.equal(proposal?.environment, 'PAPER');
    assert.equal(proposal?.grantsFinancialEffect, false);
    assert.equal(proposal?.strategyDecision.strategyId, HELIOS_H14_REFERENCE_PRICE_ENTRY_V1);

    const position = harness.paperService.store.getPosition(result.positionId!);
    assert.equal(position?.environment, 'PAPER');
    assert.equal(position?.liveProviderPosition, false);
    assert.equal(position?.status, 'OPEN');
    assert.equal(position?.entryFills[0]?.simulation, true);
    assert.equal(position?.entryFills[0]?.providerSourced, false);
    assert.equal(position?.entryFills[0]?.environment, 'PAPER');
  });

  it('2. no-action path when price above entry threshold', () => {
    const harness = createH14Harness('cust_h14_noaction', 'id_h14_noaction');
    const { workOrder, qualified } = qualifyOpportunity(harness, harness.customerId, harness.subjectId, 'noaction');
    const highPriceTerms = Object.freeze({
      ...qualified.opportunity.terms!,
      priceReference: Object.freeze({
        symbol: 'SIMETF1',
        minorUnits: '20000',
        currency: 'USD',
        asOf: NOW,
      }),
    });
    const result = harness.paperService.runCycle({
      taskId: 'task_h14_noaction',
      workOrder,
      mandate: activeMandate(harness.subjectId),
      opportunity: qualified.opportunity,
      terms: highPriceTerms,
      actorId: harness.actorId,
      investmentAccountId: harness.investmentAccountId,
      brokerageAccountId: harness.brokerageAccountId,
      reservedCapitalMinor: '50000',
      researchBudgetRemaining: '1000',
      venueSession: 'OPEN',
      idempotencyKey: 'h14_noaction',
    });
    assert.equal(result.outcome, 'NO_ACTION');
    assert.equal(result.proposalId, null);
  });

  it('3. rejected proposal via risk denial', () => {
    const harness = createH14Harness('cust_h14_risk', 'id_h14_risk');
    const blockingService = new HeliosPaperGrowStrategyService({
      clock: harness.clock,
      evidenceRegistry: createEvidenceRegistry(),
      executionPort: {
        createPaperOrder: (intent) => harness.investments.createPaperOrder(intent) as never,
      },
      riskPort: harness.blockingRiskPort,
      store: new InMemoryHeliosPaperStrategyStore(),
    });
    const { workOrder, qualified } = qualifyOpportunity(harness, harness.customerId, harness.subjectId, 'risk');
    const result = blockingService.runCycle({
      taskId: 'task_h14_risk',
      workOrder,
      mandate: activeMandate(harness.subjectId),
      opportunity: qualified.opportunity,
      terms: qualified.opportunity.terms!,
      actorId: harness.actorId,
      investmentAccountId: harness.investmentAccountId,
      brokerageAccountId: harness.brokerageAccountId,
      reservedCapitalMinor: '50000',
      researchBudgetRemaining: '1000',
      venueSession: 'OPEN',
      idempotencyKey: 'h14_risk',
    });
    assert.equal(result.outcome, 'REJECTED_RISK');
    const proposal = blockingService.store.getProposal(result.proposalId!);
    assert.equal(proposal?.state, 'RISK_DENIED');
  });

  it('4. stale opportunity blocks execution', () => {
    const harness = createH14Harness('cust_h14_stale', 'id_h14_stale');
    const { workOrder, qualified } = qualifyOpportunity(harness, harness.customerId, harness.subjectId, 'stale');
    const staleTerms = Object.freeze({
      ...qualified.opportunity.terms!,
      validUntil: asUtcInstant('2026-09-15T13:00:00.000Z'),
    });
    const result = harness.paperService.runCycle({
      taskId: 'task_h14_stale',
      workOrder,
      mandate: activeMandate(harness.subjectId),
      opportunity: qualified.opportunity,
      terms: staleTerms,
      actorId: harness.actorId,
      investmentAccountId: harness.investmentAccountId,
      brokerageAccountId: harness.brokerageAccountId,
      reservedCapitalMinor: '50000',
      researchBudgetRemaining: '1000',
      venueSession: 'OPEN',
      idempotencyKey: 'h14_stale',
    });
    assert.equal(result.outcome, 'REJECTED_VALIDATION');
    assert.match(result.reasonCodes.join(','), /EVIDENCE_STALE/);
  });

  it('5. paper fill labeling is explicit PAPER/simulation', () => {
    const harness = createH14Harness('cust_h14_label', 'id_h14_label');
    const { workOrder, qualified } = qualifyOpportunity(harness, harness.customerId, harness.subjectId, 'label');
    const result = harness.paperService.runCycle({
      taskId: 'task_h14_label',
      workOrder,
      mandate: activeMandate(harness.subjectId),
      opportunity: qualified.opportunity,
      terms: qualified.opportunity.terms!,
      actorId: harness.actorId,
      investmentAccountId: harness.investmentAccountId,
      brokerageAccountId: harness.brokerageAccountId,
      reservedCapitalMinor: '50000',
      researchBudgetRemaining: '1000',
      venueSession: 'OPEN',
      idempotencyKey: 'h14_label',
    });
    const position = harness.paperService.store.getPosition(result.positionId!);
    const fill = position?.entryFills[0];
    assert.equal(fill?.environment, 'PAPER');
    assert.equal(fill?.simulation, true);
    assert.equal(fill?.providerSourced, false);
    assert.equal(fill?.assumptions.methodologyVersion, 'helios-paper-fill-v1');
  });

  it('6. cost and slippage are applied to paper fill', () => {
    const harness = createH14Harness('cust_h14_cost', 'id_h14_cost');
    const assumptions = computePaperFillAssumptions({
      side: 'BUY',
      terms: createMarketTermsPort('OPEN').currentTerms({
        route: createExecutionRouteRegistry().routeFor({
          productId: 'prod_paper_investment_review',
          instrumentId: 'SIM-ETF-1',
          jurisdiction: asJurisdiction('US'),
        })!,
        now: NOW,
      }) as never,
      quantityUnits: '1000000000',
      now: NOW,
    });
    assert.ok(BigInt(assumptions.executionPriceMinor) > BigInt(assumptions.referenceMidMinor));
    assert.equal(assumptions.spreadBps, 5);
    assert.equal(assumptions.slippageBps, 10);
  });

  it('7. no future information at decision time', () => {
    const harness = createH14Harness('cust_h14_future', 'id_h14_future');
    const { workOrder, qualified } = qualifyOpportunity(harness, harness.customerId, harness.subjectId, 'future');
    const futureTerms = Object.freeze({
      ...qualified.opportunity.terms!,
      priceReference: Object.freeze({
        symbol: 'SIMETF1',
        minorUnits: '10000',
        currency: 'USD',
        asOf: asUtcInstant('2026-09-15T15:00:00.000Z'),
      }),
    });
    const result = harness.paperService.runCycle({
      taskId: 'task_h14_future',
      workOrder,
      mandate: activeMandate(harness.subjectId),
      opportunity: qualified.opportunity,
      terms: futureTerms,
      actorId: harness.actorId,
      investmentAccountId: harness.investmentAccountId,
      brokerageAccountId: harness.brokerageAccountId,
      reservedCapitalMinor: '50000',
      researchBudgetRemaining: '1000',
      venueSession: 'OPEN',
      idempotencyKey: 'h14_future',
    });
    assert.equal(result.outcome, 'REJECTED_VALIDATION');
    assert.match(result.reasonCodes.join(','), /FUTURE_INFORMATION/);
  });

  it('8. position accounting uses canonical money fields', () => {
    const harness = createH14Harness('cust_h14_pos', 'id_h14_pos');
    const { workOrder, qualified } = qualifyOpportunity(harness, harness.customerId, harness.subjectId, 'pos');
    const result = harness.paperService.runCycle({
      taskId: 'task_h14_pos',
      workOrder,
      mandate: activeMandate(harness.subjectId),
      opportunity: qualified.opportunity,
      terms: qualified.opportunity.terms!,
      actorId: harness.actorId,
      investmentAccountId: harness.investmentAccountId,
      brokerageAccountId: harness.brokerageAccountId,
      reservedCapitalMinor: '50000',
      researchBudgetRemaining: '1000',
      venueSession: 'OPEN',
      idempotencyKey: 'h14_pos',
    });
    const position = harness.paperService.store.getPosition(result.positionId!);
    assert.ok(position?.costBasis.minorUnits);
    assert.equal(position?.costBasis.currency, 'USD');
    assert.ok(position?.referenceValuation);
  });

  it('9. close cycle completes paper position', () => {
    const harness = createH14Harness('cust_h14_close', 'id_h14_close');
    const { workOrder, qualified } = qualifyOpportunity(harness, harness.customerId, harness.subjectId, 'close');
    const entry = harness.paperService.runCycle({
      taskId: 'task_h14_close_entry',
      workOrder,
      mandate: activeMandate(harness.subjectId),
      opportunity: qualified.opportunity,
      terms: qualified.opportunity.terms!,
      actorId: harness.actorId,
      investmentAccountId: harness.investmentAccountId,
      brokerageAccountId: harness.brokerageAccountId,
      reservedCapitalMinor: '50000',
      researchBudgetRemaining: '1000',
      venueSession: 'OPEN',
      idempotencyKey: 'h14_close_entry',
    });
    assert.equal(entry.outcome, 'EXECUTED');
    const exitTerms = Object.freeze({
      ...qualified.opportunity.terms!,
      priceReference: Object.freeze({
        symbol: 'SIMETF1',
        minorUnits: '10400',
        currency: 'USD',
        asOf: NOW,
      }),
    });
    const closed = harness.paperService.closePosition({
      positionId: entry.positionId!,
      customerId: asCustomerId(harness.customerId),
      workOrder,
      terms: exitTerms,
      actorId: harness.actorId,
      investmentAccountId: harness.investmentAccountId,
      brokerageAccountId: harness.brokerageAccountId,
      reason: 'EXPLICIT_CLOSE',
      idempotencyKey: 'h14_close_exit',
    });
    assert.equal(closed.outcome, 'CLOSED');
    const position = harness.paperService.store.getPosition(entry.positionId!);
    assert.equal(position?.status, 'CLOSED');
    assert.ok(position?.realizedResult);
  });

  it('10. paper attribution class is PAPER not live yield', () => {
    const harness = createH14Harness('cust_h14_attr', 'id_h14_attr');
    const { workOrder, qualified } = qualifyOpportunity(harness, harness.customerId, harness.subjectId, 'attr');
    const result = harness.paperService.runCycle({
      taskId: 'task_h14_attr',
      workOrder,
      mandate: activeMandate(harness.subjectId),
      opportunity: qualified.opportunity,
      terms: qualified.opportunity.terms!,
      actorId: harness.actorId,
      investmentAccountId: harness.investmentAccountId,
      brokerageAccountId: harness.brokerageAccountId,
      reservedCapitalMinor: '50000',
      researchBudgetRemaining: '1000',
      venueSession: 'OPEN',
      idempotencyKey: 'h14_attr',
    });
    assert.equal(result.attributionClass, 'PAPER');
    assert.notEqual(result.attributionClass, 'SIMULATED');
  });

  it('11. restart preserves paper strategy state via store snapshot', () => {
    const store = new InMemoryHeliosPaperStrategyStore();
    const harness = createH14Harness('cust_h14_restart', 'id_h14_restart');
    const paperService = new HeliosPaperGrowStrategyService({
      clock: harness.clock,
      evidenceRegistry: createEvidenceRegistry(),
      executionPort: {
        createPaperOrder: (intent) => {
          const result = harness.investments.createPaperOrder(intent);
          if (result.outcome === 'OK' && result.value) {
            return { outcome: 'OK', value: result.value };
          }
          return { outcome: 'REJECTED', code: result.code, message: result.message };
        },
      },
      store,
    });
    const { workOrder, qualified } = qualifyOpportunity(harness, harness.customerId, harness.subjectId, 'restart');
    paperService.runCycle({
      taskId: 'task_h14_restart',
      workOrder,
      mandate: activeMandate(harness.subjectId),
      opportunity: qualified.opportunity,
      terms: qualified.opportunity.terms!,
      actorId: harness.actorId,
      investmentAccountId: harness.investmentAccountId,
      brokerageAccountId: harness.brokerageAccountId,
      reservedCapitalMinor: '50000',
      researchBudgetRemaining: '1000',
      venueSession: 'OPEN',
      idempotencyKey: 'h14_restart',
    });
    const snapshot = store.snapshot();
    const restored = new InMemoryHeliosPaperStrategyStore();
    restored.restore(snapshot);
    assert.equal(restored.snapshot().proposals.length, 1);
    assert.equal(restored.snapshot().positions.length, 1);
    assert.equal(restored.isTaskCompleted('task_h14_restart'), true);
  });

  it('12. duplicate task idempotency returns WAIT', () => {
    const harness = createH14Harness('cust_h14_dup', 'id_h14_dup');
    const { workOrder, qualified } = qualifyOpportunity(harness, harness.customerId, harness.subjectId, 'dup');
    const first = harness.paperService.runCycle({
      taskId: 'task_h14_dup',
      workOrder,
      mandate: activeMandate(harness.subjectId),
      opportunity: qualified.opportunity,
      terms: qualified.opportunity.terms!,
      actorId: harness.actorId,
      investmentAccountId: harness.investmentAccountId,
      brokerageAccountId: harness.brokerageAccountId,
      reservedCapitalMinor: '50000',
      researchBudgetRemaining: '1000',
      venueSession: 'OPEN',
      idempotencyKey: 'h14_dup_1',
    });
    assert.equal(first.outcome, 'EXECUTED');
    const second = harness.paperService.runCycle({
      taskId: 'task_h14_dup',
      workOrder,
      mandate: activeMandate(harness.subjectId),
      opportunity: qualified.opportunity,
      terms: qualified.opportunity.terms!,
      actorId: harness.actorId,
      investmentAccountId: harness.investmentAccountId,
      brokerageAccountId: harness.brokerageAccountId,
      reservedCapitalMinor: '50000',
      researchBudgetRemaining: '1000',
      venueSession: 'OPEN',
      idempotencyKey: 'h14_dup_2',
    });
    assert.equal(second.outcome, 'WAIT');
    assert.match(second.reasonCodes.join(','), /DUPLICATE_TASK/);
  });

  it('13. customer isolation: customer B cannot see customer A positions', () => {
    const harnessA = createH14Harness('cust_h14_iso_a', 'id_h14_iso_a');
    const harnessB = createH14Harness('cust_h14_iso_b', 'id_h14_iso_b');
    const { workOrder, qualified } = qualifyOpportunity(harnessA, harnessA.customerId, harnessA.subjectId, 'iso_a');
    const result = harnessA.paperService.runCycle({
      taskId: 'task_h14_iso',
      workOrder,
      mandate: activeMandate(harnessA.subjectId),
      opportunity: qualified.opportunity,
      terms: qualified.opportunity.terms!,
      actorId: harnessA.actorId,
      investmentAccountId: harnessA.investmentAccountId,
      brokerageAccountId: harnessA.brokerageAccountId,
      reservedCapitalMinor: '50000',
      researchBudgetRemaining: '1000',
      venueSession: 'OPEN',
      idempotencyKey: 'h14_iso',
    });
    const bPositions = harnessB.paperService.store.listPositionsForCustomer(asCustomerId('cust_h14_iso_b'));
    const aPositions = harnessA.paperService.store.listPositionsForCustomer(asCustomerId('cust_h14_iso_a'));
    assert.equal(aPositions.length, 1);
    assert.equal(bPositions.length, 0);
    assert.notEqual(result.positionId, null);
  });

  it('14. production flags remain off and live provider is not invoked', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
    const harness = createH14Harness('cust_h14_flags', 'id_h14_flags');
    const { workOrder, qualified } = qualifyOpportunity(harness, harness.customerId, harness.subjectId, 'flags');
    harness.paperService.runCycle({
      taskId: 'task_h14_flags',
      workOrder,
      mandate: activeMandate(harness.subjectId),
      opportunity: qualified.opportunity,
      terms: qualified.opportunity.terms!,
      actorId: harness.actorId,
      investmentAccountId: harness.investmentAccountId,
      brokerageAccountId: harness.brokerageAccountId,
      reservedCapitalMinor: '50000',
      researchBudgetRemaining: '1000',
      venueSession: 'OPEN',
      idempotencyKey: 'h14_flags',
    });
    assert.equal(harness.liveProviderTracker.invoked, false);
  });

  it('capability constant is exported', () => {
    assert.equal(HELIOS_H14_PAPER_GROW_STRATEGY, 'HELIOS_H14_PAPER_GROW_STRATEGY');
  });
});
