import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import {
  InMemoryHeliosMetaAllocatorStore,
  META_ALLOCATOR_POLICY_VERSION,
  asCapitalRecommendationId,
  asMetaAllocationDecisionId,
  asResearchSpendRecommendationId,
  metaAllocationCandidateIdFor,
  metaAllocationRunIdFor,
  workOrderIdFor,
  type MetaAllocationDecision,
  type MetaAllocationRunResult,
} from '../../packages/platform/src/helios/index.ts';
import {
  loadHeliosMetaAllocatorState,
  persistHeliosMetaAllocatorState,
} from '../../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;
const NOW = asUtcInstant('2026-09-17T10:00:00.000Z');

describePersistence('HELIOS H20 Meta Allocator persistence', () => {
  it('meta allocator state survives restart', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const pool = durable.session.pools.customer;
    const store = new InMemoryHeliosMetaAllocatorStore();
    const workOrderId = workOrderIdFor('cust_persist_h20', '001');
    const runId = metaAllocationRunIdFor(workOrderId, 'persist');
    const candidateId = metaAllocationCandidateIdFor(workOrderId, 'persist');

    const decision: MetaAllocationDecision = Object.freeze({
      decisionId: asMetaAllocationDecisionId(`mad_${runId}_persist`),
      runId,
      candidateId,
      workOrderId,
      customerId: asCustomerId('cust_persist_h20'),
      disposition: 'NO_ACTION',
      researchSpend: Object.freeze({
        recommendationId: asResearchSpendRecommendationId('msr_persist'),
        decision: 'DO_NOT_RESEARCH',
        maxResearchSpendMinor: '0',
        currency: 'USD',
        assessment: Object.freeze({
          informationValueTier: 'LOW',
          economicallyJustified: false,
          confidenceState: 'CALIBRATED',
          reasonCodes: Object.freeze(['LOW_INFORMATION_VALUE'] as const),
          marginalResearchCostMinor: '0',
          publicReuseApplied: false,
        }),
        budgetSnapshotRef: 'MONETARY_MINOR:5000:5000',
        reasonCodes: Object.freeze([]),
        expiresAt: NOW,
      }),
      capitalRecommendation: null,
      feasibility: Object.freeze({
        feasible: false,
        minimumOrderSizeMinor: '5000',
        estimatedDeploymentMinor: '0',
        estimatedTotalCostMinor: '0',
        edgeAfterCostsMinor: '0',
        liquidityState: 'ADEQUATE',
        concentrationImpactBps: 0,
        reasonCodes: Object.freeze([]),
      }),
      reasonCodes: Object.freeze(['HOLD_CASH'] as const),
      policyVersion: META_ALLOCATOR_POLICY_VERSION,
      evidenceRefs: Object.freeze([]),
      specialistOutputRefs: Object.freeze([]),
      accountStateRef: Object.freeze({
        accountId: 'acct_persist',
        availableCashMinor: '100000',
        currency: 'USD',
        reservedCashMinor: '0',
        accountSizeMinor: '100000',
        stateVersion: 'v1',
        capturedAt: NOW,
      }),
      budgetStateRef: 'MONETARY_MINOR:5000:5000',
      decidedAt: NOW,
      expiresAt: NOW,
      grantsFinancialEffect: false,
      postsReservation: false,
    });

    const run: MetaAllocationRunResult = Object.freeze({
      runId,
      workOrderId,
      customerId: asCustomerId('cust_persist_h20'),
      decisions: Object.freeze([decision]),
      coordinationClaims: Object.freeze([]),
      unallocatedCashMinor: '100000',
      currency: 'USD',
      holdCash: true,
      decidedAt: NOW,
      policyVersion: META_ALLOCATOR_POLICY_VERSION,
      grantsFinancialEffect: false,
    });

    store.putRun(run);
    await persistHeliosMetaAllocatorState(pool, store.snapshot());

    const loaded = await loadHeliosMetaAllocatorState(pool);
    assert.equal(loaded.runs.length, 1);
    assert.equal(loaded.decisions.length, 1);
    assert.equal(loaded.runs[0]!.runId, runId);
    assert.equal(loaded.decisions[0]!.grantsFinancialEffect, false);
  });
});
