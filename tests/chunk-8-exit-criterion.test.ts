import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asAccountId } from '../packages/domain/src/account.ts';
import { asCurrencyCode, CANONICAL_SIMULATION_CURRENCIES } from '../packages/domain/src/currency.ts';
import { asHoldId } from '../packages/domain/src/hold.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { isErr, isOk } from '../packages/domain/src/result.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { Money } from '../packages/money/src/money.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../packages/permissions/src/action-types.ts';
import { projectBankingPosition } from '../services/accounts/src/available-funds.ts';
import {
  blendCustomerPosition,
  projectCurrencyIndexedPosition,
} from '../services/accounts/src/balances.ts';
import { PRODUCT_DEMAND_SAR_GB, SOLSTICE_UK } from '../services/accounts/src/catalog.ts';
import { activateCustomer, createTestRuntime, openIntent, NOW } from '../services/accounts/src/test-helpers.ts';

describe('Chunk 8 exit criterion', () => {
  it('walks the multi-currency banking core without FX or external rails', async () => {
    assert.deepEqual([...CANONICAL_SIMULATION_CURRENCIES], ['USD', 'EUR', 'GBP', 'SAR', 'AED']);
    const runtime = createTestRuntime();
    const customer = activateCustomer(runtime, 'cust_chunk8');
    const usd = runtime.accountsService.open(
      openIntent({ id: 'c8_open_usd', accountId: 'c8_usd', ownerId: customer.id }),
    );
    assert.equal(usd.outcome, 'OPENED');
    if (usd.outcome !== 'OPENED') return;

    const deposited = runtime.money.deposit({
      id: asIntentId('c8_dep'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'c8_dep',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: usd.account.id, amount: Money.fromMinorUnits(50_000n, 'USD') },
    });
    assert.equal(deposited.outcome, 'POSTED');

    const hold = await runtime.banking.createHold({
      id: asIntentId('c8_hold'),
      actionType: ACTION_TYPES.CREATE_HOLD,
      idempotencyKey: 'c8_hold',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_HOLD',
      payload: {
        holdId: asHoldId('c8_hold'),
        accountId: usd.account.id,
        amount: Money.fromMinorUnits(25_000n, 'USD'),
        holdPurpose: 'OUTGOING_TRANSFER',
      },
    });
    assert.equal(hold.outcome, 'COMPLETED');
    const whileHeld = projectBankingPosition(runtime.ledger, usd.account, runtime.holds, NOW);
    assert.equal(isOk(whileHeld), true);
    if (isOk(whileHeld)) {
      assert.equal(whileHeld.value.ledgerBalance.minorUnits, 50_000n);
      assert.equal(whileHeld.value.available.minorUnits, 25_000n);
    }

    const released = runtime.banking.releaseHold({
      id: asIntentId('c8_rel'),
      actionType: ACTION_TYPES.RELEASE_HOLD,
      idempotencyKey: 'c8_rel',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_HOLD',
      payload: { holdId: asHoldId('c8_hold'), accountId: usd.account.id },
    });
    assert.equal(released.outcome, 'COMPLETED');

    const sar = runtime.accountsService.open({
      id: asIntentId('c8_open_sar'),
      actionType: ACTION_TYPES.OPEN_ACCOUNT,
      idempotencyKey: 'c8_open_sar',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_ONBOARDING',
      payload: {
        accountId: asAccountId('c8_sar'),
        ownerId: customer.id,
        productId: PRODUCT_DEMAND_SAR_GB.id,
        accountClass: 'DEMAND_DEPOSIT',
        legalEntityId: SOLSTICE_UK.id,
        jurisdiction: asJurisdiction('GB'),
        currency: asCurrencyCode('SAR'),
      },
    });
    assert.equal(sar.outcome, 'OPENED');
    if (sar.outcome !== 'OPENED') return;
    assert.equal(
      runtime.money.deposit({
        id: asIntentId('c8_sar_dep'),
        actionType: ACTION_TYPES.POST_DEPOSIT,
        idempotencyKey: 'c8_sar_dep',
        actorId: 'operator_1',
        requestedAt: NOW,
        purpose: 'CUSTOMER_FUNDING',
        payload: { accountId: sar.account.id, amount: Money.fromMinorUnits(12_000n, 'SAR') },
      }).outcome,
      'POSTED',
    );

    const indexed = projectCurrencyIndexedPosition(
      runtime.ledger,
      customer.id,
      runtime.accounts.list(),
    );
    assert.equal(isOk(indexed), true);
    if (isOk(indexed)) {
      assert.ok(indexed.value.byCurrency.USD);
      assert.ok(indexed.value.byCurrency.SAR);
      const blended = blendCustomerPosition(indexed.value, [], 'USD');
      assert.equal(isErr(blended), true);
    }

    const statement = runtime.banking.generateStatement(
      usd.account,
      asUtcInstant('2026-08-01T00:00:00.000Z'),
      asUtcInstant('2026-08-31T23:59:59.000Z'),
    );
    assert.equal(statement.closingMinorUnits, 50_000n);

    const mismatch = runtime.banking.recordReconciliation({
      account: usd.account,
      externalMinorUnits: 1n,
      externalStatementRef: 'SIM-EXT-C8',
    });
    assert.equal(mismatch.status, 'INVESTIGATION_REQUIRED');
    assert.equal(runtime.evidence.verifyChain().ok, true);
  });
});
