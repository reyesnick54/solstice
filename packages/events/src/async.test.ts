import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';

import { InboxProcessor, InMemoryInboxStore, withIdempotentHandler } from './consumer.ts';
import { DeadLetterOps, PublicReplayRefusedError, refusePublicReplay } from './dead-letter-ops.ts';
import { InMemoryDeadLetterStore } from './memory-outbox.ts';
import {
  asEventId,
  ENVELOPE_ENVIRONMENT,
  parseEnvelope,
  sealEnvelope,
  serializeEnvelope,
} from './envelope.ts';
import { EventHandlerBypassError, refuseDirectFinancialMutation } from './gate.ts';
import {
  InMemoryJobStore,
  JOB_CAN_ISSUE_EXECUTION_AUTHORITY,
  JOB_CAN_POST_JOURNAL,
  PersistentJobQueue,
  PrivilegedJobRefusedError,
} from './jobs.ts';
import { ClassifiedError, classifyFailure, shouldRetry } from './retry.ts';
import { EVENT_COMPATIBILITY_POLICY, resolveEventSchema } from './schema.ts';
import { createTraceContext, envelopeTraceHints, propagateTrace } from './trace.ts';
import {
  InMemoryInboundWebhookStore,
  InMemoryOutboundWebhookStore,
  InboundWebhookReceiver,
  OutboundWebhookService,
  signOutboundWebhook,
  verifyOutboundWebhookSignature,
  type ProviderWebhookVerifier,
} from './webhooks.ts';
import { InMemoryWorkflowStore, WorkflowRuntime } from './workflow.ts';

const NOW = asUtcInstant('2026-08-21T09:00:00.000Z');

function clockAt(iso: string) {
  let ms = Date.parse(iso);
  return {
    now: () => new Date(ms).toISOString(),
    nowMs: () => ms,
    advance(deltaMs: number) {
      ms += deltaMs;
    },
  };
}

describe('canonical envelope productization', () => {
  it('serializes producer, actor, subject, environment, requestId, and correlation', () => {
    const envelope = sealEnvelope(
      {
        eventType: 'AccountOpened',
        schemaVersion: 1,
        occurredAt: NOW,
        requestId: 'req_1',
        producer: 'services.accounts',
        actor: { type: 'customer', id: 'cust_1' },
        payload: {
          accountId: 'acct_1',
          ownerId: 'cust_1',
          accountClass: 'DEMAND_DEPOSIT',
          executionAuthorityId: 'ea',
          intentId: 'I-1',
        },
      },
      1,
    );
    assert.equal(envelope.environment, ENVELOPE_ENVIRONMENT);
    assert.equal(envelope.producer, 'services.accounts');
    assert.equal(envelope.actor?.id, 'cust_1');
    assert.equal(envelope.subject?.type, 'account');
    assert.equal(envelope.requestId, 'req_1');
    assert.equal(envelope.correlationId, 'req_1');
    const roundTrip = parseEnvelope(serializeEnvelope(envelope));
    assert.equal(roundTrip.eventId, envelope.eventId);
    assert.equal(roundTrip.environment, 'simulation');
    assert.equal(roundTrip.requestId, 'req_1');
  });

  it('parses historical envelopes that omit the new fields', () => {
    const historical = JSON.stringify({
      eventId: 'evt_legacy',
      eventType: 'DepositPosted',
      eventVersion: 1,
      schemaVersion: 1,
      occurredAt: NOW,
      aggregateType: 'account',
      aggregateId: 'acct_1',
      aggregateSequence: 1,
      correlationId: 'corr_1',
      causationId: null,
      payload: { journalId: 'j1', accountId: 'acct_1', amountMinorUnits: '1', currency: 'USD' },
      metadata: {},
    });
    const parsed = parseEnvelope(historical);
    assert.equal(parsed.environment, 'simulation');
    assert.equal(parsed.producer, 'sunrey.events');
    assert.equal(parsed.requestId, null);
  });

  it('refuses a non-simulation envelope environment', () => {
    assert.throws(
      () =>
        sealEnvelope(
          {
            eventType: 'AccountOpened',
            schemaVersion: 1,
            occurredAt: NOW,
            environment: 'live' as 'simulation',
            payload: { accountId: 'acct_1' },
          },
          1,
        ),
      /simulation/,
    );
  });
});

