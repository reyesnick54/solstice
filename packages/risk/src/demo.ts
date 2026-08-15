import { FrozenClock } from '../../config/src/clock.ts';
import { asCurrencyCode } from '../../domain/src/currency.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../../domain/src/legal-entity.ts';
import { asProductId } from '../../domain/src/product.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { seedSimulationCatalog } from '../../../services/accounts/src/catalog.ts';
import { createSimulationRuntime } from '../../../services/accounts/src/runtime.ts';
import { activateCustomer, openIntent } from '../../../services/accounts/src/test-helpers.ts';
import { asInstrumentId, asInvestmentAccountId } from '../../investments/src/ids.ts';
import { InvestmentsService } from '../../investments/src/service.ts';
import { ModelRegistry, seedCanonicalRiskModel } from '../../model-registry/src/registry.ts';
import { ratioPercent } from './arithmetic.ts';
import { defaultSimulationBudget, RiskEngine } from './engine.ts';
import { EQUITY_SHOCK_NEGATIVE_20 } from './stress.ts';

function fail(message: string): never {
  throw new Error(message);
}

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');
const clock = new FrozenClock(NOW);
const runtime = createSimulationRuntime({ clock });
const customer = activateCustomer(runtime, 'cust_risk_demo');
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
  runtime.accountsService.open(openIntent({ id: 'risk_demo_d', accountId: 'acct_risk_d', ownerId: customer.id })),
  'demand',
);
const brokerage = mustOpen(
  runtime.accountsService.open(
    openIntent({
      id: 'risk_demo_b',
      accountId: 'acct_risk_b',
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
      id: 'risk_demo_s',
      accountId: 'acct_risk_s',
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
      id: 'risk_demo_p',
      accountId: 'acct_risk_p',
      ownerId: customer.id,
      productId: asProductId('prod_pending_usd_gb'),
      accountClass: 'PENDING_SETTLEMENT',
    }),
  ),
  'pending',
);

const deposit = runtime.money.deposit({
  id: asIntentId('risk_demo_dep'),
  actionType: ACTION_TYPES.POST_DEPOSIT,
  idempotencyKey: 'risk_demo_dep',
  actorId: 'operator_1',
  requestedAt: clock.now(),
  purpose: 'CUSTOMER_FUNDING',
  payload: { accountId: demand.id, amount: Money.fromMinorUnits(400_000n, 'USD') },
});
if (deposit.outcome !== 'POSTED') {
  fail(`deposit ${deposit.outcome}`);
}

const actor = runtime.identity.service.resolveActorContext('operator_1');
if (!actor.ok) {
  fail('operator actor');
}
const registry = new ModelRegistry();
const model = seedCanonicalRiskModel(registry, actor.value, clock.now());
if (!model.ok) {
  fail(`model seed ${model.error.code}`);
}
const engine = new RiskEngine({
  clock,
  registry,
  events: runtime.events,
  evidence: runtime.evidence,
});
engine.putBudget(
  defaultSimulationBudget({
    subjectId: customer.id,
    portfolioId: 'inv_risk_demo',
    reviewBy: clock.now(),
    maxInstrumentConcentration: ratioPercent(60n),
  }),
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
  { riskEngine: engine },
);

