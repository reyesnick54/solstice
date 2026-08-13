import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asAccountId } from '../packages/domain/src/account.ts';
import { asProductId } from '../packages/domain/src/product.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { isOk } from '../packages/domain/src/result.ts';
import { Money } from '../packages/money/src/money.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../packages/permissions/src/action-types.ts';
import {
  activateCustomer,
  openIntent,
} from '../services/accounts/src/test-helpers.ts';
import { createSimulationRuntime } from '../services/accounts/src/runtime.ts';
import {
  balanceOfAccount,
  projectCustomerPosition,
} from '../services/accounts/src/balances.ts';
import { asCustomerId, createProspect, notStartedVerification } from '../packages/domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../packages/domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../packages/domain/src/legal-entity.ts';

const NOW = asUtcInstant('2026-08-13T15:00:00.000Z');

describe('Phase 1 exit criterion', () => {
  it('accounts open only via valid Execution Authority; balances read correctly and segregated by class; every state change produced evidence; the chain verifies; every journal balances', () => {
    const runtime = createSimulationRuntime();
    const customer = activateCustomer(runtime, 'cust_exit');

    const demand = runtime.accountsService.open(
      openIntent({ id: 'exit_open_d', accountId: 'exit_d', ownerId: customer.id }),
    );
    const savings = runtime.accountsService.open(
      openIntent({
        id: 'exit_open_s',
        accountId: 'exit_s',
        ownerId: customer.id,
        productId: asProductId('prod_savings_usd_gb'),
        accountClass: 'SAVINGS_DEPOSIT',
      }),
    );
    assert.equal(demand.outcome, 'OPENED');
    assert.equal(savings.outcome, 'OPENED');
    if (demand.outcome !== 'OPENED' || savings.outcome !== 'OPENED') {
      return;
    }
    assert.ok(demand.decision.executionAuthority);
    assert.equal('balance' in demand.account, false);

    runtime.money.deposit({
      id: asIntentId('exit_dep_1'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'exit_dep_1',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: demand.account.id, amount: Money.fromMinorUnits(10_000n, 'USD') },
    });
    runtime.money.deposit({
      id: asIntentId('exit_dep_2'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'exit_dep_2',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: demand.account.id, amount: Money.fromMinorUnits(5_000n, 'USD') },
    });
    runtime.money.withdraw({
      id: asIntentId('exit_wd'),
      actionType: ACTION_TYPES.POST_WITHDRAWAL,
      idempotencyKey: 'exit_wd',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_WITHDRAWAL',
      payload: { accountId: demand.account.id, amount: Money.fromMinorUnits(2_000n, 'USD') },
    });
    runtime.money.transfer({
      id: asIntentId('exit_xfer'),
      actionType: ACTION_TYPES.INTERNAL_TRANSFER,
      idempotencyKey: 'exit_xfer',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_TRANSFER',
      payload: {
        sourceAccountId: demand.account.id,
        destinationAccountId: asAccountId('exit_s'),
        amount: Money.fromMinorUnits(3_000n, 'USD'),
      },
    });

    const demandBal = balanceOfAccount(runtime.ledger, demand.account);
    const savingsBal = balanceOfAccount(runtime.ledger, savings.account);
    assert.equal(isOk(demandBal), true);
    assert.equal(isOk(savingsBal), true);
    if (isOk(demandBal) && isOk(savingsBal)) {
      assert.equal(demandBal.value.minorUnits, 10_000n);
      assert.equal(savingsBal.value.minorUnits, 3_000n);
    }

    const position = projectCustomerPosition(
      runtime.ledger,
      customer.id,
      runtime.accountsService.listAccounts(),
    );
    assert.equal(isOk(position), true);
    if (isOk(position)) {
      assert.equal(position.value.breakdown.deposits.total.minorUnits, 13_000n);
      assert.equal(position.value.grandTotal.minorUnits, 13_000n);
      assert.equal(position.value.breakdown.deposits.classification.insurance, 'insured');
      assert.equal('percentageReturn' in position.value, false);
    }

    const prospect = createProspect({
      id: asCustomerId('cust_exit_prospect'),
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      residency: asResidency('GB'),
      verification: notStartedVerification(asUtcInstant('2027-08-13T00:00:00.000Z')),
      createdAt: asUtcInstant('2026-01-15T09:00:00.000Z'),
    });
    runtime.customers.put(prospect.id, prospect);
    const accountsBefore = runtime.accountsService.listAccounts().length;
    const refused = runtime.accountsService.open(
      openIntent({ id: 'exit_refused', accountId: 'exit_refused', ownerId: prospect.id }),
    );
    assert.equal(refused.outcome, 'KERNEL_REFUSED');
    assert.equal(runtime.accountsService.listAccounts().length, accountsBefore);

    assert.ok(runtime.evidence.count() > 0);
    const chain = runtime.evidence.verifyChain();
    assert.equal(chain.ok, true);

    for (const [asset, totals] of runtime.ledger.totalsByAsset()) {
      assert.equal(totals.debits, totals.credits, `unbalanced ${asset}`);
    }
    assert.ok(runtime.ledger.journalCount() >= 4);
    assert.equal(runtime.growth.count(), 0);
  });
});
