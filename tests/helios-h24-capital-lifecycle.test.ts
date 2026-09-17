import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asAccountId } from '../packages/domain/src/account.ts';
import { asCurrencyCode } from '../packages/domain/src/currency.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../packages/domain/src/legal-entity.ts';
import { asProductId } from '../packages/domain/src/product.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  asInstrumentId,
  asInvestmentAccountId,
  type InvestmentAccountId,
} from '../packages/investments/src/ids.ts';
import { freezeSettlement } from '../packages/investments/src/settlement.ts';
import { InvestmentsService } from '../packages/investments/src/service.ts';
import { Money } from '../packages/money/src/money.ts';
import { ModelRegistry, seedCanonicalRiskModel } from '../packages/model-registry/src/registry.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES, type CreatePaperOrderIntent } from '../packages/permissions/src/action-types.ts';
import { defaultSimulationBudget, RiskEngine } from '../packages/risk/src/engine.ts';
import {
  HeliosCapitalLifecycleService,
  runCapitalReconciliation,
  type DestinationVerificationPort,
  type InvestmentLifecyclePort,
  type MandateLifecycleContext,
} from '../packages/platform/src/helios/capital-lifecycle/index.ts';
import { workOrderIdFor } from '../packages/platform/src/helios/ids.ts';
import { seedSimulationCatalog } from '../services/accounts/src/catalog.ts';
import { createSimulationRuntime } from '../services/accounts/src/runtime.ts';
import { activateCustomer, openIntent } from '../services/accounts/src/test-helpers.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-17T12:00:00.000Z');
const TEN_SHARES = '1000000000';
const FOUR_SHARES = '400000000';

type H24Harness = {
  readonly clock: FrozenClock;
  readonly investments: InvestmentsService;
  readonly lifecycle: HeliosCapitalLifecycleService;
  readonly investmentPort: InvestmentLifecyclePort;
  readonly actorId: string;
  readonly customerId: string;
  readonly customerBId: string;
  readonly investmentAccountId: InvestmentAccountId;
  readonly brokerageAccountId: string;
  readonly demandAccountId: string;
  readonly destAccountId: string;
  readonly mandate: { current: MandateLifecycleContext };
};

function mustOpen<T extends { outcome: string }>(result: T): Extract<T, { outcome: 'OPENED' }> {
  if (result.outcome !== 'OPENED') {
    throw new Error(`account open failed: ${result.outcome}`);
  }
  return result as Extract<T, { outcome: 'OPENED' }>;
}