describe('event versioning policy', () => {
  it('does not silently accept a new payload version', () => {
    assert.equal(resolveEventSchema('AccountOpened', 1), 'CURRENT');
    assert.equal(resolveEventSchema('AccountOpened', 2), 'UNSUPPORTED');
    assert.equal(EVENT_COMPATIBILITY_POLICY.silentPayloadSemanticChangeForbidden, true);
    assert.equal(EVENT_COMPATIBILITY_POLICY.breakingChangeRequiresNewVersion, true);
    assert.equal(shouldRetry(classifyFailure({ reasonCode: 'REJECTED_FINAL' })), false);
  });
});

describe('idempotent consumers', () => {
  it('deduplicates a redelivered event', async () => {
    const processor = new InboxProcessor(new InMemoryInboxStore(), { now: () => NOW });
    let effects = 0;
    const consumer = {
      consumerId: 'proj.async',
      handle() {
        effects += 1;
      },
    };
    const envelope = sealEnvelope(
      {
        eventType: 'DepositPosted',
        schemaVersion: 1,
        occurredAt: NOW,
        eventId: 'evt-idem',
        payload: { journalId: 'j1', accountId: 'acct_1', amountMinorUnits: '1', currency: 'USD' },
      },
      1,
    );
    assert.equal(await withIdempotentHandler(processor, consumer, envelope), 'applied');
    assert.equal(await withIdempotentHandler(processor, consumer, envelope), 'duplicate');
    assert.equal(effects, 1);
  });
});

describe('retry classification', () => {
  it('never retries a rejected financial transaction', () => {
    const rejected = classifyFailure(new ClassifiedError('NON_RETRYABLE', 'REJECTED_FINAL', 'rail rejected'));
    assert.equal(rejected.retryClass, 'NON_RETRYABLE');
    const human = classifyFailure({ reasonCode: 'REQUIRES_MANUAL_REVIEW' });
    assert.equal(human.retryClass, 'REQUIRES_HUMAN');
    const compliance = classifyFailure({ reasonCode: 'KERNEL_BLOCK' });
    assert.equal(compliance.retryClass, 'REQUIRES_COMPLIANCE');
  });
});

describe('persistent job queue', () => {
  it('retries, times out, dead-letters, cancels, and survives a process restart', async () => {
    const store = new InMemoryJobStore();
    const clock = clockAt(NOW);
    const queue = new PersistentJobQueue({
      store,
      clock,
      workerId: 'w1',
      policy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 },
    });
    let attempts = 0;
    queue.register('NOTIFY', async () => {
      attempts += 1;
      if (attempts < 2) {
        throw new Error('transient');
      }
    });
    await queue.enqueue({
      jobId: 'job_retry',
      jobType: 'NOTIFY',
      payload: { kind: 'email' },
      timeoutMs: 50,
    });
    const first = await queue.dispatchOnce();
    assert.equal(first.retried, 1);
    clock.advance(10);
    const second = await queue.dispatchOnce();
    assert.equal(second.succeeded, 1);

    queue.register('SLOW', async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    await queue.enqueue({ jobId: 'job_timeout', jobType: 'SLOW', timeoutMs: 5, maxAttempts: 1 });
    const timed = await queue.dispatchOnce();
    assert.equal(timed.deadLettered, 1);
    assert.equal((await store.get('job_timeout'))?.state, 'DEAD_LETTER');
    assert.equal((await store.get('job_timeout'))?.lastErrorClass, 'RETRYABLE');

    await queue.enqueue({ jobId: 'job_cancel', jobType: 'NOTIFY' });
    await queue.cancel('job_cancel');
    assert.equal((await store.get('job_cancel'))?.state, 'CANCELLED');

    const snapshot = await store.snapshot();
    const restored = new InMemoryJobStore();
    await restored.restore(snapshot);
    assert.equal((await restored.get('job_retry'))?.state, 'SUCCEEDED');
    assert.equal((await restored.get('job_timeout'))?.state, 'DEAD_LETTER');
  });

  it('refuses a privileged job that would bypass Execution Authority', async () => {
    const queue = new PersistentJobQueue({
      store: new InMemoryJobStore(),
      clock: clockAt(NOW),
      workerId: 'w1',
    });
    assert.equal(JOB_CAN_ISSUE_EXECUTION_AUTHORITY, false);
    assert.equal(JOB_CAN_POST_JOURNAL, false);
    await assert.rejects(
      () => queue.enqueue({ jobType: 'ISSUE_EXECUTION_AUTHORITY' }),
      PrivilegedJobRefusedError,
    );
    await assert.rejects(() => queue.enqueue({ jobType: 'POST_JOURNAL' }), PrivilegedJobRefusedError);
  });
});

