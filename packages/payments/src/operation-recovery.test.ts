import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { QUERY_REQUIRED_BEFORE_RETRY } from '../../events/src/operation/index.ts';
import { PaymentSideEffectRecovery, paymentCallbackDigest } from './operation-recovery.ts';

const NOW = '2026-08-20T11:00:00.000Z';

describe('payment side-effect recovery', () => {
  it('queries before retry and converges callback-before-response', async () => {
    const recovery = new PaymentSideEffectRecovery(undefined, {
      submit: async () => ({
        kind: 'AMBIGUOUS',
        safeErrorCode: 'TIMEOUT',
        safeErrorMessage: 'lost',
        providerOperationRef: 'rail_1',
      }),
      query: async () => ({ kind: 'CONFIRMED', providerOperationRef: 'rail_1' }),
    });
    const draft = {
      paymentId: 'pay_rec_1',
      providerId: 'rail_sim_a',
      amountMinor: '10000',
      currency: 'USD',
      beneficiary: 'ben_1',
      destination: 'acct_1',
    };
    const prepared = await recovery.prepare(draft, NOW);
    const unknown = await recovery.submitPrepared(prepared, () => NOW);
    assert.equal(unknown.state, 'SUBMISSION_UNKNOWN');
    await assert.rejects(() => recovery.retryUnknown(unknown), (error: Error) => {
      return error.name === QUERY_REQUIRED_BEFORE_RETRY;
    });
    const recovered = await recovery.recoverByQuery(unknown, NOW);
    assert.equal(recovered.record.state, 'CONFIRMED');
    const callback = recovery.applyProviderCallback(
      recovered.record,
      {
        providerId: 'rail_sim_a',
        providerEventId: 'evt_1',
        payloadDigest: paymentCallbackDigest('pay_rec_1', 'evt_1', 'SETTLED'),
        businessReference: 'pay_rec_1',
        observedState: 'CONFIRMED',
        authoritative: true,
      },
      NOW,
    );
    const duplicate = recovery.applyProviderCallback(
      callback.record,
      {
        providerId: 'rail_sim_a',
        providerEventId: 'evt_1',
        payloadDigest: paymentCallbackDigest('pay_rec_1', 'evt_1', 'SETTLED'),
        businessReference: 'pay_rec_1',
        observedState: 'CONFIRMED',
        authoritative: true,
      },
      NOW,
    );
    assert.equal(duplicate.duplicate, true);
    const late = recovery.applyLateSubmissionResponse(callback.record, 'PENDING');
    assert.equal(late.applied, false);
    assert.equal(recovery.duplicatePaymentCreated(), false);
  });
});