function createInvestmentPort(
  investments: InvestmentsService,
  investmentAccountId: InvestmentAccountId,
  ledger: { listPostingsForAccount(accountId: string): readonly { direction: string; amount: { minorUnits: bigint } }[] },
): InvestmentLifecyclePort {
  const profile = investments.store.getProfile(investmentAccountId);
  if (!profile) {
    throw new Error('profile required');
  }
  return Object.freeze({
    createPaperOrder(intent: CreatePaperOrderIntent) {
      const result = investments.createPaperOrder(intent);
      if (result.outcome === 'OK') {
        return {
          outcome: 'OK' as const,
          value: { orderId: result.value.orderId, fillId: result.value.fillId ?? undefined },
          authorityId: result.decision.executionAuthority?.authorityId ?? null,
        };
      }
      if (result.outcome === 'KERNEL_REFUSED') {
        return { outcome: 'KERNEL_REFUSED' as const, message: 'Kernel refused' };
      }
      return { outcome: 'REJECTED' as const, code: result.code, message: result.message };
    },
    settleInvestment(input) {
      const result = investments.settleInvestment({
        id: asIntentId(`I_settle_${input.settlementId}`),
        actionType: ACTION_TYPES.SETTLE_INVESTMENT,
        idempotencyKey: input.idempotencyKey,
        actorId: input.actorId,
        requestedAt: input.now,
        purpose: 'CUSTOMER_INVESTMENT',
        payload: { settlementId: input.settlementId, accountId: profile.brokerageCashAccountId },
      });
      if (result.outcome === 'OK') {
        return { outcome: 'OK' as const, value: { settlementId: result.value.settlementId }, replay: result.replay };
      }
      if (result.outcome === 'KERNEL_REFUSED') {
        return { outcome: 'KERNEL_REFUSED' as const, message: 'Kernel refused' };
      }
      return { outcome: 'REJECTED' as const, code: result.code, message: result.message };
    },
    withdrawBrokerageCash(input) {
      const result = investments.withdrawBrokerageCash({
        id: asIntentId(`I_wd_${input.idempotencyKey}`),
        actionType: ACTION_TYPES.WITHDRAW_BROKERAGE_CASH,
        idempotencyKey: input.idempotencyKey,
        actorId: input.actorId,
        requestedAt: input.now,
        purpose: 'CUSTOMER_INVESTMENT',
        payload: {
          accountId: asAccountId(input.brokerageAccountId),
          destinationAccountId: asAccountId(input.destinationAccountId),
          amount: Money.fromMinorUnitsString(input.amountMinor, input.currency),
        },
      });
      if (result.outcome === 'OK') {
        return { outcome: 'OK' as const, value: { journalId: result.value.journalId }, replay: result.replay };
      }
      if (result.outcome === 'KERNEL_REFUSED') {
        return { outcome: 'KERNEL_REFUSED' as const, message: 'Kernel refused' };
      }
      return { outcome: 'REJECTED' as const, code: result.code, message: result.message };
    },
    reconcileInvestmentAccount(accountId) {
      const recon = investments.reconcile(accountId as InvestmentAccountId);
      return { result: recon.result, findings: recon.findings, reconciliationId: recon.reconciliationId };
    },
    listSettlements(accountId) {
      return investments.store.listSettlements(accountId as InvestmentAccountId).map((row) =>
        Object.freeze({
          settlementId: row.settlementId,
          fillId: row.fillId,
          state: row.state,
          side: row.side,
          cashAmountMinor: row.cashAmount.minorUnits.toString(),
          currency: row.cashAmount.currency,
        }),
      );
    },
    listPositions(accountId) {
      return investments.store.listPositions(accountId as InvestmentAccountId).map((row) =>
        Object.freeze({
          instrumentId: row.instrumentId,
          quantityUnits: row.quantity.units.toString(),
          settledQuantityUnits: row.settledQuantity.units.toString(),
        }),
      );
    },
    brokerageCashBalance(brokerageAccountId, currency) {
      void currency;
      let credits = 0n;
      let debits = 0n;
      for (const posting of ledger.listPostingsForAccount(brokerageAccountId)) {
        if (posting.direction === 'CREDIT') {
          credits += posting.amount.minorUnits;
        } else {
          debits += posting.amount.minorUnits;
        }
      }
      return (credits - debits).toString();
    },
    pendingSettlementTotal(accountId, currency) {
      void currency;
      return investments.store
        .listSettlements(accountId as InvestmentAccountId)
        .filter((row) => row.state === 'PENDING_SETTLEMENT')
        .reduce((sum, row) => sum + row.cashAmount.minorUnits, 0n)
        .toString();
    },
    investmentCustomerId(accountId) {
      return investments.store.getProfile(accountId as InvestmentAccountId)?.customerId ?? null;
    },
  });
}

function verifiedDestinations(
  destinations: Readonly<Record<string, import('../packages/domain/src/customer.ts').CustomerId>>,
): DestinationVerificationPort {
  return {
    verify(input) {
      const ownerId = destinations[input.destinationId];
      if (!ownerId) {
        return { ok: false, code: 'DESTINATION_UNVERIFIED', message: 'destination is not verified' };
      }
      if (ownerId !== input.customerId) {
        return { ok: false, code: 'DESTINATION_UNVERIFIED', message: 'destination owner does not match customer' };
      }
      return {
        ok: true,
        destination: Object.freeze({
          destinationId: input.destinationId,
          coordinateRef: `coord_${input.destinationId}`,
          verified: true,
          ownerId,
        }),
      };
    },
  };
}

