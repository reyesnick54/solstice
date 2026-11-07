import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EXEC03_GOVERNED_RESUBMIT_NOT_PERMITTED,
  EXEC03_IDEMPOTENCY_PAYLOAD_MISMATCH,
  EXEC03_QUERY_REQUIRED_BEFORE_RETRY,
  Exec03IdempotentOrderEngine,
  evaluateExec03ExactlyOnceQualification,
  executionPayloadHash,
  FixtureExec03BrokerPort,
  HELIOS_EXEC03_EXACTLY_ONCE_INTENT_QUALIFIED,
  InMemoryExec03IntentStore,
} from './index.ts';

const T0 = '2026-11-07T16:00:00.000Z';
const T1 = '2026-11-07T16:00:02.000Z';
const T_AFTER_SAFE = '2026-11-07T16:00:10.000Z';

function sampleDraft(operationId: string, clientOrderId: string) {
  return Object.freeze({
    operationId,
    clientOrderId,
    idempotencyKey: `idem_${operationId}`,
    providerAccountId: 'acct_exec03',
    providerId: 'fixture_exec03_broker_v1',
    payload: Object.freeze({
      instrumentId: 'inst_spy',
      side: 'BUY' as const,
      quantityUnits: '10',
      orderType: 'MARKET' as const,
      limitPriceMinorUnits: null,
      currency: 'USD',
      timeInForce: 'DAY',
    }),
    now: T0,
    safeWindowMs: 5_000,
  });
}

