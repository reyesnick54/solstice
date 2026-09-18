import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import {
  ENVIRONMENT,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_TRADING_ENABLED,
} from '../packages/config/src/flags.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  HeliosOrderLifecycleService,
  HELIOS_H23_ORDER_LIFECYCLE,
  InMemoryHeliosOrderLifecycleStore,
  SandboxHeliosProviderPort,
  acknowledgementIsNotFill,
  fillIsNotSettlement,
  filledIsNotAvailable,
  operationIdFor,
  type HeliosCapitalPort,
  type HeliosOrderValidationPorts,
  type CreateHeliosOrderInput,
} from '../packages/platform/src/helios/order-lifecycle/index.ts';
import { workOrderIdFor } from '../packages/platform/src/helios/ids.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-17T14:00:00.000Z');

function defaultValidation(overrides: Partial<HeliosOrderValidationPorts> = {}): HeliosOrderValidationPorts {
  return Object.freeze({
    envelopeValid: () => true,
    mandateActive: () => true,
    accountOwned: () => true,
    capitalAvailable: () => true,
    providerCapable: () => true,
    marketOpen: () => true,
    riskPermits: () => true,
    kernelPermits: () => Object.freeze({ permitted: true, authorityReference: 'ea_sim_h23' }),
    ...overrides,
  });
}

function defaultCapital(): HeliosCapitalPort & { readonly reservations: Map<string, string> } {
  const reservations = new Map<string, string>();
  return Object.freeze({
    reservations,
    reserve: (input) => {
      reservations.set(input.idempotencyKey, input.amountMinorUnits);
      return { ok: true, reservationId: `rsv_${input.orderId}` };
    },
    release: (input) => {
      for (const [key] of reservations) {
        if (key.includes(input.reservationId.replace('rsv_', ''))) {
          reservations.delete(key);
        }
      }
    },
  });
}

function baseOrderInput(customerId: string, key = 'h23'): CreateHeliosOrderInput {
  const workOrderId = workOrderIdFor(customerId, key);
  return Object.freeze({
    customerId: asCustomerId(customerId),
    providerAccountId: `acct_${customerId}`,
    workOrderId,
    strategyCapsuleRef: null,
    proposalId: `prop_${key}`,
    envelopeId: null,
    instrumentId: 'inst_spy',
    side: 'BUY' as const,
    quantityUnits: '100',
    notionalMinorUnits: '1000000',
    orderType: 'MARKET' as const,
    timeInForce: 'DAY' as const,
    currency: 'USD',
    providerRoute: 'sandbox_helios_investment_v1',
    environment: 'SANDBOX' as const,
    idempotencyKey: `idem_${key}`,
    now: NOW,
  });
}

type Harness = {
  readonly clock: FrozenClock;
  readonly provider: SandboxHeliosProviderPort;
  readonly capital: ReturnType<typeof defaultCapital>;
  readonly service: HeliosOrderLifecycleService;
};

function createHarness(scenario?: Parameters<SandboxHeliosProviderPort['setScenario']>[0]): Harness {
  const clock = new FrozenClock(NOW);
  const evidence = new EvidenceVault(clock);
  const provider = new SandboxHeliosProviderPort();
  if (scenario) provider.setScenario(scenario);
  const capital = defaultCapital();
  const service = new HeliosOrderLifecycleService({
    clock,
    evidence,
    provider,
    validation: defaultValidation(),
    capital,
  });
  return { clock, provider, capital, service };
}

async function submitAndAck(h: Harness, customerId = 'cust_h23_a', key = 'h23') {
  const created = h.service.createOrder(baseOrderInput(customerId, key));
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error('create');
  const authorized = h.service.authorizeOrder(created.value.orderId, asCustomerId(customerId));
  assert.equal(authorized.ok, true);
  if (!authorized.ok) throw new Error('authorize');
  const submitted = h.service.submitOrder(created.value.orderId, asCustomerId(customerId));
  assert.equal(submitted.ok, true);
  if (!submitted.ok) throw new Error('submit');
  return submitted.value;
}