function setupHarness(customerSuffix = 'h24_a'): H24Harness {
  const clock = new FrozenClock(NOW);
  const runtime = createSimulationRuntime({ clock, provisionSimulatedActor: true });
  const customerId = `cust_${customerSuffix}`;
  const customerBId = `cust_${customerSuffix}_b`;
  const customer = activateCustomer(runtime, customerId);
  activateCustomer(runtime, customerBId);
  const seeded = seedSimulationCatalog();
  const demand = mustOpen(
    runtime.accountsService.open(openIntent({ id: `${customerId}_d`, accountId: `acct_${customerId}_d`, ownerId: customer.id })),
  );
  const brokerage = mustOpen(
    runtime.accountsService.open(
      openIntent({
        id: `${customerId}_b`,
        accountId: `acct_${customerId}_b`,
        ownerId: customer.id,
        productId: asProductId('prod_brokerage_cash_usd_gb'),
        accountClass: 'BROKERAGE_CASH',
      }),
    ),
  );
  const securities = mustOpen(
    runtime.accountsService.open(
      openIntent({
        id: `${customerId}_s`,
        accountId: `acct_${customerId}_s`,
        ownerId: customer.id,
        productId: asProductId('prod_securities_usd_gb'),
        accountClass: 'SECURITIES',
      }),
    ),
  );
  const pending = mustOpen(
    runtime.accountsService.open(
      openIntent({
        id: `${customerId}_p`,
        accountId: `acct_${customerId}_p`,
        ownerId: customer.id,
        productId: asProductId('prod_pending_usd_gb'),
        accountClass: 'PENDING_SETTLEMENT',
      }),
    ),
  );
  const destAccountId = `acct_${customerSuffix}_dest`;
  mustOpen(
    runtime.accountsService.open(
      openIntent({ id: `${customerId}_dest`, accountId: destAccountId, ownerId: customer.id }),
    ),
  );

  const deposit = runtime.money.deposit({
    id: asIntentId(`${customerId}_dep`),
    actionType: ACTION_TYPES.POST_DEPOSIT,
    idempotencyKey: `${customerId}_dep`,
    actorId: 'operator_1',
    requestedAt: clock.now(),
    purpose: 'CUSTOMER_FUNDING',
    payload: { accountId: demand.account.id, amount: Money.fromMinorUnits(1_000_000n, 'USD') },
  });
  if (deposit.outcome !== 'POSTED') throw new Error('deposit');

  const actorId = `actor_${customerId}`;
  const provisioned = runtime.identity.provisionSimulatedActor({
    actorId,
    identityId: `id_${customerSuffix}`,
    jurisdiction: asJurisdiction('US'),
    customerId: asCustomerId(customerId),
    capabilities: ['VIEW_ACCOUNT', 'INVESTMENT_OPERATE_REQUEST', 'INVESTMENT_PROPOSE'],
    stepUp: true,
  });
  if (!provisioned.ok) throw new Error('actor');

  const actor = runtime.identity.service.resolveActorContext(actorId);
  if (!actor.ok) throw new Error('actor context');
  const registry = new ModelRegistry();
  const model = seedCanonicalRiskModel(registry, actor.value, clock.now());
  if (!model.ok) throw new Error('risk model');
  const riskEngine = new RiskEngine({ clock, registry, events: runtime.events, evidence: runtime.evidence });
  const investmentAccountId = asInvestmentAccountId(`inv_${customerId}`);

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
    { riskEngine },
  );
  investments.setSimulatedPrice(asInstrumentId('SIM-ETF-1'), 10_000n, 'USD');

  assert.equal(
    investments.openInvestmentAccount({
      id: asIntentId(`${customerId}_open`),
      actionType: ACTION_TYPES.OPEN_INVESTMENT_ACCOUNT,
      idempotencyKey: `${customerId}_open`,
      actorId,
      requestedAt: clock.now(),
      purpose: 'CUSTOMER_INVESTMENT',
      payload: {
        accountId: demand.account.id,
        investmentAccountId,
        customerId: asCustomerId(customerId),
        brokerageCashAccountId: brokerage.account.id,
        securitiesAccountId: securities.account.id,
        pendingSettlementAccountId: pending.account.id,
        productId: asProductId('prod_brokerage_cash_usd_gb'),
        legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
        jurisdiction: asJurisdiction('US'),
        currency: asCurrencyCode('USD'),
      },
    }).outcome,
    'OK',
  );
  assert.equal(
    investments.fundBrokerageCash({
      id: asIntentId(`${customerId}_fund`),
      actionType: ACTION_TYPES.FUND_BROKERAGE_CASH,
      idempotencyKey: `${customerId}_fund`,
      actorId,
      requestedAt: clock.now(),
      purpose: 'CUSTOMER_INVESTMENT',
      payload: {
        accountId: asAccountId(brokerage.account.id),
        sourceAccountId: asAccountId(demand.account.id),
        amount: Money.fromMinorUnits(500_000n, 'USD'),
      },
    }).outcome,
    'OK',
  );

  riskEngine.store.putBudget(
    defaultSimulationBudget({ subjectId: `id_${customerSuffix}`, portfolioId: investmentAccountId, reviewBy: clock.now() }),
  );

  const buy = investments.createPaperOrder({
    id: asIntentId(`${customerId}_buy`),
    actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
    idempotencyKey: `${customerId}_buy`,
    actorId,
    requestedAt: clock.now(),
    purpose: 'CUSTOMER_INVESTMENT',
    payload: {
      accountId: asAccountId(brokerage.account.id),
      investmentAccountId,
      orderId: `ord_${customerId}_buy`,
      instrumentId: asInstrumentId('SIM-ETF-1'),
      side: 'BUY',
      quantityUnits: TEN_SHARES,
      orderType: 'MARKET_SIMULATION',
    },
  });
  if (buy.outcome !== 'OK') throw new Error('buy');

  const mandate = {
    current: Object.freeze({
      mandateActive: true,
      growPaused: false,
      liquidityRetentionMinor: '0',
      reinvestmentPermitted: true,
    }),
  };

  const investmentPort = createInvestmentPort(investments, investmentAccountId, runtime.ledger);
  const lifecycle = new HeliosCapitalLifecycleService({
    clock,
    investments: investmentPort,
    destinations: verifiedDestinations({ [destAccountId]: asCustomerId(customerId) }),
    mandate: () => mandate.current,
    evidence: runtime.evidence,
  });

  return Object.freeze({
    clock,
    investments,
    lifecycle,
    investmentPort,
    actorId,
    customerId,
    customerBId,
    investmentAccountId,
    brokerageAccountId: brokerage.account.id,
    demandAccountId: demand.account.id,
    destAccountId,
    mandate,
  });
}

