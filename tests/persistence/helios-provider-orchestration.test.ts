import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import {
  createSimulatedCustodyWalletAdapter,
  createSimulatedFundingAdapter,
  createSimulatedInvestmentAdapter,
  HeliosProviderOrchestrationService,
} from '../../packages/platform/src/helios/index.ts';
import {
  loadProviderOrchestrationState,
  persistProviderOrchestrationState,
} from '../../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;
const NOW = asUtcInstant('2026-09-17T14:00:00.000Z');

function runtime() {
  return {
    get(providerId: string) {
      if (providerId === 'sim-investments') {
        return {
          providerId,
          lifecycleState: 'SIMULATED',
          environment: 'LOCAL',
          healthState: 'HEALTHY',
          capabilities: ['INVESTMENT.PAPER_ORDER', 'INVESTMENT.FUND'],
          credentialConfigured: true,
        };
      }
      return null;
    },
    list() {
      return [
        {
          providerId: 'sim-investments',
          lifecycleState: 'SIMULATED',
          environment: 'LOCAL',
          healthState: 'HEALTHY',
          capabilities: ['INVESTMENT.PAPER_ORDER', 'INVESTMENT.FUND'],
          credentialConfigured: true,
        },
      ];
    },
  };
}

describePersistence('HELIOS H22 persistence', () => {
  it('provider orchestration snapshot survives restart', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const pool = durable.session.pools.customer;
    const clock = new FrozenClock(NOW);
    const service = new HeliosProviderOrchestrationService({
      clock,
      ports: {
        runtime: runtime(),
        investmentAdapters: {
          'sim-investments': createSimulatedInvestmentAdapter('sim-investments'),
        },
        fundingAdapters: {
          'sim-investments': createSimulatedFundingAdapter('sim-investments'),
        },
        custodyAdapters: {
          'sim-custody': createSimulatedCustodyWalletAdapter('sim-custody'),
        },
      },
    });
    const submitted = service.submitAccountApplication({
      customerId: asCustomerId('cust_h22_persist'),
      legalIdentityRef: 'id_ref_verified',
      kycState: 'VERIFIED',
      jurisdiction: asJurisdiction('US'),
      productRequested: 'brokerage_cash',
      providerId: 'sim-investments',
      accountType: 'BROKERAGE_CASH',
      requiredAgreements: Object.freeze(['customer_agreement']),
      idempotencyKey: 'persist-app-key',
      environment: 'simulation',
    });
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;

    await persistProviderOrchestrationState(pool, service.snapshot(), NOW);
    const reloaded = await loadProviderOrchestrationState(pool);
    assert.ok(reloaded);
    assert.equal(reloaded!.applications.length, 1);
    assert.equal(reloaded!.applications[0]?.customerId, 'cust_h22_persist');

    const restarted = HeliosProviderOrchestrationService.fromSnapshot({
      clock,
      ports: {
        runtime: runtime(),
        investmentAdapters: {
          'sim-investments': createSimulatedInvestmentAdapter('sim-investments'),
        },
        fundingAdapters: {
          'sim-investments': createSimulatedFundingAdapter('sim-investments'),
        },
        custodyAdapters: {
          'sim-custody': createSimulatedCustodyWalletAdapter('sim-custody'),
        },
      },
      snapshot: reloaded!,
    });
    const retry = restarted.submitAccountApplication({
      customerId: asCustomerId('cust_h22_persist'),
      legalIdentityRef: 'id_ref_verified',
      kycState: 'VERIFIED',
      jurisdiction: asJurisdiction('US'),
      productRequested: 'brokerage_cash',
      providerId: 'sim-investments',
      accountType: 'BROKERAGE_CASH',
      requiredAgreements: Object.freeze(['customer_agreement']),
      idempotencyKey: 'persist-app-key',
      environment: 'simulation',
    });
    assert.equal(retry.ok, true);
    if (!retry.ok) return;
    assert.equal(retry.value.applicationId, submitted.value.applicationId);
    await durable.close();
  });
});
