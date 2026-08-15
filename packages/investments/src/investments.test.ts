import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { LIVE_INVESTMENT_EXECUTION } from '../../config/src/flags.ts';
import { transitionAccountStatus } from '../../domain/src/account.ts';
import { asCurrencyCode } from '../../domain/src/currency.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../../domain/src/legal-entity.ts';
import { asProductId } from '../../domain/src/product.ts';
import { isOk } from '../../domain/src/result.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { ACTION_TYPES, type CreatePaperOrderIntent } from '../../permissions/src/action-types.ts';
import { EconomicGraphService } from '../../personal-economic-graph/src/service.ts';
import { materializeGrowthAction } from '../../platform/src/growth/materialize.ts';
import { seedSimulationCatalog } from '../../../services/accounts/src/catalog.ts';
import { createSimulationRuntime } from '../../../services/accounts/src/runtime.ts';
import { activateCustomer, openIntent, NOW } from '../../../services/accounts/src/test-helpers.ts';
import { evaluateInvestmentEligibility } from './eligibility.ts';
import { asFillId, asInvestmentAccountId, asInstrumentId, asSettlementId } from './ids.ts';
import { SimulatedMarketDataProvider } from './market-data.ts';
import { freezePaperFill } from './fill.ts';
import { quantityFromScaledString, quantityFromWholeString, QUANTITY_SCALE } from './quantity.ts';
import { notionalMoney, priceFromMinorUnitsString } from './price.ts';
import { SIM_ETF_1 } from './seed.ts';
import { InvestmentsService } from './service.ts';
import { freezeSettlement } from './settlement.ts';
import { FORBIDDEN_ORDER_SIDES, LIVE_INVESTMENT_EXECUTION as PACKAGE_LIVE_FLAG } from './types.ts';

const TEN_THOUSAND = 1_000_000n;
const FIVE_THOUSAND = 500_000n;
const TEN_SHARES = '1000000000';
const FOUR_SHARES = '400000000';
const ELEVEN_SHARES = '1100000000';

function wired(suffix: string) {
  const clock = new FrozenClock(NOW);
  const runtime = createSimulationRuntime({ clock });
  const customer = activateCustomer(runtime, `cust_${suffix}`);
  const seeded = seedSimulationCatalog();
  const demand = runtime.accountsService.open(
    openIntent({ id: `${suffix}_open_d`, accountId: `${suffix}_d`, ownerId: customer.id }),
  );
  assert.equal(demand.outcome, 'OPENED');
  const brokerage = runtime.accountsService.open(
    openIntent({
      id: `${suffix}_open_b`,
      accountId: `${suffix}_b`,
      ownerId: customer.id,
      productId: asProductId('prod_brokerage_cash_usd_gb'),
      accountClass: 'BROKERAGE_CASH',
    }),
  );
  assert.equal(brokerage.outcome, 'OPENED');
  const securities = runtime.accountsService.open(
    openIntent({
      id: `${suffix}_open_s`,
      accountId: `${suffix}_s`,
      ownerId: customer.id,
      productId: asProductId('prod_securities_usd_gb'),
      accountClass: 'SECURITIES',
    }),
  );
  assert.equal(securities.outcome, 'OPENED');
  const pending = runtime.accountsService.open(
    openIntent({
      id: `${suffix}_open_p`,
      accountId: `${suffix}_p`,
      ownerId: customer.id,
      productId: asProductId('prod_pending_usd_gb'),
      accountClass: 'PENDING_SETTLEMENT',
    }),
  );
  assert.equal(pending.outcome, 'OPENED');
  if (demand.outcome !== 'OPENED' || brokerage.outcome !== 'OPENED' || securities.outcome !== 'OPENED' || pending.outcome !== 'OPENED') {
    throw new Error('account open failed');
  }
  const deposited = runtime.money.deposit({
    id: asIntentId(`${suffix}_dep`),
    actionType: ACTION_TYPES.POST_DEPOSIT,
    idempotencyKey: `${suffix}_dep`,
    actorId: 'operator_1',
    requestedAt: clock.now(),
    purpose: 'CUSTOMER_FUNDING',
    payload: { accountId: demand.account.id, amount: Money.fromMinorUnits(TEN_THOUSAND, 'USD') },
  });
  assert.equal(deposited.outcome, 'POSTED');
  const investments = new InvestmentsService(
    runtime.kernel,
    runtime.issuer,
    runtime.evidence,
    runtime.events,
    clock,
    {
      customers: runtime.customers,
      accounts: runtime.accounts,
      products: seeded.products.asCatalog(),
      legalEntities: seeded.legalEntities,
    },
    runtime.identity.service,
    runtime.ledger,
  );
  return {
    clock,
    runtime,
    customer,
    demand: demand.account,
    brokerage: brokerage.account,
    securities: securities.account,
    pending: pending.account,
    investments,
    seeded,
  };
}

