import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asAccountId } from '../../packages/domain/src/account.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { Money } from '../../packages/money/src/money.ts';
import { asIntentId } from '../../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../packages/permissions/src/action-types.ts';
import {
  InboxProcessor,
  InProcessTransport,
  OutboxDispatcher,
  OutOfOrderEventError,
  UnsupportedEventVersionError,
  parseEnvelope,
  refuseDirectFinancialMutation,
  replayEvents,
  requestConsequentialAction,
  sealEnvelope,
} from '../../packages/events/src/index.ts';
import {
  PostgresDeadLetterStore,
  PostgresEventCatalog,
  PostgresInboxStore,
  PostgresOutboxStore,
} from '../../packages/persistence/src/index.ts';
import { activateCustomer, openIntent } from '../../services/accounts/src/test-helpers.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;
const NOW = asUtcInstant('2026-08-14T10:00:00.000Z');

function fabricFor(durable: Awaited<ReturnType<typeof createDurableRuntime>>) {
  const pool = durable.session.pools.ledger;
  const outbox = new PostgresOutboxStore(pool);
  const inbox = new PostgresInboxStore(pool);
  const deadLetters = new PostgresDeadLetterStore(pool);
  const catalog = new PostgresEventCatalog(pool);
  const transport = new InProcessTransport();
  const clock = {
    now: () => durable.runtime.clock.now(),
    nowMs: () => Date.parse(durable.runtime.clock.now()),
  };
  const dispatcher = new OutboxDispatcher(outbox, deadLetters, transport, {
    workerId: 'test-dispatcher',
    clock,
    policy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 },
  });
  return { outbox, inbox, deadLetters, catalog, transport, dispatcher, clock };
}

