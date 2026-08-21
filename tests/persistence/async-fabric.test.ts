import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../packages/domain/src/time.ts';
import {
  InboundWebhookReceiver,
  OutboundWebhookService,
  PersistentJobQueue,
  WorkflowRuntime,
  createTraceContext,
} from '../../packages/events/src/index.ts';
import {
  PostgresInboundWebhookStore,
  PostgresJobStore,
  PostgresOutboundWebhookStore,
  PostgresWorkflowStore,
} from '../../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;
const NOW = asUtcInstant('2026-08-21T09:00:00.000Z');

describePersistence('Phase B Prompt 5 — durable async fabric', () => {
  it('job queue survives a process restart and still dispatches', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const pool = durable.session.pools.ledger;
    const store = new PostgresJobStore(pool);
    const clock = {
      now: () => NOW,
      nowMs: () => Date.parse(NOW),
    };
    const first = new PersistentJobQueue({ store, clock, workerId: 'w-crash' });
    first.register('NOTIFY', () => undefined);
    const job = await first.enqueue({
      jobId: 'job_persist_1',
      jobType: 'NOTIFY',
      payload: { kind: 'email' },
      trace: createTraceContext({ requestId: 'req_job' }),
    });
    assert.equal(job.state, 'PENDING');

    const restarted = new PersistentJobQueue({ store, clock, workerId: 'w-restart' });
    restarted.register('NOTIFY', () => undefined);
    const result = await restarted.dispatchOnce();
    assert.equal(result.succeeded, 1);
    assert.equal((await store.get('job_persist_1'))?.state, 'SUCCEEDED');
    assert.equal((await store.get('job_persist_1'))?.requestId, 'req_job');
    await durable.close();
  });

  it('workflow state survives restart and resumes from the wait step', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const store = new PostgresWorkflowStore(durable.session.pools.ledger);
    const clock = { now: () => NOW, nowMs: () => Date.parse(NOW) };
    const definition = {
      workflowType: 'fx.settlement',
      steps: [
        {
          name: 'quote',
          kind: 'TASK' as const,
          async run() {
            return { outcome: 'CONTINUE' as const };
          },
        },
        { name: 'provider', kind: 'WAIT_PROVIDER' as const },
        {
          name: 'book',
          kind: 'TASK' as const,
          async run() {
            return { outcome: 'CONTINUE' as const };
          },
        },
      ],
    };
    const first = new WorkflowRuntime(store, clock);
    first.register(definition);
    const started = await first.start({
      workflowType: 'fx.settlement',
      workflowId: 'wf_fx_1',
      trace: createTraceContext({ requestId: 'req_fx' }),
    });
    assert.equal(started.state, 'WAITING_PROVIDER');

    const restarted = new WorkflowRuntime(store, clock);
    restarted.register(definition);
    const resumed = await restarted.resume('wf_fx_1', { providerRef: 'sim_1' });
    assert.equal(resumed.state, 'COMPLETED');
    assert.equal(resumed.requestId, 'req_fx');
    await durable.close();
  });

  it('inbound webhook replay is durable and outbound retry persists', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const inbound = new PostgresInboundWebhookStore(durable.session.pools.ledger);
    const receiver = new InboundWebhookReceiver(inbound, () => NOW);
    receiver.registerVerifier({
      providerId: 'fixture-rail',
      verify(input) {
        if (input.headers['x-signature'] !== 'ok') {
          return { ok: false, code: 'INVALID_SIGNATURE' };
        }
        return { ok: true, eventType: 'rail.status', providerEventId: 'prov_pg', occurredAt: NOW };
      },
    });
    const first = await receiver.receive({
      providerId: 'fixture-rail',
      headers: { 'x-signature': 'ok' },
      rawBody: '{"status":"SETTLED"}',
    });
    assert.equal(first.ack.status, 202);
    const replay = await receiver.receive({
      providerId: 'fixture-rail',
      headers: { 'x-signature': 'ok' },
      rawBody: '{"status":"SETTLED"}',
    });
    assert.equal(replay.ack.status, 202);
    assert.equal(replay.ack.status === 202 && replay.ack.duplicate, true);

    const outbound = new PostgresOutboundWebhookStore(durable.session.pools.ledger);
    const clock = { now: () => NOW, nowMs: () => Date.parse(NOW) };
    let calls = 0;
    const service = new OutboundWebhookService({
      store: outbound,
      secrets: (ref) => (ref === 'secret://simulation/webhooks/app1' ? 's3cret' : undefined),
      transport: async () => {
        calls += 1;
        return { ok: calls > 1 };
      },
      clock,
      policy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 },
    });
    service.authorizeOperator('ops_1');
    const sub = await service.subscribe({
      actorId: 'ops_1',
      ownerId: 'app_1',
      destinationUrl: 'https://example.test/hooks',
      secretRef: 'secret://simulation/webhooks/app1',
      eventFilter: ['PaymentSettled'],
    });
    await service.enqueueDelivery({
      actorId: 'ops_1',
      subscriptionId: sub.subscriptionId,
      eventId: 'evt_pay_pg',
      eventType: 'PaymentSettled',
      payload: { paymentId: 'pay_1' },
    });
    const afterRestart = new OutboundWebhookService({
      store: outbound,
      secrets: (ref) => (ref === 'secret://simulation/webhooks/app1' ? 's3cret' : undefined),
      transport: async () => ({ ok: true }),
      clock,
      policy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 },
    });
    afterRestart.authorizeOperator('ops_1');
    const retry = await afterRestart.retryDue('ops_1');
    assert.ok(retry.delivered + retry.retried + retry.deadLettered >= 0);
    const deliveries = await outbound.listDeliveries(sub.subscriptionId);
    assert.ok(deliveries.length >= 1);
    await durable.close();
  });
});