function openProfile(world: ReturnType<typeof wired>, suffix: string, overrides: Record<string, unknown> = {}) {
  return world.investments.openInvestmentAccount({
    id: asIntentId(`${suffix}_inv_open`),
    actionType: ACTION_TYPES.OPEN_INVESTMENT_ACCOUNT,
    idempotencyKey: `${suffix}_inv_open`,
    actorId: 'operator_1',
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_INVESTMENT',
    payload: {
      accountId: world.demand.id,
      investmentAccountId: `inv_${suffix}`,
      customerId: world.customer.id,
      brokerageCashAccountId: world.brokerage.id,
      securitiesAccountId: world.securities.id,
      pendingSettlementAccountId: world.pending.id,
      productId: asProductId('prod_brokerage_cash_usd_gb'),
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      currency: asCurrencyCode('USD'),
      ...overrides,
    },
  });
}

function fund(world: ReturnType<typeof wired>, suffix: string, amount = FIVE_THOUSAND) {
  return world.investments.fundBrokerageCash({
    id: asIntentId(`${suffix}_fund`),
    actionType: ACTION_TYPES.FUND_BROKERAGE_CASH,
    idempotencyKey: `${suffix}_fund`,
    actorId: 'operator_1',
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_INVESTMENT',
    payload: {
      accountId: world.brokerage.id,
      sourceAccountId: world.demand.id,
      amount: Money.fromMinorUnits(amount, 'USD'),
    },
  });
}

function order(
  world: ReturnType<typeof wired>,
  suffix: string,
  input: {
    readonly side: 'BUY' | 'SELL';
    readonly quantityUnits: string;
    readonly orderId?: string;
    readonly instrumentId?: string;
    readonly orderType?: 'MARKET_SIMULATION' | 'LIMIT_SIMULATION';
    readonly limitPriceMinorUnits?: string;
    readonly actorId?: string;
  },
) {
  return world.investments.createPaperOrder({
    id: asIntentId(`${suffix}_ord`),
    actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
    idempotencyKey: `${suffix}_ord`,
    actorId: input.actorId ?? 'operator_1',
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_INVESTMENT',
    payload: {
      accountId: world.brokerage.id,
      investmentAccountId: `inv_${suffix.replace(/_.+$/, '') === suffix ? suffix : suffix.split('_')[0]}`,
      orderId: input.orderId ?? `ord_${suffix}`,
      instrumentId: input.instrumentId ?? 'SIM-ETF-1',
      side: input.side,
      quantityUnits: input.quantityUnits,
      orderType: input.orderType ?? 'MARKET_SIMULATION',
      ...(input.limitPriceMinorUnits ? { limitPriceMinorUnits: input.limitPriceMinorUnits } : {}),
    },
  });
}

describe('investment quantity and price arithmetic', () => {
  it('rejects floating-point quantity and price strings', () => {
    const qty = quantityFromScaledString('10.5');
    assert.equal(qty.ok, false);
    if (!qty.ok) {
      assert.equal(qty.error.code, 'FLOATING_POINT_QUANTITY');
    }
    const whole = quantityFromWholeString('10.0');
    assert.equal(whole.ok, false);
    const price = priceFromMinorUnitsString('100.00', 'USD');
    assert.equal(price.ok, false);
    const ten = quantityFromWholeString('10');
    assert.equal(ten.ok, true);
    if (ten.ok) {
      assert.equal(ten.value.scale, QUANTITY_SCALE);
      const notional = notionalMoney(ten.value, { minorUnits: 10_000n, currency: 'USD' });
      assert.equal(notional.ok, true);
      if (notional.ok) {
        assert.equal(notional.value.minorUnits, 100_000n);
      }
    }
  });
});