describe('workflow persistence and resume', () => {
  it('persists, waits for a human, and resumes after a simulated restart', async () => {
    const store = new InMemoryWorkflowStore();
    const clock = clockAt(NOW);
    const runtime = new WorkflowRuntime(store, clock);
    runtime.register({
      workflowType: 'kyc.onboarding',
      steps: [
        {
          name: 'collect',
          kind: 'TASK',
          async run() {
            return { outcome: 'CONTINUE', context: { collected: 'true' } };
          },
        },
        { name: 'review', kind: 'WAIT_HUMAN' },
        {
          name: 'finish',
          kind: 'TASK',
          async run(record) {
            return { outcome: 'CONTINUE', context: { approved: record.context.decision ?? 'no' } };
          },
        },
      ],
    });
    const started = await runtime.start({
      workflowType: 'kyc.onboarding',
      workflowId: 'wf_kyc_1',
      trace: createTraceContext({ requestId: 'req_kyc' }),
    });
    assert.equal(started.state, 'WAITING_HUMAN');
    assert.equal(started.currentStep, 'review');
    assert.equal(started.requestId, 'req_kyc');

    const snapshot = await store.snapshot();
    const restoredStore = new InMemoryWorkflowStore();
    await restoredStore.restore(snapshot);
    const restoredRuntime = new WorkflowRuntime(restoredStore, clock);
    restoredRuntime.register({
      workflowType: 'kyc.onboarding',
      steps: [
        { name: 'collect', kind: 'TASK' },
        { name: 'review', kind: 'WAIT_HUMAN' },
        {
          name: 'finish',
          kind: 'TASK',
          async run() {
            return { outcome: 'CONTINUE' };
          },
        },
      ],
    });
    const resumed = await restoredRuntime.resume('wf_kyc_1', { decision: 'allow' });
    assert.equal(resumed.state, 'COMPLETED');
    assert.ok(resumed.history.some((entry) => entry.result === 'RESUMED'));
  });

  it('runs a compensation hook instead of inventing a ledger reversal', async () => {
    const runtime = new WorkflowRuntime(new InMemoryWorkflowStore(), clockAt(NOW));
    let compensated = false;
    runtime.register({
      workflowType: 'payment.prepare',
      steps: [
        {
          name: 'submit',
          kind: 'TASK',
          async run() {
            return { outcome: 'COMPENSATE', reason: 'provider rejected' };
          },
        },
        {
          name: 'undo',
          kind: 'COMPENSATE',
          async compensate() {
            compensated = true;
            return { outcome: 'CONTINUE' };
          },
        },
      ],
    });
    const record = await runtime.start({ workflowType: 'payment.prepare' });
    assert.equal(compensated, true);
    assert.equal(record.state, 'FAILED');
  });
});

