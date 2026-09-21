import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { asDecisionValidityEnvelopeId } from '../../packages/platform/src/helios/decision-validity/ids.ts';
import {
  HeliosExecutionPlanService,
  InMemoryHeliosExecutionPlanStore,
  type ExecutionPlanConstraints,
  type ExecutionPlanValidationPorts,
} from '../../packages/platform/src/helios/execution-plan/index.ts';
import { workOrderIdFor } from '../../packages/platform/src/helios/ids.ts';
import { strategyCapsuleIdFor } from '../../packages/platform/src/helios/strategy-capsule/ids.ts';

const NOW = asUtcInstant('2026-09-21T10:00:00.000Z');
const VALID_UNTIL = asUtcInstant('2026-09-21T12:00:00.000Z');

function constraints(): ExecutionPlanConstraints {
  return Object.freeze({
    venueProvider: Object.freeze({
      permittedProviders: Object.freeze(['sandbox_helios_investment_v1']),
      excludedProviders: Object.freeze([]),
      preferredProvider: 'sandbox_helios_investment_v1',
      routePolicyVersion: 'helios.route.v1',
    }),
    orderStyle: Object.freeze({ orderIntent: 'LIMIT_REQUIRED' as const, allowPartialFills: true, minimumFillRatioBps: null }),
    price: Object.freeze({
      limitPriceMinorUnits: '4500000',
      maxPriceMinorUnits: null,
      minPriceMinorUnits: null,
      referencePriceMinorUnits: '4490000',
      priceBandBps: 50,
    }),
    time: Object.freeze({
      validFrom: NOW,
      validUntil: VALID_UNTIL,
      sessionOnly: true,
      avoidAuctionPeriods: true,
    }),
    slippage: Object.freeze({ maxSlippageBps: 25, estimatedSlippageBps: 8 }),
    spread: Object.freeze({ maxSpreadBps: 15, referenceSpreadBps: 5 }),
    liquidity: Object.freeze({
      minimumLiquidityScoreBps: 7000,
      maxParticipationRateBps: 500,
      averageDailyVolumeMinor: '50000000',
    }),
  });
}

function validation(): ExecutionPlanValidationPorts {
  return Object.freeze({
    envelopeValid: () => true,
    mandateActive: () => true,
    instrumentExecutable: () => true,
    marketStateValid: () => true,
    riskApproved: () => Object.freeze({ approved: true, reference: 'risk_persist' }),
    complianceApproved: () => Object.freeze({ approved: true, reference: 'comp_persist' }),
    capitalReserved: () => Object.freeze({ reserved: true, reference: 'cap_persist' }),
    providerCapable: () => true,
    strategyVersionMatches: () => true,
    withinApprovedSize: () => true,
  });
}

describe('HELIOS M21 execution plan persistence snapshot', () => {
  it('store snapshot round-trips plan and transition state', () => {
    const clock = new FrozenClock(NOW);
    const service = new HeliosExecutionPlanService({ clock, validation: validation() });
    const customerId = asCustomerId('cust_persist_m21');
    const workOrderId = workOrderIdFor('cust_persist_m21', 'persist');
    const capsuleRef = Object.freeze({
      capsuleId: strategyCapsuleIdFor(workOrderId, 'persist'),
      version: '1.0.0',
      contentHash: 'sha256_persist',
      promotionState: 'PROMOTED' as const,
      qualificationState: 'QUALIFIED' as const,
      validUntil: asUtcInstant('2026-12-31T00:00:00.000Z'),
      modelDependencies: Object.freeze(['mdl_s3m']),
      policyVersion: 'helios-strategy-capsule-v1',
      grantsExecutionAuthority: false as const,
    });

    const created = service.createPlan(
      Object.freeze({
        customerId,
        mandateId: 'mandate_persist',
        workOrderId,
        opportunityId: 'opp_persist',
        strategyCapsuleRef: capsuleRef,
        envelopeId: asDecisionValidityEnvelopeId(`dve_${workOrderId}_persist`),
        decisionValidUntil: VALID_UNTIL,
        legs: Object.freeze([
          Object.freeze({
            legId: 'leg_persist',
            legIndex: 0,
            instrumentId: 'inst_spy',
            assetClass: 'EQUITY' as const,
            direction: 'LONG' as const,
            targetQuantityUnits: '50',
            targetNotionalMinorUnits: '2250000',
            maximumApprovedQuantityUnits: '50',
            maximumApprovedNotionalMinorUnits: '2250000',
            executionCurrency: 'USD',
            constraints: constraints(),
          }),
        ]),
        evidenceRefs: Object.freeze(['ev_persist']),
        idempotencyKey: 'idem_persist',
        now: NOW,
      }),
    );
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    service.approveRisk(created.value.executionPlanId, customerId, 'risk_persist');
    service.approveCompliance(created.value.executionPlanId, customerId, 'comp_persist');

    const snapshot = service.store.snapshot();
    const restored = new InMemoryHeliosExecutionPlanStore();
    restored.restore(snapshot);

    assert.equal(restored.snapshot().plans.length, 1);
    assert.equal(restored.snapshot().transitions.length, 2);
    assert.equal(restored.getPlan(created.value.executionPlanId)?.status, 'COMPLIANCE_APPROVED');
  });
});
