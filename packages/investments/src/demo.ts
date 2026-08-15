import { FrozenClock } from '../../config/src/clock.ts';
import { asCurrencyCode } from '../../domain/src/currency.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../../domain/src/legal-entity.ts';
import { asProductId } from '../../domain/src/product.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { EconomicGraphService } from '../../personal-economic-graph/src/service.ts';
import { seedSimulationCatalog } from '../../../services/accounts/src/catalog.ts';
import { createSimulationRuntime } from '../../../services/accounts/src/runtime.ts';
import { activateCustomer, openIntent } from '../../../services/accounts/src/test-helpers.ts';
import { asInstrumentId, asInvestmentAccountId } from './ids.ts';
import { InvestmentsService } from './service.ts';

function fail(message: string): never {
  throw new Error(message);
}

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');
const clock = new FrozenClock(NOW);
const runtime = createSimulationRuntime({ clock });
const customer = activateCustomer(runtime, 'cust_invest_demo');
const seeded = seedSimulationCatalog();

function mustOpen(
  result: ReturnType<typeof runtime.accountsService.open>,
  label: string,
): NonNullable<Extract<typeof result, { outcome: 'OPENED' }>['account']> {
  if (result.outcome !== 'OPENED') {
    fail(`${label}: ${result.outcome}`);
  }
  return result.account;
}

const demand = mustOpen(
  runtime.accountsService.open(openIntent({ id: 'inv_demo_d', accountId: 'acct_inv_d', ownerId: customer.id })),
  'demand',
);
const brokerage = mustOpen(
  runtime.accountsService.open(
    openIntent({
      id: 'inv_demo_b',
      accountId: 'acct_inv_b',
      ownerId: customer.id,
      productId: asProductId('prod_brokerage_cash_usd_gb'),
      accountClass: 'BROKERAGE_CASH',
    }),
  ),
  'brokerage',
);
const securities = mustOpen(
  runtime.accountsService.open(
    openIntent({
      id: 'inv_demo_s',
      accountId: 'acct_inv_s',
      ownerId: customer.id,
      productId: asProductId('prod_securities_usd_gb'),
      accountClass: 'SECURITIES',
    }),
  ),
  'securities',
);
const pending = mustOpen(
  runtime.accountsService.open(
    openIntent({
      id: 'inv_demo_p',
      accountId: 'acct_inv_p',
      ownerId: customer.id,
      productId: asProductId('prod_pending_usd_gb'),
      accountClass: 'PENDING_SETTLEMENT',
    }),
  ),
  'pending',
);

const deposit = runtime.money.deposit({
  id: asIntentId('inv_demo_dep'),
  actionType: ACTION_TYPES.POST_DEPOSIT,
  idempotencyKey: 'inv_demo_dep',
  actorId: 'operator_1',
  requestedAt: clock.now(),
  purpose: 'CUSTOMER_FUNDING',
  payload: { accountId: demand.id, amount: Money.fromMinorUnits(1_000_000n, 'USD') },
});
if (deposit.outcome !== 'POSTED') {
  fail(`deposit ${deposit.outcome}`);
}

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

const opened = investments.openInvestmentAccount({
  id: asIntentId('inv_demo_open'),
  actionType: ACTION_TYPES.OPEN_INVESTMENT_ACCOUNT,
  idempotencyKey: 'inv_demo_open',
  actorId: 'operator_1',
  requestedAt: clock.now(),
  purpose: 'CUSTOMER_INVESTMENT',
  payload: {
    accountId: demand.id,
    investmentAccountId: 'inv_demo',
    customerId: customer.id,
    brokerageCashAccountId: brokerage.id,
    securitiesAccountId: securities.id,
    pendingSettlementAccountId: pending.id,
    productId: asProductId('prod_brokerage_cash_usd_gb'),
    legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
    jurisdiction: asJurisdiction('GB'),
    currency: asCurrencyCode('USD'),
  },
});
if (opened.outcome !== 'OK') {
  fail(`open ${opened.outcome} ${'code' in opened ? opened.code : ''}`);
}

const funded = investments.fundBrokerageCash({
  id: asIntentId('inv_demo_fund'),
  actionType: ACTION_TYPES.FUND_BROKERAGE_CASH,
  idempotencyKey: 'inv_demo_fund',
  actorId: 'operator_1',
  requestedAt: clock.now(),
  purpose: 'CUSTOMER_INVESTMENT',
  payload: {
    accountId: brokerage.id,
    sourceAccountId: demand.id,
    amount: Money.fromMinorUnits(500_000n, 'USD'),
  },
});
if (funded.outcome !== 'OK') {
  fail(`fund ${funded.outcome} ${'code' in funded ? funded.code : ''}`);
}

