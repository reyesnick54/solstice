import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { DomainEventLog } from '../../packages/events/src/index.ts';
import {
  computeRequestDigest,
  providerIdempotencyKeyFor,
  type OperationExecutionRecord,
} from '../../packages/events/src/operation/index.ts';
import {
  PostgresEventCatalog,
  PostgresOperationStore,
  persistOperationWithOutbox,
} from '../../packages/persistence/src/index.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;
const NOW = asUtcInstant('2026-08-20T11:00:00.000Z');

describePersistence('CHUNK-155 postgres operation execution', () => {
  it('commits operation state and outbox atomically', async () => {
    const env = await preparePersistence();
    const { openPersistenceSession } = await import('../../packages/persistence/src/session.ts');
    const session = openPersistenceSession(env);
    const store = new PostgresOperationStore(session.pools.ledger);
    const digest = {
      operationKind: 'PAYMENT_RAIL_SUBMIT',
      amountMinor: '1',
      assetId: 'USD',
      currency: 'USD',
      beneficiary: 'ben_1',
      destination: 'acct_1',
      providerId: 'rail_sim_a',
      network: null,
      nativeAssetId: null,
    };
    const record: OperationExecutionRecord = {
      operationId: 'op_pg_1',
      operationKind: 'PAYMENT_RAIL_SUBMIT',
      businessKey: 'pay_pg_1',
      idempotencyKey: providerIdempotencyKeyFor({
        businessKey: 'pay_pg_1',
        providerId: 'rail_sim_a',
        attemptLineage: 'lineage_1',
      }),
      requestDigest: computeRequestDigest(digest),
      correlationId: null,
      causationId: null,
      intentId: null,
      evidenceId: null,
      providerId: 'rail_sim_a',
      providerOperationRef: null,
      state: 'PREPARED',
      attemptCount: 0,
      attemptLineage: 'lineage_1',
      supersedesOperationId: null,
      nativeAssetId: null,
      preparedAt: NOW,
      firstSubmittedAt: null,
      lastObservedAt: NOW,
      confirmedAt: null,
      lastSafeErrorCode: null,
      lastSafeErrorMessage: null,
      revision: 1,
      leaseOwner: null,
      leaseUntil: null,
    };
    const event = new DomainEventLog().append({
      eventType: 'DepositPosted',
      schemaVersion: 1,
      occurredAt: NOW,
      payload: { journalId: 'j1', accountId: 'acct_1', amountMinorUnits: '1', currency: 'USD' },
    });
    await persistOperationWithOutbox(session, { record, events: [event] });
    const loaded = await store.get('op_pg_1');
    assert.equal(loaded?.state, 'PREPARED');
    const catalog = new PostgresEventCatalog(session.pools.ledger);
    assert.ok(await catalog.get(event.eventId));
    const first = await store.claimLease({
      operationId: 'op_pg_1',
      workerId: 'w1',
      now: NOW,
      leaseMs: 5_000,
    });
    const second = await store.claimLease({
      operationId: 'op_pg_1',
      workerId: 'w2',
      now: NOW,
      leaseMs: 5_000,
    });
    assert.equal(first, 'acquired');
    assert.equal(second, 'held');
    await session.close();
  });
});
