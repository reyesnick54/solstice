/**
 * HELIOS Multi-Asset M24 — execution, settlement, reconciliation, exit, cash availability.
 */

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
import { workOrderIdFor } from '../packages/platform/src/helios/ids.ts';
import {
  HeliosOrderLifecycleService,
  InMemoryHeliosOrderLifecycleStore,
  SandboxHeliosProviderPort,
  type HeliosCapitalPort,
  type HeliosOrderValidationPorts,
} from '../packages/platform/src/helios/order-lifecycle/index.ts';
import {
  ASSET_CLASS_SETTLEMENT_RULES,
  HELIOS_MULTI_ASSET_M24_EXECUTION,
  HELIOS_MULTI_ASSET_M24_EXECUTION_SETTLEMENT_RECONCILIATION_QUALIFIED,
  InMemoryMultiAssetExecutionStore,
  MultiAssetExecutionService,
  defaultM24QualificationChecks,
  evaluateM24ExecutionQualification,
  executionPlanIdFor,
  fillIsNotSettledCash,
  resolveAssetClass,
  settlementEligible,
  submittedIsNotFill,
  type SubmitMultiAssetOrderInput,
} from '../packages/platform/src/helios/multi-asset/m24/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-21T14:00:00.000Z');
const CUSTOMER = asCustomerId('cust_m24_a');

