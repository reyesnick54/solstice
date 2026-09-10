import assert from 'node:assert/strict';
import test from 'node:test';

import {
  asCustomerId,
  asJurisdiction,
  asLegalEntityId,
  asResidency,
  asUtcInstant,
} from '@solstice/domain';
import { ExchangeBffSurface } from '../../services/api/src/consumer/exchange.ts';
import { createDurableExchangeSurface } from '../../services/api/src/consumer/durable-exchange.ts';
import type { BffPrincipal } from '../../services/api/src/consumer/ports.ts';
import {
  createDurableRuntime,
  persistenceAvailable,
  preparePersistence,
} from './helpers.ts';

const principal: BffPrincipal = Object.freeze({
  actorId: 'actor_sandbox_exchange',
  customerId: 'cust_sandbox_exchange',
  identityId: 'idn_sandbox_exchange',
  sessionId: 'test-session-exchange',
  jurisdiction: 'GB',
  verification: 'VERIFIED',
  customerStatus: 'ACTIVE',
  identityStatus: 'ACTIVE',
  capabilities: Object.freeze(['VIEW_ACCOUNT', 'EXCHANGE_VIEW', 'EXCHANGE_TRADE']),
  risk: 'LOW',
  restricted: false,
  sandboxPersona: 'exchange',
  deviceSummary: Object.freeze({ deviceId: null, trustState: 'KNOWN' }),
});

const CUSTOMER_CREATED_AT = asUtcInstant('2026-01-15T09:00:00.000Z');
const CUSTOMER_REFRESH_BY = asUtcInstant('2027-08-21T00:00:00.000Z');

test(
  'durable Internal Alpha exchange survives restart and idempotent order submit creates no duplicate',
  { skip: !persistenceAvailable() },
  async () => {
    const env = await preparePersistence();
    let durable = await createDurableRuntime(env);

    await durable.saveCustomer(
      Object.freeze({
        id: asCustomerId(principal.customerId),
        legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
        jurisdiction: asJurisdiction('GB'),
        residency: asResidency('GB'),
        status: 'ACTIVE' as const,
        verification: Object.freeze({
          kycState: 'VERIFIED' as const,
          kycRecordVersion: 1,
          refreshBy: CUSTOMER_REFRESH_BY,
        }),
        createdAt: CUSTOMER_CREATED_AT,
        version: 1,
      }),
    );

    let surface = await createDurableExchangeSurface(durable);
    assert.equal(surface.bindingReport.hydratedCustomers, 0);
    assert.equal(surface.bindingReport.productionTradingEnabled, false);

    const world = surface.worldFor(principal);
    world.fundQuote();
    const proposal = world.createProposal({ side: 'BUY', quantity: 1n, notionalUsdMinor: '50000' });
    assert.ok(!('ok' in proposal));
    const approved = world.approveProposal({
      proposalId: proposal.proposalId,
      actor: 'HUMAN',
      stepUpSatisfied: true,
    });
    assert.ok(!('ok' in approved));

    const first = await surface.submit(principal, proposal.proposalId, { clientOrderId: 'idem_exchange_order_1' }, 'req_1');
    assert.ok(!('errorCode' in first));
    const orderCountBefore = world.engine.orders.size;

    durable = await durable.restart();
    surface = await createDurableExchangeSurface(durable);
    assert.equal(surface.bindingReport.hydratedCustomers, 1);

    const restoredWorld = surface.worldFor(principal);
    assert.equal(restoredWorld.engine.orders.size, orderCountBefore);
    assert.equal(restoredWorld.engine.ordersByClient.get('idem_exchange_order_1'), world.engine.ordersByClient.get('idem_exchange_order_1'));

    const replay = await surface.submit(principal, proposal.proposalId, { clientOrderId: 'idem_exchange_order_1' }, 'req_2');
    assert.equal((replay as { replay?: boolean }).replay, true);
    assert.equal(restoredWorld.engine.orders.size, orderCountBefore);

    await durable.close();
  },
);

test(
  'durable exchange isolates customer state across users',
  { skip: !persistenceAvailable() },
  async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const other: BffPrincipal = Object.freeze({
      ...principal,
      customerId: 'cust_sandbox_exchange_other',
      actorId: 'actor_sandbox_exchange_other',
      identityId: 'idn_sandbox_exchange_other',
    });

    for (const customerId of [principal.customerId, other.customerId]) {
      await durable.saveCustomer(
        Object.freeze({
          id: asCustomerId(customerId),
          legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
          jurisdiction: asJurisdiction('GB'),
          residency: asResidency('GB'),
          status: 'ACTIVE' as const,
          verification: Object.freeze({
            kycState: 'VERIFIED' as const,
            kycRecordVersion: 1,
            refreshBy: CUSTOMER_REFRESH_BY,
          }),
          createdAt: CUSTOMER_CREATED_AT,
          version: 1,
        }),
      );
    }

    const surface = await createDurableExchangeSurface(durable);
    const worldA = surface.worldFor(principal);
    worldA.fundQuote();
    const proposal = worldA.createProposal({ side: 'BUY', quantity: 1n });
    assert.ok(!('ok' in proposal));
    const approved = worldA.approveProposal({
      proposalId: proposal.proposalId,
      actor: 'HUMAN',
      stepUpSatisfied: true,
    });
    assert.ok(!('ok' in approved));
    await surface.submit(principal, proposal.proposalId, { clientOrderId: 'clord_a' }, 'req_a');

    const worldB = surface.worldFor(other);
    assert.equal(worldB.engine.orders.size, 0);

    await durable.close();
  },
);

test('in-memory exchange surface remains available without persistence hooks', () => {
  const surface = new ExchangeBffSurface(() => asUtcInstant('2026-09-10T12:00:00.000Z'));
  const world = surface.worldFor(principal);
  world.fundQuote();
  assert.equal(world.engine.profiles.has(principal.customerId), true);
});