describe('paper portfolio core', () => {
  it('opens, funds, buys, values, sells, and keeps unrealized P&L off the cash ledger', () => {
    const world = wired('demo');
    const opened = openProfile(world, 'demo');
    assert.equal(opened.outcome, 'OK');
    const funded = fund(world, 'demo');
    assert.equal(funded.outcome, 'OK');
    const buy = order(world, 'demo_buy', { side: 'BUY', quantityUnits: TEN_SHARES, orderId: 'ord_demo_buy' });
    assert.equal(buy.outcome, 'OK');
    const position = world.investments.store.getPosition(asInvestmentAccountId('inv_demo'), asInstrumentId('SIM-ETF-1'));
    assert.ok(position);
    assert.equal(position.quantity.units, 1_000_000_000n);
    assert.equal(position.remainingCost.minorUnits, 100_000n);
    const cashAfterBuy = world.runtime.ledger
      .listPostingsForAccount(world.brokerage.id)
      .reduce((sum, posting) => (posting.direction === 'CREDIT' ? sum + posting.amount.minorUnits : sum - posting.amount.minorUnits), 0n);
    assert.equal(cashAfterBuy, 400_000n);
    world.investments.setSimulatedPrice(asInstrumentId('SIM-ETF-1'), 11_000n, 'USD');
    const valuation = world.investments.valuePortfolio(asInvestmentAccountId('inv_demo'));
    assert.equal(valuation.marketValue.minorUnits, 110_000n);
    assert.equal(valuation.unrealized.minorUnits, 10_000n);
    assert.equal(valuation.cash.minorUnits, 400_000n);
    const cashUnchanged = world.runtime.ledger
      .listPostingsForAccount(world.brokerage.id)
      .reduce((sum, posting) => (posting.direction === 'CREDIT' ? sum + posting.amount.minorUnits : sum - posting.amount.minorUnits), 0n);
    assert.equal(cashUnchanged, 400_000n);
    const sell = order(world, 'demo_sell', { side: 'SELL', quantityUnits: FOUR_SHARES, orderId: 'ord_demo_sell' });
    assert.equal(sell.outcome, 'OK');
    const afterSell = world.investments.store.getPosition(asInvestmentAccountId('inv_demo'), asInstrumentId('SIM-ETF-1'));
    assert.equal(afterSell?.quantity.units, 600_000_000n);
    const realized = world.investments.store.listRealized()[0];
    assert.ok(realized);
    assert.equal(realized.realized.minorUnits, 4_000n);
    assert.equal(realized.taxableIncomeDetermination, false);
    const peve = world.investments.consumePeve(asInvestmentAccountId('inv_demo'));
    assert.equal(peve.realizedValueRecognized.minorUnits, 4_000n);
    assert.equal(peve.unrealizedExcluded, true);
    assert.equal(peve.principalExcluded, true);
    const recon = world.investments.reconcile(asInvestmentAccountId('inv_demo'));
    assert.equal(recon.result, 'MATCHED');
    assert.equal(recon.autoAdjusted, false);
    const chain = world.runtime.evidence.verifyChain();
    assert.equal(chain.ok, true);
    const peg = new EconomicGraphService({ clock: world.clock, events: world.runtime.events });
    peg.ingestAll(world.runtime.events.list(), world.customer.id);
    const graph = peg.store.getGraphBySubject(world.customer.id);
    assert.ok(graph);
    const nodes = peg.store.nodesFor(graph.graphId);
    assert.ok(nodes.some((node) => node.kind === 'INVESTMENT'));
    const rdt = world.investments.rdt.evaluate({
      actionType: 'CREATE_PAPER_ORDER',
      productId: 'prod_brokerage_cash_usd_gb',
      jurisdiction: 'GB',
    });
    assert.equal(rdt.simulationOnly, true);
    assert.equal(rdt.brokerDealerClaim, false);
    const replay = order(world, 'demo_buy', { side: 'BUY', quantityUnits: TEN_SHARES, orderId: 'ord_demo_buy' });
    assert.equal(replay.outcome, 'OK');
    if (replay.outcome === 'OK') {
      assert.equal(replay.replay, true);
    }
    const fill = [...world.investments.store.listFills()][0];
    assert.ok(fill);
    const duplicate = world.investments.ingestDuplicateFill(fill.providerFillRef);
    assert.equal(duplicate.outcome, 'OK');
    if (duplicate.outcome === 'OK') {
      assert.equal(duplicate.value.replay, true);
    }
    assert.equal(
      world.investments.store.getPosition(asInvestmentAccountId('inv_demo'), asInstrumentId('SIM-ETF-1'))?.quantity.units,
      600_000_000n,
    );
  });
});

