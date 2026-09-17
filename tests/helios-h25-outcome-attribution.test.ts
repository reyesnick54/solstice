/**
 * HELIOS H25 — independent Grow outcome attribution.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCurrencyCode } from '../packages/domain/src/currency.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../packages/domain/src/legal-entity.ts';
import { asProductId } from '../packages/domain/src/product.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { Money } from '../packages/money/src/money.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../packages/permissions/src/action-types.ts';
import {
  asInvestmentAccountId,
  buildCanonicalGrowAttributionSource,
  InvestmentsService,
  SimulatedMarketDataProvider,
} from '../packages/investments/src/index.ts';
import {
  buildIndependentGrowOutcomeAttribution,
  InMemoryGrowOutcomeAttributionStore,
  reconstructGrowOutcomeAttribution,
  type CanonicalAttributionSourcePort,
  type GrowResearchSpendInput,
} from '../packages/platform/src/helios/outcome-attribution/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';
import { seedSimulationCatalog } from '../services/accounts/src/catalog.ts';
import { createSimulationRuntime } from '../services/accounts/src/runtime.ts';
import { activateCustomer, openIntent } from '../services/accounts/src/test-helpers.ts';
import { createPhaseEWorld } from './phase-e-world.ts';

const NOW = asUtcInstant('2026-08-22T12:00:00.000Z');
const TEN_SHARES = '1000000000';
const FOUR_SHARES = '400000000';
const FIVE_THOUSAND = 500_000n;
const TEN_THOUSAND = 1_000_000n;

type TestWorld = {
  readonly clock: FrozenClock;
  readonly investments: InvestmentsService;
  readonly demandId: string;
  readonly brokerageId: string;
  readonly securitiesId: string;
  readonly pendingId: string;
  readonly investmentAccountId: string;
  readonly customerId: string;
  readonly ledger: ReturnType<typeof createSimulationRuntime>['ledger'];
};

function buildWorld(suffix: string): TestWorld {
  const clock = new FrozenClock(NOW);
  const runtime = createSimulationRuntime({ clock });
  const customer = activateCustomer(runtime, `cust_h25_${suffix}`);
  const seeded = seedSimulationCatalog();
  const demand = runtime.accountsService.open(
    openIntent({ id: `${suffix}_d`, accountId: `acct_h25_${suffix}_d`, ownerId: customer.id }),
  );
  const brokerage = runtime.accountsService.open(
    openIntent({
      id: `${suffix}_b`,
      accountId: `acct_h25_${suffix}_b`,
      ownerId: customer.id,
      productId: asProductId('prod_brokerage_cash_usd_gb'),
      accountClass: 'BROKERAGE_CASH',
    }),
  );
  const securities = runtime.accountsService.open(
    openIntent({
      id: `${suffix}_s`,
      accountId: `acct_h25_${suffix}_s`,
      ownerId: customer.id,
      productId: asProductId('prod_securities_usd_gb'),
      accountClass: 'SECURITIES',
    }),
  );
  const pending = runtime.accountsService.open(
    openIntent({
      id: `${suffix}_p`,
      accountId: `acct_h25_${suffix}_p`,
      ownerId: customer.id,
      productId: asProductId('prod_pending_usd_gb'),
      accountClass: 'PENDING_SETTLEMENT',
    }),
  );
  if (
    demand.outcome !== 'OPENED' ||
    brokerage.outcome !== 'OPENED' ||
    securities.outcome !== 'OPENED' ||
    pending.outcome !== 'OPENED'
  ) {
    throw new Error('account open failed');
  }
  runtime.money.deposit({
    id: asIntentId(`${suffix}_dep`),
    actionType: ACTION_TYPES.POST_DEPOSIT,
    idempotencyKey: `${suffix}_dep`,
    actorId: 'operator_1',
    requestedAt: clock.now(),
    purpose: 'CUSTOMER_FUNDING',
    payload: { accountId: demand.account.id, amount: Money.fromMinorUnits(TEN_THOUSAND, 'USD') },
  });
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
    investments,
    demandId: demand.account.id,
    brokerageId: brokerage.account.id,
    securitiesId: securities.account.id,
    pendingId: pending.account.id,
    investmentAccountId: `inv_h25_${suffix}`,
    customerId: customer.id,
    ledger: runtime.ledger,
  };
}

function openAndFund(world: TestWorld) {
  const opened = world.investments.openInvestmentAccount({
    id: asIntentId(`open_${world.investmentAccountId}`),
    actionType: ACTION_TYPES.OPEN_INVESTMENT_ACCOUNT,
    idempotencyKey: `open_${world.investmentAccountId}`,
    actorId: 'operator_1',
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_INVESTMENT',
    payload: {
      accountId: world.demandId,
      investmentAccountId: world.investmentAccountId,
      customerId: world.customerId,
      brokerageCashAccountId: world.brokerageId,
      securitiesAccountId: world.securitiesId,
      pendingSettlementAccountId: world.pendingId,
      productId: asProductId('prod_brokerage_cash_usd_gb'),
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      currency: asCurrencyCode('USD'),
    },
  });
  assert.equal(opened.outcome, 'OK');
  const funded = world.investments.fundBrokerageCash({
    id: asIntentId(`fund_${world.investmentAccountId}`),
    actionType: ACTION_TYPES.FUND_BROKERAGE_CASH,
    idempotencyKey: `fund_${world.investmentAccountId}`,
    actorId: 'operator_1',
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_INVESTMENT',
    payload: {
      accountId: world.brokerageId,
      sourceAccountId: world.demandId,
      amount: Money.fromMinorUnits(FIVE_THOUSAND, 'USD'),
    },
  });
  assert.equal(funded.outcome, 'OK');
}

function buy(world: TestWorld, key: string, quantityUnits = TEN_SHARES) {
  const result = world.investments.createPaperOrder({
    id: asIntentId(`${key}_buy`),
    actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
    idempotencyKey: `${key}_buy`,
    actorId: 'operator_1',
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_INVESTMENT',
    payload: {
      accountId: world.brokerageId,
      investmentAccountId: world.investmentAccountId,
      orderId: `ord_${key}`,
      instrumentId: 'SIM-ETF-1',
      side: 'BUY',
      quantityUnits,
      orderType: 'MARKET_SIMULATION',
    },
  });
  assert.equal(result.outcome, 'OK', JSON.stringify(result));
}

function sell(world: TestWorld, key: string, quantityUnits: string) {
  const result = world.investments.createPaperOrder({
    id: asIntentId(`${key}_sell`),
    actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
    idempotencyKey: `${key}_sell`,
    actorId: 'operator_1',
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_INVESTMENT',
    payload: {
      accountId: world.brokerageId,
      investmentAccountId: world.investmentAccountId,
      orderId: `ord_${key}_sell`,
      instrumentId: 'SIM-ETF-1',
      side: 'SELL',
      quantityUnits,
      orderType: 'MARKET_SIMULATION',
    },
  });
  assert.equal(result.outcome, 'OK', JSON.stringify(result));
}

function attribute(world: TestWorld, research: readonly GrowResearchSpendInput[] = []) {
  const source = buildCanonicalGrowAttributionSource({
    investments: world.investments,
    investmentAccountId: asInvestmentAccountId(world.investmentAccountId),
    ledger: world.ledger,
    demandAccountId: world.demandId,
    now: world.clock.now(),
  });
  return buildIndependentGrowOutcomeAttribution({
    source,
    researchSpend: research,
    now: world.clock.now(),
  });
}

describe('HELIOS H25 — independent Grow outcome attribution', () => {
  it('architecture guard: outcome-attribution stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const scoped = findings.filter((f) => f.file.includes('helios/outcome-attribution'));
    assert.equal(scoped.length, 0, JSON.stringify(scoped));
  });

  it('1. deposit is not counted as growth', () => {
    const world = buildWorld('dep');
    openAndFund(world);
    const row = attribute(world);
    assert.ok(BigInt(row.principalDeposits.minorUnits) > 0n);
    assert.ok(BigInt(row.netContributions.minorUnits) > 0n);
    assert.equal(row.realizedTotal.minorUnits, '0');
    assert.notEqual(row.principalDeposits.minorUnits, row.netInvestmentResult.minorUnits);
    assert.equal(row.rules.principalDepositsAreNotGrowth, true);
  });

  it('2. buy has no instant profit', () => {
    const world = buildWorld('buy');
    openAndFund(world);
    buy(world, 'instant');
    const row = attribute(world);
    assert.equal(row.realizedTotal.minorUnits, '0');
    assert.equal(row.unrealizedTotal.minorUnits, '0');
    assert.ok(BigInt(row.capitalDeployed.minorUnits) > 0n);
  });

  it('3. partial exit applies FIFO cost basis', () => {
    const world = buildWorld('partial');
    openAndFund(world);
    buy(world, 'partial_buy');
    world.investments.setSimulatedPrice('SIM-ETF-1', 11_000n, 'USD');
    sell(world, 'partial_exit', FOUR_SHARES);
    const row = attribute(world);
    assert.equal(row.realizedLines.length, 1);
    assert.equal(row.realizedLines[0]?.realized.minorUnits, '4000');
    assert.ok(row.positions.some((p) => p.quantityUnits === '600000000'));
    assert.equal(row.costBasisMethod, 'FIFO_SIMULATION_ACCOUNTING_METHOD');
  });

  it('4. full exit reports realized P&L', () => {
    const world = buildWorld('full');
    openAndFund(world);
    buy(world, 'full_buy');
    world.investments.setSimulatedPrice('SIM-ETF-1', 11_000n, 'USD');
    sell(world, 'full_exit', TEN_SHARES);
    const row = attribute(world);
    assert.equal(row.realizedTotal.minorUnits, '10000');
    assert.equal(row.unrealizedTotal.minorUnits, '0');
  });

  it('5. open position reports unrealized P&L', () => {
    const world = buildWorld('open');
    openAndFund(world);
    buy(world, 'open_buy');
    world.investments.setSimulatedPrice('SIM-ETF-1', 12_000n, 'USD');
    const row = attribute(world);
    assert.equal(row.realizedTotal.minorUnits, '0');
    assert.equal(row.unrealizedTotal.minorUnits, '20000');
    assert.equal(row.rules.unrealizedIsNotAvailableCash, true);
  });

  it('6. fees reduce net investment result', () => {
    const world = buildWorld('fees');
    openAndFund(world);
    buy(world, 'fee_buy');
    const row = attribute(world);
    assert.ok(row.fees.length >= 1);
    assert.ok(BigInt(row.tradingCosts.minorUnits) >= 0n);
    assert.ok(BigInt(row.netInvestmentResult.minorUnits) <= BigInt(row.grossInvestmentResult.minorUnits));
  });

  it('7. income is separate from trading P&L', () => {
    const world = buildWorld('income');
    openAndFund(world);
    buy(world, 'income_buy');
    const source = buildCanonicalGrowAttributionSource({
      investments: world.investments,
      investmentAccountId: asInvestmentAccountId(world.investmentAccountId),
      ledger: world.ledger,
      demandAccountId: world.demandId,
      now: world.clock.now(),
    });
    const withIncome: CanonicalAttributionSourcePort = Object.freeze({
      ...source,
      income: Object.freeze([
        Object.freeze({
          incomeId: 'ca_div_h25',
          incomeType: 'DIVIDEND',
          amountMinorUnits: '500',
          currency: 'USD',
          receivedAt: world.clock.now(),
          sourceRef: 'sim-div-ref',
        }),
      ]),
    });
    const row = buildIndependentGrowOutcomeAttribution({
      source: withIncome,
      researchSpend: [],
      now: world.clock.now(),
    });
    assert.equal(row.income.length, 1);
    assert.equal(row.income[0]?.amount.minorUnits, '500');
    assert.notEqual(row.incomeTotal.minorUnits, row.realizedTotal.minorUnits);
    assert.ok(BigInt(row.netEconomicResult.minorUnits) > BigInt(row.netInvestmentResult.minorUnits));
  });

  it('8. research cost is separate from investment P&L', () => {
    const world = buildWorld('research');
    openAndFund(world);
    buy(world, 'research_buy');
    const row = attribute(world, [
      Object.freeze({
        spendId: 'rsp_h25_1',
        workOrderId: 'wo_h25',
        taskId: 'task_h25',
        customerId: world.customerId,
        budgetCategory: 'MODEL_CALLS',
        actualAmount: '250',
        estimatedAmount: null,
        costStatus: 'ACTUAL',
        currency: 'USD',
        recordedAt: NOW,
      }),
    ]);
    assert.equal(row.researchCosts.length, 1);
    assert.equal(row.researchOperatingCost.minorUnits, '250');
    assert.ok(BigInt(row.netEconomicResult.minorUnits) < BigInt(row.netInvestmentResult.minorUnits));
    assert.equal(row.rules.researchEarningsSeparateFromInvestment, true);
  });

  it('9. pending settlement is not classified as realized', () => {
    const world = buildWorld('pending');
    openAndFund(world);
    buy(world, 'pending_buy');
    const source = buildCanonicalGrowAttributionSource({
      investments: world.investments,
      investmentAccountId: asInvestmentAccountId(world.investmentAccountId),
      ledger: world.ledger,
      demandAccountId: world.demandId,
      now: world.clock.now(),
    });
    const pendingSource: CanonicalAttributionSourcePort = Object.freeze({
      ...source,
      settlements: Object.freeze([
        Object.freeze({
          settlementId: 'set_pending',
          fillId: source.fills[0]?.fillId ?? 'fill_missing',
          state: 'PENDING_SETTLEMENT',
          feeMinorUnits: '0',
          currency: 'USD',
        }),
      ]),
      positions: Object.freeze(
        source.positions.map((row) =>
          Object.freeze({
            ...row,
            positionStatus: 'PENDING' as const,
            unsettledQuantityUnits: row.quantityUnits,
          }),
        ),
      ),
    });
    const row = buildIndependentGrowOutcomeAttribution({ source: pendingSource, researchSpend: [], now: NOW });
    assert.ok(row.positions.every((p) => p.resultKind === 'PENDING' || p.resultKind === 'UNREALIZED'));
    assert.equal(row.realizedTotal.minorUnits, '0');
  });

  it('10. stale mark yields degraded valuation', () => {
    const world = buildWorld('stale');
    openAndFund(world);
    buy(world, 'stale_buy');
    const market = world.investments.market as SimulatedMarketDataProvider;
    market.markQuotedAt('SIM-ETF-1', asUtcInstant('2026-08-22T11:00:00.000Z'));
    world.clock.set(asUtcInstant('2026-08-22T13:00:00.000Z'));
    const row = attribute(world);
    assert.ok(row.positions.some((p) => p.markFreshness === 'STALE'));
    assert.ok(row.positions.some((p) => p.resultKind === 'ESTIMATED'));
  });

  it('11. duplicate provider fill does not double count', () => {
    const world = buildWorld('dup');
    openAndFund(world);
    buy(world, 'dup_buy');
    const fill = world.investments.store.listFills()[0];
    assert.ok(fill);
    const dup = world.investments.ingestDuplicateFill(fill.providerFillRef);
    assert.equal(dup.outcome, 'OK');
    const row = attribute(world);
    const fillEvents = row.economicEvents.filter((e) => e.kind === 'FILL');
    assert.equal(fillEvents.length, 1);
  });

  it('12. multi-currency positions are not silently blended', () => {
    const world = buildWorld('fx');
    openAndFund(world);
    buy(world, 'fx_buy');
    const source = buildCanonicalGrowAttributionSource({
      investments: world.investments,
      investmentAccountId: asInvestmentAccountId(world.investmentAccountId),
      ledger: world.ledger,
      demandAccountId: world.demandId,
      now: world.clock.now(),
    });
    const fxSource: CanonicalAttributionSourcePort = Object.freeze({
      ...source,
      positions: Object.freeze([
        ...source.positions,
        Object.freeze({
          instrumentId: 'SIM-ETF-EUR',
          quantityUnits: '100000000',
          settledQuantityUnits: '100000000',
          unsettledQuantityUnits: '0',
          remainingCostMinorUnits: '10000',
          marketValueMinorUnits: '11000',
          unrealizedMinorUnits: '1000',
          currency: 'EUR',
          positionStatus: 'OPEN' as const,
          mark: null,
        }),
      ]),
      fx: Object.freeze({
        sourceCurrency: 'EUR',
        reportingCurrency: 'USD',
        rateNumerator: '1',
        rateDenominator: '1',
        asOf: NOW,
        methodology: 'UNCONFIGURED_NO_SILENT_BLEND',
        reference: 'REPORTING_CURRENCY_SEGREGATED',
      }),
    });
    const row = buildIndependentGrowOutcomeAttribution({ source: fxSource, researchSpend: [], now: NOW });
    assert.ok(row.fx);
    assert.equal(row.fx?.methodology, 'UNCONFIGURED_NO_SILENT_BLEND');
  });

  it('13. losses are reported accurately', () => {
    const world = buildWorld('loss');
    openAndFund(world);
    buy(world, 'loss_buy');
    world.investments.setSimulatedPrice('SIM-ETF-1', 8_000n, 'USD');
    sell(world, 'loss_exit', TEN_SHARES);
    const row = attribute(world);
    assert.ok(BigInt(row.realizedTotal.minorUnits) < 0n);
    assert.equal(row.realizedTotal.minorUnits, '-20000');
  });

  it('14. restart reconstruction reproduces attribution', () => {
    const world = buildWorld('restart');
    openAndFund(world);
    buy(world, 'restart_buy');
    world.investments.setSimulatedPrice('SIM-ETF-1', 11_000n, 'USD');
    const store = new InMemoryGrowOutcomeAttributionStore();
    const first = reconstructGrowOutcomeAttribution({
      store,
      customerId: world.customerId,
      rebuild: () => attribute(world),
    });
    store.clear();
    const second = reconstructGrowOutcomeAttribution({
      store,
      customerId: world.customerId,
      rebuild: () => attribute(world),
    });
    assert.deepEqual(
      {
        realized: first.realizedTotal.minorUnits,
        unrealized: first.unrealizedTotal.minorUnits,
        net: first.netInvestmentResult.minorUnits,
      },
      {
        realized: second.realizedTotal.minorUnits,
        unrealized: second.unrealizedTotal.minorUnits,
        net: second.netInvestmentResult.minorUnits,
      },
    );
  });

  it('15. customer isolation prevents cross-customer attribution', () => {
    const worldA = buildWorld('iso_a');
    const worldB = buildWorld('iso_b');
    openAndFund(worldA);
    buy(worldA, 'iso_a_buy');
    openAndFund(worldB);
    const rowA = attribute(worldA);
    const rowB = attribute(worldB);
    assert.notEqual(rowA.customerId, rowB.customerId);
    assert.ok(BigInt(rowA.capitalDeployed.minorUnits) > 0n);
    assert.equal(rowB.capitalDeployed.minorUnits, '0');
  });

  it('16. reconciliation mismatch is surfaced honestly', () => {
    const world = buildWorld('recon');
    openAndFund(world);
    buy(world, 'recon_buy');
    const source = buildCanonicalGrowAttributionSource({
      investments: world.investments,
      investmentAccountId: asInvestmentAccountId(world.investmentAccountId),
      ledger: world.ledger,
      demandAccountId: world.demandId,
      now: world.clock.now(),
    });
    const mismatched: CanonicalAttributionSourcePort = Object.freeze({
      ...source,
      reconciliation: Object.freeze({
        result: 'POSITION_MISMATCH',
        findings: Object.freeze(['POSITION_MISMATCH SIM-ETF-1']),
      }),
    });
    const row = buildIndependentGrowOutcomeAttribution({ source: mismatched, researchSpend: [], now: NOW });
    assert.equal(row.reconciliation.result, 'POSITION_MISMATCH');
    assert.equal(row.reconciliation.providerResultIsNotCanonical, true);
    assert.ok(row.reconciliation.findings.length > 0);
  });

  it('Grow BFF exposes server-owned outcomeAttribution on /grow/results', async () => {
    const world = createPhaseEWorld('h25_bff');
    const plan = await world.handle({ method: 'GET', path: '/api/v1/grow/plan', query: {} });
    assert.equal(plan.status, 200);
    const planBody = plan.body as { actions: Array<{ actionId: string; action: string }> };
    const action = planBody.actions[0];
    assert.ok(action);
    const created = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/proposals',
      query: {},
      body: { actionId: action.actionId },
    });
    assert.equal(created.status, 201);
    const proposal = created.body as { proposalId: string };
    await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposal.proposalId}/approve`,
      query: {},
      body: { stepUpSatisfied: true },
    });
    await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposal.proposalId}/execute`,
      query: {},
      body: { idempotencyKey: 'h25-bff-exec' },
    });
    const results = await world.handle({ method: 'GET', path: '/api/v1/grow/results', query: {} });
    assert.equal(results.status, 200);
    const body = results.body as {
      outcomeAttribution: { schema: string; serverOwned: boolean; costBasisMethod: string } | null;
    };
    assert.ok(body.outcomeAttribution);
    assert.equal(body.outcomeAttribution.schema, 'sunrey.helios.grow.outcome-attribution.v1');
    assert.equal(body.outcomeAttribution.serverOwned, true);
    assert.equal(body.outcomeAttribution.costBasisMethod, 'FIFO_SIMULATION_ACCOUNTING_METHOD');
  });
});