const buy = investments.createPaperOrder({
  id: asIntentId('inv_demo_buy'),
  actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
  idempotencyKey: 'inv_demo_buy',
  actorId: 'operator_1',
  requestedAt: clock.now(),
  purpose: 'CUSTOMER_INVESTMENT',
  payload: {
    accountId: brokerage.id,
    investmentAccountId: 'inv_demo',
    orderId: 'ord_demo_buy',
    instrumentId: 'SIM-ETF-1',
    side: 'BUY',
    quantityUnits: '1000000000',
    orderType: 'MARKET_SIMULATION',
  },
});
if (buy.outcome !== 'OK') {
  fail(`buy ${buy.outcome} ${'code' in buy ? buy.code : ''}`);
}

investments.setSimulatedPrice(asInstrumentId('SIM-ETF-1'), 11_000n, 'USD');
const marked = investments.valuePortfolio(asInvestmentAccountId('inv_demo'));
if (marked.marketValue.minorUnits !== 110_000n || marked.unrealized.minorUnits !== 10_000n) {
  fail(`valuation expected 1100/100, got ${marked.marketValue.minorUnits}/${marked.unrealized.minorUnits}`);
}
if (marked.cash.minorUnits !== 400_000n) {
  fail(`unrealized P&L must not credit cash; cash=${marked.cash.minorUnits}`);
}

const sell = investments.createPaperOrder({
  id: asIntentId('inv_demo_sell'),
  actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
  idempotencyKey: 'inv_demo_sell',
  actorId: 'operator_1',
  requestedAt: clock.now(),
  purpose: 'CUSTOMER_INVESTMENT',
  payload: {
    accountId: brokerage.id,
    investmentAccountId: 'inv_demo',
    orderId: 'ord_demo_sell',
    instrumentId: 'SIM-ETF-1',
    side: 'SELL',
    quantityUnits: '400000000',
    orderType: 'MARKET_SIMULATION',
  },
});
if (sell.outcome !== 'OK') {
  fail(`sell ${sell.outcome} ${'code' in sell ? sell.code : ''}`);
}

const remaining = investments.store.getPosition(asInvestmentAccountId('inv_demo'), asInstrumentId('SIM-ETF-1'));
if (!remaining || remaining.quantity.units !== 600_000_000n) {
  fail(`expected 6 shares remaining, got ${remaining?.quantity.units}`);
}
const realized = investments.store.listRealized()[0];
if (!realized || realized.realized.minorUnits !== 4_000n) {
  fail(`expected realized 4000 minor, got ${realized?.realized.minorUnits}`);
}
const peve = investments.consumePeve(asInvestmentAccountId('inv_demo'));
if (peve.realizedValueRecognized.minorUnits !== 4_000n || peve.unrealizedExcluded !== true) {
  fail('PEVE must recognize realized outcome and exclude unrealized marks');
}
const recon = investments.reconcile(asInvestmentAccountId('inv_demo'));
if (recon.result !== 'MATCHED' || recon.autoAdjusted !== false) {
  fail(`reconciliation ${recon.result}`);
}
const chain = runtime.evidence.verifyChain();
if (!chain.ok) {
  fail('evidence chain broken');
}
const replay = investments.createPaperOrder({
  id: asIntentId('inv_demo_buy_retry'),
  actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
  idempotencyKey: 'inv_demo_buy',
  actorId: 'operator_1',
  requestedAt: clock.now(),
  purpose: 'CUSTOMER_INVESTMENT',
  payload: {
    accountId: brokerage.id,
    investmentAccountId: 'inv_demo',
    orderId: 'ord_demo_buy',
    instrumentId: 'SIM-ETF-1',
    side: 'BUY',
    quantityUnits: '1000000000',
    orderType: 'MARKET_SIMULATION',
  },
});
if (replay.outcome !== 'OK' || replay.replay !== true) {
  fail('duplicate paper order must replay without a second fill');
}
if (investments.store.getPosition(asInvestmentAccountId('inv_demo'), asInstrumentId('SIM-ETF-1'))?.quantity.units !== 600_000_000n) {
  fail('duplicate order changed the position');
}

const peg = new EconomicGraphService({ clock, events: runtime.events });
peg.ingestAll(runtime.events.list(), customer.id);
const graph = peg.store.getGraphBySubject(customer.id);
if (!graph || !peg.store.nodesFor(graph.graphId).some((node) => node.kind === 'INVESTMENT')) {
  fail('PEG did not project the investment account');
}

const agentBlocked = investments.refuseAgentBrokerCall();
const growthBlocked = investments.refuseGrowthAutoExecution();
if (agentBlocked.outcome !== 'REJECTED' || growthBlocked.outcome !== 'REJECTED') {
  fail('agent and growth boundary refusals are required');
}

console.log('Investments demo: ok');
console.log(`  profile=${opened.value.investmentAccountId} funded=500000 buy=10@100 mark=110 sell=4@110 remaining=6`);
console.log(`  unrealizedBeforeSell=${marked.unrealized.minorUnits} cashAfterBuy=${marked.cash.minorUnits}`);
console.log(`  realized=${realized.realized.minorUnits} peveRealized=${peve.realizedValueRecognized.minorUnits} recon=${recon.result}`);
console.log(`  evidenceRecords=${chain.length} pegNodes=${peg.store.nodesFor(graph.graphId).length}`);