describe('investment failure paths', () => {
  it('refuses unverified identity', () => {
    const world = wired('kyc');
    const current = world.runtime.customers.get(world.customer.id);
    assert.ok(current);
    world.runtime.customers.put(world.customer.id, {
      ...current,
      verification: { ...current.verification, kycState: 'NOT_STARTED' },
    });
    const opened = openProfile(world, 'kyc');
    assert.equal(opened.outcome, 'REJECTED');
    if (opened.outcome === 'REJECTED') {
      assert.equal(opened.code, 'INELIGIBLE');
    }
  });

  it('refuses unsupported jurisdiction', () => {
    const world = wired('jur');
    const opened = openProfile(world, 'jur', { jurisdiction: asJurisdiction('SA') });
    assert.equal(opened.outcome, 'REJECTED');
    if (opened.outcome === 'REJECTED') {
      assert.equal(opened.code, 'INELIGIBLE');
    }
  });

  it('refuses a disabled investment capability product', () => {
    const world = wired('cap');
    const opened = openProfile(world, 'cap', { productId: asProductId('prod_demand_usd_gb') });
    assert.equal(opened.outcome, 'REJECTED');
    if (opened.outcome === 'REJECTED') {
      assert.equal(opened.code, 'INELIGIBLE');
    }
  });

  it('refuses a frozen brokerage cash account', () => {
    const world = wired('frz');
    const frozen = transitionAccountStatus(world.brokerage, 'FROZEN', world.clock.now());
    assert.equal(isOk(frozen), true);
    if (isOk(frozen)) {
      world.runtime.accounts.put(frozen.value.id, frozen.value);
    }
    const opened = openProfile(world, 'frz');
    assert.equal(opened.outcome, 'REJECTED');
    if (opened.outcome === 'REJECTED') {
      assert.equal(opened.code, 'FROZEN_ACCOUNT');
    }
  });

  it('refuses insufficient brokerage cash, unknown instrument, invalid and floating quantity', () => {
    const world = wired('qty');
    assert.equal(openProfile(world, 'qty').outcome, 'OK');
    assert.equal(fund(world, 'qty', 1_000n).outcome, 'OK');
    const poor = order(world, 'qty_poor', { side: 'BUY', quantityUnits: TEN_SHARES, orderId: 'ord_poor' });
    assert.equal(poor.outcome, 'REJECTED');
    if (poor.outcome === 'REJECTED') {
      assert.equal(poor.code, 'INSUFFICIENT_BROKERAGE_CASH');
    }
    assert.equal(fund(world, 'qty2', 499_000n).outcome, 'OK');
    const unknown = order(world, 'qty_unk', {
      side: 'BUY',
      quantityUnits: TEN_SHARES,
      orderId: 'ord_unk',
      instrumentId: 'NO-SUCH',
    });
    assert.equal(unknown.outcome, 'REJECTED');
    if (unknown.outcome === 'REJECTED') {
      assert.equal(unknown.code, 'UNKNOWN_INSTRUMENT');
    }
    const zero = order(world, 'qty_zero', { side: 'BUY', quantityUnits: '0', orderId: 'ord_zero' });
    assert.equal(zero.outcome, 'REJECTED');
    const floating = order(world, 'qty_float', { side: 'BUY', quantityUnits: '10.5', orderId: 'ord_float' });
    assert.equal(floating.outcome, 'REJECTED');
  });

  it('refuses short sales and selling more than owned', () => {
    const world = wired('short');
    assert.equal(openProfile(world, 'short').outcome, 'OK');
    assert.equal(fund(world, 'short').outcome, 'OK');
    const shortIntent = {
      id: asIntentId('short_ord'),
      actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
      idempotencyKey: 'short_ord',
      actorId: 'operator_1',
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_INVESTMENT',
      payload: {
        accountId: world.brokerage.id,
        investmentAccountId: 'inv_short',
        orderId: 'ord_short',
        instrumentId: 'SIM-ETF-1',
        side: 'SHORT',
        quantityUnits: TEN_SHARES,
        orderType: 'MARKET_SIMULATION',
      },
    } as unknown as CreatePaperOrderIntent;
    const shorted = world.investments.createPaperOrder(shortIntent);
    assert.equal(shorted.outcome, 'REJECTED');
    assert.equal(order(world, 'short_buy', { side: 'BUY', quantityUnits: TEN_SHARES, orderId: 'ord_short_buy' }).outcome, 'OK');
    const oversell = order(world, 'short_sell', { side: 'SELL', quantityUnits: ELEVEN_SHARES, orderId: 'ord_oversell' });
    assert.equal(oversell.outcome, 'REJECTED');
    if (oversell.outcome === 'REJECTED') {
      assert.equal(oversell.code, 'SELL_EXCEEDS_POSITION');
    }
    assert.deepEqual(FORBIDDEN_ORDER_SIDES, ['SHORT', 'SELL_SHORT', 'BORROW', 'LEVERAGED_BUY']);
  });

  it('refuses unauthorized actors and keeps agent/growth away from the broker', () => {
    const world = wired('auth');
    assert.equal(openProfile(world, 'auth').outcome, 'OK');
    assert.equal(fund(world, 'auth').outcome, 'OK');
    const unauthorized = order(world, 'auth_bad', {
      side: 'BUY',
      quantityUnits: TEN_SHARES,
      orderId: 'ord_unauth',
      actorId: 'stranger',
    });
    assert.equal(unauthorized.outcome, 'KERNEL_REFUSED');
    const agent = world.investments.refuseAgentBrokerCall();
    assert.equal(agent.outcome, 'REJECTED');
    if (agent.outcome === 'REJECTED') {
      assert.equal(agent.code, 'AGENT_CANNOT_TRADE');
    }
    const growth = world.investments.refuseGrowthAutoExecution();
    assert.equal(growth.outcome, 'REJECTED');
    if (growth.outcome === 'REJECTED') {
      assert.equal(growth.code, 'GROWTH_CANNOT_AUTO_TRADE');
    }
    const materialized = materializeGrowthAction({
      candidate: {
        actionId: 'act_growth',
        action: 'PAPER_INVESTMENT_REVIEW_AVAILABLE',
      } as never,
      approved: true,
      actorId: 'operator_1',
      requestedAt: NOW,
    });
    assert.equal(materialized.ok, true);
    if (materialized.ok) {
      assert.equal(materialized.value.actionType, ACTION_TYPES.CREATE_PAPER_ORDER);
    }
  });

  it('refuses a stale simulated quote', () => {
    const clock = new FrozenClock(NOW);
    const runtime = createSimulationRuntime({ clock });
    const customer = activateCustomer(runtime, 'cust_stale');
    const seeded = seedSimulationCatalog();
    const demand = runtime.accountsService.open(openIntent({ id: 'stale_d', accountId: 'stale_d', ownerId: customer.id }));
    const brokerage = runtime.accountsService.open(
      openIntent({
        id: 'stale_b',
        accountId: 'stale_b',
        ownerId: customer.id,
        productId: asProductId('prod_brokerage_cash_usd_gb'),
        accountClass: 'BROKERAGE_CASH',
      }),
    );
    const securities = runtime.accountsService.open(
      openIntent({
        id: 'stale_s',
        accountId: 'stale_s',
        ownerId: customer.id,
        productId: asProductId('prod_securities_usd_gb'),
        accountClass: 'SECURITIES',
      }),
    );
    const pending = runtime.accountsService.open(
      openIntent({
        id: 'stale_p',
        accountId: 'stale_p',
        ownerId: customer.id,
        productId: asProductId('prod_pending_usd_gb'),
        accountClass: 'PENDING_SETTLEMENT',
      }),
    );
    assert.equal(demand.outcome, 'OPENED');
    assert.equal(brokerage.outcome, 'OPENED');
    assert.equal(securities.outcome, 'OPENED');
    assert.equal(pending.outcome, 'OPENED');
    if (demand.outcome !== 'OPENED' || brokerage.outcome !== 'OPENED' || securities.outcome !== 'OPENED' || pending.outcome !== 'OPENED') {
      return;
    }
    runtime.money.deposit({
      id: asIntentId('stale_dep'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'stale_dep',
      actorId: 'operator_1',
      requestedAt: clock.now(),
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: demand.account.id, amount: Money.fromMinorUnits(TEN_THOUSAND, 'USD') },
    });
    const market = new SimulatedMarketDataProvider(
      [{ instrumentId: SIM_ETF_1.instrumentId, minorUnits: 10_000n, currency: 'USD', marketId: SIM_ETF_1.marketId }],
      { quoteTtlMs: 1n },
    );
    const investments = new InvestmentsService(
      runtime.kernel,
      runtime.issuer,
      runtime.evidence,
      runtime.events,
      clock,
      {
        customers: runtime.customers,
        accounts: runtime.accounts,
        products: seeded.products.asCatalog(),
        legalEntities: seeded.legalEntities,
      },
      runtime.identity.service,
      runtime.ledger,
      { market },
    );
    const world = { clock, runtime, customer, demand: demand.account, brokerage: brokerage.account, securities: securities.account, pending: pending.account, investments, seeded };
    assert.equal(openProfile(world, 'stale').outcome, 'OK');
    assert.equal(fund(world, 'stale').outcome, 'OK');
    market.markQuotedAt(SIM_ETF_1.instrumentId, NOW);
    clock.advanceMs(10n);
    const stale = order(world, 'stale_ord', { side: 'BUY', quantityUnits: TEN_SHARES, orderId: 'ord_stale' });
    assert.equal(stale.outcome, 'REJECTED');
    if (stale.outcome === 'REJECTED') {
      assert.equal(stale.code, 'STALE_QUOTE');
    }
  });

  it('reports settlement, cash, and position reconciliation mismatches without auto-adjusting', () => {
    const world = wired('recon');
    assert.equal(openProfile(world, 'recon').outcome, 'OK');
    const investmentAccountId = asInvestmentAccountId('inv_recon');
    world.investments.store.putFill(
      freezePaperFill({
        fillId: asFillId('fill_missing'),
        orderId: asInvestmentAccountId('ord_missing') as never,
        instrumentId: asInstrumentId('SIM-ETF-1'),
        side: 'BUY',
        quantity: { units: 100_000_000n, scale: 8 },
        price: { minorUnits: 10_000n, currency: 'USD' },
        grossNotional: Money.fromMinorUnits(10_000n, 'USD'),
        explicitFee: Money.zero('USD'),
        filledAt: NOW,
        providerFillRef: 'prov_missing',
        simulation: true,
      }),
    );
    const missing = world.investments.reconcile(investmentAccountId);
    assert.equal(missing.result === 'MISSING_FILL' || missing.result === 'MISSING_INTERNAL' || missing.result === 'INVESTIGATION_REQUIRED', true);
    assert.equal(missing.autoAdjusted, false);
    world.investments.store.putSettlement(
      freezeSettlement({
        settlementId: asSettlementId('set_mismatch'),
        fillId: asFillId('fill_missing'),
        investmentAccountId,
        side: 'BUY',
        quantity: { units: 100_000_000n, scale: 8 },
        cashAmount: Money.fromMinorUnits(1n, 'USD'),
        feeAmount: Money.zero('USD'),
        state: 'SETTLED',
        tradeAt: NOW,
        settleAfter: NOW,
        settledAt: NOW,
        cashJournalId: 'j_x',
        settlementJournalId: 'j_x',
        settlementDelayDays: 0n,
      }),
    );
    const cash = world.investments.reconcile(investmentAccountId);
    assert.equal(cash.result, 'CASH_MISMATCH');
    world.investments.store.putPosition({
      investmentAccountId,
      instrumentId: asInstrumentId('SIM-ETF-1'),
      quantity: { units: 9n, scale: 8 },
      availableQuantity: { units: 9n, scale: 8 },
      settledQuantity: { units: 9n, scale: 8 },
      unsettledQuantity: { units: 0n, scale: 8 },
      remainingCost: Money.zero('USD'),
      currency: 'USD',
      updatedAt: NOW,
    });
    const position = world.investments.reconcile(investmentAccountId);
    assert.equal(position.result, 'POSITION_MISMATCH');
  });
});

describe('eligibility and live flags', () => {
  it('keeps live investment execution off and labels suitability as research', () => {
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
    assert.equal(PACKAGE_LIVE_FLAG, false);
    const eligibility = evaluateInvestmentEligibility({
      customer: undefined,
      identityVerified: false,
      identityUsable: false,
      jurisdiction: 'XX',
      legalEntity: undefined,
      product: undefined,
      brokerageCash: undefined,
      securities: undefined,
      investmentCapabilityEnabled: false,
      rdtStatus: 'RESEARCH_REQUIRED',
    });
    assert.equal(eligibility.status, 'NOT_SUPPORTED');
    assert.equal(eligibility.simulationOnly, true);
  });
});
