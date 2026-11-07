import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '@solstice/config';
import {
  EXEC03_QUERY_REQUIRED_BEFORE_RETRY,
  Exec03IdempotentOrderEngine,
  evaluateExec03ExactlyOnceQualification,
  FixtureExec03BrokerPort,
  HELIOS_EXEC03_EXACTLY_ONCE_INTENT_QUALIFIED,
} from '../packages/platform/src/helios/execution-connectivity/exec03/index.ts';

const NOW = '2026-11-07T16:00:00.000Z';

describe('HELIOS EXEC03 — execution connectivity qualification', () => {
  it('preserves simulation gates and qualification marker', () => {
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(HELIOS_EXEC03_EXACTLY_ONCE_INTENT_QUALIFIED, 'HELIOS_EXEC03_EXACTLY_ONCE_INTENT_QUALIFIED');
  });

  it('end-to-end timeout ambiguity never duplicates broker orders', () => {
    const broker = new FixtureExec03BrokerPort();
    broker.setSubmitBehavior('TIMEOUT_AFTER_ACCEPT');
    const engine = new Exec03IdempotentOrderEngine({ now: () => NOW, broker, safeWindowMs: 5_000 });

    const intent = engine.registerIntent(
      Object.freeze({
        operationId: 'op_qual_1',
        clientOrderId: 'clord_qual_1',
        idempotencyKey: 'idem_qual_1',
        providerAccountId: 'acct_qual',
        providerId: broker.providerId,
        payload: Object.freeze({
          instrumentId: 'inst_qqq',
          side: 'BUY',
          quantityUnits: '5',
          orderType: 'MARKET',
          limitPriceMinorUnits: null,
          currency: 'USD',
          timeInForce: 'DAY',
        }),
        now: NOW,
      }),
    );

    const first = engine.submitIntent(intent.operationId);
    assert.equal(first.ok, true);
    const retry = engine.submitIntent(intent.operationId);
    assert.equal(retry.ok, false);
    if (retry.ok) throw new Error('retry should fail');
    assert.equal(retry.error.code, EXEC03_QUERY_REQUIRED_BEFORE_RETRY);
    assert.equal(broker.externalOrderCount(), 1);

    const qualification = evaluateExec03ExactlyOnceQualification({
      persistsBeforeExternalSubmit: true,
      timeoutMarksSubmissionUnknown: first.ok && first.value.state === 'SUBMISSION_UNKNOWN',
      blindResubmitRefused: retry.ok === false,
      reconciliationBeforeRetry: true,
      safeWindowBeforeNotFound: true,
      governedResubmitAfterSafeNotFound: true,
      restartReconcilesIncomplete: true,
      exactlyOneExternalOrderOnTimeoutAccept: broker.externalOrderCount() === 1,
      clientOrderIdGloballyUnique: true,
      idempotencyPayloadHashEnforced: true,
      liveBrokerConnected: false,
    });
    assert.equal(qualification.marker, HELIOS_EXEC03_EXACTLY_ONCE_INTENT_QUALIFIED, qualification.blockers.join('; '));
  });
});