describe('HELIOS H23 order / fill / settlement lifecycle', () => {
  it('architecture guard: no competing HELIOS packages or authority bypass', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.deepEqual(findings, []);
  });

  it('1. submit order and reach acknowledged state', async () => {
    const h = createHarness();
    const order = await submitAndAck(h);
    assert.equal(order.status, 'ACKNOWLEDGED');
    assert.ok(order.providerOrderId);
    assert.equal(acknowledgementIsNotFill(order.status), true);
    assert.ok(order.submittedAt);
    assert.ok(order.acknowledgedAt);
  });

  it('2. acknowledgement is not fill or settlement', async () => {
    const h = createHarness();
    const order = await submitAndAck(h);
    assert.equal(fillIsNotSettlement(order.status), false);
    assert.equal(filledIsNotAvailable(order.status), true);
    const fills = h.service.store.getFills(order.orderId);
    assert.equal(fills.length, 0);
  });

  it('3. reject order at provider', async () => {
    const h = createHarness('REJECT');
    const created = h.service.createOrder(baseOrderInput('cust_reject'));
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    h.service.authorizeOrder(created.value.orderId, asCustomerId('cust_reject'));
    const submitted = h.service.submitOrder(created.value.orderId, asCustomerId('cust_reject'));
    assert.equal(submitted.ok, false);
    if (submitted.ok) throw new Error('expected reject');
    assert.equal(submitted.error.code, 'PROVIDER_REJECTED');
    const order = h.service.store.getOrder(created.value.orderId);
    assert.equal(order?.status, 'REJECTED');
  });

  it('4. partial fill', async () => {
    const h = createHarness('ACKNOWLEDGE_THEN_PARTIAL_THEN_FILL');
    const order = await submitAndAck(h, 'cust_partial', 'partial');
    const fills = h.provider.advanceScenarioFill(order.externalOperationId, NOW);
    assert.equal(fills.length, 1);
    const result = h.service.processFill(
      order.orderId,
      asCustomerId('cust_partial'),
      fills[0]!,
      'ev_partial_1',
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error('fill');
    assert.equal(result.value.order.status, 'PARTIALLY_FILLED');
    assert.equal(result.value.duplicate, false);
  });

  it('5. multiple partial fills aggregate correctly', async () => {
    const h = createHarness('ACKNOWLEDGE_THEN_PARTIAL_THEN_FILL');
    const order = await submitAndAck(h, 'cust_multi', 'multi');
    const first = h.provider.advanceScenarioFill(order.externalOperationId, NOW);
    h.service.processFill(order.orderId, asCustomerId('cust_multi'), first[0]!, 'ev_m1');
    const second = h.provider.advanceScenarioFill(order.externalOperationId, NOW);
    h.service.processFill(order.orderId, asCustomerId('cust_multi'), second[0]!, 'ev_m2');
    const agg = h.service.getOrderAggregation(order.orderId, asCustomerId('cust_multi'));
    assert.equal(agg.ok, true);
    if (!agg.ok) throw new Error('agg');
    assert.equal(agg.value.fillCount, 2);
    assert.equal(agg.value.remainingQuantityUnits, '0');
    assert.equal(agg.value.filledQuantityUnits, '100');
  });

  it('6. full fill', async () => {
    const h = createHarness();
    const order = await submitAndAck(h, 'cust_full', 'full');
    const fills = h.provider.advanceScenarioFill(order.externalOperationId, NOW);
    const result = h.service.processFill(order.orderId, asCustomerId('cust_full'), fills[0]!, 'ev_full');
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error('fill');
    assert.equal(result.value.order.status, 'FILLED');
  });

  it('7. duplicate fill webhook does not create duplicate fill', async () => {
    const h = createHarness();
    const order = await submitAndAck(h, 'cust_dup', 'dup');
    const fills = h.provider.advanceScenarioFill(order.externalOperationId, NOW);
    const fill = fills[0]!;
    h.service.processFill(order.orderId, asCustomerId('cust_dup'), fill, 'ev_dup_1');
    const dup = h.service.processFill(order.orderId, asCustomerId('cust_dup'), fill, 'ev_dup_2');
    assert.equal(dup.ok, true);
    if (!dup.ok) throw new Error('dup');
    assert.equal(dup.value.duplicate, true);
    assert.equal(h.service.store.getFills(order.orderId).length, 1);
  });

  it('8. cancellation before fill', async () => {
    const h = createHarness('CANCEL_SUCCESS');
    const order = await submitAndAck(h, 'cust_cancel', 'cancel');
    const cancelled = h.service.requestCancellation(order.orderId, asCustomerId('cust_cancel'));
    assert.equal(cancelled.ok, true);
    if (!cancelled.ok) throw new Error('cancel');
    assert.equal(cancelled.value.status, 'CANCELLED');
    assert.equal(h.service.store.getFills(order.orderId).length, 0);
  });

  it('8b. provider cancel rejection restores acknowledged state', async () => {
    const h = createHarness('CANCEL_REJECTED');
    const order = await submitAndAck(h, 'cust_cancel_reject', 'cancel_reject');
    const rejected = h.service.requestCancellation(order.orderId, asCustomerId('cust_cancel_reject'));
    assert.equal(rejected.ok, false);
    if (rejected.ok) throw new Error('expected cancel rejection');
    assert.equal(rejected.error.code, 'CANNOT_CANCEL');
    const restored = h.service.store.getOrder(order.orderId);
    assert.equal(restored?.status, 'ACKNOWLEDGED');
    assert.equal(restored?.cancelStatus, 'CANCEL_REJECTED');
  });

  it('9. cancellation/fill race resolves through provider evidence', async () => {
    const h = createHarness('CANCEL_FILL_RACE');
    const order = await submitAndAck(h, 'cust_race', 'race');
    const cancelled = h.service.requestCancellation(order.orderId, asCustomerId('cust_race'));
    assert.equal(cancelled.ok, true);
    if (!cancelled.ok) throw new Error('cancel');
    assert.equal(cancelled.value.status, 'PARTIALLY_FILLED_THEN_CANCELLED');
    assert.ok(h.service.store.getFills(order.orderId).length > 0);
  });

  it('10. timeout after submission does not release capital or mark failed', async () => {
    const h = createHarness('TIMEOUT_ON_SUBMIT');
    const created = h.service.createOrder(baseOrderInput('cust_timeout', 'timeout'));
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    h.service.authorizeOrder(created.value.orderId, asCustomerId('cust_timeout'));
    const submitted = h.service.submitOrder(created.value.orderId, asCustomerId('cust_timeout'));
    assert.equal(submitted.ok, false);
    if (submitted.ok) throw new Error('expected timeout');
    assert.equal(submitted.error.code, 'TIMEOUT_REQUIRES_RECONCILIATION');
    const order = h.service.store.getOrder(created.value.orderId);
    assert.equal(order?.status, 'UNKNOWN');
    assert.ok(h.capital.reservations.size > 0, 'capital reservation must remain');
  });

  it('11. unknown-state reconciliation', async () => {
    const h = createHarness();
    const order = await submitAndAck(h, 'cust_unknown', 'unknown');
    const unknown = h.service.store.getOrder(order.orderId)!;
    h.service.store.updateOrder(Object.freeze({ ...unknown, status: 'UNKNOWN' }));
    const reconciled = h.service.reconcileOrder(order.orderId, asCustomerId('cust_unknown'));
    assert.equal(reconciled.ok, true);
    if (!reconciled.ok) throw new Error('reconcile');
    assert.notEqual(reconciled.value.status, 'UNKNOWN');
  });

  it('12. settlement is separate from fill', async () => {
    const h = createHarness();
    const order = await submitAndAck(h, 'cust_settle', 'settle');
    const fills = h.provider.advanceScenarioFill(order.externalOperationId, NOW);
    h.service.processFill(order.orderId, asCustomerId('cust_settle'), fills[0]!, 'ev_settle');
    const filled = h.service.store.getOrder(order.orderId)!;
    assert.equal(filled.status, 'FILLED');
    assert.equal(fillIsNotSettlement(filled.status), true);
    const settlement = h.service.settleOrder(order.orderId, asCustomerId('cust_settle'));
    assert.equal(settlement.ok, true);
    if (!settlement.ok) throw new Error('settle');
    assert.equal(settlement.value.status, 'SETTLED');
    const settled = h.service.store.getOrder(order.orderId)!;
    assert.equal(settled.status, 'SETTLED');
  });

  it('13. reconciliation to available', async () => {
    const h = createHarness();
    const order = await submitAndAck(h, 'cust_recon', 'recon');
    const fills = h.provider.advanceScenarioFill(order.externalOperationId, NOW);
    h.service.processFill(order.orderId, asCustomerId('cust_recon'), fills[0]!, 'ev_recon');
    const reconciled = h.service.reconcileOrder(order.orderId, asCustomerId('cust_recon'));
    assert.equal(reconciled.ok, true);
    if (!reconciled.ok) throw new Error('reconcile');
    assert.equal(reconciled.value.status, 'AVAILABLE');
  });

  it('14. fee accounting in fill aggregation', async () => {
    const h = createHarness();
    const order = await submitAndAck(h, 'cust_fee', 'fee');
    const fills = h.provider.advanceScenarioFill(order.externalOperationId, NOW);
    h.service.processFill(order.orderId, asCustomerId('cust_fee'), fills[0]!, 'ev_fee');
    const agg = h.service.getOrderAggregation(order.orderId, asCustomerId('cust_fee'));
    assert.equal(agg.ok, true);
    if (!agg.ok) throw new Error('agg');
    assert.equal(agg.value.totalFeeMinor, '25');
  });

  it('15. restart after send preserves operation identity', async () => {
    const h = createHarness();
    const input = baseOrderInput('cust_restart', 'restart');
    const created = h.service.createOrder(input);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    h.service.authorizeOrder(created.value.orderId, asCustomerId('cust_restart'));
    h.service.submitOrder(created.value.orderId, asCustomerId('cust_restart'));

    const snapshot = h.service.store.snapshot();
    const restoredStore = new InMemoryHeliosOrderLifecycleStore();
    restoredStore.restore(snapshot);

    const h2 = new HeliosOrderLifecycleService({
      clock: h.clock,
      provider: h.provider,
      validation: defaultValidation(),
      capital: h.capital,
      store: restoredStore,
    });

    const opId = operationIdFor(input.workOrderId, input.proposalId, input.idempotencyKey);
    const restored = h2.store.getOrderByOperationId(opId);
    assert.ok(restored);
    assert.equal(restored?.status, 'ACKNOWLEDGED');
    const retry = h2.submitOrder(restored!.orderId, asCustomerId('cust_restart'));
    assert.equal(retry.ok, true);
    if (!retry.ok) throw new Error('retry');
    assert.equal(retry.value.providerOrderId, restored?.providerOrderId);
  });

  it('16. restart after partial fill preserves fill history', async () => {
    const h = createHarness('ACKNOWLEDGE_THEN_PARTIAL_THEN_FILL');
    const order = await submitAndAck(h, 'cust_restart_pf', 'restart_pf');
    const fills = h.provider.advanceScenarioFill(order.externalOperationId, NOW);
    h.service.processFill(order.orderId, asCustomerId('cust_restart_pf'), fills[0]!, 'ev_rpf');

    const snapshot = h.service.store.snapshot();
    const restoredStore = new InMemoryHeliosOrderLifecycleStore();
    restoredStore.restore(snapshot);

    assert.equal(restoredStore.getFills(order.orderId).length, 1);
    assert.equal(restoredStore.getOrder(order.orderId)?.status, 'PARTIALLY_FILLED');
  });

  it('17. stable operation ID prevents duplicate financial effect', async () => {
    const h = createHarness();
    const input = baseOrderInput('cust_stable', 'stable');
    const first = h.service.createOrder(input);
    const second = h.service.createOrder(input);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) throw new Error('create');
    assert.equal(first.value.orderId, second.value.orderId);
    assert.equal(first.value.operationId, second.value.operationId);
  });

  it('18. retry after timeout reconciles before duplicate submission', async () => {
    const h = createHarness('TIMEOUT_ON_SUBMIT');
    const input = baseOrderInput('cust_retry', 'retry');
    const created = h.service.createOrder(input);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    h.service.authorizeOrder(created.value.orderId, asCustomerId('cust_retry'));

    const first = h.service.submitOrder(created.value.orderId, asCustomerId('cust_retry'));
    assert.equal(first.ok, false);
    if (first.ok) throw new Error('expected timeout');
    assert.equal(h.service.store.getOrder(created.value.orderId)?.status, 'UNKNOWN');

    h.provider.setScenario('ACKNOWLEDGE_THEN_FILL');
    const order = h.service.store.getOrder(created.value.orderId)!;
    h.provider.submit({
      externalOperationId: order.externalOperationId,
      operationId: order.operationId,
      orderId: order.orderId,
      instrumentId: order.instrumentId,
      side: order.side,
      quantityUnits: order.quantityUnits,
      orderType: order.orderType,
      limitPriceMinorUnits: order.limitPriceMinorUnits,
      currency: order.currency,
      timeInForce: order.timeInForce,
    });

    const reconciled = h.service.reconcileOrder(created.value.orderId, asCustomerId('cust_retry'));
    assert.equal(reconciled.ok, true);
    if (!reconciled.ok) throw new Error('reconcile');
    assert.notEqual(reconciled.value.status, 'UNKNOWN');
  });

  it('19. customer isolation', async () => {
    const h = createHarness();
    const orderA = await submitAndAck(h, 'cust_a', 'iso_a');
    const viewB = h.service.getOrder(orderA.orderId, asCustomerId('cust_b'));
    assert.equal(viewB.ok, false);
    if (viewB.ok) throw new Error('expected mismatch');
    assert.equal(viewB.error.code, 'CUSTOMER_MISMATCH');
  });

  it('20. provider unavailable', async () => {
    const h = createHarness('UNAVAILABLE');
    const created = h.service.createOrder(baseOrderInput('cust_unavail', 'unavail'));
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    h.service.authorizeOrder(created.value.orderId, asCustomerId('cust_unavail'));
    const submitted = h.service.submitOrder(created.value.orderId, asCustomerId('cust_unavail'));
    assert.equal(submitted.ok, false);
    if (submitted.ok) throw new Error('expected unavailable');
    assert.equal(submitted.error.code, 'PROVIDER_UNAVAILABLE');
  });

  it('21. malformed webhook rejected', async () => {
    const h = createHarness();
    const order = await submitAndAck(h, 'cust_webhook', 'webhook');
    const result = h.service.ingestWebhook(asCustomerId('cust_webhook'), {
      eventId: 'pev_malformed_1',
      signature: 'wrong_secret',
      rawBody: '{}',
      parsed: {
        kind: 'FILL',
        externalOperationId: order.externalOperationId,
        providerOrderId: order.providerOrderId,
        providerFillId: null,
        customerId: 'cust_webhook',
      },
    });
    assert.equal(result.ok, false);
    if (result.ok) throw new Error('expected invalid');
    assert.equal(result.error.code, 'WEBHOOK_INVALID');
  });

  it('22. production/live gates remain explicit and disabled', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(HELIOS_H23_ORDER_LIFECYCLE, 'HELIOS_H23_ORDER_LIFECYCLE');
  });
});