describePersistence('Chunk 3 — durable event fabric', () => {
  it('A: committed outbox survives dispatcher crash and publishes on restart', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const customer = activateCustomer(durable.runtime, 'cust_evt_a');
    await durable.saveCustomer(customer);
    const opened = await durable.open(
      openIntent({ id: 'evt_a_open', accountId: 'evt_a_d', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');

    const first = fabricFor(durable);
    const pending = await first.outbox.list('PENDING');
    assert.ok(pending.length >= 1);
    const eventId = pending[0]!.eventId;

    const restarted = fabricFor(durable);
    const result = await restarted.dispatcher.dispatchOnce();
    assert.ok(result.published >= 1);
    const delivered = await restarted.outbox.get(eventId);
    assert.equal(delivered?.deliveryState, 'DELIVERED');
    assert.ok(restarted.transport.listPublished().some((event) => event.eventId === eventId));
    await durable.close();
  });

  it('B: duplicate delivery applies the consumer effect once', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const customer = activateCustomer(durable.runtime, 'cust_evt_b');
    await durable.saveCustomer(customer);
    await durable.open(openIntent({ id: 'evt_b_open', accountId: 'evt_b_d', ownerId: customer.id }));
    const { inbox } = fabricFor(durable);
    const processor = new InboxProcessor(inbox, { now: () => NOW });
    const opened = durable.runtime.events.list().find((event) => event.eventType === 'AccountOpened');
    assert.ok(opened);
    let effects = 0;
    const consumer = {
      consumerId: 'projection.account-opened',
      handle() {
        effects += 1;
      },
    };
    assert.equal(await processor.process(consumer, opened), 'applied');
    assert.equal(await processor.process(consumer, opened), 'duplicate');
    assert.equal(effects, 1);
    const row = await inbox.get(consumer.consumerId, opened.eventId);
    assert.equal(row?.status, 'COMPLETED');
    await durable.close();
  });

  it('C: consumer failure is retried', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const customer = activateCustomer(durable.runtime, 'cust_evt_c');
    await durable.saveCustomer(customer);
    await durable.open(openIntent({ id: 'evt_c_open', accountId: 'evt_c_d', ownerId: customer.id }));
    const { inbox } = fabricFor(durable);
    const processor = new InboxProcessor(inbox, { now: () => NOW });
    const opened = durable.runtime.events.list().find((event) => event.eventType === 'AccountOpened');
    assert.ok(opened);
    let attempts = 0;
    const consumer = {
      consumerId: 'flaky.once',
      handle() {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('temporary');
        }
      },
    };
    await assert.rejects(() => processor.process(consumer, opened), /temporary/);
    assert.equal(await processor.process(consumer, opened), 'applied');
    assert.equal(attempts, 2);
    await durable.close();
  });

  it('D: repeated failure creates a dead-letter record', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const customer = activateCustomer(durable.runtime, 'cust_evt_d');
    await durable.saveCustomer(customer);
    await durable.open(openIntent({ id: 'evt_d_open', accountId: 'evt_d_d', ownerId: customer.id }));
    const { outbox, deadLetters, dispatcher, clock } = fabricFor(durable);
    const transport = {
      name: 'always-fail',
      async publish() {
        throw new Error('permanent failure');
      },
    };
    const failing = new OutboxDispatcher(outbox, deadLetters, transport, {
      workerId: 'failing',
      clock,
      // FrozenClock never advances; a positive delay would leave next_attempt_at
      // in the future and the second claim would see no work.
      policy: { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await failing.dispatchOnce();
    await failing.dispatchOnce();
    const letters = await deadLetters.list();
    assert.ok(letters.length >= 1);
    assert.equal(letters[0]!.reasonCode.length > 0, true);
    const dead = (await outbox.list('DEAD_LETTER'))[0];
    assert.ok(dead);
    await durable.close();
  });

  it('E: explicit replay of a dead-lettered event preserves identity', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const customer = activateCustomer(durable.runtime, 'cust_evt_e');
    await durable.saveCustomer(customer);
    await durable.open(openIntent({ id: 'evt_e_open', accountId: 'evt_e_d', ownerId: customer.id }));
    const { outbox, inbox, deadLetters, catalog, clock } = fabricFor(durable);
    const pending = (await outbox.list('PENDING'))[0];
    assert.ok(pending);
    await outbox.markDeadLetter(pending.eventId, clock.now());
    await deadLetters.record({
      eventId: pending.eventId,
      eventType: 'AccountOpened',
      eventVersion: 1,
      consumerId: 'replay.target',
      attemptCount: 5,
      reasonCode: 'CONSUMER_FAILURE',
      reasonSafe: 'forced dead letter',
      createdAt: clock.now(),
      replayedAt: null,
    });
    const replayed = await replayEvents({
      catalog,
      outbox,
      inbox,
      deadLetters,
      filter: { eventId: pending.eventId, consumerId: 'replay.target' },
      now: clock.now(),
    });
    assert.equal(replayed.replayed, 1);
    assert.equal(replayed.eventIds[0], pending.eventId);
    const after = await outbox.get(pending.eventId);
    assert.equal(after?.deliveryState, 'PENDING');
    const letter = await deadLetters.getByEventId(pending.eventId);
    assert.ok(letter?.replayedAt);
    await durable.close();
  });

  it('F: unknown incompatible version fails safely', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const { inbox } = fabricFor(durable);
    const processor = new InboxProcessor(inbox, { now: () => NOW });
    let effects = 0;
    const envelope = {
      ...sealEnvelope(
        {
          eventType: 'AccountOpened',
          schemaVersion: 1,
          occurredAt: NOW,
          eventId: 'evt-incompatible',
          payload: {
            accountId: 'acct_x',
            ownerId: 'cust_x',
            accountClass: 'DEMAND_DEPOSIT',
            executionAuthorityId: 'ea',
            intentId: 'i',
          },
        },
        1,
      ),
      eventVersion: 99 as 1,
      schemaVersion: 99 as 1,
    };
    await assert.rejects(
      () =>
        processor.process(
          {
            consumerId: 'version.guard',
            handle() {
              effects += 1;
            },
          },
          envelope,
        ),
      UnsupportedEventVersionError,
    );
    assert.equal(effects, 0);
    await durable.close();
  });

  it('G: out-of-order aggregate event is detected', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const { inbox } = fabricFor(durable);
    const processor = new InboxProcessor(inbox, { now: () => NOW, enforceOrder: true });
    const first = sealEnvelope(
      {
        eventType: 'DepositPosted',
        schemaVersion: 1,
        occurredAt: NOW,
        eventId: 'evt-ord-1',
        aggregateType: 'account',
        aggregateId: 'acct_ord',
        aggregateSequence: 1,
        payload: { journalId: 'j1', accountId: 'acct_ord', amountMinorUnits: '1', currency: 'USD' },
      },
      1,
    );
    const third = { ...first, eventId: 'evt-ord-3' as typeof first.eventId, aggregateSequence: 3 };
    await processor.process({ consumerId: 'order.acct', handle() {} }, first);
    await assert.rejects(
      () => processor.process({ consumerId: 'order.acct', handle() {} }, third),
      OutOfOrderEventError,
    );
    await durable.close();
  });

  it('H: event-driven consequential action must pass through a new ActionIntent and Kernel', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const customer = activateCustomer(durable.runtime, 'cust_evt_h');
    await durable.saveCustomer(customer);
    const opened = await durable.open(
      openIntent({ id: 'evt_h_open', accountId: 'evt_h_d', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') {
      return;
    }

    assert.throws(() => refuseDirectFinancialMutation());

    const journalsBefore = durable.runtime.ledger.journalCount();
    const ports = {
      submitIntent: (intent: Parameters<typeof durable.runtime.kernel.submit>[0]) =>
        durable.runtime.kernel.submit(intent, {
          actor: {
            id: intent.actorId,
            capabilities: durable.runtime.identity.service.resolveActorContext(intent.actorId).ok
              ? [intent.actionType]
              : [],
          },
          identity: durable.runtime.identity.service.identityFactsFor(intent.actorId),
          customer,
          jurisdiction: opened.account.jurisdiction,
          amount: Money.fromMinorUnits(1_000n, 'USD'),
          sourceAccount: opened.account,
        }),
    };
    const followOn = {
      id: asIntentId('evt_h_follow'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'evt_h_follow',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING' as const,
      payload: {
        accountId: opened.account.id,
        amount: Money.fromMinorUnits(1_000n, 'USD'),
      },
    };
    const decision = requestConsequentialAction(ports, followOn);
    assert.equal(decision.status, 'ALLOW');
    assert.ok(decision.executionAuthority);
    const posted = await durable.postDeposit(followOn);
    assert.equal(posted.outcome, 'POSTED');
    assert.equal(durable.runtime.ledger.journalCount(), journalsBefore + 1);

    const chain = durable.runtime.events.list();
    const kernelEvent = chain.find((event) => event.eventType === 'KernelDecisionRecorded');
    const openedEvent = chain.find((event) => event.eventType === 'AccountOpened');
    assert.ok(kernelEvent);
    assert.ok(openedEvent);
    assert.equal(openedEvent.correlationId, 'evt_h_open');
    assert.equal(openedEvent.causationId, opened.decision.evidenceRecordId);
    await durable.close();
  });

  it('state and outbox commit atomically; restart preserves event infrastructure', async () => {
    const env = await preparePersistence();
    let durable = await createDurableRuntime(env);
    const customer = activateCustomer(durable.runtime, 'cust_evt_atom');
    await durable.saveCustomer(customer);
    await durable.open(openIntent({ id: 'evt_atom_open', accountId: 'evt_atom_d', ownerId: customer.id }));
    await durable.postDeposit({
      id: asIntentId('evt_atom_dep'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'evt_atom_dep',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING',
      payload: {
        accountId: asAccountId('evt_atom_d'),
        amount: Money.fromMinorUnits(2_000n, 'USD'),
      },
    });
    const before = durable.runtime.events.list().length;
    const { outbox } = fabricFor(durable);
    const pendingBefore = (await outbox.list()).length;
    await durable.close();

    durable = await createDurableRuntime(env);
    assert.equal(durable.runtime.events.list().length, before);
    const after = fabricFor(durable);
    assert.equal((await after.outbox.list()).length, pendingBefore);
    const deposit = durable.runtime.events.list().find((event) => event.eventType === 'DepositPosted');
    assert.ok(deposit?.eventId);
    assert.equal(parseEnvelope(JSON.stringify(deposit)).eventId, deposit.eventId);
    await durable.close();
  });
});
