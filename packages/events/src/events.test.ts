import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asAccountId } from '../../domain/src/account.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asUtcInstant } from '../../domain/src/time.ts';

import { InboxProcessor, InMemoryInboxStore } from './consumer.ts';
import { OutboxDispatcher } from './dispatcher.ts';
import { asEventId, sealEnvelope, serializeEnvelope } from './envelope.ts';
import { DomainEventLog } from './events.ts';
import { EventHandlerBypassError, refuseDirectFinancialMutation } from './gate.ts';
import { InMemoryDeadLetterStore, InMemoryOutboxStore, outboxRecordFromEnvelope } from './memory-outbox.ts';
import { OutOfOrderEventError, checkAggregateOrder } from './ordering.ts';
import { UnsupportedEventVersionError, resolveEventSchema } from './schema.ts';
import { InProcessTransport } from './transport.ts';

const NOW = asUtcInstant('2026-08-14T10:00:00.000Z');

describe('durable event envelope', () => {
  it('seals VersionedEvent with identity, correlation, and schemaRef', () => {
    const log = new DomainEventLog();
    const event = log.append({
      eventType: 'AccountOpened',
      schemaVersion: 1,
      occurredAt: NOW,
      intentId: 'I-100',
      causationId: 'K-200',
      jurisdiction: 'GB',
      payload: {
        accountId: asAccountId('acct_1'),
        ownerId: asCustomerId('cust_1'),
        accountClass: 'DEMAND_DEPOSIT',
        executionAuthorityId: 'ea_1',
        intentId: 'I-100',
      },
    });
    assert.ok(event.eventId.length > 0);
    assert.equal(event.eventVersion, 1);
    assert.equal(event.schemaRef, 'solstice.account.opened/1');
    assert.equal(event.aggregateType, 'account');
    assert.equal(event.aggregateId, 'acct_1');
    assert.equal(event.aggregateSequence, 1);
    assert.equal(event.correlationId, 'I-100');
    assert.equal(event.causationId, 'K-200');
  });

  it('seals a security key rotation event with metadata only', () => {
    const log = new DomainEventLog();
    const event = log.append({
      eventType: 'KeyRotated',
      schemaVersion: 1,
      occurredAt: NOW,
      payload: {
        keyId: 'sim:execution_authority_signing',
        purpose: 'EXECUTION_AUTHORITY_SIGNING',
        version: 2,
        previousVersion: 1,
        status: 'ACTIVE',
        provider: 'simulation',
        providerRef: 'secret://simulation/keys/execution_authority_signing/v2',
      },
    });
    assert.equal(event.schemaRef, 'solstice.security.key_rotated/1');
    assert.equal(event.aggregateType, 'key');
    assert.equal(event.payload.previousVersion, 1);
  });

  it('rejects sensitive payload keys', () => {
    assert.throws(
      () =>
        sealEnvelope(
          {
            eventType: 'AccountOpened',
            schemaVersion: 1,
            occurredAt: NOW,
            payload: { password: 'secret' },
          },
          1,
        ),
      /sensitive field/,
    );
  });
});

describe('schema versioning', () => {
  it('treats unknown versions as unsupported', () => {
    assert.equal(resolveEventSchema('AccountOpened', 1), 'CURRENT');
    assert.equal(resolveEventSchema('AccountOpened', 99), 'UNSUPPORTED');
  });
});

describe('ordering', () => {
  it('detects out-of-order aggregate delivery', () => {
    const first = sealEnvelope(
      {
        eventType: 'DepositPosted',
        schemaVersion: 1,
        occurredAt: NOW,
        aggregateType: 'account',
        aggregateId: 'acct_1',
        aggregateSequence: 1,
        payload: { journalId: 'j1', accountId: 'acct_1', amountMinorUnits: '1', currency: 'USD' },
      },
      1,
    );
    const second = { ...first, aggregateSequence: 3, eventId: asEventId('evt-3') };
    assert.equal(checkAggregateOrder(undefined, first).status, 'IN_ORDER');
    assert.equal(checkAggregateOrder(1, second).status, 'OUT_OF_ORDER');
  });
});

describe('inbox idempotency', () => {
  it('applies a consumer effect once for duplicate delivery', async () => {
    const inbox = new InMemoryInboxStore();
    const processor = new InboxProcessor(inbox, { now: () => NOW });
    let effects = 0;
    const consumer = {
      consumerId: 'projection.deposit-count',
      eventTypes: ['DepositPosted'],
      handle() {
        effects += 1;
      },
    };
    const envelope = sealEnvelope(
      {
        eventType: 'DepositPosted',
        schemaVersion: 1,
        occurredAt: NOW,
        eventId: 'evt-dup',
        payload: { journalId: 'j1', accountId: 'acct_1', amountMinorUnits: '1', currency: 'USD' },
      },
      1,
    );
    assert.equal(await processor.process(consumer, envelope), 'applied');
    assert.equal(await processor.process(consumer, envelope), 'duplicate');
    assert.equal(effects, 1);
  });
});