function buildExitIntent(
  world: H24Harness,
  suffix: string,
  quantityUnits: string,
): CreatePaperOrderIntent {
  return Object.freeze({
    id: asIntentId(`I_exit_${suffix}`),
    actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
    idempotencyKey: `exit_${suffix}`,
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_INVESTMENT',
    payload: Object.freeze({
      accountId: asAccountId(world.brokerageAccountId),
      investmentAccountId: world.investmentAccountId,
      orderId: `ord_exit_${suffix}`.slice(0, 48),
      instrumentId: asInstrumentId('SIM-ETF-1'),
      side: 'SELL',
      quantityUnits,
      orderType: 'MARKET_SIMULATION',
    }),
  });
}

function reconcileMatched(world: H24Harness): void {
  const run = world.lifecycle.runPeriodicReconciliation({
    customerId: asCustomerId(world.customerId),
    investmentAccountId: world.investmentAccountId,
  });
  assert.equal(run.outcome, 'MATCHED');
}

describe('helios h24 capital lifecycle', () => {
  it('passes architecture guard', () => {
    assert.equal(lintHeliosBoundary(process.cwd()).length, 0);
  });

  it('1 partial exit reduces position and records typed reason', () => {
    const world = setupHarness('partial');
    reconcileMatched(world);
    const exit = world.lifecycle.requestExit({
      customerId: asCustomerId(world.customerId),
      investmentAccountId: world.investmentAccountId,
      brokerageAccountId: world.brokerageAccountId,
      workOrderId: workOrderIdFor(world.customerId, 'partial'),
      instrumentId: 'SIM-ETF-1',
      exitType: 'PARTIAL_CLOSE',
      reason: 'RISK_REDUCTION',
      quantityUnits: FOUR_SHARES,
      actorId: world.actorId,
      providerRoute: 'sim-investments',
      idempotencyKey: 'partial_exit_1',
      orderIntent: buildExitIntent(world, 'partial_1', FOUR_SHARES),
    });
    assert.equal(exit.ok, true);
    if (exit.ok) {
      assert.equal(exit.value.exitType, 'PARTIAL_CLOSE');
      assert.equal(exit.value.reason, 'RISK_REDUCTION');
      assert.equal(exit.value.remainingQuantityUnits, '600000000');
      assert.ok(exit.value.orderId);
    }
    const position = world.investments.store.getPosition(world.investmentAccountId, asInstrumentId('SIM-ETF-1'));
    assert.equal(position?.quantity.units, 600_000_000n);
  });

  it('2 full exit closes entire position', () => {
    const world = setupHarness('full');
    reconcileMatched(world);
    const position = world.investments.store.getPosition(world.investmentAccountId, asInstrumentId('SIM-ETF-1'));
    assert.ok(position);
    const exit = world.lifecycle.requestExit({
      customerId: asCustomerId(world.customerId),
      investmentAccountId: world.investmentAccountId,
      brokerageAccountId: world.brokerageAccountId,
      workOrderId: workOrderIdFor(world.customerId, 'full'),
      instrumentId: 'SIM-ETF-1',
      exitType: 'FULL_CLOSE',
      reason: 'USER_REQUEST',
      quantityUnits: position.quantity.units.toString(),
      actorId: world.actorId,
      providerRoute: 'sim-investments',
      idempotencyKey: 'full_exit_1',
      orderIntent: buildExitIntent(world, 'full_1', position.quantity.units.toString()),
    });
    assert.equal(exit.ok, true);
    if (exit.ok) {
      assert.equal(exit.value.remainingQuantityUnits, '0');
      assert.equal(exit.value.exitType, 'FULL_CLOSE');
    }
    const after = world.investments.store.getPosition(world.investmentAccountId, asInstrumentId('SIM-ETF-1'));
    assert.equal(after?.quantity.units, 0n);
  });

  it('3 exit settlement advances lifecycle stage', () => {
    const world = setupHarness('settle');
    const fill = [...world.investments.store.listFills()][0];
    assert.ok(fill);
    const pending = freezeSettlement({
      settlementId: `set_pending_${fill.fillId}`,
      fillId: fill.fillId,
      investmentAccountId: world.investmentAccountId,
      side: fill.side,
      quantity: fill.quantity,
      cashAmount: fill.grossNotional,
      feeAmount: fill.explicitFee,
      state: 'PENDING_SETTLEMENT',
      tradeAt: fill.filledAt,
      settleAfter: NOW,
      settledAt: null,
      cashJournalId: null,
      settlementJournalId: null,
      settlementDelayDays: 2n,
    });
    world.investments.store.putSettlement(pending);

    const exit = world.lifecycle.requestExit({
      customerId: asCustomerId(world.customerId),
      investmentAccountId: world.investmentAccountId,
      brokerageAccountId: world.brokerageAccountId,
      workOrderId: workOrderIdFor(world.customerId, 'settle'),
      instrumentId: 'SIM-ETF-1',
      exitType: 'PARTIAL_CLOSE',
      reason: 'STRATEGY_EXIT',
      quantityUnits: FOUR_SHARES,
      actorId: world.actorId,
      providerRoute: 'sim-investments',
      idempotencyKey: 'settle_exit_1',
      orderIntent: buildExitIntent(world, 'settle_1', FOUR_SHARES),
    });
    assert.equal(exit.ok, true);
    if (!exit.ok) return;

    if (exit.value.settlementId) {
      world.investments.store.putSettlement(
        freezeSettlement({
          ...pending,
          settlementId: exit.value.settlementId,
          state: 'PENDING_SETTLEMENT',
          settledAt: null,
        }),
      );
    }

    const advanced = world.lifecycle.advanceExitSettlement(exit.value.exitRequestId);
    assert.equal(advanced.ok, true);
    if (advanced.ok) {
      assert.equal(advanced.value.stage, 'SETTLED');
    }
  });

  it('4 reinvest only after settlement and reconciliation', () => {
    const world = setupHarness('reinvest');
    const before = world.lifecycle.evaluateReinvest({
      customerId: asCustomerId(world.customerId),
      investmentAccountId: world.investmentAccountId,
      brokerageAccountId: world.brokerageAccountId,
      currency: 'USD',
      requestedMinor: '50000',
    });
    assert.equal(before.eligible, false);
    assert.ok(before.refusalCodes.includes('UNRECONCILED'));

    const run = world.lifecycle.runPeriodicReconciliation({
      customerId: asCustomerId(world.customerId),
      investmentAccountId: world.investmentAccountId,
    });
    assert.equal(run.outcome, 'MATCHED');

    const after = world.lifecycle.evaluateReinvest({
      customerId: asCustomerId(world.customerId),
      investmentAccountId: world.investmentAccountId,
      brokerageAccountId: world.brokerageAccountId,
      currency: 'USD',
      requestedMinor: '50000',
    });
    assert.equal(after.eligible, true);
    assert.equal(after.requiresNewAuthority, true);
  });

  it('5 current authority revalidated for reinvestment', () => {
    const world = setupHarness('auth');
    reconcileMatched(world);
    world.mandate.current = Object.freeze({
      mandateActive: false,
      growPaused: false,
      liquidityRetentionMinor: '0',
      reinvestmentPermitted: true,
    });
    const result = world.lifecycle.evaluateReinvest({
      customerId: asCustomerId(world.customerId),
      investmentAccountId: world.investmentAccountId,
      brokerageAccountId: world.brokerageAccountId,
      currency: 'USD',
      requestedMinor: '10000',
    });
    assert.equal(result.eligible, false);
    assert.ok(result.refusalCodes.includes('MANDATE_INACTIVE'));
    assert.equal(result.requiresNewAuthority, true);
  });

  it('6 valid withdrawal uses server withdrawable cash', () => {
    const world = setupHarness('wd_ok');
    reconcileMatched(world);
    const cash = world.lifecycle.withdrawableCash({
      customerId: asCustomerId(world.customerId),
      investmentAccountId: world.investmentAccountId,
      brokerageAccountId: world.brokerageAccountId,
      currency: 'USD',
    });
    assert.equal(cash.serverCalculated, true);
    assert.ok(BigInt(cash.withdrawableMinor) > 0n);

    const wd = world.lifecycle.requestWithdrawal({
      customerId: asCustomerId(world.customerId),
      sourceAccountId: world.brokerageAccountId,
      investmentAccountId: world.investmentAccountId,
      destinationId: world.destAccountId,
      amountMinor: '10000',
      currency: 'USD',
      operationId: 'op_wd_ok_1',
      fundingRail: 'INTERNAL_TRANSFER',
      mandateRef: null,
      actorId: world.actorId,
      idempotencyKey: 'wd_ok_1',
    });
    assert.equal(wd.ok, true);
    if (wd.ok) {
      assert.equal(wd.value.state, 'SUBMITTED');
      assert.ok(wd.value.journalId);
    }
  });

  it('7 insufficient withdrawable cash rejected', () => {
    const world = setupHarness('wd_insuf');
    reconcileMatched(world);
    const cash = world.lifecycle.withdrawableCash({
      customerId: asCustomerId(world.customerId),
      investmentAccountId: world.investmentAccountId,
      brokerageAccountId: world.brokerageAccountId,
      currency: 'USD',
    });
    const wd = world.lifecycle.requestWithdrawal({
      customerId: asCustomerId(world.customerId),
      sourceAccountId: world.brokerageAccountId,
      investmentAccountId: world.investmentAccountId,
      destinationId: world.destAccountId,
      amountMinor: (BigInt(cash.withdrawableMinor) + 1n).toString(),
      currency: 'USD',
      operationId: 'op_wd_insuf',
      fundingRail: 'INTERNAL_TRANSFER',
      mandateRef: null,
      actorId: world.actorId,
      idempotencyKey: 'wd_insuf',
    });
    assert.equal(wd.ok, false);
    if (!wd.ok) {
      assert.equal(wd.error.code, 'INSUFFICIENT_WITHDRAWABLE');
    }
  });

  it('8 unverified destination rejected', () => {
    const world = setupHarness('wd_dest');
    reconcileMatched(world);
    const wd = world.lifecycle.requestWithdrawal({
      customerId: asCustomerId(world.customerId),
      sourceAccountId: world.brokerageAccountId,
      investmentAccountId: world.investmentAccountId,
      destinationId: 'acct_unverified_external',
      amountMinor: '1000',
      currency: 'USD',
      operationId: 'op_wd_dest',
      fundingRail: 'ACH',
      mandateRef: null,
      actorId: world.actorId,
      idempotencyKey: 'wd_dest',
    });
    assert.equal(wd.ok, false);
    if (!wd.ok) {
      assert.equal(wd.error.code, 'DESTINATION_UNVERIFIED');
    }
  });

  it('9 duplicate withdrawal retry reconciles first', () => {
    const world = setupHarness('wd_dup');
    reconcileMatched(world);
    const first = world.lifecycle.requestWithdrawal({
      customerId: asCustomerId(world.customerId),
      sourceAccountId: world.brokerageAccountId,
      investmentAccountId: world.investmentAccountId,
      destinationId: world.destAccountId,
      amountMinor: '5000',
      currency: 'USD',
      operationId: 'op_wd_dup',
      fundingRail: 'INTERNAL_TRANSFER',
      mandateRef: null,
      actorId: world.actorId,
      idempotencyKey: 'wd_dup_1',
    });
    assert.equal(first.ok, true);

    const replay = world.lifecycle.requestWithdrawal({
      customerId: asCustomerId(world.customerId),
      sourceAccountId: world.brokerageAccountId,
      investmentAccountId: world.investmentAccountId,
      destinationId: world.destAccountId,
      amountMinor: '5000',
      currency: 'USD',
      operationId: 'op_wd_dup',
      fundingRail: 'INTERNAL_TRANSFER',
      mandateRef: null,
      actorId: world.actorId,
      idempotencyKey: 'wd_dup_1',
    });
    assert.equal(replay.ok, true);

    const duplicateOp = world.lifecycle.requestWithdrawal({
      customerId: asCustomerId(world.customerId),
      sourceAccountId: world.brokerageAccountId,
      investmentAccountId: world.investmentAccountId,
      destinationId: world.destAccountId,
      amountMinor: '5000',
      currency: 'USD',
      operationId: 'op_wd_dup',
      fundingRail: 'INTERNAL_TRANSFER',
      mandateRef: null,
      actorId: world.actorId,
      idempotencyKey: 'wd_dup_2',
    });
    assert.equal(duplicateOp.ok, false);
    if (!duplicateOp.ok) {
      assert.equal(duplicateOp.error.code, 'DUPLICATE_WITHDRAWAL');
    }
  });

  it('10 timeout after withdrawal submission does not duplicate effect on idempotent replay', () => {
    const world = setupHarness('wd_timeout');
    reconcileMatched(world);
    const submitted = world.lifecycle.requestWithdrawal({
      customerId: asCustomerId(world.customerId),
      sourceAccountId: world.brokerageAccountId,
      investmentAccountId: world.investmentAccountId,
      destinationId: world.destAccountId,
      amountMinor: '3000',
      currency: 'USD',
      operationId: 'op_wd_timeout',
      fundingRail: 'INTERNAL_TRANSFER',
      mandateRef: null,
      actorId: world.actorId,
      idempotencyKey: 'wd_timeout_key',
    });
    assert.equal(submitted.ok, true);
    const journalsBefore = world.investments.store.fundingJournalId('wd_timeout_key');
    assert.ok(journalsBefore);

    const replay = world.lifecycle.requestWithdrawal({
      customerId: asCustomerId(world.customerId),
      sourceAccountId: world.brokerageAccountId,
      investmentAccountId: world.investmentAccountId,
      destinationId: world.destAccountId,
      amountMinor: '3000',
      currency: 'USD',
      operationId: 'op_wd_timeout_retry',
      fundingRail: 'INTERNAL_TRANSFER',
      mandateRef: null,
      actorId: world.actorId,
      idempotencyKey: 'wd_timeout_key',
    });
    assert.equal(replay.ok, true);
    if (replay.ok) {
      assert.equal(replay.value.journalId, journalsBefore);
    }
  });

  it('11 mismatch detection surfaces discrepancies', () => {
    const world = setupHarness('mismatch');
    const run = runCapitalReconciliation({
      customerId: asCustomerId(world.customerId),
      investmentAccountId: world.investmentAccountId,
      investments: world.investmentPort,
      now: world.clock.now(),
      injectMismatch: true,
    });
    assert.equal(run.outcome, 'MISMATCH');
    assert.ok(run.mismatchKinds.includes('CASH_DISCREPANCY'));
    assert.equal(run.findings.some((f) => f.includes('CASH_MISMATCH')), true);
  });

  it('12 mismatch blocks unsafe availability', () => {
    const world = setupHarness('block');
    world.lifecycle.store.putReconciliation(
      runCapitalReconciliation({
        customerId: asCustomerId(world.customerId),
        investmentAccountId: world.investmentAccountId,
        investments: world.investmentPort,
        now: world.clock.now(),
        injectMismatch: true,
      }),
    );
    const cash = world.lifecycle.withdrawableCash({
      customerId: asCustomerId(world.customerId),
      investmentAccountId: world.investmentAccountId,
      brokerageAccountId: world.brokerageAccountId,
      currency: 'USD',
    });
    assert.equal(cash.withdrawableMinor, '0');
    assert.ok(BigInt(cash.ledgerSettledMinor) > 0n);
  });

  it('13 periodic reconciliation runs for grow account', () => {
    const world = setupHarness('periodic');
    const first = world.lifecycle.runPeriodicReconciliation({
      customerId: asCustomerId(world.customerId),
      investmentAccountId: world.investmentAccountId,
    });
    const second = world.lifecycle.runPeriodicReconciliation({
      customerId: asCustomerId(world.customerId),
      investmentAccountId: world.investmentAccountId,
    });
    assert.equal(first.outcome, 'MATCHED');
    assert.equal(second.outcome, 'MATCHED');
    assert.equal(world.lifecycle.store.listReconciliations(world.investmentAccountId).length, 2);
  });

  it('14 withdrawal/reinvestment race resolves atomically', () => {
    const world = setupHarness('race');
    reconcileMatched(world);
    const cash = world.lifecycle.withdrawableCash({
      customerId: asCustomerId(world.customerId),
      investmentAccountId: world.investmentAccountId,
      brokerageAccountId: world.brokerageAccountId,
      currency: 'USD',
    });
    const available = BigInt(cash.withdrawableMinor);
    assert.ok(available >= 200_000n);

    const reserveAmount = ((available * 8n) / 10n).toString();
    const withdrawAmount = ((available * 7n) / 10n).toString();

    const reserve = world.lifecycle.reserveCapital({
      customerId: asCustomerId(world.customerId),
      accountId: world.brokerageAccountId,
      investmentAccountId: world.investmentAccountId,
      kind: 'REINVESTMENT',
      amountMinor: reserveAmount,
      currency: 'USD',
      operationId: 'race_reinvest',
    });
    assert.equal(reserve.ok, true);

    const wd = world.lifecycle.requestWithdrawal({
      customerId: asCustomerId(world.customerId),
      sourceAccountId: world.brokerageAccountId,
      investmentAccountId: world.investmentAccountId,
      destinationId: world.destAccountId,
      amountMinor: withdrawAmount,
      currency: 'USD',
      operationId: 'race_wd',
      fundingRail: 'INTERNAL_TRANSFER',
      mandateRef: null,
      actorId: world.actorId,
      idempotencyKey: 'race_wd',
    });
    assert.equal(wd.ok, false);
    if (!wd.ok) {
      assert.equal(wd.error.code, 'INSUFFICIENT_WITHDRAWABLE');
    }
  });

  it('15 pause blocks new reinvestment but not settlement path', () => {
    const world = setupHarness('pause');
    reconcileMatched(world);
    world.mandate.current = Object.freeze({
      mandateActive: true,
      growPaused: true,
      liquidityRetentionMinor: '0',
      reinvestmentPermitted: true,
    });
    const reinvest = world.lifecycle.evaluateReinvest({
      customerId: asCustomerId(world.customerId),
      investmentAccountId: world.investmentAccountId,
      brokerageAccountId: world.brokerageAccountId,
      currency: 'USD',
      requestedMinor: '10000',
    });
    assert.equal(reinvest.eligible, false);
    assert.ok(reinvest.refusalCodes.includes('GROW_PAUSED'));

    const wd = world.lifecycle.requestWithdrawal({
      customerId: asCustomerId(world.customerId),
      sourceAccountId: world.brokerageAccountId,
      investmentAccountId: world.investmentAccountId,
      destinationId: world.destAccountId,
      amountMinor: '5000',
      currency: 'USD',
      operationId: 'pause_wd',
      fundingRail: 'INTERNAL_TRANSFER',
      mandateRef: null,
      actorId: world.actorId,
      idempotencyKey: 'pause_wd',
    });
    assert.equal(wd.ok, true);
  });

  it('16 restart at multiple stages preserves idempotent state', () => {
    const world = setupHarness('restart');
    reconcileMatched(world);
    const exit = world.lifecycle.requestExit({
      customerId: asCustomerId(world.customerId),
      investmentAccountId: world.investmentAccountId,
      brokerageAccountId: world.brokerageAccountId,
      workOrderId: workOrderIdFor(world.customerId, 'restart'),
      instrumentId: 'SIM-ETF-1',
      exitType: 'PARTIAL_CLOSE',
      reason: 'SYSTEM_CLOSE_POLICY',
      quantityUnits: FOUR_SHARES,
      actorId: world.actorId,
      providerRoute: 'sim-investments',
      idempotencyKey: 'restart_exit',
      orderIntent: buildExitIntent(world, 'restart', FOUR_SHARES),
    });
    assert.equal(exit.ok, true);

    const checkpoint = world.lifecycle.store.snapshot();
    const recovered = world.lifecycle.recoverFromCheckpoint();
    assert.equal(recovered.recovered, true);
    assert.equal(recovered.checkpoint.exits.length, checkpoint.exits.length);

    const replay = world.lifecycle.requestExit({
      customerId: asCustomerId(world.customerId),
      investmentAccountId: world.investmentAccountId,
      brokerageAccountId: world.brokerageAccountId,
      workOrderId: workOrderIdFor(world.customerId, 'restart'),
      instrumentId: 'SIM-ETF-1',
      exitType: 'PARTIAL_CLOSE',
      reason: 'SYSTEM_CLOSE_POLICY',
      quantityUnits: FOUR_SHARES,
      actorId: world.actorId,
      providerRoute: 'sim-investments',
      idempotencyKey: 'restart_exit',
      orderIntent: buildExitIntent(world, 'restart_replay', FOUR_SHARES),
    });
    assert.equal(replay.ok, true);
    if (replay.ok && exit.ok) {
      assert.equal(replay.value.exitRequestId, exit.value.exitRequestId);
    }
  });

  it('17 customer isolation prevents cross-customer exit and withdrawal', () => {
    const world = setupHarness('iso');
    reconcileMatched(world);
    const otherExit = world.lifecycle.requestExit({
      customerId: asCustomerId(world.customerBId),
      investmentAccountId: world.investmentAccountId,
      brokerageAccountId: world.brokerageAccountId,
      workOrderId: workOrderIdFor(world.customerBId, 'iso'),
      instrumentId: 'SIM-ETF-1',
      exitType: 'FULL_CLOSE',
      reason: 'OTHER',
      quantityUnits: TEN_SHARES,
      actorId: world.actorId,
      providerRoute: 'sim-investments',
      idempotencyKey: 'iso_exit_b',
      orderIntent: buildExitIntent(world, 'iso_b', TEN_SHARES),
    });
    assert.equal(otherExit.ok, false);
    if (!otherExit.ok) {
      assert.equal(otherExit.error.code, 'CUSTOMER_MISMATCH');
    }

    const wd = world.lifecycle.requestWithdrawal({
      customerId: asCustomerId(world.customerBId),
      sourceAccountId: world.brokerageAccountId,
      investmentAccountId: world.investmentAccountId,
      destinationId: world.destAccountId,
      amountMinor: '1000',
      currency: 'USD',
      operationId: 'iso_wd_b',
      fundingRail: 'INTERNAL_TRANSFER',
      mandateRef: null,
      actorId: world.actorId,
      idempotencyKey: 'iso_wd_b',
    });
    assert.equal(wd.ok, false);
    if (!wd.ok) {
      assert.equal(wd.error.code, 'DESTINATION_UNVERIFIED');
    }
  });
});
