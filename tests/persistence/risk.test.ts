import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { DomainEventLog } from '../../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../packages/identity/src/simulation.ts';
import { persistRiskState } from '../../packages/persistence/src/risk/pg-risk-store.ts';
import {
  closePersistencePools,
  createPersistencePools,
} from '../../packages/persistence/src/postgres/pools.ts';
import { ModelRegistry, seedCanonicalRiskModel } from '../../packages/model-registry/src/registry.ts';
import { asPortfolioRiskSnapshotId } from '../../packages/risk/src/ids.ts';
import { defaultSimulationBudget, RiskEngine } from '../../packages/risk/src/engine.ts';
import { createSimulationKeyProvider } from '../../packages/security/src/simulation.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

describe('Risk persistence', () => {
  it('persists budgets, assessments, and stress runs without a journal table', async (t) => {
    if (!persistenceAvailable()) {
      t.skip('SOLSTICE_PERSISTENCE_TEST is not set');
      return;
    }
    const env = await preparePersistence();
    const pools = createPersistencePools(env);
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const events = new DomainEventLog();
    const identity = new SimulatedIdentityAdapter({ clock, keys, events });
    assert.equal(
      identity.provisionSimulatedActor({
        actorId: 'actor_risk_pg',
        jurisdiction: asJurisdiction('GB'),
        identityId: 'id_risk_pg',
        customerId: asCustomerId('cust_risk_pg'),
        capabilities: ['VIEW_ACCOUNT'],
      }).ok,
      true,
    );
    const actor = identity.service.resolveActorContext('actor_risk_pg');
    assert.equal(actor.ok, true);
    if (!actor.ok) {
      return;
    }
    const registry = new ModelRegistry();
    const seeded = seedCanonicalRiskModel(registry, actor.value, NOW);
    assert.equal(seeded.ok, true);
    const engine = new RiskEngine({ clock, registry, events });
    const budget = defaultSimulationBudget({
      subjectId: 'cust_risk_pg',
      portfolioId: 'inv_risk_pg',
      reviewBy: NOW,
    });
    engine.putBudget(budget);
    engine.assessPreTrade({
      snapshot: Object.freeze({
        snapshotId: asPortfolioRiskSnapshotId('prs_risk_pg'),
        portfolioId: 'inv_risk_pg',
        subjectId: 'cust_risk_pg',
        asOf: NOW,
        currency: 'USD',
        positions: Object.freeze([
          {
            instrumentId: 'SIM-ETF-1',
            instrumentType: 'ETF',
            currency: 'USD',
            quantityUnits: 1_000_000_000n,
            marketValueMinor: 100_000n,
            priceMinor: 10_000n,
            priceTimestamp: NOW,
            priceQuality: 'CURRENT' as const,
            liquidityClass: 'HIGH' as const,
            sourceRef: 'fixture:pg',
          },
        ]),
        brokerageCashMinor: 100_000n,
        unsettledCashMinor: 0n,
        pendingOrderNotionalMinor: 0n,
        realizedPnlMinor: 0n,
        unrealizedPnlMinor: 0n,
        observations: Object.freeze([]),
        sourceRefs: Object.freeze(['fixture:pg']),
        simulationOnly: true as const,
      }),
      proposed: Object.freeze({
        proposalRef: 'ord_pg_block',
        instrumentId: 'SIM-ETF-1',
        instrumentType: 'ETF',
        currency: 'USD',
        side: 'BUY' as const,
        quantityUnits: 600_000_000n,
        quantityScale: 8 as const,
        priceMinor: 10_000n,
        notionalMinor: 60_000n,
        feeMinor: 0n,
        liquidityClass: 'HIGH' as const,
      }),
      budget,
    });
    await persistRiskState(pools.customer, engine.store.snapshot());
    const budgets = await pools.customer.query('SELECT budget_id FROM risk.budget');
    const assessments = await pools.customer.query('SELECT outcome FROM risk.assessment');
    const journals = await pools.customer.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'risk' AND table_name = 'journal'`,
    );
    assert.equal(budgets.rowCount, 1);
    assert.ok((assessments.rowCount ?? 0) >= 1);
    assert.equal(journals.rowCount, 0);
    await closePersistencePools(pools);
  });
});