describe('HELIOS EXEC03 idempotent order intent', () => {
  it('requires immutable payload hash and idempotency binding', () => {
    const broker = new FixtureExec03BrokerPort();
    const engine = new Exec03IdempotentOrderEngine({ now: () => T0, broker });
    const draft = sampleDraft('op_hash_1', 'clord_hash_1');
    const registered = engine.registerIntent(draft);
    assert.equal(registered.payloadHash, executionPayloadHash(draft.payload));

    const replay = engine.registerIntent(draft);
    assert.equal(replay.operationId, registered.operationId);

    assert.throws(
      () =>
        engine.registerIntent({
          ...draft,
          operationId: 'op_hash_2',
          clientOrderId: 'clord_hash_2',
          payload: { ...draft.payload, quantityUnits: '11' },
        }),
      (error: Error) => error.name === EXEC03_IDEMPOTENCY_PAYLOAD_MISMATCH,
    );
  });

  it('property: timeout after broker accept creates exactly one external order', () => {
    const broker = new FixtureExec03BrokerPort();
    broker.setSubmitBehavior('TIMEOUT_AFTER_ACCEPT');
    let now = T0;
    const engine = new Exec03IdempotentOrderEngine({
      now: () => now,
      broker,
      safeWindowMs: 5_000,
    });

    const intent = engine.registerIntent(sampleDraft('op_prop_1', 'clord_prop_1'));
    const submitted = engine.submitIntent(intent.operationId);
    assert.equal(submitted.ok, true);
    if (!submitted.ok) throw new Error('submit');
    assert.equal(submitted.value.state, 'SUBMISSION_UNKNOWN');
    assert.equal(broker.externalOrderCount(), 1);

    const blind = engine.submitIntent(intent.operationId);
    assert.equal(blind.ok, false);
    if (blind.ok) throw new Error('expected blind failure');
    assert.equal(blind.error.code, EXEC03_QUERY_REQUIRED_BEFORE_RETRY);
    assert.equal(broker.externalOrderCount(), 1);

    const refused = engine.refuseBlindResubmit(intent.operationId);
    assert.equal(refused.ok, false);

    now = T1;
    const reconciled = engine.reconcileIntent(intent.operationId);
    assert.equal(reconciled.ok, true);
    if (!reconciled.ok) throw new Error('reconcile');
    assert.equal(reconciled.value.intent.state, 'ACKNOWLEDGED');
    assert.equal(broker.externalOrderCount(), 1);
  });

  it('recoverAfterRestart reconciles SUBMISSION_UNKNOWN without resubmitting', () => {
    const broker = new FixtureExec03BrokerPort();
    broker.setSubmitBehavior('TIMEOUT_AFTER_ACCEPT');
    const store = new InMemoryExec03IntentStore();
    const engine = new Exec03IdempotentOrderEngine({ now: () => T0, broker, safeWindowMs: 5_000 }, store);

    const intent = engine.registerIntent(sampleDraft('op_restart_1', 'clord_restart_1'));
    engine.submitIntent(intent.operationId);
    assert.equal(broker.externalOrderCount(), 1);

    const snapshot = store.snapshot();
    const brokerAfterRestart = new FixtureExec03BrokerPort();
    brokerAfterRestart.setSubmitBehavior('TIMEOUT_AFTER_ACCEPT');
    const restartedStore = new InMemoryExec03IntentStore();
    restartedStore.restore(snapshot);
    const restarted = new Exec03IdempotentOrderEngine(
      { now: () => T1, broker: brokerAfterRestart, safeWindowMs: 5_000 },
      restartedStore,
    );

    brokerAfterRestart.submit({
      clientOrderId: 'clord_restart_1',
      operationId: 'op_restart_1',
      instrumentId: 'inst_spy',
      side: 'BUY',
      quantityUnits: '10',
    });

    const recovered = restarted.recoverAfterRestart();
    assert.equal(recovered.length, 1);
    assert.equal(recovered[0]?.state, 'ACKNOWLEDGED');
    assert.equal(brokerAfterRestart.externalOrderCount(), 1);
  });

  it('permits governed resubmission only after safe-window NOT_FOUND', () => {
    const broker = new FixtureExec03BrokerPort();
    broker.setSubmitBehavior('TIMEOUT_AFTER_ACCEPT');
    let now = T0;
    const engine = new Exec03IdempotentOrderEngine({ now: () => now, broker, safeWindowMs: 5_000 });

    const intent = engine.registerIntent(sampleDraft('op_gov_1', 'clord_gov_missing'));
    engine.submitIntent(intent.operationId);
    assert.equal(broker.externalOrderCount(), 1);
    broker.reset();

    now = T_AFTER_SAFE;
    const reconciled = engine.reconcileIntent(intent.operationId);
    assert.equal(reconciled.ok, true);
    if (!reconciled.ok) throw new Error('reconcile');
    assert.equal(reconciled.value.intent.state, 'NOT_SUBMITTED');
    assert.equal(reconciled.value.intent.governedResubmitPermitted, true);

    broker.setSubmitBehavior('ACKNOWLEDGED');
    const resubmitted = engine.governedResubmit(intent.operationId);
    assert.equal(resubmitted.ok, true);
    assert.equal(broker.externalOrderCount(), 1);
  });

  it('rejects direct submitIntent when governed resubmit is required', () => {
    const broker = new FixtureExec03BrokerPort();
    broker.setSubmitBehavior('TIMEOUT_AFTER_ACCEPT');
    let now = T0;
    const engine = new Exec03IdempotentOrderEngine({ now: () => now, broker, safeWindowMs: 5_000 });

    const intent = engine.registerIntent(sampleDraft('op_gov_direct', 'clord_gov_direct'));
    engine.submitIntent(intent.operationId);
    broker.reset();

    now = T_AFTER_SAFE;
    const reconciled = engine.reconcileIntent(intent.operationId);
    assert.equal(reconciled.ok, true);
    if (!reconciled.ok) throw new Error('reconcile');
    assert.equal(reconciled.value.intent.governedResubmitPermitted, true);

    const direct = engine.submitIntent(intent.operationId);
    assert.equal(direct.ok, false);
    if (direct.ok) throw new Error('expected governed gate');
    assert.equal(direct.error.code, EXEC03_GOVERNED_RESUBMIT_NOT_PERMITTED);
  });

  it('qualifies HELIOS_EXEC03_EXACTLY_ONCE_INTENT_QUALIFIED when engineering checks pass', () => {
    const result = evaluateExec03ExactlyOnceQualification({
      persistsBeforeExternalSubmit: true,
      timeoutMarksSubmissionUnknown: true,
      blindResubmitRefused: true,
      reconciliationBeforeRetry: true,
      safeWindowBeforeNotFound: true,
      governedResubmitAfterSafeNotFound: true,
      restartReconcilesIncomplete: true,
      exactlyOneExternalOrderOnTimeoutAccept: true,
      clientOrderIdGloballyUnique: true,
      idempotencyPayloadHashEnforced: true,
      liveBrokerConnected: false,
    });
    assert.equal(result.marker, HELIOS_EXEC03_EXACTLY_ONCE_INTENT_QUALIFIED, result.blockers.join('; '));
  });
});