describe('webhooks', () => {
  it('rejects an invalid inbound signature and detects replay', async () => {
    const store = new InMemoryInboundWebhookStore();
    const receiver = new InboundWebhookReceiver(store, () => NOW);
    const verifier: ProviderWebhookVerifier = {
      providerId: 'fixture-rail',
      verify(input) {
        if (input.headers['x-signature'] !== 'expected') {
          return { ok: false, code: 'INVALID_SIGNATURE' };
        }
        return {
          ok: true,
          eventType: 'rail.status',
          providerEventId: 'prov_1',
          occurredAt: NOW,
        };
      },
    };
    receiver.registerVerifier(verifier);
    const rejected = await receiver.receive({
      providerId: 'fixture-rail',
      headers: { 'x-signature': 'wrong' },
      rawBody: '{"ok":true}',
    });
    assert.equal(rejected.ack.status, 401);
    assert.equal(rejected.receipt?.status, 'REJECTED');

    const first = await receiver.receive({
      providerId: 'fixture-rail',
      headers: { 'x-signature': 'expected' },
      rawBody: '{"ok":true}',
      trace: createTraceContext({ requestId: 'req_wh' }),
    });
    assert.equal(first.ack.status, 202);
    assert.equal(first.ack.duplicate, false);
    const replay = await receiver.receive({
      providerId: 'fixture-rail',
      headers: { 'x-signature': 'expected' },
      rawBody: '{"ok":true}',
    });
    assert.equal(replay.ack.status, 202);
    assert.equal(replay.ack.duplicate, true);
  });

  it('retries an outbound webhook and disables after the failure threshold', async () => {
    const store = new InMemoryOutboundWebhookStore();
    const secrets = new Map([['secret://simulation/webhooks/app1', 's3cret']]);
    let calls = 0;
    const clock = clockAt(NOW);
    const service = new OutboundWebhookService({
      store,
      secrets: (ref) => secrets.get(ref),
      transport: async () => {
        calls += 1;
        return { ok: false, status: 503 };
      },
      clock,
      policy: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 },
    });
    service.authorizeOperator('ops_1');
    const sub = await service.subscribe({
      actorId: 'ops_1',
      ownerId: 'app_1',
      destinationUrl: 'https://example.test/hooks',
      secretRef: 'secret://simulation/webhooks/app1',
      eventFilter: ['PaymentSettled'],
      failureThreshold: 2,
    });
    const first = await service.enqueueDelivery({
      actorId: 'ops_1',
      subscriptionId: sub.subscriptionId,
      eventId: 'evt_pay',
      eventType: 'PaymentSettled',
      payload: { paymentId: 'pay_1' },
      trace: createTraceContext({ requestId: 'req_out' }),
    });
    assert.equal('state' in first && first.state === 'RETRYING', true);
    clock.advance(10);
    const retry = await service.retryDue('ops_1');
    assert.ok(retry.deadLettered >= 1);
    const after = await store.getSubscription(sub.subscriptionId);
    assert.equal(after?.active, false);
    assert.ok(calls >= 2);
    await assert.rejects(
      () =>
        service.enqueueDelivery({
          actorId: 'stranger',
          subscriptionId: sub.subscriptionId,
          eventId: 'evt_x',
          eventType: 'PaymentSettled',
          payload: {},
        }),
      /authorized internal actor/,
    );
  });

  it('verifies a signed outbound payload and rejects a stale timestamp', () => {
    const body = '{"ok":true}';
    const signed = signOutboundWebhook('s3cret', {
      deliveryId: 'whd_1',
      eventId: 'evt_1',
      timestamp: NOW,
      attempt: 1,
      body,
    });
    const ok = verifyOutboundWebhookSignature({
      secret: 's3cret',
      signature: signed.signature,
      deliveryId: 'whd_1',
      eventId: 'evt_1',
      timestamp: NOW,
      attempt: 1,
      body,
      nowMs: Date.parse(NOW),
    });
    assert.equal(ok.ok, true);
    const stale = verifyOutboundWebhookSignature({
      secret: 's3cret',
      signature: signed.signature,
      deliveryId: 'whd_1',
      eventId: 'evt_1',
      timestamp: NOW,
      attempt: 1,
      body,
      nowMs: Date.parse(NOW) + 10 * 60 * 1000,
    });
    assert.equal(stale.ok, false);
  });
});

describe('dead letter operations', () => {
  it('lists failures for an internal operator and refuses public replay', async () => {
    const events = new InMemoryDeadLetterStore();
    await events.record({
      eventId: asEventId('evt_dl'),
      eventType: 'PaymentFailed',
      eventVersion: 1,
      consumerId: null,
      attemptCount: 3,
      reasonCode: 'REJECTED_FINAL',
      reasonSafe: 'rail rejected',
      errorClass: 'NON_RETRYABLE',
      correlationId: 'corr_1',
      requestId: 'req_1',
      createdAt: NOW,
      replayedAt: null,
    });
    const ops = new DeadLetterOps({ events });
    await assert.rejects(() => ops.list(undefined), PublicReplayRefusedError);
    assert.throws(() => refusePublicReplay(), PublicReplayRefusedError);
    const listed = await ops.list({ actorId: 'ops_1', role: 'INTERNAL_OPS' });
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.correlationId, 'corr_1');
  });
});

describe('correlation propagation and authority boundary', () => {
  it('propagates requestId through job and workflow envelopes', async () => {
    const parent = createTraceContext({ requestId: 'req_flow', correlationId: 'corr_flow' });
    const child = propagateTrace(parent, 'evt_cause');
    const hints = envelopeTraceHints(child);
    const envelope = sealEnvelope(
      {
        eventType: 'WorkflowStarted',
        schemaVersion: 1,
        occurredAt: NOW,
        ...hints,
        payload: { workflowId: 'wf_1', workflowType: 'kyc.onboarding' },
      },
      1,
    );
    assert.equal(envelope.requestId, 'req_flow');
    assert.equal(envelope.correlationId, 'corr_flow');
    assert.equal(envelope.causationId, 'evt_cause');
    assert.throws(() => refuseDirectFinancialMutation(), EventHandlerBypassError);
  });
});