const opened = investments.openInvestmentAccount({
  id: asIntentId('risk_demo_open'),
  actionType: ACTION_TYPES.OPEN_INVESTMENT_ACCOUNT,
  idempotencyKey: 'risk_demo_open',
  actorId: 'operator_1',
  requestedAt: clock.now(),
  purpose: 'CUSTOMER_INVESTMENT',
  payload: {
    accountId: demand.id,
    investmentAccountId: 'inv_risk_demo',
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
  fail(`open ${opened.outcome}`);
}

const funded = investments.fundBrokerageCash({
  id: asIntentId('risk_demo_fund'),
  actionType: ACTION_TYPES.FUND_BROKERAGE_CASH,
  idempotencyKey: 'risk_demo_fund',
  actorId: 'operator_1',
  requestedAt: clock.now(),
  purpose: 'CUSTOMER_INVESTMENT',
  payload: {
    accountId: brokerage.id,
    sourceAccountId: demand.id,
    amount: Money.fromMinorUnits(200_000n, 'USD'),
  },
});
if (funded.outcome !== 'OK') {
  fail(`fund ${funded.outcome}`);
}

const seedBuy = investments.createPaperOrder({
  id: asIntentId('risk_demo_seed'),
  actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
  idempotencyKey: 'risk_demo_seed',
  actorId: 'operator_1',
  requestedAt: clock.now(),
  purpose: 'CUSTOMER_INVESTMENT',
  payload: {
    accountId: brokerage.id,
    investmentAccountId: 'inv_risk_demo',
    orderId: 'ord_risk_seed',
    instrumentId: 'SIM-ETF-1',
    side: 'BUY',
    quantityUnits: '1000000000',
    orderType: 'MARKET_SIMULATION',
  },
});
if (seedBuy.outcome !== 'OK') {
  fail(`seed buy ${seedBuy.outcome} ${'code' in seedBuy ? seedBuy.code : ''}`);
}

const blocked = investments.createPaperOrder({
  id: asIntentId('risk_demo_block'),
  actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
  idempotencyKey: 'risk_demo_block',
  actorId: 'operator_1',
  requestedAt: clock.now(),
  purpose: 'CUSTOMER_INVESTMENT',
  payload: {
    accountId: brokerage.id,
    investmentAccountId: 'inv_risk_demo',
    orderId: 'ord_risk_block',
    instrumentId: 'SIM-ETF-1',
    side: 'BUY',
    quantityUnits: '600000000',
    orderType: 'MARKET_SIMULATION',
  },
});
if (blocked.outcome !== 'REJECTED' || investments.lastRiskDecision?.outcome !== 'BLOCK') {
  fail(`expected concentration BLOCK, got ${blocked.outcome} ${investments.lastRiskDecision?.outcome ?? ''}`);
}
if (investments.store.getOrder('ord_risk_block')) {
  fail('blocked paper order must not persist');
}

const allowed = investments.createPaperOrder({
  id: asIntentId('risk_demo_allow'),
  actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
  idempotencyKey: 'risk_demo_allow',
  actorId: 'operator_1',
  requestedAt: clock.now(),
  purpose: 'CUSTOMER_INVESTMENT',
  payload: {
    accountId: brokerage.id,
    investmentAccountId: 'inv_risk_demo',
    orderId: 'ord_risk_allow',
    instrumentId: 'SIM-ETF-1',
    side: 'BUY',
    quantityUnits: '100000000',
    orderType: 'MARKET_SIMULATION',
  },
});
if (allowed.outcome !== 'OK' || investments.lastRiskDecision?.outcome !== 'ALLOW_SIMULATION') {
  fail(`expected ALLOW_SIMULATION execution, got ${allowed.outcome}`);
}

const remaining = investments.store.getPosition(asInvestmentAccountId('inv_risk_demo'), asInstrumentId('SIM-ETF-1'));
if (!remaining || remaining.quantity.units !== 1_100_000_000n) {
  fail(`expected 11 shares after allowed buy, got ${remaining?.quantity.units}`);
}

const snap = engine.store.latestSnapshot('inv_risk_demo');
if (!snap) {
  fail('portfolio risk snapshot was not updated');
}
const cashBeforeStress = snap.brokerageCashMinor;
const run = engine.runStress(snap, EQUITY_SHOCK_NEGATIVE_20);
if (run.estimatedLossMinor <= 0n || run.mutatesFinancialState !== false) {
  fail('stress run must estimate a loss without mutating state');
}
if (engine.store.latestSnapshot('inv_risk_demo')?.brokerageCashMinor !== cashBeforeStress) {
  fail('stress run mutated brokerage cash');
}

const chain = runtime.evidence.verifyChain();
if (!chain.ok) {
  fail('evidence chain broken');
}

const extreme = engine.analyzeExtremeGoal({
  goalText: '$1,000 → $1,300 in one week.',
  baselineMinor: 100_000n,
  targetMinor: 130_000n,
  intervalDays: 7n,
  budget: defaultSimulationBudget({
    subjectId: customer.id,
    portfolioId: 'inv_risk_demo',
    reviewBy: clock.now(),
    maxInstrumentConcentration: ratioPercent(60n),
  }),
});
if (extreme.impliedGrowth.units !== 30_000_000n || extreme.guaranteed !== false || extreme.limitsRelaxed !== false) {
  fail('extreme goal analysis drifted');
}

console.log('Risk demo: ok');
console.log(`  seed=10 ETF @ 10000 concentration=50% budget=60%`);
console.log(`  blockBuy=6 shares outcome=${investments.lastRiskDecision?.outcome} executed=false`);
console.log(`  allowBuy=1 share remaining=11 snapshot=${snap.snapshotId}`);
console.log(`  stress=-20% estimatedLoss=${run.estimatedLossMinor} cashUnchanged=${cashBeforeStress}`);
console.log(`  evidenceRecords=${chain.length} extremeImpliedGrowth=${extreme.impliedGrowth.units}`);
