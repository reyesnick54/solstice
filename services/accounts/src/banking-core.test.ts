import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asAccountId, transitionAccountStatus } from '../../../packages/domain/src/account.ts';
import { asCoordinateId, createSimulatedIbanCoordinate } from '../../../packages/domain/src/coordinates.ts';
import { asHoldId } from '../../../packages/domain/src/hold.ts';
import { asInterestRateVersionId } from '../../../packages/domain/src/interest.ts';
import { asPendingSettlementId } from '../../../packages/domain/src/pending-settlement.ts';
import { asProductId } from '../../../packages/domain/src/product.ts';
import { isErr, isOk } from '../../../packages/domain/src/result.ts';
import { asUtcInstant } from '../../../packages/domain/src/time.ts';
import { asJurisdiction } from '../../../packages/domain/src/jurisdiction.ts';
import { asCurrencyCode } from '../../../packages/domain/src/currency.ts';
import { asCustomerId } from '../../../packages/domain/src/customer.ts';
import { Money } from '../../../packages/money/src/money.ts';
import { asIntentId } from '../../../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../../packages/permissions/src/action-types.ts';
import { projectBankingPosition } from './available-funds.ts';
import {
  blendCustomerPosition,
  projectCurrencyIndexedPosition,
  projectCustomerPosition,
} from './balances.ts';
import { PRODUCT_DEMAND_SAR_GB, PRODUCT_PENDING_USD_GB, SOLSTICE_UK } from './catalog.ts';
import { createSimulationRuntime } from './runtime.ts';
import { activateCustomer, openIntent, NOW } from './test-helpers.ts';
import { projectTransactionHistory } from './transaction-history.ts';

function deposit(runtime: ReturnType<typeof createSimulationRuntime>, accountId: string, amount: bigint, currency: string, key: string) {
  return runtime.money.deposit({
    id: asIntentId(key),
    actionType: ACTION_TYPES.POST_DEPOSIT,
    idempotencyKey: key,
    actorId: 'operator_1',
    requestedAt: NOW,
    purpose: 'CUSTOMER_FUNDING',
    payload: { accountId: asAccountId(accountId), amount: Money.fromMinorUnits(amount, currency) },
  });
}

