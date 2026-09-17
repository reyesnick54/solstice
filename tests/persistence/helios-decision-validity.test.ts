import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import {
  DecisionValidityEnvelopeService,
  createEvidenceRegistry,
  createExecutionRouteRegistry,
  createMarketTermsPort,
  strategyCapsuleIdFor,
  workOrderIdFor,
  candidateIdFor,
  type StrategyCapsuleRef,
  type StrategyCapsuleRegistryPort,
} from '../../packages/platform/src/helios/index.ts';
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
    service.createEnvelope(
      Object.freeze({
        now: NOW,
        candidate,
        recommendation,
        capsule,
        workOrder: null,
        mandate: null,
        authorityBinding: null,
        jurisdiction: asJurisdiction('US'),
        accountId: 'acct_checking',
        terms: null,
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
