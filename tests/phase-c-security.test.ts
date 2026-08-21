import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { CAPABILITIES, ENVIRONMENT } from '../packages/config/src/flags.ts';
import { PRODUCTION_ACTIVE, PRODUCTION_READY_DEFAULT, LIVE_CONNECTIVITY_ENABLED } from '../packages/sunrey-chain/src/production-handoff/engineering-closure/types.ts';
import { createPhaseCWorld } from './phase-c-world.ts';
import { ACTION_TYPES } from '../packages/permissions/src/action-types.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { Money } from '../packages/money/src/money.ts';
import { asAccountId } from '../packages/domain/src/account.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Phase C security and authority', () => {
  it('keeps production disabled and simulation providers inert in production posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(CAPABILITIES.LIVE_MONEY_ENABLED, false);
    assert.equal(CAPABILITIES.LIVE_PAYMENTS_ENABLED, false);
    assert.equal(CAPABILITIES.LIVE_BANKING_RAILS, false);
    assert.equal(PRODUCTION_READY_DEFAULT, false);
    assert.equal(PRODUCTION_ACTIVE, false);
    assert.equal(LIVE_CONNECTIVITY_ENABLED, false);
    const flags = readFileSync(join(ROOT, 'packages/config/src/flags.ts'), 'utf8');
    assert.equal(flags.includes("ENVIRONMENT = 'simulation'"), true);
    assert.equal(/LIVE_MONEY_ENABLED = true/.test(flags), false);
  });

  it('denies cross-user payment initiation and keeps balances ledger-originated', () => {
    const world = createPhaseCWorld('sec', 200_000n);
    const stranger = world.runtime.identity.provisionSimulatedActor({
      actorId: 'actor_stranger_sec',
      customerId: asCustomerId('cust_stranger_sec'),
      jurisdiction: world.account.jurisdiction,
      capabilities: ['PAYMENT_REQUEST', 'FX_QUOTE_REQUEST', 'MANAGE_BENEFICIARY'],
    });
    assert.equal(stranger.ok, true);
    const quote = world.payments.createQuote({
      id: asIntentId('q_stranger'),
      actionType: ACTION_TYPES.CREATE_FX_QUOTE,
      idempotencyKey: 'q_stranger',
      actorId: 'actor_stranger_sec',
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_FX',
      payload: {
        quoteId: 'quote_stranger',
        accountId: world.account.id,
        baseCurrency: world.account.currency,
        quoteCurrency: world.sarAccount.currency,
        sourceAmount: Money.fromMinorUnits(10_000n, 'USD'),
        corridorId: 'US-SA-USD-SAR',
      },
    });
    assert.notEqual(quote.outcome, 'OK');
  });

  it('does not expose Execution Authority or a client ledger-post path', () => {
    const client = readFileSync(join(ROOT, 'packages/sunrey-sdk/src/consumer-platform/client.ts'), 'utf8');
    assert.equal(client.includes('postJournal'), false);
    assert.equal(client.includes('ExecutionAuthority'), false);
    assert.equal(client.includes('AuthorityIssuer'), false);
    const runtime = readFileSync(join(ROOT, 'services/consumer-platform/src/runtime.ts'), 'utf8');
    assert.equal(runtime.includes('issuer.issue('), false);
  });

  it('refuses a restricted self-approved transfer when capability is absent', () => {
    const world = createPhaseCWorld('sec2', 50_000n);
    const denied = world.runtime.identity.provisionSimulatedActor({
      actorId: 'actor_no_xfer',
      jurisdiction: world.account.jurisdiction,
      customerId: world.customer.id,
      capabilities: ['VIEW_ACCOUNT'],
    });
    assert.equal(denied.ok, true);
    const result = world.runtime.money.transfer({
      id: asIntentId('xfer_denied'),
      actionType: ACTION_TYPES.INTERNAL_TRANSFER,
      idempotencyKey: 'xfer_denied',
      actorId: 'actor_no_xfer',
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_TRANSFER',
      payload: {
        sourceAccountId: world.account.id,
        destinationAccountId: asAccountId(world.sarAccount.id),
        amount: Money.fromMinorUnits(1_000n, 'USD'),
      },
    });
    assert.notEqual(result.outcome, 'POSTED');
  });
});
