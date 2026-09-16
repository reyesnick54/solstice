import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import {
  ExecutableOpportunityQualificationService,
  InMemoryExecutableOpportunityStore,
  createEvidenceRegistry,
  createExecutionRouteRegistry,
  createMarketTermsPort,
  workOrderIdFor,
} from '../../packages/platform/src/helios/index.ts';
import {
  loadExecutableOpportunityState,
  persistExecutableOpportunityState,
} from '../../packages/persistence/src/index.ts';
import { defaultOpportunityPreferences } from '../../packages/platform/src/growth/opportunity/preferences.ts';
import { SIMULATION_GROWTH_PRODUCTS, SIMULATION_RATE_CATALOG } from '../../packages/platform/src/growth/opportunity/products.ts';
import { simulationPolicyPort } from '../../packages/platform/src/policy-port.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;
const NOW = asUtcInstant('2026-09-15T14:00:00.000Z');

describePersistence('HELIOS H09 persistence', () => {
  it('16. executable opportunity state survives restart', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const pool = durable.session.pools.customer;
    const clock = new FrozenClock(NOW);
    const service = new ExecutableOpportunityQualificationService({
      clock,
      evidenceRegistry: createEvidenceRegistry(),
      routeRegistry: createExecutionRouteRegistry(),
      marketTerms: createMarketTermsPort(),
    });
    const candidate = service.discoverCandidate({
      workOrderId: workOrderIdFor('cust_persist_h09', '001'),
      customerId: asCustomerId('cust_persist_h09'),
      subjectId: 'id_persist_h09',
      source: 'ECONOMIC_OBSERVATION',
      hypothesisType: 'persist',
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      instrumentCandidate: Object.freeze({
        instrumentId: 'SIM-ETF-1',
        productId: 'prod_paper_investment_review',
        symbol: 'SIM-ETF-1',
        assetClass: 'ETF',
      }),
      key: '001',
    });
    service.qualifyCandidate({
      candidate,
      workOrder: null,
      mandate: null,
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
        preferences: defaultOpportunityPreferences('id_persist_h09', NOW),
        previous: Object.freeze([]),
        rateCatalog: SIMULATION_RATE_CATALOG,
      },
      detector: 'MARKET_RESEARCH_CANDIDATE',
      environment: 'sandbox',
      accountClass: 'BROKERAGE',
      proposedNotional: { minorUnits: '50000', currency: 'USD' },
    });
    await persistExecutableOpportunityState(pool, service.snapshot());
    const reloaded = await loadExecutableOpportunityState(pool);
    assert.equal(reloaded.candidates.length, 1);
    assert.equal(reloaded.executableOpportunities.length, 1);
    const restarted = new ExecutableOpportunityQualificationService({
      clock,
      evidenceRegistry: createEvidenceRegistry(),
      routeRegistry: createExecutionRouteRegistry(),
      marketTerms: createMarketTermsPort(),
      store: InMemoryExecutableOpportunityStore.fromSnapshot(reloaded),
    });
    const found = restarted.getForCustomer(
      asCustomerId('cust_persist_h09'),
      reloaded.executableOpportunities[0]!.executableOpportunityId,
    );
    assert.ok(found);
    assert.equal(found!.candidateId, reloaded.candidates[0]!.candidateId);
    await durable.close();
  });
});
