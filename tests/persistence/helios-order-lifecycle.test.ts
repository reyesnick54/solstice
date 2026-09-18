import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import {
  HeliosOrderLifecycleService,
  InMemoryHeliosOrderLifecycleStore,
  SandboxHeliosProviderPort,
  type HeliosCapitalPort,
  type HeliosOrderValidationPorts,
} from '../../packages/platform/src/helios/order-lifecycle/index.ts';
import { workOrderIdFor } from '../../packages/platform/src/helios/ids.ts';

const NOW = asUtcInstant('2026-09-17T14:00:00.000Z');

function validation(): HeliosOrderValidationPorts {
  return Object.freeze({
    envelopeValid: () => true,
    mandateActive: () => true,
    accountOwned: () => true,
    capitalAvailable: () => true,
    providerCapable: () => true,
    marketOpen: () => true,
    riskPermits: () => true,
    kernelPermits: () => Object.freeze({ permitted: true, authorityReference: 'ea_persist' }),
  });
}

function capital(): HeliosCapitalPort {
  return Object.freeze({
    reserve: (input) => ({ ok: true, reservationId: `rsv_${input.orderId}` }),
    release: () => {},
  });
}

describe('HELIOS H23 order lifecycle persistence snapshot', () => {
  it('store snapshot round-trips order and fill state', () => {
    const clock = new FrozenClock(NOW);
    const provider = new SandboxHeliosProviderPort();
    const service = new HeliosOrderLifecycleService({ clock, provider, validation: validation(), capital: capital() });

    const customerId = asCustomerId('cust_persist_h23');
    const workOrderId = workOrderIdFor('cust_persist_h23', 'persist');
    const created = service.createOrder(
      Object.freeze({
        customerId,
        providerAccountId: 'acct_persist',
        workOrderId,
        strategyCapsuleRef: null,
        proposalId: 'prop_persist',
        envelopeId: null,
        instrumentId: 'inst_spy',
        side: 'BUY',
        quantityUnits: '50',
        notionalMinorUnits: '500000',
        orderType: 'MARKET',
        timeInForce: 'DAY',
        currency: 'USD',
        providerRoute: 'sandbox_helios_investment_v1',
        environment: 'SANDBOX',
        idempotencyKey: 'idem_persist',
        now: NOW,
      }),
    );
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    service.authorizeOrder(created.value.orderId, customerId);
    service.submitOrder(created.value.orderId, customerId);
    const fills = provider.advanceScenarioFill(created.value.externalOperationId, NOW);
    service.processFill(created.value.orderId, customerId, fills[0]!, 'ev_persist');

    const snapshot = service.store.snapshot();
    const restored = new InMemoryHeliosOrderLifecycleStore();
    restored.restore(snapshot);

    assert.equal(restored.snapshot().orders.length, 1);
    assert.equal(restored.snapshot().fills.length, 1);
    assert.equal(restored.getOrder(created.value.orderId)?.status, 'FILLED');
  });
});