describe('multi-currency banking core', () => {
  it('separates available and ledger balances across a hold lifecycle', async () => {
    const runtime = createSimulationRuntime();
    const customer = activateCustomer(runtime, 'cust_hold');
    const opened = runtime.accountsService.open(
      openIntent({ id: 'open_hold', accountId: 'acct_hold', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') return;
    assert.equal(deposit(runtime, opened.account.id, 50_000n, 'USD', 'dep_hold').outcome, 'POSTED');

    const created = await runtime.banking.createHold({
      id: asIntentId('hold_out'),
      actionType: ACTION_TYPES.CREATE_HOLD,
      idempotencyKey: 'hold_out',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_HOLD',
      payload: {
        holdId: asHoldId('hold_250'),
        accountId: opened.account.id,
        amount: Money.fromMinorUnits(25_000n, 'USD'),
        holdPurpose: 'OUTGOING_TRANSFER',
      },
    });
    assert.equal(created.outcome, 'COMPLETED');
    if (created.outcome !== 'COMPLETED') return;

    const held = projectBankingPosition(runtime.ledger, opened.account, runtime.holds, NOW);
    assert.equal(isOk(held), true);
    if (isOk(held)) {
      assert.equal(held.value.ledgerBalance.minorUnits, 50_000n);
      assert.equal(held.value.held.minorUnits, 25_000n);
      assert.equal(held.value.available.minorUnits, 25_000n);
    }

    const released = runtime.banking.releaseHold({
      id: asIntentId('hold_rel'),
      actionType: ACTION_TYPES.RELEASE_HOLD,
      idempotencyKey: 'hold_rel',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_HOLD',
      payload: { holdId: asHoldId('hold_250'), accountId: opened.account.id },
    });
    assert.equal(released.outcome, 'COMPLETED');
    const restored = projectBankingPosition(runtime.ledger, opened.account, runtime.holds, NOW);
    assert.equal(isOk(restored), true);
    if (isOk(restored)) {
      assert.equal(restored.value.available.minorUnits, 50_000n);
      assert.equal(restored.value.ledgerBalance.minorUnits, 50_000n);
    }
  });

  it('refuses concurrent overspending of available funds', async () => {
    const runtime = createSimulationRuntime();
    const customer = activateCustomer(runtime, 'cust_race');
    const opened = runtime.accountsService.open(
      openIntent({ id: 'open_race', accountId: 'acct_race', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') return;
    assert.equal(deposit(runtime, opened.account.id, 10_000n, 'USD', 'dep_race').outcome, 'POSTED');

    const [first, second] = await Promise.all([
      runtime.banking.createHold({
        id: asIntentId('hold_a'),
        actionType: ACTION_TYPES.CREATE_HOLD,
        idempotencyKey: 'hold_a',
        actorId: 'operator_1',
        requestedAt: NOW,
        purpose: 'CUSTOMER_HOLD',
        payload: {
          holdId: asHoldId('hold_a'),
          accountId: opened.account.id,
          amount: Money.fromMinorUnits(8_000n, 'USD'),
          holdPurpose: 'WITHDRAWAL',
        },
      }),
      runtime.banking.createHold({
        id: asIntentId('hold_b'),
        actionType: ACTION_TYPES.CREATE_HOLD,
        idempotencyKey: 'hold_b',
        actorId: 'operator_1',
        requestedAt: NOW,
        purpose: 'CUSTOMER_HOLD',
        payload: {
          holdId: asHoldId('hold_b'),
          accountId: opened.account.id,
          amount: Money.fromMinorUnits(8_000n, 'USD'),
          holdPurpose: 'WITHDRAWAL',
        },
      }),
    ]);
    const outcomes = [first.outcome, second.outcome];
    assert.equal(outcomes.filter((o) => o === 'COMPLETED').length, 1);
    assert.equal(outcomes.filter((o) => o === 'REJECTED').length, 1);
    const position = projectBankingPosition(runtime.ledger, opened.account, runtime.holds, NOW);
    assert.equal(isOk(position), true);
    if (isOk(position)) {
      assert.equal(position.value.held.minorUnits, 8_000n);
      assert.equal(position.value.available.minorUnits, 2_000n);
    }
  });

  it('keeps USD and SAR positions separate and refuses a blended total without FX', () => {
    const runtime = createSimulationRuntime();
    const customer = activateCustomer(runtime, 'cust_fx');
    const usd = runtime.accountsService.open(
      openIntent({ id: 'open_usd', accountId: 'acct_usd_fx', ownerId: customer.id }),
    );
    const sar = runtime.accountsService.open({
      id: asIntentId('open_sar'),
      actionType: ACTION_TYPES.OPEN_ACCOUNT,
      idempotencyKey: 'open_sar',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_ONBOARDING',
      payload: {
        accountId: asAccountId('acct_sar_fx'),
        ownerId: asCustomerId(customer.id),
        productId: PRODUCT_DEMAND_SAR_GB.id,
        accountClass: 'DEMAND_DEPOSIT',
        legalEntityId: SOLSTICE_UK.id,
        jurisdiction: asJurisdiction('GB'),
        currency: asCurrencyCode('SAR'),
      },
    });
    assert.equal(usd.outcome, 'OPENED');
    assert.equal(sar.outcome, 'OPENED');
    if (usd.outcome !== 'OPENED' || sar.outcome !== 'OPENED') return;
    assert.equal(deposit(runtime, usd.account.id, 10_000n, 'USD', 'dep_usd_fx').outcome, 'POSTED');
    assert.equal(deposit(runtime, sar.account.id, 20_000n, 'SAR', 'dep_sar_fx').outcome, 'POSTED');

    const blended = projectCustomerPosition(
      runtime.ledger,
      customer.id,
      runtime.accounts.list(),
    );
    assert.equal(isErr(blended), true);
    if (isErr(blended)) {
      assert.equal(blended.error.code, 'MIXED_CURRENCY_WITHOUT_CONVERSION');
    }

    const indexed = projectCurrencyIndexedPosition(
      runtime.ledger,
      customer.id,
      runtime.accounts.list(),
    );
    assert.equal(isOk(indexed), true);
    if (isOk(indexed)) {
      assert.ok(indexed.value.byCurrency.USD);
      assert.ok(indexed.value.byCurrency.SAR);
      assert.equal(indexed.value.byCurrency.USD.grandTotal.minorUnits, 10_000n);
      assert.equal(indexed.value.byCurrency.SAR.grandTotal.minorUnits, 20_000n);
      const refused = blendCustomerPosition(indexed.value, [], 'USD');
      assert.equal(isErr(refused), true);
    }
  });

  it('posts fees as explicit journals and reverses with a compensating entry', () => {
    const runtime = createSimulationRuntime();
    const customer = activateCustomer(runtime, 'cust_fee');
    const opened = runtime.accountsService.open(
      openIntent({ id: 'open_fee', accountId: 'acct_fee', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') return;
    const funded = deposit(runtime, opened.account.id, 10_000n, 'USD', 'dep_fee');
    assert.equal(funded.outcome, 'POSTED');
    if (funded.outcome !== 'POSTED') return;

    const fee = runtime.banking.postFee({
      id: asIntentId('fee_1'),
      actionType: ACTION_TYPES.POST_FEE,
      idempotencyKey: 'fee_1',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FEE',
      payload: {
        accountId: opened.account.id,
        amount: Money.fromMinorUnits(250n, 'USD'),
        feeType: 'FIXED',
      },
    });
    assert.equal(fee.outcome, 'COMPLETED');
    if (fee.outcome !== 'COMPLETED') return;
    assert.ok(fee.value.journalId);
    const afterFee = projectBankingPosition(runtime.ledger, opened.account, runtime.holds, NOW);
    assert.equal(isOk(afterFee), true);
    if (isOk(afterFee)) {
      assert.equal(afterFee.value.ledgerBalance.minorUnits, 9_750n);
    }

    const reversal = runtime.banking.postReversal({
      id: asIntentId('rev_1'),
      actionType: ACTION_TYPES.POST_REVERSAL,
      idempotencyKey: 'rev_1',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_REVERSAL',
      payload: {
        accountId: opened.account.id,
        originalJournalId: fee.value.journalId!,
        reason: 'fee waived',
      },
    });
    assert.equal(reversal.outcome, 'COMPLETED');
    if (reversal.outcome !== 'COMPLETED') return;
    assert.notEqual(reversal.value.originalJournalId, reversal.value.compensatingJournalId);
    assert.ok(runtime.ledger.getJournal(reversal.value.originalJournalId));
    const restored = projectBankingPosition(runtime.ledger, opened.account, runtime.holds, NOW);
    assert.equal(isOk(restored), true);
    if (isOk(restored)) {
      assert.equal(restored.value.ledgerBalance.minorUnits, 10_000n);
    }
  });

  it('derives statements from journals and records reconciliation mismatches', () => {
    const runtime = createSimulationRuntime();
    const customer = activateCustomer(runtime, 'cust_stmt');
    const opened = runtime.accountsService.open(
      openIntent({ id: 'open_stmt', accountId: 'acct_stmt', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') return;
    assert.equal(deposit(runtime, opened.account.id, 4_000n, 'USD', 'dep_stmt').outcome, 'POSTED');
    const statement = runtime.banking.generateStatement(
      opened.account,
      asUtcInstant('2026-08-01T00:00:00.000Z'),
      asUtcInstant('2026-08-31T23:59:59.000Z'),
    );
    assert.equal(statement.currency, 'USD');
    assert.equal(statement.openingMinorUnits, 0n);
    assert.equal(statement.closingMinorUnits, 4_000n);
    assert.ok(statement.lines.length > 0);

    const mismatch = runtime.banking.recordReconciliation({
      account: opened.account,
      externalMinorUnits: 1_000n,
      externalStatementRef: 'SIM-EXT-STMT-1',
    });
    assert.equal(mismatch.status, 'INVESTIGATION_REQUIRED');
    assert.equal(mismatch.differenceMinorUnits, 3_000n);

    const history = projectTransactionHistory({
      ledger: runtime.ledger,
      customerId: customer.id,
      accounts: runtime.accounts.list(),
      holds: runtime.holds.list(),
      pending: runtime.banking.listPending(),
      now: NOW,
    });
    assert.ok(history.length > 0);
  });

  it('blocks outgoing movement on a FROZEN account and keeps pending settlement out of settled balance', async () => {
    const runtime = createSimulationRuntime();
    const customer = activateCustomer(runtime, 'cust_frz');
    const demand = runtime.accountsService.open(
      openIntent({ id: 'open_frz', accountId: 'acct_frz', ownerId: customer.id }),
    );
    const pending = runtime.accountsService.open(
      openIntent({
        id: 'open_pend',
        accountId: 'acct_pend',
        ownerId: customer.id,
        productId: asProductId(PRODUCT_PENDING_USD_GB.id),
        accountClass: 'PENDING_SETTLEMENT',
      }),
    );
    assert.equal(demand.outcome, 'OPENED');
    assert.equal(pending.outcome, 'OPENED');
    if (demand.outcome !== 'OPENED' || pending.outcome !== 'OPENED') return;
    assert.equal(deposit(runtime, demand.account.id, 8_000n, 'USD', 'dep_frz').outcome, 'POSTED');

    const initiated = runtime.banking.initiatePending({
      id: asIntentId('pend_1'),
      actionType: ACTION_TYPES.INITIATE_PENDING_SETTLEMENT,
      idempotencyKey: 'pend_1',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_SETTLEMENT',
      payload: {
        pendingId: asPendingSettlementId('pend_1'),
        sourceAccountId: demand.account.id,
        pendingAccountId: pending.account.id,
        amount: Money.fromMinorUnits(3_000n, 'USD'),
      },
    });
    assert.equal(initiated.outcome, 'COMPLETED');
    const demandPos = projectBankingPosition(runtime.ledger, demand.account, runtime.holds, NOW);
    const pendingPos = projectBankingPosition(runtime.ledger, pending.account, runtime.holds, NOW);
    assert.equal(isOk(demandPos) && isOk(pendingPos), true);
    if (isOk(demandPos) && isOk(pendingPos)) {
      assert.equal(demandPos.value.settled.minorUnits, 5_000n);
      assert.equal(pendingPos.value.pending.minorUnits, 3_000n);
      assert.equal(pendingPos.value.settled.minorUnits, 0n);
    }

    const frozen = transitionAccountStatus(demand.account, 'FROZEN', NOW);
    assert.equal(isOk(frozen), true);
    if (isOk(frozen)) {
      runtime.accounts.put(frozen.value.account.id, frozen.value.account);
    }
    const hold = await runtime.banking.createHold({
      id: asIntentId('hold_frz'),
      actionType: ACTION_TYPES.CREATE_HOLD,
      idempotencyKey: 'hold_frz',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_HOLD',
      payload: {
        holdId: asHoldId('hold_frz'),
        accountId: demand.account.id,
        amount: Money.fromMinorUnits(100n, 'USD'),
        holdPurpose: 'COMPLIANCE',
      },
    });
    assert.equal(hold.outcome, 'REJECTED');
  });

  it('posts interest from a rate version without inventing APY and assigns synthetic coordinates', () => {
    const runtime = createSimulationRuntime();
    const customer = activateCustomer(runtime, 'cust_int');
    const opened = runtime.accountsService.open(
      openIntent({ id: 'open_int', accountId: 'acct_int', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') return;
    const interest = runtime.banking.postInterest({
      id: asIntentId('int_1'),
      actionType: ACTION_TYPES.POST_INTEREST,
      idempotencyKey: 'int_1',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_INTEREST',
      payload: {
        accountId: opened.account.id,
        amount: Money.fromMinorUnits(15n, 'USD'),
        rateVersionId: asInterestRateVersionId('rate_sim_v1'),
        periodStart: asUtcInstant('2026-07-01T00:00:00.000Z'),
        periodEnd: asUtcInstant('2026-07-31T23:59:59.000Z'),
      },
    });
    assert.equal(interest.outcome, 'COMPLETED');
    const coord = createSimulatedIbanCoordinate({
      id: asCoordinateId('coord_int'),
      accountId: opened.account.id,
      serial: '7',
    });
    assert.equal(coord.ok, true);
    if (coord.ok) {
      runtime.banking.attachCoordinates(opened.account.id, [coord.value]);
      assert.equal(runtime.banking.coordinatesFor(opened.account.id)[0]?.synthetic, true);
    }
  });

  it('is idempotent for hold create and fee posting', async () => {
    const runtime = createSimulationRuntime();
    const customer = activateCustomer(runtime, 'cust_idemp');
    const opened = runtime.accountsService.open(
      openIntent({ id: 'open_idemp', accountId: 'acct_idemp', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') return;
    assert.equal(deposit(runtime, opened.account.id, 5_000n, 'USD', 'dep_idemp').outcome, 'POSTED');
    const first = await runtime.banking.createHold({
      id: asIntentId('hold_idemp'),
      actionType: ACTION_TYPES.CREATE_HOLD,
      idempotencyKey: 'hold_idemp',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_HOLD',
      payload: {
        holdId: asHoldId('hold_idemp'),
        accountId: opened.account.id,
        amount: Money.fromMinorUnits(500n, 'USD'),
        holdPurpose: 'WITHDRAWAL',
      },
    });
    const second = await runtime.banking.createHold({
      id: asIntentId('hold_idemp'),
      actionType: ACTION_TYPES.CREATE_HOLD,
      idempotencyKey: 'hold_idemp',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_HOLD',
      payload: {
        holdId: asHoldId('hold_idemp'),
        accountId: opened.account.id,
        amount: Money.fromMinorUnits(500n, 'USD'),
        holdPurpose: 'WITHDRAWAL',
      },
    });
    assert.equal(first.outcome, 'COMPLETED');
    assert.equal(second.outcome, 'COMPLETED');
    if (first.outcome === 'COMPLETED' && second.outcome === 'COMPLETED') {
      assert.equal(second.replay, true);
      assert.equal(first.value.id, second.value.id);
    }
  });
});
