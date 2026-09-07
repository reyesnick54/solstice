import assert from 'node:assert/strict';
import test from 'node:test';

import { DurableInternalPaymentSurface } from '../../services/api/src/consumer/durable-internal-payments.ts';
import { ensureDurableSandboxCoreState } from '../../services/api/src/consumer/durable-account-state.ts';
import { ensureDurableSandboxTransferCapability } from '../../services/api/src/consumer/durable-transfer-capability.ts';
import type { BffPrincipal } from '../../services/api/src/consumer/ports.ts';
import {
  createDurableRuntime,
  persistenceAvailable,
  preparePersistence,
} from './helpers.ts';

const principal: BffPrincipal = Object.freeze({
  actorId: 'actor_sandbox_grow',
  customerId: 'cust_sandbox_grow',
  identityId: 'idn_sandbox_grow',
  sessionId: 'test-session',
  jurisdiction: 'GB',
  verification: 'VERIFIED',
  customerStatus: 'ACTIVE',
  identityStatus: 'ACTIVE',
  capabilities: Object.freeze(['VIEW_ACCOUNT', 'PAYMENT_REQUEST', 'TRANSFER_REQUEST']),
  risk: 'LOW',
  restricted: false,
  sandboxPersona: 'grow',
  deviceSummary: Object.freeze({ deviceId: null, trustState: 'KNOWN' }),
});

test(
  'durable same-owner internal transfer survives restart and idempotent replay does not double-post',
  { skip: !persistenceAvailable() },
  async () => {
    const env = await preparePersistence();
    let durable = await createDurableRuntime(env);
    await ensureDurableSandboxCoreState(durable);
    const capability = await ensureDurableSandboxTransferCapability(durable);
    assert.ok(capability.eligibleActors > 0);

    let surface = new DurableInternalPaymentSurface(durable);
    const sourceId = 'acct_sandbox_grow_checking';
    const destinationId = 'acct_sandbox_grow_savings';
    const beforeSource = durable.runtime.ledger.projectAccountBalance(sourceId).posted.minorUnits;
    const beforeDestination = durable.runtime.ledger.projectAccountBalance(destinationId).posted.minorUnits;
    const beforeJournalCount = durable.runtime.ledger.journalCount();

    const first = await surface.create(principal, {
      sourceAccountId: sourceId,
      destinationAccountId: destinationId,
      amountMinorUnits: '1234',
      currency: 'USD',
      idempotencyKey: 'idem_persistence_internal_transfer_1',
      paymentId: 'pay_persistence_internal_transfer_1',
      purpose: 'Persistence qualification',
    });
    assert.equal(first.outcome, 'OK');
    if (first.outcome !== 'OK') throw new Error('transfer did not post');
    assert.equal(first.replay, false);
    assert.equal(
      durable.runtime.ledger.projectAccountBalance(sourceId).posted.minorUnits,
      beforeSource - 1234n,
    );
    assert.equal(
      durable.runtime.ledger.projectAccountBalance(destinationId).posted.minorUnits,
      beforeDestination + 1234n,
    );
    assert.equal(durable.runtime.ledger.journalCount(), beforeJournalCount + 1);

    durable = await durable.restart();
    surface = new DurableInternalPaymentSurface(durable);

    assert.equal(
      durable.runtime.ledger.projectAccountBalance(sourceId).posted.minorUnits,
      beforeSource - 1234n,
    );
    assert.equal(
      durable.runtime.ledger.projectAccountBalance(destinationId).posted.minorUnits,
      beforeDestination + 1234n,
    );
    const afterRestartJournalCount = durable.runtime.ledger.journalCount();

    const persisted = await surface.get(principal, 'pay_persistence_internal_transfer_1');
    assert.ok(persisted);
    assert.equal(persisted?.status, 'SETTLED');
    assert.equal(persisted?.journalId, first.value.journalId);

    const replay = await surface.create(principal, {
      sourceAccountId: sourceId,
      destinationAccountId: destinationId,
      amountMinorUnits: '1234',
      currency: 'USD',
      idempotencyKey: 'idem_persistence_internal_transfer_1',
      paymentId: 'pay_persistence_internal_transfer_1',
      purpose: 'Persistence qualification',
    });
    assert.equal(replay.outcome, 'OK');
    if (replay.outcome !== 'OK') throw new Error('replay was rejected');
    assert.equal(replay.replay, true);
    assert.equal(durable.runtime.ledger.journalCount(), afterRestartJournalCount);
    assert.equal(
      durable.runtime.ledger.projectAccountBalance(sourceId).posted.minorUnits,
      beforeSource - 1234n,
    );
    assert.equal(
      durable.runtime.ledger.projectAccountBalance(destinationId).posted.minorUnits,
      beforeDestination + 1234n,
    );

    const listed = await surface.list(principal);
    assert.equal(listed.filter((item) => item.paymentId === 'pay_persistence_internal_transfer_1').length, 1);

    await durable.close();
  },
);