function defaultValidation(overrides: Partial<HeliosOrderValidationPorts> = {}): HeliosOrderValidationPorts {
  return Object.freeze({
    envelopeValid: () => true,
    mandateActive: () => true,
    accountOwned: () => true,
    capitalAvailable: () => true,
    providerCapable: () => true,
    marketOpen: () => true,
    riskPermits: () => true,
    kernelPermits: () => Object.freeze({ permitted: true, authorityReference: 'ea_sim_m24' }),
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

function baseOrderInput(overrides: Partial<SubmitMultiAssetOrderInput> = {}): SubmitMultiAssetOrderInput {
  const key = overrides.idempotencyKey ?? 'm24_base';
  const workOrderId = workOrderIdFor(String(CUSTOMER), key);
  return Object.freeze({
    customerId: CUSTOMER,
    accountId: 'acct_m24_a',
    workOrderId,
    proposalId: `prop_${key}`,
    instrumentId: 'inst_spy',
    side: 'BUY',
    quantityUnits: '100',
    notionalMinorUnits: '1000000',
    orderType: 'MARKET',
    currency: 'USD',
    providerRoute: 'sandbox_helios_investment_v1',
    venue: 'NYSE',
    idempotencyKey: key,
    ...overrides,
  });
}

type Harness = {
  readonly clock: FrozenClock;
  readonly provider: SandboxHeliosProviderPort;
  readonly capital: ReturnType<typeof defaultCapital>;
  readonly service: MultiAssetExecutionService;
};

function createHarness(scenario?: Parameters<SandboxHeliosProviderPort['setScenario']>[0]): Harness {
  const clock = new FrozenClock(NOW);
  const evidence = new EvidenceVault(clock);
  const provider = new SandboxHeliosProviderPort();
  if (scenario) provider.setScenario(scenario);
  const capital = defaultCapital();
  const service = new MultiAssetExecutionService({
    clock,
    evidence,
    provider,
    validation: defaultValidation(),
    capital,
  });
  return { clock, provider, capital, service };
}

async function submitAndAck(h: Harness, input = baseOrderInput()) {
  const submitted = h.service.submitOrder(input);
  assert.equal(submitted.ok, true, submitted.ok ? '' : submitted.error.message);
  return submitted.value;
}

describe('HELIOS Multi-Asset M24 execution / settlement / reconciliation', () => {
  it('architecture guard: no competing HELIOS packages or authority bypass', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.deepEqual(findings, []);
  });

  it('1. full fill lifecycle reaches SETTLEMENT_PENDING then SETTLED', async () => {
    const h = createHarness();
    const order = await submitAndAck(h, baseOrderInput({ idempotencyKey: 'full_fill' }));
    assert.equal(submittedIsNotFill(order.currentState), true);
    const fills = h.provider.advanceScenarioFill(
      h.service.orderLifecycle.store.getOrder(order.orderId)!.externalOperationId,
      NOW,
    );
    const filled = h.service.processFill(order.orderId, CUSTOMER, fills[0]!, 'ev_full');
    assert.equal(filled.ok, true);
    if (!filled.ok) throw new Error('fill');
    assert.equal(filled.value.order.currentState, 'SETTLEMENT_PENDING');
    assert.equal(fillIsNotSettledCash(filled.value.order.currentState), true);

    h.clock.set(asUtcInstant('2026-09-23T14:00:00.000Z'));
    const settled = h.service.advanceSettlement(order.orderId, CUSTOMER);
    assert.equal(settled.ok, true);
    if (!settled.ok) throw new Error('settle');
    assert.equal(settled.value.currentState, 'SETTLED');
  });

  it('2. partial fill with cancelled remainder', async () => {
    const h = createHarness('ACKNOWLEDGE_THEN_PARTIAL_THEN_FILL');
    const order = await submitAndAck(h, baseOrderInput({ idempotencyKey: 'partial' }));
    const extOp = h.service.orderLifecycle.store.getOrder(order.orderId)!.externalOperationId;
    const first = h.provider.advanceScenarioFill(extOp, NOW);
    h.service.processFill(order.orderId, CUSTOMER, first[0]!, 'ev_p1');
    const partial = h.service.store.getOrder(order.orderId);
    assert.equal(partial?.currentState, 'PARTIALLY_FILLED');

    h.provider.setScenario('CANCEL_FILL_RACE');
    const cancelled = h.service.requestCancellation(order.orderId, CUSTOMER);
    assert.equal(cancelled.ok, true);
    if (!cancelled.ok) throw new Error('cancel');
    assert.equal(h.service.store.getFills(order.orderId).length, 1);
  });

  it('3. rejected order', async () => {
    const h = createHarness('REJECT');
    const result = h.service.submitOrder(baseOrderInput({ idempotencyKey: 'reject' }));
    assert.equal(result.ok, false);
    if (result.ok) throw new Error('expected reject');
    assert.equal(result.error.code, 'PROVIDER_REJECTED');
    const plan = executionPlanIdFor(
      baseOrderInput({ idempotencyKey: 'reject' }).workOrderId,
      'prop_reject',
      'reject',
    );
    const record = h.service.store.getOrderByPlan(plan);
    assert.equal(record?.currentState, 'REJECTED');
  });

  it('4. timeout after submission preserves capital and requires reconciliation', async () => {
    const h = createHarness('TIMEOUT_ON_SUBMIT');
    const input = baseOrderInput({ idempotencyKey: 'timeout' });
    const result = h.service.submitOrder(input);
    assert.equal(result.ok, false);
    if (result.ok) throw new Error('expected timeout');
    assert.equal(result.error.code, 'TIMEOUT_REQUIRES_RECONCILIATION');
    assert.ok(h.capital.reservations.size > 0);
    const plan = executionPlanIdFor(input.workOrderId, input.proposalId, input.idempotencyKey);
    const order = h.service.store.getOrderByPlan(plan);
    assert.equal(order?.currentState, 'UNKNOWN_PROVIDER_STATE');
  });

  it('5. reconciliation recovery after timeout', async () => {
    const h = createHarness('TIMEOUT_ON_SUBMIT');
    const input = baseOrderInput({ idempotencyKey: 'recon_recovery' });
    h.service.submitOrder(input);
    const plan = executionPlanIdFor(input.workOrderId, input.proposalId, input.idempotencyKey);
    const order = h.service.store.getOrderByPlan(plan)!;

    h.provider.setScenario('ACKNOWLEDGE_THEN_FILL');
    const h23 = h.service.orderLifecycle.store.getOrder(order.orderId)!;
    h.provider.submit({
      externalOperationId: h23.externalOperationId,
      operationId: h23.operationId,
      orderId: h23.orderId,
      instrumentId: h23.instrumentId,
      side: h23.side,
      quantityUnits: h23.quantityUnits,
      orderType: h23.orderType,
      limitPriceMinorUnits: h23.limitPriceMinorUnits,
      currency: h23.currency,
      timeInForce: h23.timeInForce,
    });

    const reconciled = h.service.reconcileOrder(order.orderId, CUSTOMER);
    assert.equal(reconciled.ok, true);
    if (!reconciled.ok) throw new Error('reconcile');
    assert.notEqual(reconciled.value.currentState, 'UNKNOWN_PROVIDER_STATE');
  });

  it('6. duplicate callback does not duplicate fill', async () => {
    const h = createHarness();
    const order = await submitAndAck(h, baseOrderInput({ idempotencyKey: 'dup_cb' }));
    const extOp = h.service.orderLifecycle.store.getOrder(order.orderId)!.externalOperationId;
    const fills = h.provider.advanceScenarioFill(extOp, NOW);
    const fill = fills[0]!;
    h.service.processFill(order.orderId, CUSTOMER, fill, 'ev_dup1');
    const dup = h.service.processFill(order.orderId, CUSTOMER, fill, 'ev_dup2');
    assert.equal(dup.ok, true);
    if (!dup.ok) throw new Error('dup');
    assert.equal(dup.value.duplicate, true);
    assert.equal(h.service.store.getFills(order.orderId).length, 1);
  });

  it('7. duplicate polling / resubmit does not create duplicate order', async () => {
    const h = createHarness();
    const input = baseOrderInput({ idempotencyKey: 'dup_poll' });
    const first = h.service.submitOrder(input);
    const second = h.service.submitOrder(input);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) throw new Error('submit');
    assert.equal(first.value.executionPlanId, second.value.executionPlanId);
    assert.equal(first.value.orderId, second.value.orderId);
  });

  it('8. restart mid-order preserves state', async () => {
    const h = createHarness('ACKNOWLEDGE_THEN_PARTIAL_THEN_FILL');
    const order = await submitAndAck(h, baseOrderInput({ idempotencyKey: 'restart' }));
    const extOp = h.service.orderLifecycle.store.getOrder(order.orderId)!.externalOperationId;
    const fills = h.provider.advanceScenarioFill(extOp, NOW);
    h.service.processFill(order.orderId, CUSTOMER, fills[0]!, 'ev_restart');

    const snapshot = h.service.store.snapshot();
    const h23Snapshot = h.service.orderLifecycle.store.snapshot();
    const restoredStore = new InMemoryMultiAssetExecutionStore();
    restoredStore.restore(snapshot);
    const restoredH23Store = new InMemoryHeliosOrderLifecycleStore();
    restoredH23Store.restore(h23Snapshot);

    const h2 = new MultiAssetExecutionService({
      clock: h.clock,
      provider: h.provider,
      validation: defaultValidation(),
      capital: h.capital,
      orderLifecycle: new HeliosOrderLifecycleService({
        clock: h.clock,
        provider: h.provider,
        validation: defaultValidation(),
        capital: h.capital,
        store: restoredH23Store,
      }),
      store: restoredStore,
    });

    const restored = h2.store.getOrder(order.orderId);
    assert.equal(restored?.currentState, 'PARTIALLY_FILLED');
    assert.equal(h2.store.getFills(order.orderId).length, 1);
  });

  it('9. fill before acknowledgement via provider query reconciliation', async () => {
    const h = createHarness();
    const order = await submitAndAck(h, baseOrderInput({ idempotencyKey: 'fill_before_ack' }));
    const h23 = h.service.orderLifecycle.store.getOrder(order.orderId)!;
    h.service.orderLifecycle.store.updateOrder(
      Object.freeze({ ...h23, status: 'ACKNOWLEDGED', acknowledgedAt: null }),
    );
    h.service.store.putOrder(
      Object.freeze({ ...order, currentState: 'ACKNOWLEDGED', acknowledgedAt: null }),
    );
    assert.equal(submittedIsNotFill('ACKNOWLEDGED'), true);
    const fill = h.provider.emitFill(h23.externalOperationId, h23.quantityUnits, NOW);
    assert.ok(fill);
    const filled = h.service.processFill(order.orderId, CUSTOMER, fill!, 'ev_before_ack');
    assert.equal(filled.ok, true);
    if (!filled.ok) throw new Error('fill');
    assert.ok(h.service.store.getFills(order.orderId).length > 0);
    assert.equal(filled.value.order.currentState, 'SETTLEMENT_PENDING');
  });

  it('10. settlement delay for equities (T+1)', () => {
    const assetClass = resolveAssetClass('inst_spy');
    assert.equal(ASSET_CLASS_SETTLEMENT_RULES[assetClass].cycle, 'T_PLUS_1');
    assert.equal(settlementEligible(NOW, assetClass, NOW), false);
    assert.equal(settlementEligible(NOW, assetClass, asUtcInstant('2026-09-22T14:00:00.000Z')), true);
  });

  it('11. crypto immediate settlement (T+0)', async () => {
    const h = createHarness();
    const order = await submitAndAck(
      h,
      baseOrderInput({ instrumentId: 'crypto_btc_usd', venue: 'COINBASE', idempotencyKey: 'crypto' }),
    );
    assert.equal(order.assetClass, 'CRYPTO');
    assert.equal(ASSET_CLASS_SETTLEMENT_RULES.CRYPTO.immediateCashEffect, true);
    const extOp = h.service.orderLifecycle.store.getOrder(order.orderId)!.externalOperationId;
    const fills = h.provider.advanceScenarioFill(extOp, NOW);
    h.service.processFill(order.orderId, CUSTOMER, fills[0]!, 'ev_crypto');
    const settled = h.service.advanceSettlement(order.orderId, CUSTOMER);
    assert.equal(settled.ok, true);
    if (!settled.ok) throw new Error('settle');
    assert.equal(settled.value.currentState, 'SETTLED');
  });

  it('12. FX T+2 settlement semantics', () => {
    const assetClass = resolveAssetClass('fx_eur_usd');
    assert.equal(ASSET_CLASS_SETTLEMENT_RULES[assetClass].cycle, 'T_PLUS_2');
    assert.equal(settlementEligible(NOW, assetClass, asUtcInstant('2026-09-22T14:00:00.000Z')), false);
    assert.equal(settlementEligible(NOW, assetClass, asUtcInstant('2026-09-23T14:00:00.000Z')), true);
  });

  it('13. fees accounted in fill record', async () => {
    const h = createHarness();
    const order = await submitAndAck(h, baseOrderInput({ idempotencyKey: 'fees' }));
    const extOp = h.service.orderLifecycle.store.getOrder(order.orderId)!.externalOperationId;
    const fills = h.provider.advanceScenarioFill(extOp, NOW);
    h.service.processFill(order.orderId, CUSTOMER, fills[0]!, 'ev_fees');
    const fill = h.service.store.getFills(order.orderId)[0];
    assert.equal(fill?.feeMinorUnits, '25');
    assert.equal(fill?.feeCurrency, 'USD');
  });

  it('14. authorized exit plan (strategy exit)', async () => {
    const h = createHarness();
    const exit = h.service.authorizeExit({
      customerId: CUSTOMER,
      accountId: 'acct_m24_a',
      instrumentId: 'inst_spy',
      quantityUnits: '50',
      exitKind: 'STRATEGY_EXIT',
      workOrderId: workOrderIdFor(String(CUSTOMER), 'exit_strat'),
      proposalId: 'prop_exit_strat',
      idempotencyKey: 'exit_strat',
      authorityReference: 'ea_exit_strat',
    });
    assert.equal(exit.ok, true);
    if (!exit.ok) throw new Error('exit');
    assert.equal(exit.value.authorized, true);
    assert.equal(exit.value.exitKind, 'STRATEGY_EXIT');
  });

  it('15. emergency exit', async () => {
    const h = createHarness();
    const exit = h.service.authorizeExit({
      customerId: CUSTOMER,
      accountId: 'acct_m24_a',
      instrumentId: 'inst_spy',
      quantityUnits: '100',
      exitKind: 'EMERGENCY_CLOSE',
      workOrderId: workOrderIdFor(String(CUSTOMER), 'exit_emerg'),
      proposalId: 'prop_exit_emerg',
      idempotencyKey: 'exit_emerg',
      authorityReference: 'ea_exit_emerg',
    });
    assert.equal(exit.ok, true);
    if (!exit.ok) throw new Error('exit');
    assert.equal(exit.value.exitKind, 'EMERGENCY_CLOSE');
  });

  it('16. customer close request exit', async () => {
    const h = createHarness();
    const exit = h.service.authorizeExit({
      customerId: CUSTOMER,
      accountId: 'acct_m24_a',
      instrumentId: 'inst_spy',
      quantityUnits: '25',
      exitKind: 'USER_CLOSE',
      workOrderId: workOrderIdFor(String(CUSTOMER), 'exit_user'),
      proposalId: 'prop_exit_user',
      idempotencyKey: 'exit_user',
      authorityReference: 'ea_exit_user',
    });
    assert.equal(exit.ok, true);
    if (!exit.ok) throw new Error('exit');
    assert.equal(exit.value.exitKind, 'USER_CLOSE');
  });

  it('17. cash availability breakdown', () => {
    const h = createHarness();
    const cash = h.service.cashAvailability({
      customerId: CUSTOMER,
      accountId: 'acct_m24_a',
      currency: 'USD',
      ledgerSettledMinor: '500000',
      reservedMinor: '100000',
      positionMarketValueMinor: '300000',
      positionCostBasisMinor: '250000',
      realizedPnlMinor: '50000',
    });
    assert.equal(cash.serverCalculated, true);
    assert.ok(BigInt(cash.totalAccountEquityMinor) > 0n);
    assert.ok(BigInt(cash.unrealizedPnlMinor) > 0n);
    assert.equal(cash.realizedPnlMinor, '50000');
    assert.equal(cash.settledCashMinor, '500000');
    assert.equal(cash.reservedCapitalMinor, '100000');
    assert.ok(BigInt(cash.withdrawableCashMinor) >= 0n);
  });

  it('18. provider/account mismatch creates reconciliation exception', () => {
    const h = createHarness();
    const run = h.service.reconcileAccount({
      customerId: CUSTOMER,
      accountId: 'acct_m24_a',
      providerCashMinor: '900000',
      canonicalCashMinor: '1000000',
      providerPositions: Object.freeze({ inst_spy: '90' }),
      canonicalPositions: Object.freeze({ inst_spy: '100' }),
    });
    assert.equal(run.matched, false);
    assert.ok(run.exceptions.length >= 2);
    assert.ok(run.exceptions.some((e) => e.kind === 'CASH_MISMATCH'));
    assert.ok(run.exceptions.some((e) => e.kind === 'POSITION_MISMATCH'));
  });

  it('19. reconciliation exception sealed as evidence', () => {
    const h = createHarness();
    h.service.reconcileAccount({
      customerId: CUSTOMER,
      accountId: 'acct_m24_a',
      providerCashMinor: '0',
      canonicalCashMinor: '100',
      providerPositions: null,
      canonicalPositions: Object.freeze({}),
    });
    const open = h.service.store.openExceptions('acct_m24_a');
    assert.ok(open.length > 0);
    assert.ok(open.every((e) => e.evidenceRef !== null));
  });

  it('20. futures roll exit kind supported', async () => {
    const h = createHarness();
    const exit = h.service.authorizeExit({
      customerId: CUSTOMER,
      accountId: 'acct_m24_a',
      instrumentId: 'fut_cl_dec26',
      quantityUnits: '10',
      exitKind: 'FUTURES_ROLL',
      workOrderId: workOrderIdFor(String(CUSTOMER), 'exit_roll'),
      proposalId: 'prop_exit_roll',
      idempotencyKey: 'exit_roll',
      authorityReference: 'ea_exit_roll',
    });
    assert.equal(exit.ok, true);
    if (!exit.ok) throw new Error('exit');
    assert.equal(exit.value.assetClass, 'FUTURES');
    assert.equal(exit.value.exitKind, 'FUTURES_ROLL');
  });

  it('HELIOS_MULTI_ASSET_M24_EXECUTION_SETTLEMENT_RECONCILIATION_QUALIFIED when all checks pass', () => {
    const checks = defaultM24QualificationChecks();
    const result = evaluateM24ExecutionQualification(checks);
    assert.equal(
      result.marker,
      HELIOS_MULTI_ASSET_M24_EXECUTION_SETTLEMENT_RECONCILIATION_QUALIFIED,
      result.blockers.join('; '),
    );
    assert.equal(HELIOS_MULTI_ASSET_M24_EXECUTION, 'HELIOS_MULTI_ASSET_M24_EXECUTION');
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
    assert.equal(LIVE_TRADING_ENABLED, false);
  });
});
