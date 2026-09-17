import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { interpretMandateLanguage } from '../packages/agent/src/interpretation.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asUtcInstant, type UtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { bindWorkOrderAuthority } from '../packages/platform/src/helios/authority-binding.ts';
import { createWorkOrderApprovalRef } from '../packages/platform/src/helios/approval-binding.ts';
import {
  createEvidenceRegistry,
  createExecutionRouteRegistry,
  createMarketTermsPort,
  DecisionValidityEnvelopeService,
  HELIOS_H21_DECISION_VALIDITY_ENVELOPE,
  shortestMaterialValidUntil,
  assessEconomicEdge,
  strategyCapsuleIdFor,
  workOrderIdFor,
  candidateIdFor,
  createEconomicWorkOrderDraft,
  mandateBindingRefFromCompiled,
  type DecisionValidityEnvelope,
  type EnvelopeEvaluationContext,
  type EnvelopeEvaluationPorts,
  type EconomicWorkOrder,
  type MetaAllocatorRecommendation,
  type OpportunityCandidate,
  type StrategyCapsuleRef,
  type StrategyCapsuleRegistryPort,
  type WorkOrderScope,
} from '../packages/platform/src/helios/index.ts';
import { compileEconomicMandate, mandateDraftFromInterpretation } from '../packages/platform/src/mandate/compiler.ts';
import type { CompiledEconomicMandate } from '../packages/platform/src/mandate/types.ts';
import { captureQualificationTerms } from '../packages/platform/src/helios/executable-opportunity/terms.ts';
import type { ExecutionRouteDescriptor, QualificationTermsSnapshot } from '../packages/platform/src/helios/executable-opportunity/types.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-15T14:00:00.000Z');

