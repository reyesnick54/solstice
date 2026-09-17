import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { interpretMandateLanguage } from '../../packages/agent/src/interpretation.ts';
import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import {
  DecisionValidityEnvelopeService,
  bindWorkOrderAuthority,
  captureQualificationTerms,
  createEvidenceRegistry,
  createExecutionRouteRegistry,
  createMarketTermsPort,
  createEconomicWorkOrderDraft,
  mandateBindingRefFromCompiled,
  strategyCapsuleIdFor,
  workOrderIdFor,
  candidateIdFor,
  type StrategyCapsuleRef,
  type StrategyCapsuleRegistryPort,
} from '../../packages/platform/src/helios/index.ts';
import { compileEconomicMandate, mandateDraftFromInterpretation } from '../../packages/platform/src/mandate/compiler.ts';
import {
  loadDecisionValidityState,
  persistDecisionValidityState,
} from '../../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;
const NOW = asUtcInstant('2026-09-15T14:00:00.000Z');

describePersistence('HELIOS H21 persistence', () => {
  it('20. decision validity envelope survives restart and requires revalidation', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const pool = durable.session.pools.customer;
    const clock = new FrozenClock(NOW);
    const workOrderId = workOrderIdFor('cust_persist_h21', '001');
    const capsule: StrategyCapsuleRef = Object.freeze({
      capsuleId: strategyCapsuleIdFor(workOrderId, 'persist'),
      version: '1.0.0',
      contentHash: 'sha256_persist',
      promotionState: 'PROMOTED',
      qualificationState: 'QUALIFIED',
      validUntil: asUtcInstant('2026-12-31T00:00:00.000Z'),
      modelDependencies: Object.freeze([]),
      policyVersion: 'helios-strategy-capsule-v1',
      grantsExecutionAuthority: false as const,
    });
    const capsuleRegistry: StrategyCapsuleRegistryPort = Object.freeze({
      resolve: () => capsule,
    });
    const service = new DecisionValidityEnvelopeService({
      clock,
      ports: Object.freeze({
        evidenceRegistry: createEvidenceRegistry(),
        routeRegistry: createExecutionRouteRegistry(),
        marketTerms: createMarketTermsPort('OPEN'),
        capsuleRegistry,
        riskPort: { assess: () => Object.freeze({ outcome: 'ALLOW' }) },
      }),
    });
    const candidate = Object.freeze({
      candidateId: candidateIdFor(workOrderId, 'persist'),
      workOrderId,
      customerId: asCustomerId('cust_persist_h21'),
      subjectId: 'id_persist_h21',
      source: 'MARKET_OBSERVATION' as const,
      hypothesisType: 'persist',
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      instrumentCandidate: Object.freeze({
        instrumentId: 'SIM-ETF-1',
        productId: 'prod_paper_investment_review',
        symbol: 'SIM-ETF-1',
        assetClass: 'ETF',
      }),
      discoveredAt: NOW,
    });
    const recommendation = Object.freeze({
      recommendationId: `marec_${candidate.candidateId}` as const,
      candidateId: candidate.candidateId,
      workOrderId,
      customerId: candidate.customerId,
      capsuleRef: capsule,
      recommendedAt: NOW,
      expectedEdgeBps: 50,
      rationale: 'persist test',
      grantsExecutionAuthority: false as const,
    });
    const route = createExecutionRouteRegistry().routeFor({
      productId: 'prod_paper_investment_review',
      instrumentId: 'SIM-ETF-1',
      jurisdiction: asJurisdiction('US'),
    })!;
    const interpretation = interpretMandateLanguage({
      subjectId: candidate.subjectId,
      sourceText: 'Keep at least $8,000 liquid. Ask me before any movement over $1,000.',
      now: NOW,
    });
    if (!interpretation.ok) throw new Error('interpretation');
    const mandateDraft = mandateDraftFromInterpretation(interpretation.value, NOW);
    const compiled = compileEconomicMandate({ draft: mandateDraft, now: NOW });
    if (!compiled.ok) throw new Error('compile');
    const mandate = Object.freeze({ ...compiled.value, state: 'ACTIVE' as const });
    const scope = Object.freeze({
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
    const workOrder = Object.freeze({
      ...createEconomicWorkOrderDraft({
        workOrderId,
        customerId: candidate.customerId,
        subjectId: candidate.subjectId,
        growObjectiveId: 'grow_persist_h21',
        requestedScope: scope,
        mandateRef: mandateBindingRefFromCompiled(mandate, candidate.customerId, NOW),
        approvalRef: null,
        requiredApprovalClass: 'NONE' as const,
        now: NOW,
      }),
      state: 'ACTIVE' as const,
      effectiveScope: scope,
      activatedAt: NOW,
      updatedAt: NOW,
    });
    const authorityBinding = bindWorkOrderAuthority({
      mandate,
      customerId: candidate.customerId,
      capability: 'HELIOS_RESEARCH',
      approvalRef: null,
      now: NOW,
    });
    const terms = captureQualificationTerms({ route, now: NOW, venueSession: 'OPEN' });
    service.createEnvelope(
      Object.freeze({
        now: NOW,
        candidate,
        recommendation,
        capsule,
        workOrder,
        mandate,
        authorityBinding: typeof authorityBinding === 'object' && 'revalidationState' in authorityBinding ? authorityBinding : null,
        jurisdiction: asJurisdiction('US'),
        accountId: 'acct_checking',
        terms,
        route,
        venueSession: 'OPEN',
        availableFundsMinor: '500000',
        reservedFundsMinor: '0',
        deployedCapitalMinor: '0',
        strategyCapacityMinor: '500000',
        proposedNotionalMinor: '50000',
        currency: 'USD',
        instrumentActive: true,
        instrumentHalted: false,
        jurisdictionCapabilityEnabled: true,
        modelVersionQualified: true,
        researchExpiresAt: asUtcInstant('2026-12-31T00:00:00.000Z'),
        researchCompletedAt: NOW,
        qualificationAt: NOW,
        evidenceArrivedAt: NOW,
      }),
    );
    await persistDecisionValidityState(pool, service.snapshot());
    const reloaded = await loadDecisionValidityState(pool);
    assert.equal(reloaded.envelopes.length, 1);
    assert.equal(reloaded.envelopes[0]?.overallStatus, 'VALID');
    assert.equal(reloaded.envelopes[0]?.grantsFinancialEffect, false);
  });
});
