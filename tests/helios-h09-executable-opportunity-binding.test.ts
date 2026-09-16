import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { interpretMandateLanguage } from '../packages/agent/src/interpretation.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import type { IdentityCapability } from '../packages/identity/src/capability.ts';
import { SimulatedIdentityAdapter } from '../packages/identity/src/simulation.ts';
import type { PersonalEconomicSnapshot } from '../packages/personal-economic-graph/src/snapshot.ts';
import { EconomicGraphService } from '../packages/personal-economic-graph/src/service.ts';
import { createSimulationKeyProvider } from '../packages/security/src/simulation.ts';
import {
  ExecutableOpportunityQualificationService,
  HELIOS_H09_EXECUTABLE_OPPORTUNITY_BINDING,
  InMemoryExecutableOpportunityStore,
  collectExecutableOpportunityMetrics,
  createEvidenceRegistry,
  createExecutionRouteRegistry,
  createMarketTermsPort,
  mandateBindingRefFromCompiled,
  routeAvailabilityLabel,
  workOrderIdFor,
  candidateIdFor,
  createEconomicWorkOrderDraft,
  type CapabilityBindingContext,
  type EconomicWorkOrder,
  type WorkOrderScope,
} from '../packages/platform/src/helios/index.ts';
import { compileEconomicMandate, mandateDraftFromInterpretation } from '../packages/platform/src/mandate/compiler.ts';
import { constraintIdFor } from '../packages/platform/src/ids.ts';
import type { CompiledEconomicMandate, HardConstraint } from '../packages/platform/src/mandate/types.ts';
import { defaultOpportunityPreferences } from '../packages/platform/src/growth/opportunity/preferences.ts';
import { SIMULATION_GROWTH_PRODUCTS, SIMULATION_RATE_CATALOG } from '../packages/platform/src/growth/opportunity/products.ts';
import { simulationPolicyPort } from '../packages/platform/src/policy-port.ts';
import { GrowthOrchestrator } from '../packages/platform/src/service.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-15T14:00:00.000Z');

function activeMandate(subjectId: string, extra: readonly HardConstraint[] = []): CompiledEconomicMandate {
  const interpretation = interpretMandateLanguage({
    subjectId,
    sourceText: 'Keep at least $8,000 liquid. Ask me before any movement over $1,000.',
    now: NOW,
  });
  if (!interpretation.ok) throw new Error('interpretation');
  const draft = mandateDraftFromInterpretation(interpretation.value, NOW);
  const compiled = compileEconomicMandate({ draft, now: NOW });
  if (!compiled.ok) throw new Error('compile');
  return Object.freeze({
    ...compiled.value,
    state: 'ACTIVE',
    hardConstraints: Object.freeze([...compiled.value.hardConstraints, ...extra]),
  });
}

function baseScope(overrides: Partial<WorkOrderScope> = {}): WorkOrderScope {
  return Object.freeze({
    objectiveClasses: Object.freeze(['RESEARCH'] as const),
    activityClasses: Object.freeze(['RESEARCH', 'DATA_ACCESS'] as const),
    productClasses: Object.freeze(['CASH', 'EQUITIES'] as const),
    capitalCeiling: { minorUnits: '100000', currency: 'USD' },
    accountIds: Object.freeze(['acct_checking']),
    jurisdiction: asJurisdiction('US'),
    horizonDays: 30,
    toolIds: Object.freeze(['tool_research']),
    modelIds: Object.freeze(['mdl_s3m']),
    ...overrides,
  });
}

const FULL_CAPS: readonly IdentityCapability[] = Object.freeze([
  'VIEW_GROWTH_PLAN',
  'VIEW_ECONOMIC_GRAPH',
  'CONSENT_VIEW_OWN',
  'AGENT_USE',
  'OPERATE_GROWTH_ORCHESTRATOR',
  'INVESTMENT_PROPOSE',
  'VIEW_ACCOUNT',
  'EXCHANGE_OPERATE_REQUEST',
  'FX_QUOTE_REQUEST',
]);

function capabilityContext(customerId: string, capabilities: readonly IdentityCapability[] = FULL_CAPS): CapabilityBindingContext {
  return Object.freeze({
    customerId: asCustomerId(customerId),
    jurisdiction: asJurisdiction('US'),
    legalEntityId: 'le_us_demo',
    environment: 'simulation',
    grantedCapabilities: capabilities,
    capabilityStates: {},
    contextVersion: 'cap_ctx_v1',
  });
}

