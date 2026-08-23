import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addMs, FrozenClock } from '../../config/src/clock.ts';
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
import { activateCustomer, openIntent, NOW } from '../../../services/accounts/src/test-helpers.ts';
import { asInstrumentId, asInvestmentAccountId } from './ids.ts';
import { InvestmentsService } from './service.ts';
import { computePerformance } from './product/performance.ts';
import { evaluateProductSuitability } from './product/suitability.ts';
import { seedInstrumentProducts } from './product/instrument-catalog.ts';
import { InvestmentPlatform } from './product/platform.ts';
import { SandboxInvestmentExecutionProvider } from './product/sandbox.ts';
import { postReservationJournal, overlayReservation, reservedTotal } from './product/reservation.ts';
import { LIVE_SECURITIES_BROKERAGE, LIVE_INVESTMENT_EXECUTION } from './index.ts';
import { quantityFromWholeString } from './quantity.ts';
import { brokerageToPendingBridge, postInvestmentJournal } from './journals.ts';
import { portfolioFromProfile } from './product/portfolio.ts';
import { asPortfolioId } from './product/ids.ts';

const FIVE_THOUSAND = 500_000n;
const TEN_SHARES = '1000000000';

function wired(suffix: string) {
  const clock = new FrozenClock(NOW);
  const runtime = createSimulationRuntime({ clock });
  const customer = activateCustomer(runtime, `cust_${suffix}`);
  const seeded = seedSimulationCatalog();
  const demand = runtime.accountsService.open(
    openIntent({ id: `${suffix}_open_d`, accountId: `${suffix}_d`, ownerId: customer.id }),
  );
  const brokerage = runtime.accountsService.open(
    openIntent({
      id: `${suffix}_open_b`,
      accountId: `${suffix}_b`,
      ownerId: customer.id,
      productId: asProductId('prod_brokerage_cash_usd_gb'),
      accountClass: 'BROKERAGE_CASH',
    }),
  );
  const securities = runtime.accountsService.open(
    openIntent({
      id: `${suffix}_open_s`,
      accountId: `${suffix}_s`,
      ownerId: customer.id,
      productId: asProductId('prod_securities_usd_gb'),
      accountClass: 'SECURITIES',
    }),
  );
  const pending = runtime.accountsService.open(
    openIntent({
      id: `${suffix}_open_p`,
      accountId: `${suffix}_p`,
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
  const deposited = runtime.money.deposit({
    id: asIntentId(`${suffix}_dep`),
    actionType: ACTION_TYPES.POST_DEPOSIT,
    idempotencyKey: `${suffix}_dep`,
    actorId: 'operator_1',
    requestedAt: clock.now(),
    purpose: 'CUSTOMER_FUNDING',
    payload: { accountId: demand.account.id, amount: Money.fromMinorUnits(1_000_000n, 'USD') },
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
  const platform = new InvestmentPlatform(investments);
  return {
    clock,
    runtime,
    customer,
    demand: demand.account,
    brokerage: brokerage.account,
    securities: securities.account,
    pending: pending.account,
    investments,
    platform,
  };
}

function openAndFund(world: ReturnType<typeof wired>, suffix: string) {
  const opened = world.investments.openInvestmentAccount({
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
    },
  });
  assert.equal(opened.outcome, 'OK');
  const funded = world.investments.fundBrokerageCash({
    id: asIntentId(`${suffix}_fund`),
    actionType: ACTION_TYPES.FUND_BROKERAGE_CASH,
    idempotencyKey: `${suffix}_fund`,
    actorId: 'operator_1',
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_INVESTMENT',
    payload: {
      accountId: world.brokerage.id,
      sourceAccountId: world.demand.id,
      amount: Money.fromMinorUnits(FIVE_THOUSAND, 'USD'),
    },
  });
  assert.equal(funded.outcome, 'OK');
  const portfolio = world.platform.attachFromInvestmentAccount(asInvestmentAccountId(`inv_${suffix}`));
  assert.ok(portfolio);
  world.platform.recordCashFlow(portfolio.portfolioId, {
    at: world.clock.now(),
    amount: Money.fromMinorUnits(FIVE_THOUSAND, 'USD'),
    kind: 'DEPOSIT',
  });
  return portfolio;
}

describe('investment product catalog', () => {
  it('lists generic asset classes without making unsupported products available', () => {
    const products = seedInstrumentProducts();
    const classes = new Set(products.map((row) => row.assetClass));
    assert.ok(classes.has('CASH'));
    assert.ok(classes.has('MONEY_MARKET'));
    assert.ok(classes.has('EQUITY'));
    assert.ok(classes.has('ETF'));
    assert.ok(classes.has('FUND'));
    assert.ok(classes.has('FIXED_INCOME'));
    assert.ok(classes.has('DIGITAL_ASSET'));
    assert.ok(classes.has('OTHER_APPROVED_PRODUCT'));
    const digital = products.find((row) => row.assetClass === 'DIGITAL_ASSET');
    assert.equal(digital?.status, 'UNAVAILABLE');
    const other = products.find((row) => row.assetClass === 'OTHER_APPROVED_PRODUCT');
    assert.equal(other?.status, 'RESEARCH_REQUIRED');
    assert.equal(LIVE_SECURITIES_BROKERAGE, false);
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
  });
});

describe('portfolio persist and holdings valuation', () => {
  it('persists a portfolio overlay and values holdings with freshness', () => {
    const world = wired('pf');
    const portfolio = openAndFund(world, 'pf');
    assert.equal(portfolio.environment, 'simulation');
    assert.equal(portfolio.liveState, false);
    assert.equal('balance' in portfolio, false);
    const buy = world.investments.createPaperOrder({
      id: asIntentId('pf_buy'),
      actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
      idempotencyKey: 'pf_buy',
      actorId: 'operator_1',
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_INVESTMENT',
      payload: {
        accountId: world.brokerage.id,
        investmentAccountId: 'inv_pf',
        orderId: 'ord_pf_buy',
        instrumentId: 'SIM-ETF-1',
        side: 'BUY',
        quantityUnits: TEN_SHARES,
        orderType: 'MARKET_SIMULATION',
      },
    });
    assert.equal(buy.outcome, 'OK');
    world.investments.valuePortfolio(asInvestmentAccountId('inv_pf'));
    const holdings = world.platform.holdings(portfolio, world.clock.now());
    assert.equal(holdings.length, 1);
    assert.equal(holdings[0]?.quantity.units, 1_000_000_000n);
    assert.equal(holdings[0]?.averageCost.minorUnits, 10_000n);
    assert.equal(holdings[0]?.marketValue?.minorUnits, 100_000n);
    assert.equal(holdings[0]?.unrealized?.unrealized.minorUnits, 0n);
    assert.equal(holdings[0]?.valuation.source.length > 0, true);
    assert.equal(typeof holdings[0]?.valuation.freshnessMs, 'bigint');
    assert.equal(world.platform.portfolios.has(portfolio.portfolioId), true);
  });

  it('identifies a stale price', () => {
    const world = wired('stale');
    const portfolio = openAndFund(world, 'stale');
    world.investments.createPaperOrder({
      id: asIntentId('stale_buy'),
      actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
      idempotencyKey: 'stale_buy',
      actorId: 'operator_1',
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_INVESTMENT',
      payload: {
        accountId: world.brokerage.id,
        investmentAccountId: 'inv_stale',
        orderId: 'ord_stale_buy',
        instrumentId: 'SIM-ETF-1',
        side: 'BUY',
        quantityUnits: TEN_SHARES,
        orderType: 'MARKET_SIMULATION',
      },
    });
    const market = world.investments.market;
    if ('markQuotedAt' in market) {
      (market as { markQuotedAt(id: ReturnType<typeof asInstrumentId>, at: string): void }).markQuotedAt(
        asInstrumentId('SIM-ETF-1'),
        '2026-01-01T00:00:00.000Z',
      );
    }
    world.investments.valuePortfolio(asInvestmentAccountId('inv_stale'));
    const holdings = world.platform.holdings(portfolio, world.clock.now());
    assert.equal(holdings[0]?.valuation.stale, true);
    assert.equal(holdings[0]?.valuation.quality, 'STALE');
  });
});

describe('performance engine', () => {
  it('handles deposits and withdrawals with documented TWR and Modified Dietz', () => {
    const start = asUtcInstant('2026-01-01T00:00:00.000Z');
    const mid = asUtcInstant('2026-04-01T00:00:00.000Z');
    const end = asUtcInstant('2026-07-01T00:00:00.000Z');
    const twr = computePerformance({
      from: start,
      to: end,
      points: [
        { at: start, marketValue: Money.fromMinorUnits(100_000n, 'USD'), cash: Money.zero('USD') },
        { at: mid, marketValue: Money.fromMinorUnits(110_000n, 'USD'), cash: Money.zero('USD') },
        { at: end, marketValue: Money.fromMinorUnits(160_000n, 'USD'), cash: Money.zero('USD') },
      ],
      cashFlows: [{ at: mid, amount: Money.fromMinorUnits(40_000n, 'USD'), kind: 'DEPOSIT' }],
      realized: Money.zero('USD'),
      unrealized: Money.fromMinorUnits(20_000n, 'USD'),
      income: Money.zero('USD'),
      methodology: 'TWR_LINKED_SUBPERIODS',
    });
    assert.equal(twr.llmAuthoritative, false);
    assert.equal(twr.authoritativeCalculator, 'INVESTMENT_PERFORMANCE_ENGINE');
    assert.equal(twr.externalCashFlow.minorUnits, 40_000n);
    assert.equal(twr.absoluteReturn.minorUnits, 20_000n);
    assert.equal(twr.periodReturnBps, 1733n);
    const dietz = computePerformance({
      from: start,
      to: end,
      points: [
        { at: start, marketValue: Money.fromMinorUnits(100_000n, 'USD'), cash: Money.zero('USD') },
        { at: end, marketValue: Money.fromMinorUnits(160_000n, 'USD'), cash: Money.zero('USD') },
      ],
      cashFlows: [{ at: mid, amount: Money.fromMinorUnits(40_000n, 'USD'), kind: 'DEPOSIT' }],
      realized: Money.zero('USD'),
      unrealized: Money.fromMinorUnits(20_000n, 'USD'),
      income: Money.zero('USD'),
      methodology: 'MODIFIED_DIETZ',
      benchmark: { benchmarkId: 'SIM-BENCH', periodReturnBps: 1000n, source: 'SIMULATED_DETERMINISTIC' },
    });
    assert.ok(dietz.periodReturnBps !== null);
    assert.ok((dietz.periodReturnBps ?? 0n) > 1000n);
    assert.equal(dietz.benchmark?.deltaBps !== null, true);
    const withdraw = computePerformance({
      from: start,
      to: end,
      points: [
        { at: start, marketValue: Money.fromMinorUnits(100_000n, 'USD'), cash: Money.zero('USD') },
        { at: end, marketValue: Money.fromMinorUnits(50_000n, 'USD'), cash: Money.zero('USD') },
      ],
      cashFlows: [{ at: mid, amount: Money.fromMinorUnits(50_000n, 'USD'), kind: 'WITHDRAWAL' }],
      realized: Money.zero('USD'),
      unrealized: Money.zero('USD'),
      income: Money.zero('USD'),
    });
    assert.equal(withdraw.absoluteReturn.minorUnits, 0n);
    assert.equal(withdraw.externalCashFlow.minorUnits, -50_000n);
  });
});

describe('allocation concentration and rebalance', () => {
  it('builds allocation views and a non-executing rebalance proposal', () => {
    const world = wired('alloc');
    const portfolio = openAndFund(world, 'alloc');
    assert.equal(
      world.investments.createPaperOrder({
        id: asIntentId('alloc_buy'),
        actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
        idempotencyKey: 'alloc_buy',
        actorId: 'operator_1',
        requestedAt: world.clock.now(),
        purpose: 'CUSTOMER_INVESTMENT',
        payload: {
          accountId: world.brokerage.id,
          investmentAccountId: 'inv_alloc',
          orderId: 'ord_alloc_buy',
          instrumentId: 'SIM-ETF-1',
          side: 'BUY',
          quantityUnits: TEN_SHARES,
          orderType: 'MARKET_SIMULATION',
        },
      }).outcome,
      'OK',
    );
    world.investments.valuePortfolio(asInvestmentAccountId('inv_alloc'));
    const allocation = world.platform.allocation(portfolio);
    assert.ok(allocation.byAssetClass.some((row) => row.key === 'ETF' || row.key === 'CASH'));
    assert.ok(allocation.byInstrument.length >= 1);
    assert.ok(allocation.byCurrency.length >= 1);
    assert.ok(allocation.byRiskClass.length >= 1);
    const risk = world.platform.risk(portfolio, world.clock.now());
    assert.ok(risk.concentration.largestWeightBps > 0n);
    assert.equal(risk.fabricatedStatistics, false);
    if (risk.volatility.availability === 'INSUFFICIENT_DATA') {
      assert.equal(risk.volatility.stdevBps, null);
    }
    const proposal = world.platform.rebalance(portfolio, world.clock.now());
    assert.equal(proposal.executes, false);
    assert.equal(proposal.status, 'PROPOSED');
    assert.ok(proposal.trades.every((row) => row.executes === false));
  });
});

describe('product suitability', () => {
  it('requires KYC, jurisdiction, risk, experience, liquidity, and provider', () => {
    const products = seedInstrumentProducts();
    const etf = products.find((row) => row.instrumentId === 'SIM-ETF-1');
    const digital = products.find((row) => row.assetClass === 'DIGITAL_ASSET');
    assert.ok(etf && digital);
    const world = wired('suit');
    const okDecision = evaluateProductSuitability({
      customer: world.customer,
      identityVerified: true,
      identityUsable: true,
      jurisdiction: 'GB',
      investorClassification: 'RETAIL',
      experience: 'EXPERIENCED',
      riskTolerance: 'MODERATE',
      liquidityNeed: 'MEDIUM',
      providerAvailable: true,
      productRestriction: [],
      instrument: etf,
    });
    assert.equal(okDecision.status, 'ELIGIBLE_SIMULATION');
    const kyc = evaluateProductSuitability({
      customer: world.customer,
      identityVerified: false,
      identityUsable: false,
      jurisdiction: 'GB',
      investorClassification: 'RETAIL',
      experience: 'EXPERIENCED',
      riskTolerance: 'MODERATE',
      liquidityNeed: 'MEDIUM',
      providerAvailable: true,
      productRestriction: [],
      instrument: etf,
    });
    assert.equal(kyc.status, 'NOT_SUPPORTED');
    const da = evaluateProductSuitability({
      customer: world.customer,
      identityVerified: true,
      identityUsable: true,
      jurisdiction: 'GB',
      investorClassification: 'RETAIL',
      experience: 'EXPERIENCED',
      riskTolerance: 'HIGH',
      liquidityNeed: 'LOW',
      providerAvailable: true,
      productRestriction: [],
      instrument: digital,
    });
    assert.equal(da.status, 'NOT_SUPPORTED');
    const down = evaluateProductSuitability({
      customer: world.customer,
      identityVerified: true,
      identityUsable: true,
      jurisdiction: 'GB',
      investorClassification: 'RETAIL',
      experience: 'EXPERIENCED',
      riskTolerance: 'MODERATE',
      liquidityNeed: 'MEDIUM',
      providerAvailable: false,
      productRestriction: [],
      instrument: etf,
    });
    assert.equal(down.status, 'NOT_SUPPORTED');
  });
});

describe('order proposal and sandbox execution', () => {
  it('proposes an order, fills, partially fills, rejects, and handles unavailable', () => {
    const world = wired('ord');
    const portfolio = openAndFund(world, 'ord');
    const qty = quantityFromWholeString('1');
    assert.equal(qty.ok, true);
    if (!qty.ok) {
      throw new Error('qty');
    }
    const proposed = world.platform.proposeOrder({
      proposalId: 'prop_ord',
      portfolio,
      instrumentId: asInstrumentId('SIM-ETF-1'),
      side: 'BUY',
      sizing: 'QUANTITY',
      quantity: qty.value,
      amount: Money.fromMinorUnits(10_000n, 'USD'),
      at: world.clock.now(),
      customer: world.customer,
      jurisdiction: 'GB',
      identityVerified: true,
    });
    if (proposed.outcome !== 'OK') {
      throw new Error('expected proposed order');
    }
    assert.equal(proposed.value.status, 'PROPOSED');
    assert.equal(proposed.value.liveExecution, false);
    const filled = world.platform.submitSandbox(proposed.value.proposalId, world.clock.now());
    assert.equal(filled.outcome, 'OK');
    if (filled.outcome === 'OK') {
      assert.equal(filled.value.status, 'FILLED');
      assert.equal(filled.value.fillIsLiveSecuritiesExecution, false);
    }

    const partialWorld = wired('part');
    const partialPf = openAndFund(partialWorld, 'part');
    partialWorld.platform.setSandboxScenario('PARTIAL_FILL');
    const partialProp = partialWorld.platform.proposeOrder({
      proposalId: 'prop_part',
      portfolio: partialPf,
      instrumentId: asInstrumentId('SIM-ETF-1'),
      side: 'BUY',
      sizing: 'AMOUNT',
      amount: Money.fromMinorUnits(20_000n, 'USD'),
      at: partialWorld.clock.now(),
      customer: partialWorld.customer,
      jurisdiction: 'GB',
      identityVerified: true,
    });
    assert.equal(partialProp.outcome, 'OK');
    if (partialProp.outcome === 'OK') {
      const partial = partialWorld.platform.submitSandbox(partialProp.value.proposalId, partialWorld.clock.now());
      assert.equal(partial.outcome, 'OK');
      if (partial.outcome === 'OK') {
        assert.equal(partial.value.status, 'PARTIALLY_FILLED');
      }
    }

    const rejectWorld = wired('rej');
    const rejectPf = openAndFund(rejectWorld, 'rej');
    rejectWorld.platform.setSandboxScenario('REJECTED');
    const rejectProp = rejectWorld.platform.proposeOrder({
      proposalId: 'prop_rej',
      portfolio: rejectPf,
      instrumentId: asInstrumentId('SIM-ETF-1'),
      side: 'BUY',
      sizing: 'QUANTITY',
      quantity: qty.value,
      amount: Money.fromMinorUnits(10_000n, 'USD'),
      at: rejectWorld.clock.now(),
      customer: rejectWorld.customer,
      jurisdiction: 'GB',
      identityVerified: true,
    });
    assert.equal(rejectProp.outcome, 'OK');
    if (rejectProp.outcome === 'OK') {
      const rejected = rejectWorld.platform.submitSandbox(rejectProp.value.proposalId, rejectWorld.clock.now());
      assert.equal(rejected.outcome, 'OK');
      if (rejected.outcome === 'OK') {
        assert.equal(rejected.value.status, 'REJECTED');
      }
    }

    const down = new SandboxInvestmentExecutionProvider();
    down.setScenario('MARKET_UNAVAILABLE');
    const unavailable = down.submitOrder({ ...proposed.value, status: 'AUTHORIZED' }, world.clock.now());
    assert.equal(unavailable.ok, false);
    if (!unavailable.ok) {
      assert.equal(unavailable.error.code, 'MARKET_UNAVAILABLE');
    }
  });

  it('denies cross-user portfolio reads', () => {
    const world = wired('xuser');
    const portfolio = openAndFund(world, 'xuser');
    const denied = world.platform.authorizeRead(portfolio.portfolioId, 'cust_someone_else');
    assert.equal(denied.outcome, 'DENIED');
    if (denied.outcome === 'DENIED') {
      assert.equal(denied.code, 'RESOURCE_NOT_OWNED');
    }
    const grow = world.platform.growPortfolio('cust_someone_else');
    assert.equal(grow.outcome, 'DENIED');
  });
});

describe('ledger reservation and settlement', () => {
  it('posts a reservation onto PENDING_SETTLEMENT and can release it', () => {
    const world = wired('resv');
    const portfolio = openAndFund(world, 'resv');
    const overlay = overlayReservation({
      reservationId: 'res_test',
      portfolioId: portfolio.portfolioId,
      proposalId: 'prop_res',
      brokerageCashAccountId: world.brokerage.id,
      pendingSettlementAccountId: world.pending.id,
      amount: Money.fromMinorUnits(10_000n, 'USD'),
      createdAt: world.clock.now(),
    });
    assert.equal(reservedTotal([overlay], 'USD').minorUnits, 10_000n);
    const fundIntent = {
      id: asIntentId('resv_auth'),
      actionType: ACTION_TYPES.FUND_BROKERAGE_CASH,
      idempotencyKey: 'resv_auth_reserve',
      actorId: 'operator_1',
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_INVESTMENT' as const,
      payload: {
        accountId: world.brokerage.id,
        sourceAccountId: world.demand.id,
        amount: Money.fromMinorUnits(1n, 'USD'),
      },
    };
    const gated = world.investments.fundBrokerageCash(fundIntent);
    assert.equal(gated.outcome, 'OK');
    const authority = world.runtime.issuer.issue({
      authorityId: 'ea_resv_ledger',
      actionType: ACTION_TYPES.FUND_BROKERAGE_CASH,
      accountId: world.brokerage.id,
      intentId: asIntentId('resv_auth_post'),
      idempotencyKey: 'resv_ledger_post',
      amount: Money.fromMinorUnits(10_000n, 'USD'),
      issuedAt: world.clock.now(),
      expiresAt: addMs(world.clock.now(), 60_000n),
    });
    const posted = postReservationJournal(
      world.runtime.ledger,
      world.investments.store.getProfile(asInvestmentAccountId('inv_resv'))!,
      overlay,
      authority,
      ACTION_TYPES.FUND_BROKERAGE_CASH,
    );
    assert.equal(posted.state, 'LEDGER_POSTED');
    assert.ok(posted.journalId);
    const pending = world.runtime.ledger.listPostingsForAccount(world.pending.id);
    assert.ok(pending.some((row) => row.direction === 'CREDIT'));
    assert.ok(brokerageToPendingBridge());
    assert.equal(typeof postInvestmentJournal, 'function');
    assert.equal(portfolioFromProfile(world.investments.store.getProfile(asInvestmentAccountId('inv_resv'))!).portfolioId, asPortfolioId('pf_inv_resv'));
  });
});