describe('dispatcher retry and dead letter', () => {
  it('retries then dead-letters a repeatedly failing publish', async () => {
    const outbox = new InMemoryOutboxStore();
    const dead = new InMemoryDeadLetterStore();
    let nowMs = Date.parse(NOW);
    const clock = {
      now: () => new Date(nowMs).toISOString(),
      nowMs: () => nowMs,
    };
    const transport = {
      name: 'failing',
      async publish() {
        throw new Error('transport down');
      },
    };
    const dispatcher = new OutboxDispatcher(outbox, dead, transport, {
      workerId: 'w1',
      clock,
      policy: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 },
    });
    const envelope = sealEnvelope(
      {
        eventType: 'AccountOpened',
        schemaVersion: 1,
        occurredAt: NOW,
        eventId: 'evt-dlq',
        payload: {
          accountId: 'acct_1',
          ownerId: 'cust_1',
          accountClass: 'DEMAND_DEPOSIT',
          executionAuthorityId: 'ea',
          intentId: 'i1',
        },
      },
      1,
    );
    await outbox.enqueue(outboxRecordFromEnvelope(envelope, NOW));
    const first = await dispatcher.dispatchOnce();
    assert.equal(first.retried, 1);
    nowMs += 10;
    const second = await dispatcher.dispatchOnce();
    assert.equal(second.deadLettered, 1);
    const stored = await dead.getByEventId('evt-dlq');
    assert.ok(stored);
    assert.equal(stored.reasonCode.length > 0, true);
  });
});

describe('in-process publish after crash-safe enqueue', () => {
  it('publishes a committed outbox row after a dispatcher restart', async () => {
    const outbox = new InMemoryOutboxStore();
    const dead = new InMemoryDeadLetterStore();
    const transport = new InProcessTransport();
    const envelope = sealEnvelope(
      {
        eventType: 'DepositPosted',
        schemaVersion: 1,
        occurredAt: NOW,
        eventId: 'evt-restart',
        payload: { journalId: 'j1', accountId: 'acct_1', amountMinorUnits: '5', currency: 'USD' },
      },
      1,
    );
    await outbox.enqueue(outboxRecordFromEnvelope(envelope, NOW));
    const clock = { now: () => NOW, nowMs: () => Date.parse(NOW) };
    const first = new OutboxDispatcher(outbox, dead, transport, { workerId: 'w-crash', clock });
    void first;
    const restarted = new OutboxDispatcher(outbox, dead, transport, { workerId: 'w-restart', clock });
    const result = await restarted.dispatchOnce();
    assert.equal(result.published, 1);
    assert.equal(transport.listPublished()[0]?.eventId, 'evt-restart');
  });
});

describe('event handler financial gate', () => {
  it('refuses a direct ledger mutation from an event handler', () => {
    assert.throws(() => refuseDirectFinancialMutation(), EventHandlerBypassError);
  });
});

describe('unsupported version fails safely', () => {
  it('does not invoke the consumer handle path', async () => {
    const inbox = new InMemoryInboxStore();
    const processor = new InboxProcessor(inbox, { now: () => NOW });
    let effects = 0;
    const consumer = {
      consumerId: 'safe.version',
      handle() {
        effects += 1;
      },
    };
    const envelope = {
      ...sealEnvelope(
        {
          eventType: 'AccountOpened',
          schemaVersion: 1,
          occurredAt: NOW,
          eventId: 'evt-bad-ver',
          payload: {
            accountId: 'acct_1',
            ownerId: 'cust_1',
            accountClass: 'DEMAND_DEPOSIT',
            executionAuthorityId: 'ea',
            intentId: 'i1',
          },
        },
        1,
      ),
      eventVersion: 99 as 1,
      schemaVersion: 99 as 1,
    };
    await assert.rejects(() => processor.process(consumer, envelope), UnsupportedEventVersionError);
    assert.equal(effects, 0);
  });
});

describe('out-of-order consumer', () => {
  it('fails safely when sequence jumps', async () => {
    const inbox = new InMemoryInboxStore();
    const processor = new InboxProcessor(inbox, { now: () => NOW, enforceOrder: true });
    const consumer = { consumerId: 'order.account', handle() {} };
    const first = sealEnvelope(
      {
        eventType: 'DepositPosted',
        schemaVersion: 1,
        occurredAt: NOW,
        eventId: 'evt-o1',
        aggregateType: 'account',
        aggregateId: 'acct_1',
        aggregateSequence: 1,
        payload: { journalId: 'j1', accountId: 'acct_1', amountMinorUnits: '1', currency: 'USD' },
      },
      1,
    );
    const third = { ...first, eventId: asEventId('evt-o3'), aggregateSequence: 3 };
    assert.equal(await processor.process(consumer, first), 'applied');
    await assert.rejects(() => processor.process(consumer, third), OutOfOrderEventError);
  });
});

describe('serialize round-trip', () => {
  it('preserves event identity', () => {
    const envelope = sealEnvelope(
      {
        eventType: 'KernelDecisionRecorded',
        schemaVersion: 1,
        occurredAt: NOW,
        eventId: 'evt-k',
        intentId: 'I-100',
        payload: {
          intentId: 'I-100',
          actionType: 'OPEN_ACCOUNT',
          status: 'ALLOW',
          evidenceRecordId: 'E-400',
          executionAuthorityId: 'ea',
        },
      },
      1,
    );
    const json = serializeEnvelope(envelope);
    assert.match(json, /"eventId":"evt-k"/);
  });
});