function activeMandate(subjectId: string, state: CompiledEconomicMandate['state'] = 'ACTIVE'): CompiledEconomicMandate {
  const interpretation = interpretMandateLanguage({
    subjectId,
    sourceText: 'Keep at least $8,000 liquid. Ask me before any movement over $1,000.',
    now: NOW,
  });
  if (!interpretation.ok) throw new Error('interpretation');
  const draft = mandateDraftFromInterpretation(interpretation.value, NOW);
  const compiled = compileEconomicMandate({ draft, now: NOW });
  if (!compiled.ok) throw new Error('compile');
  return Object.freeze({ ...compiled.value, state });
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

function activeWorkOrder(
  customerId: string,
  subjectId: string,
  key = 'h21',
  mandateState: CompiledEconomicMandate['state'] = 'ACTIVE',
): EconomicWorkOrder {
  const mandate = activeMandate(subjectId, mandateState);
  const scope = baseScope();
  const workOrderId = workOrderIdFor(customerId, key);
  return Object.freeze({
    ...createEconomicWorkOrderDraft({
      workOrderId,
      customerId: asCustomerId(customerId),
      subjectId,
      growObjectiveId: 'grow_h21',
      requestedScope: scope,
      mandateRef: mandateBindingRefFromCompiled(mandate, asCustomerId(customerId), NOW),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      now: NOW,
    }),
    state: 'ACTIVE',
    effectiveScope: scope,
    activatedAt: NOW,
    updatedAt: NOW,
  });
}

function promotedCapsule(workOrderId: ReturnType<typeof workOrderIdFor>, overrides: Partial<StrategyCapsuleRef> = {}): StrategyCapsuleRef {
  return Object.freeze({
    capsuleId: strategyCapsuleIdFor(workOrderId, 'ref'),
    version: '1.0.0',
    contentHash: 'sha256_capsule_ref_v1',
    promotionState: 'PROMOTED',
    qualificationState: 'QUALIFIED',
    validUntil: asUtcInstant('2026-12-31T00:00:00.000Z'),
    modelDependencies: Object.freeze(['mdl_s3m']),
    policyVersion: 'helios-strategy-capsule-v1',
    grantsExecutionAuthority: false as const,
    ...overrides,
  });
}

function createCapsuleRegistry(capsule: StrategyCapsuleRef): StrategyCapsuleRegistryPort {
  return Object.freeze({
    resolve(capsuleId, version) {
      if (capsuleId === capsule.capsuleId && version === capsule.version) {
        return capsule;
      }
      return null;
    },
  });
}

function sampleCandidate(customerId: string, subjectId: string, evidenceRefs: readonly string[]): OpportunityCandidate {
  const workOrderId = workOrderIdFor(customerId, 'h21');
  return Object.freeze({
    candidateId: candidateIdFor(workOrderId, '001'),
    workOrderId,
    customerId: asCustomerId(customerId),
    subjectId,
    source: 'MARKET_OBSERVATION',
    hypothesisType: 'value_entry',
    evidenceRefs: Object.freeze([...evidenceRefs]),
    instrumentCandidate: Object.freeze({
      instrumentId: 'SIM-ETF-1',
      productId: 'prod_paper_investment_review',
      symbol: 'SIM-ETF-1',
      assetClass: 'ETF',
    }),
    discoveredAt: NOW,
  });
}

function recommendation(candidate: OpportunityCandidate, capsule: StrategyCapsuleRef, expectedEdgeBps = 50): MetaAllocatorRecommendation {
  return Object.freeze({
    recommendationId: `marec_${candidate.candidateId}_001` as const,
    candidateId: candidate.candidateId,
    workOrderId: candidate.workOrderId,
    customerId: candidate.customerId,
    capsuleRef: capsule,
    recommendedAt: NOW,
    expectedEdgeBps,
    rationale: 'simulation meta allocator recommendation',
    grantsExecutionAuthority: false as const,
  });
}

function defaultRoute(): ExecutionRouteDescriptor {
  const registry = createExecutionRouteRegistry();
  return registry.routeFor({
    productId: 'prod_paper_investment_review',
    instrumentId: 'SIM-ETF-1',
    jurisdiction: asJurisdiction('US'),
  })!;
}

function baseContext(input: {
  candidate: OpportunityCandidate;
  recommendation: MetaAllocatorRecommendation;
  capsule: StrategyCapsuleRef;
  workOrder: EconomicWorkOrder;
  mandate: CompiledEconomicMandate;
  now?: UtcInstant;
  terms?: QualificationTermsSnapshot | null;
  venueSession?: 'OPEN' | 'CLOSED';
  availableFundsMinor?: string;
  reservedFundsMinor?: string;
  jurisdictionCapabilityEnabled?: boolean;
  modelVersionQualified?: boolean;
  researchExpiresAt?: UtcInstant | null;
}): EnvelopeEvaluationContext {
  const route = defaultRoute();
  const terms =
    input.terms ??
    captureQualificationTerms({ route, now: input.now ?? NOW, venueSession: input.venueSession ?? 'OPEN' });
  const mandate = input.mandate;
  const authorityBinding = bindWorkOrderAuthority({
    mandate,
    customerId: input.candidate.customerId,
    capability: 'HELIOS_RESEARCH',
    approvalRef: input.workOrder.approvalRef?.approvalBindingId ?? null,
    now: input.now ?? NOW,
  });
  return Object.freeze({
    now: input.now ?? NOW,
    candidate: input.candidate,
    recommendation: input.recommendation,
    capsule: input.capsule,
    workOrder: input.workOrder,
    mandate,
    authorityBinding: typeof authorityBinding === 'object' && 'revalidationState' in authorityBinding ? authorityBinding : null,
    jurisdiction: asJurisdiction('US'),
    accountId: 'acct_checking',
    terms,
    route,
    venueSession: input.venueSession ?? 'OPEN',
    availableFundsMinor: input.availableFundsMinor ?? '500000',
    reservedFundsMinor: input.reservedFundsMinor ?? '0',
    deployedCapitalMinor: '0',
    strategyCapacityMinor: '500000',
    proposedNotionalMinor: '50000',
    currency: 'USD',
    instrumentActive: true,
    instrumentHalted: false,
    jurisdictionCapabilityEnabled: input.jurisdictionCapabilityEnabled ?? true,
    modelVersionQualified: input.modelVersionQualified ?? true,
    researchExpiresAt: input.researchExpiresAt ?? asUtcInstant('2026-12-31T00:00:00.000Z'),
    researchCompletedAt: NOW,
    qualificationAt: NOW,
    evidenceArrivedAt: asUtcInstant('2026-09-15T13:55:30.000Z'),
  });
}

function createService(
  capsule: StrategyCapsuleRef,
  portOverrides: Partial<EnvelopeEvaluationPorts> = {},
): DecisionValidityEnvelopeService {
  const clock = new FrozenClock(NOW);
  return new DecisionValidityEnvelopeService({
    clock,
    evidence: new EvidenceVault(clock),
    ports: Object.freeze({
      evidenceRegistry: createEvidenceRegistry(),
      routeRegistry: createExecutionRouteRegistry(),
      marketTerms: createMarketTermsPort('OPEN'),
      capsuleRegistry: createCapsuleRegistry(capsule),
      ...portOverrides,
    }),
  });
}

describe('HELIOS H21 decision validity envelope', () => {
  it('1. fresh valid evidence produces VALID envelope', () => {
    const customerId = 'cust_h21_valid';
    const subjectId = 'id_h21_valid';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const service = createService(capsule, {
      riskPort: {
        assess: () => Object.freeze({ outcome: 'ALLOW', assessmentId: 'risk_ok' }),
      },
    });
    const result = service.createEnvelope(baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate }));
    assert.equal(result.envelope.overallStatus, 'VALID');
    assert.equal(result.proposalEligible, true);
    assert.equal(result.grantsFinancialEffect, false);
  });

  it('2. stale evidence invalidates envelope', () => {
    const customerId = 'cust_h21_stale';
    const subjectId = 'id_h21_stale';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_stale']);
    const rec = recommendation(candidate, capsule);
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
    });
    const result = service.createEnvelope(baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate }));
    assert.equal(result.envelope.overallStatus, 'INVALID');
    assert.ok(result.envelope.reasonCodes.includes('EVIDENCE_STALE'));
    assert.equal(result.failureAction, 'RESEARCH_AGAIN');
  });

  it('3. widened spread invalidates envelope', () => {
    const customerId = 'cust_h21_spread';
    const subjectId = 'id_h21_spread';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const route = defaultRoute();
    const baseline = captureQualificationTerms({ route, now: NOW, validitySeconds: 900 });
    const widened = Object.freeze({ ...baseline, spreadBps: 25 });
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
      marketTerms: Object.freeze({
        currentTerms: () => widened,
      }),
    });
    const ctx = baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate, terms: baseline });
    const result = service.createEnvelope(ctx, baseline);
    assert.equal(result.envelope.overallStatus, 'INVALID');
    assert.ok(result.envelope.reasonCodes.includes('MARKET_SPREAD_WIDENED'));
  });

  it('4. transaction cost destroys economic edge', () => {
    const edge = assessEconomicEdge({
      expectedEdgeBps: 50,
      terms: Object.freeze({
        snapshotId: 'terms_cost',
        capturedAt: NOW,
        validUntil: asUtcInstant('2026-09-15T14:30:00.000Z'),
        spreadBps: 30,
        feeMetadata: Object.freeze([{ code: 'fee', basisPoints: 20, description: 'sim' }]),
        liquidityState: 'ADEQUATE',
        venueSession: 'OPEN',
        providerAvailability: 'AVAILABLE',
      }),
      slippageBps: 10,
    });
    assert.equal(edge.economicallyValid, false);
    assert.ok(edge.reasonCodes.includes('TRANSACTION_COST_DESTROYS_EDGE'));
  });

  it('5. insufficient liquidity invalidates envelope', () => {
    const customerId = 'cust_h21_liq';
    const subjectId = 'id_h21_liq';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const route = defaultRoute();
    const thinTerms = Object.freeze({
      ...captureQualificationTerms({ route, now: NOW }),
      liquidityState: 'THIN' as const,
    });
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
    });
    const result = service.createEnvelope(
      baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate, terms: thinTerms }),
    );
    assert.equal(result.envelope.overallStatus, 'INVALID');
    assert.ok(result.envelope.reasonCodes.includes('INSUFFICIENT_LIQUIDITY'));
  });

  it('6. market close invalidates envelope', () => {
    const customerId = 'cust_h21_close';
    const subjectId = 'id_h21_close';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
      marketTerms: createMarketTermsPort('CLOSED'),
    });
    const result = service.createEnvelope(
      baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate, venueSession: 'CLOSED' }),
    );
    assert.equal(result.envelope.overallStatus, 'INVALID');
    assert.ok(result.envelope.reasonCodes.includes('VENUE_CLOSED'));
  });

  it('7. account funds change invalidates envelope', () => {
    const customerId = 'cust_h21_funds';
    const subjectId = 'id_h21_funds';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
    });
    const result = service.createEnvelope(
      baseContext({
        candidate,
        recommendation: rec,
        capsule,
        workOrder,
        mandate,
        availableFundsMinor: '10000',
      }),
    );
    assert.equal(result.envelope.overallStatus, 'INVALID');
    assert.ok(
      result.envelope.reasonCodes.includes('ACCOUNT_FUNDS_INSUFFICIENT') ||
        result.envelope.reasonCodes.includes('CAPITAL_UNAVAILABLE'),
    );
  });

  it('8. competing reservation consumes cash before proposal', () => {
    const customerId = 'cust_h21_race';
    const subjectId = 'id_h21_race';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
    });
    const ctx = baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate, reservedFundsMinor: '0' });
    const created = service.createEnvelope(ctx);
    assert.equal(created.envelope.overallStatus, 'VALID');
    const raced = service.assertProposalEligibility(created.envelope.envelopeId, {
      ...ctx,
      reservedFundsMinor: '480000',
    });
    assert.equal(raced.eligible, false);
    if (!raced.eligible) {
      assert.ok(
        raced.reasonCodes.includes('CAPITAL_UNAVAILABLE') ||
          raced.reasonCodes.includes('ACCOUNT_FUNDS_INSUFFICIENT'),
      );
    }
  });

  it('9. mandate revoked invalidates envelope', () => {
    const customerId = 'cust_h21_mandate';
    const subjectId = 'id_h21_mandate';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const revokedMandate = activeMandate(subjectId, 'REVOKED');
    const capsule = promotedCapsule(workOrder.workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
    });
    const result = service.createEnvelope(
      baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate: revokedMandate }),
    );
    assert.equal(result.envelope.overallStatus, 'INVALID');
    assert.ok(result.envelope.reasonCodes.includes('MANDATE_REVOKED'));
  });

  it('10. approval expired invalidates envelope', () => {
    const customerId = 'cust_h21_approval';
    const subjectId = 'id_h21_approval';
    const scope = baseScope();
    const mandate = activeMandate(subjectId);
    const workOrderId = workOrderIdFor(customerId, 'h21_approval');
    const approval = createWorkOrderApprovalRef({
      workOrderId,
      approvalId: 'appr_expired',
      customerId: asCustomerId(customerId),
      actorId: subjectId,
      actorKind: 'CUSTOMER',
      approvalClass: 'EXPLICIT_STEP_UP',
      approvedScope: scope,
      now: asUtcInstant('2026-09-01T00:00:00.000Z'),
      expiresAt: asUtcInstant('2026-09-10T00:00:00.000Z'),
    });
    if ('code' in approval) throw new Error('approval');
    const workOrder = Object.freeze({
      ...createEconomicWorkOrderDraft({
        workOrderId,
        customerId: asCustomerId(customerId),
        subjectId,
        growObjectiveId: 'grow_h21',
        requestedScope: scope,
        mandateRef: mandateBindingRefFromCompiled(mandate, asCustomerId(customerId), NOW),
        approvalRef: approval,
        requiredApprovalClass: 'EXPLICIT_STEP_UP' as const,
        now: NOW,
      }),
      state: 'ACTIVE' as const,
      effectiveScope: scope,
      activatedAt: NOW,
      updatedAt: NOW,
    });
    const capsule = promotedCapsule(workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    candidateIdFor(workOrderId, 'approval');
    const candidateWithWo = Object.freeze({ ...candidate, workOrderId });
    const rec = recommendation(candidateWithWo, capsule);
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
    });
    const result = service.createEnvelope(
      baseContext({ candidate: candidateWithWo, recommendation: rec, capsule, workOrder, mandate }),
    );
    assert.equal(result.envelope.overallStatus, 'INVALID');
    assert.ok(result.envelope.reasonCodes.includes('APPROVAL_EXPIRED'));
  });

  it('11. Strategy Capsule expired invalidates envelope', () => {
    const customerId = 'cust_h21_scap_exp';
    const subjectId = 'id_h21_scap_exp';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId, {
      validUntil: asUtcInstant('2026-09-01T00:00:00.000Z'),
    });
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
    });
    const result = service.createEnvelope(baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate }));
    assert.equal(result.envelope.overallStatus, 'INVALID');
    assert.ok(result.envelope.reasonCodes.includes('STRATEGY_CAPSULE_EXPIRED'));
  });

  it('12. Strategy Capsule revoked invalidates envelope', () => {
    const customerId = 'cust_h21_scap_rev';
    const subjectId = 'id_h21_scap_rev';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId, { promotionState: 'REVOKED' });
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
    });
    const result = service.createEnvelope(baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate }));
    assert.equal(result.envelope.overallStatus, 'INVALID');
    assert.ok(result.envelope.reasonCodes.includes('STRATEGY_CAPSULE_REVOKED'));
  });

  it('13. model version unqualified invalidates envelope', () => {
    const customerId = 'cust_h21_model';
    const subjectId = 'id_h21_model';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
    });
    const result = service.createEnvelope(
      baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate, modelVersionQualified: false }),
    );
    assert.equal(result.envelope.overallStatus, 'INVALID');
    assert.ok(result.envelope.reasonCodes.includes('MODEL_VERSION_UNQUALIFIED'));
  });

  it('14. provider route unavailable invalidates envelope', () => {
    const customerId = 'cust_h21_route';
    const subjectId = 'id_h21_route';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const unavailableRoute = Object.freeze({
      ...defaultRoute(),
      availability: 'UNAVAILABLE' as const,
    });
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
    });
    const ctx = Object.freeze({
      ...baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate }),
      route: unavailableRoute,
    });
    const unavailableResult = service.createEnvelope(ctx);
    assert.equal(unavailableResult.envelope.overallStatus, 'INVALID');
    assert.ok(unavailableResult.envelope.reasonCodes.includes('PROVIDER_ROUTE_UNAVAILABLE'));
  });

  it('15. jurisdiction capability disabled invalidates envelope', () => {
    const customerId = 'cust_h21_jur';
    const subjectId = 'id_h21_jur';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
    });
    const result = service.createEnvelope(
      baseContext({
        candidate,
        recommendation: rec,
        capsule,
        workOrder,
        mandate,
        jurisdictionCapabilityEnabled: false,
      }),
    );
    assert.equal(result.envelope.overallStatus, 'INVALID');
    assert.ok(result.envelope.reasonCodes.includes('JURISDICTION_CAPABILITY_DISABLED'));
  });

  it('16. risk refusal invalidates envelope', () => {
    const customerId = 'cust_h21_risk';
    const subjectId = 'id_h21_risk';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'BLOCK', assessmentId: 'risk_block' }) },
    });
    const result = service.createEnvelope(baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate }));
    assert.equal(result.envelope.overallStatus, 'INVALID');
    assert.ok(result.envelope.reasonCodes.includes('RISK_REFUSED'));
    assert.equal(result.failureAction, 'ABANDON');
  });

  it('17. unknown critical state fails closed', () => {
    const customerId = 'cust_h21_unknown';
    const subjectId = 'id_h21_unknown';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const service = createService(capsule);
    const result = service.createEnvelope(baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate }));
    assert.equal(result.envelope.overallStatus, 'UNKNOWN');
    assert.ok(result.envelope.reasonCodes.includes('CRITICAL_STATE_UNKNOWN'));
    assert.equal(result.proposalEligible, false);
  });

  it('18. validity TTL follows shortest material component', () => {
    const customerId = 'cust_h21_ttl';
    const subjectId = 'id_h21_ttl';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
    });
    const result = service.createEnvelope(baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate }));
    const shortest = shortestMaterialValidUntil(result.envelope.componentChecks);
    assert.equal(result.envelope.validUntil, shortest);
    const quoteCheck = result.envelope.componentChecks.find((c) => c.component === 'MARKET_TERMS');
    const mandateCheck = result.envelope.componentChecks.find((c) => c.component === 'MANDATE_APPROVAL');
    assert.ok(quoteCheck && mandateCheck);
    assert.ok(Date.parse(result.envelope.validUntil) <= Date.parse(mandateCheck.validUntil));
  });

  it('19. envelope cannot cross customer', () => {
    const customerA = 'cust_h21_a';
    const customerB = 'cust_h21_b';
    const workOrderA = activeWorkOrder(customerA, 'id_a');
    const mandateA = activeMandate('id_a');
    const capsule = promotedCapsule(workOrderA.workOrderId);
    const candidateA = sampleCandidate(customerA, 'id_a', ['ev_external_market_obs_001']);
    const recA = recommendation(candidateA, capsule);
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
    });
    const created = service.createEnvelope(
      baseContext({ candidate: candidateA, recommendation: recA, capsule, workOrder: workOrderA, mandate: mandateA }),
    );
    const candidateB = sampleCandidate(customerB, 'id_b', ['ev_external_market_obs_001']);
    const revalidated = service.revalidateEnvelope(
      created.envelope.envelopeId,
      baseContext({
        candidate: candidateB,
        recommendation: recommendation(candidateB, capsule),
        capsule,
        workOrder: activeWorkOrder(customerB, 'id_b'),
        mandate: activeMandate('id_b'),
      }),
    );
    assert.equal(revalidated.ok, false);
    if (!revalidated.ok) {
      assert.equal(revalidated.error.code, 'CUSTOMER_MISMATCH');
    }
  });

  it('20. restart triggers revalidation', () => {
    const customerId = 'cust_h21_restart';
    const subjectId = 'id_h21_restart';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
    });
    const created = service.createEnvelope(baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate }));
    const restarted = service.afterRestart(created.envelope.envelopeId, {
      ...baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate }),
      afterRestart: true,
    });
    assert.equal(restarted.ok, true);
    if (restarted.ok) {
      assert.ok(restarted.value.envelope.reasonCodes.includes('RESTART_REVALIDATION'));
      assert.equal(restarted.value.envelope.supersedesEnvelopeId, created.envelope.envelopeId);
    }
  });

  it('21. valid envelope produces no financial effect by itself', () => {
    const customerId = 'cust_h21_no_fx';
    const subjectId = 'id_h21_no_fx';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
    });
    const result = service.createEnvelope(baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate }));
    assert.equal(result.envelope.overallStatus, 'VALID');
    assert.equal(result.envelope.grantsFinancialEffect, false);
    assert.equal(result.envelope.grantsExecutionAuthority, false);
    assert.equal(result.envelope.authorizesFinancialExecution, false);
  });

  it('22. race immediately before proposal is caught by assertProposalEligibility', () => {
    const customerId = 'cust_h21_proposal_race';
    const subjectId = 'id_h21_proposal_race';
    const workOrder = activeWorkOrder(customerId, subjectId);
    const mandate = activeMandate(subjectId);
    const capsule = promotedCapsule(workOrder.workOrderId);
    const candidate = sampleCandidate(customerId, subjectId, ['ev_external_market_obs_001']);
    const rec = recommendation(candidate, capsule);
    const service = createService(capsule, {
      riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
    });
    const ctx = baseContext({ candidate, recommendation: rec, capsule, workOrder, mandate });
    const created = service.createEnvelope(ctx);
    assert.equal(created.proposalEligible, true);
    const providerDown = Object.freeze({ ...defaultRoute(), availability: 'UNAVAILABLE' as const });
    const raced = service.assertProposalEligibility(created.envelope.envelopeId, {
      ...ctx,
      route: providerDown,
    });
    assert.equal(raced.eligible, false);
    if (!raced.eligible) {
      assert.ok(raced.reasonCodes.includes('PROVIDER_ROUTE_UNAVAILABLE'));
    }
  });

  it('architecture lint passes for HELIOS boundary', () => {
    const findings = lintHeliosBoundary(process.cwd()).filter((row) =>
      row.file.includes('decision-validity') || row.file.includes('strategy-capsule') || row.file.includes('meta-allocator'),
    );
    assert.equal(findings.length, 0);
  });

  it('chunk marker HELIOS_H21_DECISION_VALIDITY_ENVELOPE is defined', () => {
    assert.equal(HELIOS_H21_DECISION_VALIDITY_ENVELOPE, 'HELIOS_H21_DECISION_VALIDITY_ENVELOPE');
  });
});
