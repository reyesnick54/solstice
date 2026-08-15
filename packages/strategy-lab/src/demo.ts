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
import { defaultSimulationBudget, RiskEngine } from '../../risk/src/engine.ts';
import { classifyPeveStrategyValue } from './bridges.ts';
import {
  DEFAULT_PARAMETER_SET,
  SIM_ETF_1,
  equalWeightSpec,
  overfitSpec,
  syntheticBenchmarkDataset,
  syntheticTwoEtfDataset,
} from './fixtures.ts';
import { assertNoLiveTransition } from './lifecycle.ts';
import { StrategyLab } from './service.ts';
import { LIVE_STRATEGY_EXECUTION } from './types.ts';

function fail(message: string): never {
  throw new Error(message);
}

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');
const clock = new FrozenClock(NOW);
const runtime = createSimulationRuntime({ clock });
const customer = activateCustomer(runtime, 'cust_lab_demo');
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
  runtime.accountsService.open(openIntent({ id: 'lab_demo_d', accountId: 'acct_lab_d', ownerId: customer.id })),
  'demand',
);
const brokerage = mustOpen(
  runtime.accountsService.open(
    openIntent({
      id: 'lab_demo_b',
      accountId: 'acct_lab_b',
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
      id: 'lab_demo_s',
      accountId: 'acct_lab_s',
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
      id: 'lab_demo_p',
      accountId: 'acct_lab_p',
      ownerId: customer.id,
      productId: asProductId('prod_pending_usd_gb'),
      accountClass: 'PENDING_SETTLEMENT',
    }),
  ),
  'pending',
);

const deposit = runtime.money.deposit({
  id: asIntentId('lab_demo_dep'),
  actionType: ACTION_TYPES.POST_DEPOSIT,
  idempotencyKey: 'lab_demo_dep',
  actorId: 'operator_1',
  requestedAt: clock.now(),
  purpose: 'CUSTOMER_FUNDING',
  payload: { accountId: demand.id, amount: Money.fromMinorUnits(1_000_000n, 'USD') },
});
if (deposit.outcome !== 'POSTED') {
  fail(`deposit ${deposit.outcome}`);
}

const actor = runtime.identity.service.resolveActorContext('operator_1');
if (!actor.ok) {
  fail('operator ActorContext');
}
const registry = new ModelRegistry();
if (!seedCanonicalRiskModel(registry, actor.value, NOW).ok) {
  fail('seed risk model');
}
const risk = new RiskEngine({
  clock,
  registry,
  events: runtime.events,
  evidence: runtime.evidence,
});
const lab = new StrategyLab({
  clock,
  risk,
  registry,
  events: runtime.events,
  evidence: runtime.evidence,
});
const budget = defaultSimulationBudget({
  subjectId: customer.id,
  portfolioId: 'inv_lab_demo',
  reviewBy: NOW,
});
risk.putBudget(budget);

const dataset = syntheticTwoEtfDataset();
const bench = syntheticBenchmarkDataset();
if (!lab.registerDataset(dataset).ok || !lab.registerDataset(bench).ok) {
  fail('dataset registry');
}

const draft = lab.createDraft({
  specification: equalWeightSpec(),
  meshProposal: {
    proposalId: 'cprop_demo',
    subjectId: customer.id,
    thesisSummary: 'Capital thesis: two simulated ETFs plus cash',
    instrumentUniverse: [SIM_ETF_1, 'SIM-ETF-2'],
    riskBudgetRef: budget.budgetId,
    modelRefs: [{ modelId: 'mdl_investment_pretrade', version: 'risk-model-v1' }],
    source: 'AGENTIC_CAPITAL_MESH',
    meshCannotSetValidation: true,
  },
});
if (!draft.ok) {
  fail(`draft ${draft.error.message}`);
}
const compiled = lab.compile('str_two_etf_cash', 'v1', budget);
if (!compiled.ok) {
  fail(`compile ${compiled.error.message}`);
}