function activeWorkOrder(customerId: string, subjectId: string, key = 'h09'): EconomicWorkOrder {
  const mandate = activeMandate(subjectId);
  const scope = baseScope();
  const workOrderId = workOrderIdFor(customerId, key);
  const draft = createEconomicWorkOrderDraft({
    workOrderId,
    customerId: asCustomerId(customerId),
    subjectId,
    growObjectiveId: 'grow_h09',
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

function discoveryContext(subjectId: string, overrides: Record<string, unknown> = {}) {
  return {
    now: NOW,
    jurisdiction: 'US',
    kycState: 'VERIFIED' as const,
    customerRestricted: false,
    riskProfile: 'BALANCED' as const,
    suitabilityMaxRisk: 'MODERATE' as const,
    products: SIMULATION_GROWTH_PRODUCTS,
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
    rateCatalog: SIMULATION_RATE_CATALOG,
    policy: simulationPolicyPort,
    preferences: defaultOpportunityPreferences(subjectId, NOW),
    previous: Object.freeze([]),
    ...overrides,
  };
}

function qualificationService(clock = new FrozenClock(NOW), venueSession: 'OPEN' | 'CLOSED' = 'OPEN') {
  const evidence = new EvidenceVault(clock);
  return new ExecutableOpportunityQualificationService({
    clock,
    evidence,
    evidenceRegistry: createEvidenceRegistry(),
    routeRegistry: createExecutionRouteRegistry(),
    marketTerms: createMarketTermsPort(venueSession),
  });
}

function qualify(input: {
  customerId: string;
  subjectId: string;
  workOrder: EconomicWorkOrder | null;
  mandate: CompiledEconomicMandate | null;
  evidenceRefs: readonly string[];
  productId: string;
  instrumentId: string;
  environment?: 'simulation' | 'sandbox' | 'production_candidate';
  venueSession?: 'OPEN' | 'CLOSED';
  proposedNotional?: { readonly minorUnits: string; readonly currency: string };
  accountClass?: string;
  requireExternalObservation?: boolean;
}) {
  const service = qualificationService(new FrozenClock(NOW), input.venueSession ?? 'OPEN');
  const candidate = service.discoverCandidate({
    workOrderId: workOrderIdFor(input.customerId, 'qual'),
    customerId: asCustomerId(input.customerId),
    subjectId: input.subjectId,
    source: 'MARKET_OBSERVATION',
    hypothesisType: 'investment_review',
    evidenceRefs: input.evidenceRefs,
    instrumentCandidate: Object.freeze({
      instrumentId: input.instrumentId,
      productId: input.productId,
      symbol: input.instrumentId,
      assetClass: 'ETF',
    }),
    key: 'qual',
  });
  return service.qualifyCandidate({
    candidate,
    workOrder: input.workOrder,
    mandate: input.mandate,
    jurisdiction: asJurisdiction('US'),
    context: discoveryContext(input.subjectId),
    detector: 'MARKET_RESEARCH_CANDIDATE',
    ...(input.environment ? { environment: input.environment } : {}),
    ...(input.venueSession ? { venueSession: input.venueSession } : {}),
    ...(input.proposedNotional ? { proposedNotional: input.proposedNotional } : {}),
    ...(input.accountClass ? { accountClass: input.accountClass } : {}),
    ...(input.requireExternalObservation ? { requireExternalObservation: true } : {}),
  });
}

function setupOrchestrator(subjectId: string, customerId: string) {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events, evidence });
  assert.equal(
    identity.provisionSimulatedActor({
      actorId: 'actor_h09',
      jurisdiction: asJurisdiction('US'),
      identityId: subjectId,
      customerId: asCustomerId(customerId),
      capabilities: ['VIEW_ECONOMIC_GRAPH', 'VIEW_GROWTH_PLAN', 'INVESTMENT_PROPOSE', 'OPERATE_GROWTH_ORCHESTRATOR'],
    }).ok,
    true,
  );
  const actor = identity.service.resolveActorContext('actor_h09');
  if (!actor.ok) throw new Error('actor');
  const peg = new EconomicGraphService({ clock, events });
  const orchestrator = new GrowthOrchestrator({ clock, events, peg, evidence });
  return { actor: actor.value, orchestrator };
}

describe('HELIOS H09 executable opportunity binding', () => {
  it('architecture guard: executable opportunity module does not grant Execution Authority', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const h09 = findings.filter((row) => row.file.includes('executable-opportunity'));
    assert.equal(h09.length, 0);
  });

  it('1. valid external observation creates candidate', () => {
    const workOrder = activeWorkOrder('cust_a', 'id_a');
    const result = qualify({
      customerId: 'cust_a',
      subjectId: 'id_a',
      workOrder,
      mandate: activeMandate('id_a'),
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      productId: 'prod_paper_investment_review',
      instrumentId: 'SIM-ETF-1',
      environment: 'sandbox',
      accountClass: 'BROKERAGE',
    });
    assert.equal(result.opportunity.candidate.source, 'MARKET_OBSERVATION');
    assert.equal(result.opportunity.state, 'QUALIFIED_FOR_PROPOSAL');
    assert.equal(result.grantsExecutionAuthority, false);
  });

  it('2. fixture cannot masquerade as external evidence', () => {
    const result = qualify({
      customerId: 'cust_a',
      subjectId: 'id_a',
      workOrder: activeWorkOrder('cust_a', 'id_a'),
      mandate: activeMandate('id_a'),
      evidenceRefs: Object.freeze(['ev_fixture_masquerade']),
      productId: 'prod_paper_investment_review',
      instrumentId: 'SIM-ETF-1',
      requireExternalObservation: true,
    });
    assert.equal(result.outcome, 'REJECTED');
    assert.match(result.reasonCodes.join(','), /EVIDENCE_FIXTURE_MASQUERADE/);
  });

  it('3. stale evidence blocks verification', () => {
    const result = qualify({
      customerId: 'cust_a',
      subjectId: 'id_a',
      workOrder: activeWorkOrder('cust_a', 'id_a'),
      mandate: activeMandate('id_a'),
      evidenceRefs: Object.freeze(['ev_external_market_obs_stale']),
      productId: 'prod_paper_investment_review',
      instrumentId: 'SIM-ETF-1',
    });
    assert.equal(result.opportunity.state, 'STALE');
    assert.match(result.reasonCodes.join(','), /EVIDENCE_STALE/);
  });

  it('4. invalid entitlement blocks/degrades', () => {
    const result = qualify({
      customerId: 'cust_b',
      subjectId: 'id_b',
      workOrder: activeWorkOrder('cust_b', 'id_b'),
      mandate: activeMandate('id_b'),
      evidenceRefs: Object.freeze(['ev_entitlement_restricted']),
      productId: 'prod_paper_investment_review',
      instrumentId: 'SIM-ETF-1',
    });
    assert.equal(result.outcome, 'REJECTED');
    assert.match(result.reasonCodes.join(','), /EVIDENCE_ENTITLEMENT_DENIED/);
  });

  it('5. missing instrument mapping blocks', () => {
    const result = qualify({
      customerId: 'cust_a',
      subjectId: 'id_a',
      workOrder: activeWorkOrder('cust_a', 'id_a'),
      mandate: activeMandate('id_a'),
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      productId: 'prod_paper_investment_review',
      instrumentId: 'UNKNOWN-INST',
    });
    assert.equal(result.outcome, 'REJECTED');
    assert.match(result.reasonCodes.join(','), /INSTRUMENT_/);
  });

  it('6. wrong product capability blocks', () => {
    const result = qualify({
      customerId: 'cust_a',
      subjectId: 'id_a',
      workOrder: activeWorkOrder('cust_a', 'id_a'),
      mandate: activeMandate('id_a'),
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      productId: 'prod_unknown_product',
      instrumentId: 'SIM-ETF-1',
    });
    assert.equal(result.outcome, 'REJECTED');
    assert.match(result.reasonCodes.join(','), /PRODUCT_CAPABILITY_DENIED/);
  });

  it('7. mandate restriction blocks', () => {
    const mandate = activeMandate('id_a', [
      Object.freeze({
        constraintId: constraintIdFor('PROHIBITED_PRODUCT_CATEGORIES', 'id_a_inv'),
        kind: 'PROHIBITED_PRODUCT_CATEGORIES',
        categories: Object.freeze(['INVESTMENT_ALLOCATION']),
        overrideForbidden: true,
      }),
    ]);
    const result = qualify({
      customerId: 'cust_a',
      subjectId: 'id_a',
      workOrder: activeWorkOrder('cust_a', 'id_a'),
      mandate,
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      productId: 'prod_paper_investment_review',
      instrumentId: 'SIM-ETF-1',
    });
    assert.equal(result.opportunity.state, 'INELIGIBLE');
    assert.match(result.reasonCodes.join(','), /MANDATE_RESTRICTED/);
  });

  it('8. minimum-size failure blocks', () => {
    const result = qualify({
      customerId: 'cust_a',
      subjectId: 'id_a',
      workOrder: activeWorkOrder('cust_a', 'id_a'),
      mandate: activeMandate('id_a'),
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      productId: 'prod_paper_investment_review',
      instrumentId: 'SIM-ETF-1',
      environment: 'sandbox',
      accountClass: 'BROKERAGE',
      proposedNotional: { minorUnits: '100', currency: 'USD' },
    });
    assert.equal(result.opportunity.state, 'NO_ROUTE');
    assert.match(result.reasonCodes.join(','), /MINIMUM_SIZE_FAILURE/);
  });

  it('9. unsupported venue blocks', () => {
    const result = qualify({
      customerId: 'cust_a',
      subjectId: 'id_a',
      workOrder: activeWorkOrder('cust_a', 'id_a'),
      mandate: activeMandate('id_a'),
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      productId: 'prod_paper_investment_review',
      instrumentId: 'SIM-ETF-1',
      environment: 'sandbox',
      accountClass: 'BROKERAGE',
      venueSession: 'CLOSED',
    });
    assert.equal(result.opportunity.state, 'NO_ROUTE');
    assert.match(result.reasonCodes.join(','), /VENUE_CLOSED/);
  });

  it('10. unavailable provider route blocks', () => {
    const result = qualify({
      customerId: 'cust_a',
      subjectId: 'id_a',
      workOrder: activeWorkOrder('cust_a', 'id_a'),
      mandate: activeMandate('id_a'),
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      productId: 'prod_paper_investment_review',
      instrumentId: 'SIM-EQ-1',
      environment: 'sandbox',
      accountClass: 'BROKERAGE',
    });
    assert.equal(result.opportunity.state, 'NO_ROUTE');
    assert.match(result.reasonCodes.join(','), /ROUTE_UNAVAILABLE/);
  });

  it('11. configured but not live-authorized route remains correctly labeled', () => {
    const result = qualify({
      customerId: 'cust_a',
      subjectId: 'id_a',
      workOrder: activeWorkOrder('cust_a', 'id_a'),
      mandate: activeMandate('id_a'),
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      productId: 'prod_paper_rebalance_review',
      instrumentId: 'SIM-ETF-1',
      environment: 'simulation',
      accountClass: 'BROKERAGE',
    });
    assert.equal(result.opportunity.state, 'NO_ROUTE');
    assert.equal(routeAvailabilityLabel(result.opportunity.routeDecision?.route ?? null), 'CONFIGURED');
    assert.match(result.reasonCodes.join(','), /ROUTE_NOT_OPERATIONAL|ROUTE_CONFIGURED_NOT_LIVE/);
  });

  it('12. valid sandbox route becomes route-ready in sandbox mode', () => {
    const result = qualify({
      customerId: 'cust_a',
      subjectId: 'id_a',
      workOrder: activeWorkOrder('cust_a', 'id_a'),
      mandate: activeMandate('id_a'),
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      productId: 'prod_paper_investment_review',
      instrumentId: 'SIM-ETF-1',
      environment: 'sandbox',
      accountClass: 'BROKERAGE',
      proposedNotional: { minorUnits: '50000', currency: 'USD' },
    });
    assert.equal(result.opportunity.state, 'QUALIFIED_FOR_PROPOSAL');
    assert.equal(result.opportunity.routeDecision?.availability, 'SANDBOX_AVAILABLE');
    assert.match(result.reasonCodes.join(','), /ROUTE_SANDBOX_READY|OK/);
  });

  it('13. market/session closure invalidates where required', () => {
    const service = qualificationService(new FrozenClock(NOW), 'CLOSED');
    const candidate = service.discoverCandidate({
      workOrderId: workOrderIdFor('cust_a', 'closed'),
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      source: 'MARKET_OBSERVATION',
      hypothesisType: 'closed_market',
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      instrumentCandidate: Object.freeze({
        instrumentId: 'SIM-ETF-1',
        productId: 'prod_paper_investment_review',
        symbol: 'SIM-ETF-1',
        assetClass: 'ETF',
      }),
      key: 'closed',
    });
    const result = service.qualifyCandidate({
      candidate,
      workOrder: activeWorkOrder('cust_a', 'id_a'),
      mandate: activeMandate('id_a'),
      jurisdiction: asJurisdiction('US'),
      context: discoveryContext('id_a'),
      detector: 'MARKET_RESEARCH_CANDIDATE',
      environment: 'sandbox',
      venueSession: 'CLOSED',
      accountClass: 'BROKERAGE',
      proposedNotional: { minorUnits: '50000', currency: 'USD' },
    });
    assert.equal(result.opportunity.state, 'NO_ROUTE');
    assert.match(result.reasonCodes.join(','), /VENUE_CLOSED/);
  });

  it('14. terms expiry triggers revalidation', () => {
    const clock = new FrozenClock(NOW);
    const service = qualificationService(clock, 'OPEN');
    const workOrder = activeWorkOrder('cust_a', 'id_a');
    const candidate = service.discoverCandidate({
      workOrderId: workOrderIdFor('cust_a', 'terms'),
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      source: 'MARKET_OBSERVATION',
      hypothesisType: 'terms_expiry',
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      instrumentCandidate: Object.freeze({
        instrumentId: 'SIM-ETF-1',
        productId: 'prod_paper_investment_review',
        symbol: 'SIM-ETF-1',
        assetClass: 'ETF',
      }),
      key: 'terms',
    });
    const qualified = service.qualifyCandidate({
      candidate,
      workOrder,
      mandate: activeMandate('id_a'),
      jurisdiction: asJurisdiction('US'),
      context: discoveryContext('id_a'),
      detector: 'MARKET_RESEARCH_CANDIDATE',
      environment: 'sandbox',
      accountClass: 'BROKERAGE',
      proposedNotional: { minorUnits: '50000', currency: 'USD' },
    });
    assert.equal(qualified.opportunity.state, 'QUALIFIED_FOR_PROPOSAL');
    clock.advanceMs(20n * 60n * 1000n);
    const revalidated = service.revalidate(asCustomerId('cust_a'), qualified.opportunity.executableOpportunityId, {
      workOrder,
      mandate: activeMandate('id_a'),
      jurisdiction: asJurisdiction('US'),
      context: discoveryContext('id_a'),
      detector: 'MARKET_RESEARCH_CANDIDATE',
      environment: 'sandbox',
      accountClass: 'BROKERAGE',
      proposedNotional: { minorUnits: '50000', currency: 'USD' },
    });
    assert.equal(revalidated.ok, true);
    assert.equal(revalidated.value.outcome, 'WAIT');
    assert.equal(revalidated.value.opportunity.state, 'STALE');
    assert.match(revalidated.value.reasonCodes.join(','), /TERMS_EXPIRED|REVALIDATION_REQUIRED/);
  });

  it('15. customer isolation', () => {
    const workOrderA = activeWorkOrder('cust_a', 'id_a');
    const qualifiedA = qualify({
      customerId: 'cust_a',
      subjectId: 'id_a',
      workOrder: workOrderA,
      mandate: activeMandate('id_a'),
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      productId: 'prod_paper_investment_review',
      instrumentId: 'SIM-ETF-1',
      environment: 'sandbox',
      accountClass: 'BROKERAGE',
      proposedNotional: { minorUnits: '50000', currency: 'USD' },
    });
    const service = qualificationService();
    const leaked = service.getForCustomer(asCustomerId('cust_b'), qualifiedA.opportunity.executableOpportunityId);
    assert.equal(leaked, undefined);
    assert.equal(qualifiedA.opportunity.customerId, asCustomerId('cust_a'));
    assert.doesNotMatch(JSON.stringify(qualifiedA.opportunity), /cust_b/);
  });

  it('17. qualified opportunity still creates NO financial effect', () => {
    const result = qualify({
      customerId: 'cust_a',
      subjectId: 'id_a',
      workOrder: activeWorkOrder('cust_a', 'id_a'),
      mandate: activeMandate('id_a'),
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      productId: 'prod_paper_investment_review',
      instrumentId: 'SIM-ETF-1',
      environment: 'sandbox',
      accountClass: 'BROKERAGE',
      proposedNotional: { minorUnits: '50000', currency: 'USD' },
    });
    assert.equal(result.outcome, 'QUALIFIED_FOR_PROPOSAL');
    assert.equal(result.grantsExecutionAuthority, false);
    assert.equal(result.authorizesFinancialExecution, false);
    assert.equal(result.opportunity.grantsExecutionAuthority, false);
  });

  it('18. qualified opportunity enters existing proposal path rather than bypassing it', () => {
    const setup = setupOrchestrator('id_a', 'cust_a');
    const orchestrator = setup.orchestrator;
    orchestrator.store.putMandate(activeMandate('id_a'));
    const discovered = orchestrator.discoverCustomerOpportunities(setup.actor, 'id_a', discoveryContext('id_a'));
    if (!discovered.ok) throw new Error(discovered.error.message);
    const presented = discovered.value.all.find((item) => item.status === 'PRESENTED' || item.status === 'ELIGIBLE');
    assert.ok(presented);
    const workOrder = activeWorkOrder('cust_a', 'id_a');
    const qualified = orchestrator.qualifyExecutableOpportunity(setup.actor, 'id_a', {
      customerId: 'cust_a',
      workOrder,
      hypothesisType: 'proposal_path',
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      productId: 'prod_paper_investment_review',
      instrumentId: 'SIM-ETF-1',
      environment: 'sandbox',
      accountClass: 'BROKERAGE',
      proposedNotional: { minorUnits: '50000', currency: 'USD' },
      originatingOpportunityId: presented.opportunityId,
    });
    if (!qualified.ok) throw new Error(qualified.error.message);
    assert.equal(qualified.value.opportunity.state, 'QUALIFIED_FOR_PROPOSAL');
    const proposal = orchestrator.proposeFromQualifiedExecutableOpportunity(
      setup.actor,
      'id_a',
      'cust_a',
      qualified.value.opportunity.executableOpportunityId,
      presented.opportunityId,
    );
    if (!proposal.ok) throw new Error(proposal.error.message);
    assert.equal(proposal.value.issuesExecutionAuthority, false);
    assert.equal(proposal.value.executesMoney, false);
    assert.equal(proposal.value.nextStep, 'USER_CONFIRMATION_THEN_KERNEL');
  });

  it('observability metrics track qualification funnel', () => {
    const service = qualificationService();
    const workOrder = activeWorkOrder('cust_a', 'id_a', 'metrics_a');
    service.discoverCandidate({
      workOrderId: workOrder.workOrderId,
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      source: 'MARKET_OBSERVATION',
      hypothesisType: 'metrics_qualified',
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      instrumentCandidate: Object.freeze({
        instrumentId: 'SIM-ETF-1',
        productId: 'prod_paper_investment_review',
        symbol: 'SIM-ETF-1',
        assetClass: 'ETF',
      }),
      key: 'metrics_a',
    });
    service.qualifyCandidate({
      candidate: service.store.getCandidate(
        candidateIdFor(workOrder.workOrderId, 'metrics_a'),
      )!,
      workOrder,
      mandate: activeMandate('id_a'),
      jurisdiction: asJurisdiction('US'),
      context: discoveryContext('id_a'),
      detector: 'MARKET_RESEARCH_CANDIDATE',
      environment: 'sandbox',
      accountClass: 'BROKERAGE',
      proposedNotional: { minorUnits: '50000', currency: 'USD' },
    });
    const workOrderB = activeWorkOrder('cust_a', 'id_a', 'metrics_b');
    service.discoverCandidate({
      workOrderId: workOrderB.workOrderId,
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      source: 'MARKET_OBSERVATION',
      hypothesisType: 'metrics_stale',
      evidenceRefs: Object.freeze(['ev_external_market_obs_stale']),
      instrumentCandidate: Object.freeze({
        instrumentId: 'SIM-ETF-1',
        productId: 'prod_paper_investment_review',
        symbol: 'SIM-ETF-1',
        assetClass: 'ETF',
      }),
      key: 'metrics_b',
    });
    service.qualifyCandidate({
      candidate: service.store.getCandidate(
        candidateIdFor(workOrderB.workOrderId, 'metrics_b'),
      )!,
      workOrder: workOrderB,
      mandate: activeMandate('id_a'),
      jurisdiction: asJurisdiction('US'),
      context: discoveryContext('id_a'),
      detector: 'MARKET_RESEARCH_CANDIDATE',
    });
    const metrics = collectExecutableOpportunityMetrics(service.store.snapshot().executableOpportunities);
    assert.ok(metrics.discoveredCount >= 2);
    assert.ok(metrics.staleCount >= 1);
    assert.ok(metrics.qualifiedForProposalCount >= 1);
    assert.equal(HELIOS_H09_EXECUTABLE_OPPORTUNITY_BINDING, 'HELIOS_H09_EXECUTABLE_OPPORTUNITY_BINDING');
  });
});