const train = lab.backtest({
  strategyId: 'str_two_etf_cash',
  version: 'v1',
  datasetId: dataset.datasetId,
  datasetVersion: dataset.version,
  parameterSet: DEFAULT_PARAMETER_SET,
  startingCapitalMinor: 100_000n,
  period: { start: dataset.timeRange.start, end: asUtcInstant('2026-01-12T00:00:00.000Z') },
  partition: 'TRAIN',
});
const oos = lab.backtest({
  strategyId: 'str_two_etf_cash',
  version: 'v1',
  datasetId: dataset.datasetId,
  datasetVersion: dataset.version,
  parameterSet: DEFAULT_PARAMETER_SET,
  startingCapitalMinor: 100_000n,
  period: { start: asUtcInstant('2026-01-18T00:00:00.000Z'), end: dataset.timeRange.end },
  partition: 'OUT_OF_SAMPLE_TEST',
});
if (!train.ok || !oos.ok) {
  fail('backtest');
}
if (train.value.transactionCosts.mode !== 'EXPLICIT_COSTS' || train.value.results.feesMinor <= 0n) {
  fail('fees/slippage must be explicit and applied');
}
const future = lab.futurePriceInaccessible(dataset, SIM_ETF_1, asUtcInstant('2026-02-15T00:00:00.000Z'));
if (future.ok) {
  fail('future February spike must be inaccessible from the January dataset window');
}
const walk = lab.walkForward({
  strategyId: 'str_two_etf_cash',
  version: 'v1',
  datasetId: dataset.datasetId,
  datasetVersion: dataset.version,
  parameterSet: DEFAULT_PARAMETER_SET,
  startingCapitalMinor: 100_000n,
  trainDays: 7,
  testDays: 7,
});
if (!walk.ok) {
  fail(`walk-forward ${walk.error.message}`);
}
const report = lab.validate({
  strategyId: 'str_two_etf_cash',
  version: 'v1',
  train: train.value,
  outOfSample: oos.value,
  walkForward: walk.value,
  snapshot: lab.emptySnapshot('inv_lab_demo01', customer.id, 100_000n),
  benchmark: { datasetId: bench.datasetId, version: bench.version, hash: bench.hash },
  rdtState: 'SIMULATION_READY',
});
if (!report.ok) {
  fail(`validation ${report.error.message}`);
}

if (!lab.approveShadow(actor.value, 'str_two_etf_cash', 'v1', 'human approves shadow').ok) {
  fail('shadow approval');
}
const shadow = lab.startShadow('str_two_etf_cash', 'v1', dataset.datasetId, dataset.version);
if (!shadow.ok) {
  fail('shadow start');
}
const decision = lab.stepShadow({
  run: shadow.value,
  strategyId: 'str_two_etf_cash',
  version: 'v1',
  datasetId: dataset.datasetId,
  datasetVersion: dataset.version,
  at: dataset.timeRange.start,
});
if (!decision.ok || decision.value.brokerSubmission !== false || shadow.value.sendsOrders !== false) {
  fail('shadow must not send orders');
}
if (!lab.completeShadow('str_two_etf_cash', 'v1').ok) {
  fail('shadow complete');
}
if (!lab.approvePaper(actor.value, 'str_two_etf_cash', 'v1', 'human approves paper').ok) {
  fail('paper approval');
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
  { riskEngine: risk },
);
const opened = investments.openInvestmentAccount({
  id: asIntentId('lab_demo_open'),
  actionType: ACTION_TYPES.OPEN_INVESTMENT_ACCOUNT,
  idempotencyKey: 'lab_demo_open',
  actorId: 'operator_1',
  requestedAt: clock.now(),
  purpose: 'CUSTOMER_INVESTMENT',
  payload: {
    accountId: demand.id,
    investmentAccountId: 'inv_lab_demo',
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
  id: asIntentId('lab_demo_fund'),
  actionType: ACTION_TYPES.FUND_BROKERAGE_CASH,
  idempotencyKey: 'lab_demo_fund',
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
  fail(`fund ${funded.outcome}`);
}
if (!lab.startPaper({ strategyId: 'str_two_etf_cash', version: 'v1', investmentAccountId: 'inv_lab_demo' }).ok) {
  fail('paper start');
}
investments.setSimulatedPrice(asInstrumentId(SIM_ETF_1), 10_000n, 'USD');
const paper = lab.proposePaperOrder({
  port: {
    createPaperOrder: (intent) => {
      const result = investments.createPaperOrder(intent);
      if (result.outcome === 'OK') {
        return {
          outcome: 'OK' as const,
          value: {
            orderId: result.value.orderId,
            ...(result.value.fillId ? { fillId: result.value.fillId } : {}),
          },
        };
      }
      return {
        outcome: result.outcome,
        code: result.outcome === 'REJECTED' ? result.code : result.outcome,
        message: result.outcome === 'REJECTED' ? result.message : result.outcome,
      };
    },
  },
  intent: {
    intentId: 'lab_demo_paper',
    accountId: brokerage.id,
    investmentAccountId: 'inv_lab_demo',
    orderId: 'ord_lab_demo',
    instrumentId: SIM_ETF_1,
    side: 'BUY',
    quantityUnits: '1000000000',
    actorId: 'operator_1',
    idempotencyKey: 'ord_lab_demo',
    requestedAt: clock.now(),
  },
  snapshot: lab.emptySnapshot('inv_lab_demo02', customer.id, 500_000n),
  proposed: {
    proposalRef: 'ord_lab_demo',
    instrumentId: SIM_ETF_1,
    instrumentType: 'ETF',
    currency: 'USD',
    side: 'BUY',
    quantityUnits: 1_000_000_000n,
    quantityScale: 8,
    priceMinor: 10_000n,
    notionalMinor: 100_000n,
    feeMinor: 0n,
    liquidityClass: 'HIGH',
  },
  budget,
});
if (!paper.ok) {
  fail(`paper ${paper.error.message}`);
}
const position = investments.store.getPosition(asInvestmentAccountId('inv_lab_demo'), asInstrumentId(SIM_ETF_1));
if (!position || position.quantity.units <= 0n) {
  fail('paper fill did not occur');
}
lab.halt('DRAWDOWN_GUARD');
if (lab.store.getStrategy('str_two_etf_cash', 'v1')?.lifecycle !== 'PAPER_HALTED') {
  fail('kill switch');
}
if (LIVE_STRATEGY_EXECUTION !== false || assertNoLiveTransition('PAPER_APPROVED', 'LIVE').ok) {
  fail('live path must not exist');
}
if (classifyPeveStrategyValue('BACKTEST').realizedUserValue !== false) {
  fail('PEVE backtest is not realized value');
}

const overfit = lab.createDraft({ specification: overfitSpec() });
if (!overfit.ok) {
  fail('overfit draft');
}
if (!lab.compile('str_overfit_fixture', 'v-overfit', budget).ok) {
  fail('overfit compile');
}
const overfitTrain = lab.backtest({
  strategyId: 'str_overfit_fixture',
  version: 'v-overfit',
  datasetId: dataset.datasetId,
  datasetVersion: dataset.version,
  parameterSet: DEFAULT_PARAMETER_SET,
  startingCapitalMinor: 100_000n,
  period: { start: dataset.timeRange.start, end: asUtcInstant('2026-01-12T00:00:00.000Z') },
  partition: 'TRAIN',
});
const overfitOos = lab.backtest({
  strategyId: 'str_overfit_fixture',
  version: 'v-overfit',
  datasetId: dataset.datasetId,
  datasetVersion: dataset.version,
  parameterSet: DEFAULT_PARAMETER_SET,
  startingCapitalMinor: 100_000n,
  period: { start: asUtcInstant('2026-01-20T00:00:00.000Z'), end: dataset.timeRange.end },
  partition: 'OUT_OF_SAMPLE_TEST',
});
if (!overfitTrain.ok || !overfitOos.ok) {
  fail('overfit runs');
}
const overfitReport = lab.validate({
  strategyId: 'str_overfit_fixture',
  version: 'v-overfit',
  train: overfitTrain.value,
  outOfSample: overfitOos.value,
});
if (!overfitReport.ok || overfitReport.value.overfittingWarnings.length === 0) {
  fail('overfit warnings');
}
if (lab.approvePaper(actor.value, 'str_overfit_fixture', 'v-overfit', 'must not auto-promote').ok) {
  fail('overfit must not reach paper');
}
const objective = lab.evaluateObjective('$1,000 to $1,300 every week.', false);
if (objective.guaranteed || objective.promote) {
  fail('aggressive objective must not be guaranteed or promoted');
}
if (lab.growthGate('str_two_etf_cash', 'v1') === 'NEEDS_BACKTEST') {
  fail('paper-approved strategy should leave NEEDS_BACKTEST');
}

const chain = runtime.evidence.verifyChain();
if (!chain.ok) {
  fail('evidence chain broken');
}

console.log(
  JSON.stringify(
    {
      meshProposal: true,
      strategyDraft: draft.value.strategyId,
      compiledHash: compiled.value.compiledHash,
      trainReturn: train.value.results.totalReturn.units.toString(),
      outOfSampleReturn: oos.value.results.totalReturn.units.toString(),
      feesMinor: train.value.results.feesMinor.toString(),
      walkForwardFolds: walk.value.folds.length,
      stressRuns: report.value.stress.length,
      shadowOrders: 0,
      paperFill: paper.value.fillId ?? paper.value.orderId,
      killSwitch: lab.store.killSwitch.reason,
      liveExecution: LIVE_STRATEGY_EXECUTION,
      peveBacktestRealized: false,
      overfitWarnings: overfitReport.value.overfittingWarnings.map((row) => row.kind),
      objectiveGuaranteed: objective.guaranteed,
    },
    null,
    2,
  ),
);
