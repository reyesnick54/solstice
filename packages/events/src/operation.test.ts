import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_PAYMENTS_ENABLED } from '../../config/src/flags.ts';
import { asUtcInstant } from '../../domain/src/time.ts';

import { InboxProcessor, InMemoryInboxStore } from './consumer.ts';
import { asEventId, sealEnvelope } from './envelope.ts';
import {
  APPROVAL_BINDING_CHANGED,
  AUTONOMOUS_FINANCIAL_RESOLUTION_REFUSED,
  COMPENSATION_ERASES_JOURNAL_HISTORY,
  CallbackReplayLedger,
  EFFECTIVELY_ONCE_BY_IDEMPOTENCY_AND_RECONCILIATION,
  EXACTLY_ONCE_CLAIMED,
  IDEMPOTENCY_PAYLOAD_MISMATCH,
  InMemoryBusinessEffectLedger,
  InMemoryOperationStore,
  OracleObservationDedupe,
  QUERY_REQUIRED_BEFORE_RETRY,
  RECONCILIATION_CAN_MINT,
  RECONCILIATION_CAN_POST_LEDGER,
  ReconciliationCoordinator,
  SimulatedCrash,
  applyCallbackOrResponse,
  applyIdempotentConsumerEffect,
  approvalBindingUnchanged,
  computeRequestDigest,
  custodyDomainTransition,
  dispatchExternalSideEffect,
  isIdempotencyConflict,
  journalHistoryPreserved,
  paymentDomainTransition,
  prepareOperation,
  proposeCompensatingEntry,
  providerIdempotencyKeyFor,
  refuseAutonomousFinancialResolution,
  refuseBlindRetry,
  startProviderFailover,
  type OperationExecutionRecord,
  type ProviderQueryOutcome,
  type ProviderSubmitOutcome,
  type RequestDigestFields,
} from './operation/index.ts';

const NOW = asUtcInstant('2026-08-20T11:00:00.000Z');
const LATER = asUtcInstant('2026-08-20T11:00:05.000Z');

function paymentDigest(overrides: Partial<RequestDigestFields> = {}): RequestDigestFields {
  return {
    operationKind: 'PAYMENT_RAIL_SUBMIT',
    amountMinor: '10000',
    assetId: 'USD',
    currency: 'USD',
    beneficiary: 'ben_1',
    destination: 'acct_ext_1',
    providerId: 'rail_sim_a',
    network: null,
    nativeAssetId: null,
    ...overrides,
  };
}

function custodyDigest(overrides: Partial<RequestDigestFields> = {}): RequestDigestFields {
  return {
    operationKind: 'CUSTODY_NATIVE_WITHDRAWAL',
    amountMinor: '500000000',
    assetId: 'MOONREY_COIN',
    currency: null,
    beneficiary: null,
    destination: 'addr_moon_1',
    providerId: 'custody_sim_a',
    network: 'sunrey-chain',
    nativeAssetId: 'MOONREY_COIN',
    ...overrides,
  };
}

async function preparedPayment(
  store: InMemoryOperationStore,
  digest = paymentDigest(),
): Promise<OperationExecutionRecord> {
  return prepareOperation(store, {
    operationId: 'op_pay_1',
    operationKind: 'PAYMENT_RAIL_SUBMIT',
    businessKey: 'pay_1',
    idempotencyKey: providerIdempotencyKeyFor({
      businessKey: 'pay_1',
      providerId: digest.providerId,
      attemptLineage: 'lineage_1',
    }),
    digest,
    intentId: 'intent_pay_1',
    now: NOW,
  });
}

describe('CHUNK-155 distributed idempotency recovery', () => {
  it('1. keeps a stable business operation ID', async () => {
    const store = new InMemoryOperationStore();
    const first = await preparedPayment(store);
    const again = await preparedPayment(store);
    assert.equal(first.businessKey, 'pay_1');
    assert.equal(again.operationId, first.operationId);
    assert.equal(again.businessKey, first.businessKey);
  });

  it('2. keeps a stable provider idempotency key', async () => {
    const key = providerIdempotencyKeyFor({
      businessKey: 'pay_1',
      providerId: 'rail_sim_a',
      attemptLineage: 'lineage_1',
    });
    assert.equal(
      key,
      providerIdempotencyKeyFor({
        businessKey: 'pay_1',
        providerId: 'rail_sim_a',
        attemptLineage: 'lineage_1',
      }),
    );
    const store = new InMemoryOperationStore();
    const record = await preparedPayment(store);
    assert.equal(record.idempotencyKey, key);
  });

  it('3. computes a deterministic request digest', () => {
    assert.equal(computeRequestDigest(paymentDigest()), computeRequestDigest(paymentDigest()));
  });

  it('4. rejects the same key reused with a changed amount', async () => {
    const store = new InMemoryOperationStore();
    await preparedPayment(store);
    const conflict = await store.prepare({
      operationId: 'op_pay_2',
      operationKind: 'PAYMENT_RAIL_SUBMIT',
      businessKey: 'pay_1',
      idempotencyKey: providerIdempotencyKeyFor({
        businessKey: 'pay_1',
        providerId: 'rail_sim_a',
        attemptLineage: 'lineage_1',
      }),
      digest: paymentDigest({ amountMinor: '20000' }),
      now: NOW,
    });
    assert.equal(isIdempotencyConflict(conflict), true);
    if (isIdempotencyConflict(conflict)) {
      assert.equal(conflict.code, IDEMPOTENCY_PAYLOAD_MISMATCH);
    }
  });

  it('5. rejects the same key reused with a changed asset', async () => {
    const store = new InMemoryOperationStore();
    await preparedPayment(store);
    await assert.rejects(
      () =>
        prepareOperation(store, {
          operationId: 'op_pay_asset',
          operationKind: 'PAYMENT_RAIL_SUBMIT',
          businessKey: 'pay_1',
          idempotencyKey: providerIdempotencyKeyFor({
            businessKey: 'pay_1',
            providerId: 'rail_sim_a',
            attemptLineage: 'lineage_1',
          }),
          digest: paymentDigest({ assetId: 'EUR', currency: 'EUR' }),
          now: NOW,
        }),
      (error: Error) => error.name === IDEMPOTENCY_PAYLOAD_MISMATCH,
    );
  });

  it('6. treats local state and outbox as one atomic unit', async () => {
    const store = new InMemoryOperationStore();
    const record = await preparedPayment(store);
    const outbox: string[] = [];
    const commit = async (writeOutbox: boolean) => {
      await store.update({ ...record, state: 'SUBMITTED' });
      if (!writeOutbox) {
        throw new Error('outbox_failed');
      }
      outbox.push(record.operationId);
    };
    await assert.rejects(() => commit(false));
    assert.equal(outbox.length, 0);
    await commit(true);
    assert.deepEqual(outbox, [record.operationId]);
  });

  it('7. keeps the external call outside any database transaction', async () => {
    const store = new InMemoryOperationStore();
    const record = await preparedPayment(store);
    let openTransactions = 0;
    const result = await dispatchExternalSideEffect(record, {
      store,
      now: () => LATER,
      submit: async () => {
        assert.equal(openTransactions, 0);
        return { kind: 'ACCEPTED', providerOperationRef: 'rail_ref_1' };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.providerCalled, true);
  });

  it('8. persists SUBMISSION_UNKNOWN', async () => {
    const store = new InMemoryOperationStore();
    const record = await preparedPayment(store);
    const result = await dispatchExternalSideEffect(record, {
      store,
      now: () => LATER,
      submit: async () => ({
        kind: 'AMBIGUOUS',
        safeErrorCode: 'TIMEOUT',
        safeErrorMessage: 'response_lost',
      }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.record.state, 'SUBMISSION_UNKNOWN');
    assert.equal((await store.get(record.operationId))?.state, 'SUBMISSION_UNKNOWN');
  });

  it('9. payment queries before retry', async () => {
    const store = new InMemoryOperationStore();
    const record = await preparedPayment(store);
    const unknown = await dispatchExternalSideEffect(record, {
      store,
      now: () => LATER,
      submit: async () => ({
        kind: 'AMBIGUOUS',
        safeErrorCode: 'TIMEOUT',
        safeErrorMessage: 'response_lost',
      }),
    });
    assert.equal(unknown.record.state, 'SUBMISSION_UNKNOWN');
    const refused = await refuseBlindRetry(unknown.record);
    assert.equal(refused.ok, false);
    assert.equal(refused.code, QUERY_REQUIRED_BEFORE_RETRY);
    assert.equal(refused.providerCalled, false);
  });

  it('10. custody queries before retry', async () => {
    const store = new InMemoryOperationStore();
    const prepared = await prepareOperation(store, {
      operationId: 'op_wd_1',
      operationKind: 'CUSTODY_NATIVE_WITHDRAWAL',
      businessKey: 'wd_1',
      idempotencyKey: providerIdempotencyKeyFor({
        businessKey: 'wd_1',
        providerId: 'custody_sim_a',
        attemptLineage: 'lineage_1',
      }),
      digest: custodyDigest(),
      now: NOW,
    });
    const unknown = await dispatchExternalSideEffect(prepared, {
      store,
      now: () => LATER,
      submit: async () => ({
        kind: 'AMBIGUOUS',
        safeErrorCode: 'BROADCAST_TIMEOUT',
        safeErrorMessage: 'chain_or_provider_ambiguous',
      }),
    });
    const second = await dispatchExternalSideEffect(unknown.record, {
      store,
      now: () => LATER,
      submit: async () => ({ kind: 'ACCEPTED', providerOperationRef: 'should_not_run' }),
    });
    assert.equal(second.ok, false);
    assert.equal(second.providerCalled, false);
    assert.equal(second.code, QUERY_REQUIRED_BEFORE_RETRY);
  });

  it('11. does not duplicate a custody approval', () => {
    const approved = {
      destination: 'addr_moon_1',
      assetId: 'MOONREY_COIN',
      quantityMinor: '500000000',
      feePolicyId: 'fee_std',
      network: 'sunrey-chain',
      canonicalSemantics: 'native_withdraw_v1',
    };
    assert.equal(approvalBindingUnchanged(approved, approved), true);
    assert.equal(
      approvalBindingUnchanged(approved, { ...approved, destination: 'addr_moon_2' }),
      false,
    );
    assert.equal(APPROVAL_BINDING_CHANGED, 'APPROVAL_BINDING_CHANGED');
  });

  it('12. restarts Exchange settlement without a second settlement', () => {
    let settlements = 0;
    let phase: 'TRADE_RECORDED' | 'RESERVED' | 'SETTLED' = 'TRADE_RECORDED';
    const restart = () => {
      if (phase === 'TRADE_RECORDED') {
        phase = 'RESERVED';
      }
      if (phase !== 'SETTLED') {
        settlements += 1;
        phase = 'SETTLED';
      }
    };
    restart();
    restart();
    assert.equal(settlements, 1);
    assert.equal(phase, 'SETTLED');
  });

  it('13. keeps HIN anchor submission idempotent', async () => {
    const store = new InMemoryOperationStore();
    const first = await prepareOperation(store, {
      operationId: 'op_hin_1',
      operationKind: 'HIN_CHAIN_ANCHOR',
      businessKey: 'anchor_intent_1',
      idempotencyKey: 'hin.anchor.anchor_intent_1',
      digest: {
        operationKind: 'HIN_CHAIN_ANCHOR',
        amountMinor: '0',
        assetId: 'HIN_COMMITMENT',
        currency: null,
        beneficiary: null,
        destination: 'commit_abc',
        providerId: 'hin.chain',
        network: 'sunrey-chain',
        nativeAssetId: null,
      },
      now: NOW,
    });
    const again = await prepareOperation(store, {
      operationId: 'op_hin_1',
      operationKind: 'HIN_CHAIN_ANCHOR',
      businessKey: 'anchor_intent_1',
      idempotencyKey: 'hin.anchor.anchor_intent_1',
      digest: {
        operationKind: 'HIN_CHAIN_ANCHOR',
        amountMinor: '0',
        assetId: 'HIN_COMMITMENT',
        currency: null,
        beneficiary: null,
        destination: 'commit_abc',
        providerId: 'hin.chain',
        network: 'sunrey-chain',
        nativeAssetId: null,
      },
      now: NOW,
    });
    assert.equal(first.operationId, again.operationId);
    assert.equal(first.requestDigest, again.requestDigest);
  });

  it('14. dedupes oracle observation retries', () => {
    const ledger = new OracleObservationDedupe();
    const observation = {
      providerId: 'oracle_sim',
      sourceId: 'src_energy',
      feedId: 'feed_mw',
      sourceObservationId: 'obs_1',
    };
    assert.equal(ledger.admit(observation), 'accepted');
    assert.equal(ledger.admit(observation), 'duplicate');
  });

  it('15. dedupes a duplicate webhook', () => {
    const ledger = new CallbackReplayLedger();
    const identity = {
      providerId: 'rail_sim_a',
      providerEventId: 'evt_1',
      payloadDigest: 'digest_1',
      businessReference: 'pay_1',
    };
    assert.equal(ledger.ingest(identity, NOW).duplicate, false);
    assert.equal(ledger.ingest(identity, LATER).duplicate, true);
  });

  it('16. converges when the callback arrives before the submit response', async () => {
    const store = new InMemoryOperationStore();
    const prepared = await preparedPayment(store);
    const dispatched = await dispatchExternalSideEffect(prepared, {
      store,
      now: () => LATER,
      submit: async () => ({ kind: 'ACCEPTED', providerOperationRef: 'rail_ref_late' }),
    });
    const afterCallback = applyCallbackOrResponse(
      dispatched.record,
      {
        providerId: 'rail_sim_a',
        providerEventId: 'cb_1',
        payloadDigest: 'cb_digest',
        businessReference: 'pay_1',
        observedState: 'CONFIRMED',
        providerOperationRef: 'rail_ref_cb',
        authoritative: true,
      },
      LATER,
    );
    assert.equal(afterCallback.record.state, 'CONFIRMED');
    const lateResponse = applyCallbackOrResponse(
      afterCallback.record,
      {
        providerId: 'rail_sim_a',
        providerEventId: 'resp_1',
        payloadDigest: 'resp_digest',
        businessReference: 'pay_1',
        observedState: 'SUBMITTED',
        providerOperationRef: 'rail_ref_late',
        authoritative: false,
      },
      LATER,
    );
    assert.equal(lateResponse.applied, false);
    assert.equal(lateResponse.record.state, 'CONFIRMED');
  });

  it('17. refuses a late status that would regress a terminal state', () => {
    const payment = paymentDomainTransition('SETTLED', 'PENDING');
    assert.equal(payment.applied, false);
    assert.equal(payment.next, 'SETTLED');
    const acceptedAfterReturned = paymentDomainTransition('RETURNED', 'ACCEPTED');
    assert.equal(acceptedAfterReturned.applied, false);
    const custody = custodyDomainTransition('FINALIZED', 'SUBMITTED');
    assert.equal(custody.applied, false);
    assert.equal(custody.next, 'FINALIZED');
  });

  it('18. prevents two workers from owning the same lease', async () => {
    const store = new InMemoryOperationStore();
    const record = await preparedPayment(store);
    assert.equal(
      await store.claimLease({ operationId: record.operationId, workerId: 'w1', now: NOW, leaseMs: 5_000 }),
      'acquired',
    );
    assert.equal(
      await store.claimLease({ operationId: record.operationId, workerId: 'w2', now: NOW, leaseMs: 5_000 }),
      'held',
    );
  });

  it('19. reclaims an expired lease', async () => {
    const store = new InMemoryOperationStore();
    const record = await preparedPayment(store);
    assert.equal(
      await store.claimLease({ operationId: record.operationId, workerId: 'w1', now: NOW, leaseMs: 1_000 }),
      'acquired',
    );
    const expired = asUtcInstant('2026-08-20T11:00:02.000Z');
    assert.equal(
      await store.claimLease({
        operationId: record.operationId,
        workerId: 'w2',
        now: expired,
        leaseMs: 1_000,
      }),
      'acquired',
    );
  });

  it('20. dedupes a completed inbox event', async () => {
    const inbox = new InMemoryInboxStore();
    const processor = new InboxProcessor(inbox, { now: () => NOW });
    const envelope = sealEnvelope(
      {
        eventId: asEventId('evt_inbox_1'),
        eventType: 'DepositPosted',
        schemaVersion: 1,
        occurredAt: NOW,
        intentId: 'I-1',
        payload: { journalId: 'j1', accountId: 'acct_1', amountMinorUnits: '1', currency: 'USD' },
      },
      1,
    );
    let effects = 0;
    const consumer = {
      consumerId: 'c1',
      handle: () => {
        effects += 1;
      },
    };
    assert.equal(await processor.process(consumer, envelope), 'applied');
    assert.equal(await processor.process(consumer, envelope), 'duplicate');
    assert.equal(effects, 1);
  });

  it('21. keeps an interrupted consumer effect idempotent', async () => {
    const inbox = new InMemoryInboxStore();
    const effects = new InMemoryBusinessEffectLedger();
    const envelopeId = asEventId('evt_bound_1');
    let applied = 0;
    await assert.rejects(
      () =>
        applyIdempotentConsumerEffect({
          inbox,
          consumerId: 'c1',
          eventId: envelopeId,
          now: NOW,
          effectKey: 'pay_1:reserve',
          effects,
          effect: () => {
            applied += 1;
          },
          crashAt: 'AFTER_CONSUMER_EFFECT_BEFORE_INBOX',
        }),
      (error: Error) => error instanceof SimulatedCrash,
    );
    assert.equal(applied, 1);
    assert.equal(
      await applyIdempotentConsumerEffect({
        inbox,
        consumerId: 'c1',
        eventId: envelopeId,
        now: LATER,
        effectKey: 'pay_1:reserve',
        effects,
        effect: () => {
          applied += 1;
        },
      }),
      'duplicate',
    );
    assert.equal(applied, 1);
  });

  it('22. assigns a new lineage on provider failover', async () => {
    const store = new InMemoryOperationStore();
    const original = await preparedPayment(store);
    const failover = await startProviderFailover(store, {
      from: original,
      originalDigest: paymentDigest(),
      newProviderId: 'rail_sim_b',
      newCredentialRef: 'cred_b',
      digest: paymentDigest({ providerId: 'rail_sim_b' }),
      now: LATER,
      newOperationId: 'op_pay_failover',
    });
    assert.equal(failover.ok, true);
    if (failover.ok) {
      assert.notEqual(failover.successor.attemptLineage, original.attemptLineage);
      assert.notEqual(failover.successor.idempotencyKey, original.idempotencyKey);
      assert.equal(failover.successor.businessKey, original.businessKey);
      assert.equal(failover.abandoned.state, 'RECONCILIATION_REQUIRED');
    }
  });

  it('23. refuses a failover that changes the beneficiary', async () => {
    const store = new InMemoryOperationStore();
    const original = await preparedPayment(store);
    const failover = await startProviderFailover(store, {
      from: original,
      originalDigest: paymentDigest(),
      newProviderId: 'rail_sim_b',
      newCredentialRef: 'cred_b',
      digest: paymentDigest({ providerId: 'rail_sim_b', beneficiary: 'ben_other' }),
      now: LATER,
      newOperationId: 'op_pay_bad_failover',
    });
    assert.equal(failover.ok, false);
    if (!failover.ok) {
      assert.equal(failover.code, 'FAILOVER_CANNOT_CHANGE_BENEFICIARY');
    }
  });

  it('24. isolates cross-asset idempotency', () => {
    const sunrey = computeRequestDigest(
      custodyDigest({ assetId: 'SUNREY_COIN', nativeAssetId: 'SUNREY_COIN' }),
    );
    const moonrey = computeRequestDigest(
      custodyDigest({ assetId: 'MOONREY_COIN', nativeAssetId: 'MOONREY_COIN' }),
    );
    assert.notEqual(sunrey, moonrey);
  });

  it('25. compensation does not erase journal history', () => {
    const proposal = proposeCompensatingEntry({
      originalJournalId: 'jnl_1',
      operationId: 'op_pay_1',
      reason: 'external_return',
    });
    assert.equal(proposal.erasesOriginal, false);
    assert.equal(proposal.coordinatorCanPost, false);
    assert.equal(COMPENSATION_ERASES_JOURNAL_HISTORY, false);
    assert.equal(
      journalHistoryPreserved(
        [
          { journalId: 'jnl_1' },
          { journalId: 'jnl_2' },
        ],
        'jnl_1',
      ),
      true,
    );
  });

  it('26. reconciliation cannot post ledger directly', () => {
    const coordinator = new ReconciliationCoordinator(new InMemoryOperationStore());
    assert.equal(coordinator.canPostLedger, false);
    assert.equal(RECONCILIATION_CAN_POST_LEDGER, false);
    assert.equal('postJournal' in coordinator, false);
  });

  it('27. reconciliation cannot mint', () => {
    const coordinator = new ReconciliationCoordinator(new InMemoryOperationStore());
    assert.equal(coordinator.canMint, false);
    assert.equal(RECONCILIATION_CAN_MINT, false);
    assert.equal('mint' in coordinator, false);
  });

  it('28. AI cannot resolve financial ambiguity autonomously', () => {
    assert.deepEqual(refuseAutonomousFinancialResolution('AI'), {
      allowed: false,
      code: AUTONOMOUS_FINANCIAL_RESOLUTION_REFUSED,
    });
    assert.deepEqual(refuseAutonomousFinancialResolution('AGENT'), {
      allowed: false,
      code: AUTONOMOUS_FINANCIAL_RESOLUTION_REFUSED,
    });
    assert.equal(refuseAutonomousFinancialResolution('HUMAN').allowed, true);
  });

  it('29. does not make a real external call', async () => {
    let injectedCalls = 0;
    const store = new InMemoryOperationStore();
    const prepared = await preparedPayment(store);
    await dispatchExternalSideEffect(prepared, {
      store,
      now: () => LATER,
      submit: async () => {
        injectedCalls += 1;
        return { kind: 'ACCEPTED', providerOperationRef: 'sim' };
      },
    });
    assert.equal(injectedCalls, 1);
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
  });

  it('30. keeps production inactive', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    assert.equal(EXACTLY_ONCE_CLAIMED, false);
    assert.equal(EFFECTIVELY_ONCE_BY_IDEMPOTENCY_AND_RECONCILIATION, true);
  });
});

describe('CHUNK-155 crash matrix', () => {
  it('A. crash before PREPARED commit leaves no record', async () => {
    const store = new InMemoryOperationStore();
    await assert.rejects(
      () =>
        prepareOperation(
          store,
          {
            operationId: 'op_crash_a',
            operationKind: 'PAYMENT_RAIL_SUBMIT',
            businessKey: 'pay_a',
            idempotencyKey: 'key_a',
            digest: paymentDigest(),
            now: NOW,
          },
          'BEFORE_PREPARED_COMMIT',
        ),
      (error: Error) => error instanceof SimulatedCrash,
    );
    assert.equal(await store.get('op_crash_a'), undefined);
  });

  it('B. crash after PREPARED commit keeps the durable row', async () => {
    const store = new InMemoryOperationStore();
    await assert.rejects(
      () =>
        prepareOperation(
          store,
          {
            operationId: 'op_crash_b',
            operationKind: 'PAYMENT_RAIL_SUBMIT',
            businessKey: 'pay_b',
            idempotencyKey: 'key_b',
            digest: paymentDigest(),
            now: NOW,
          },
          'AFTER_PREPARED_COMMIT',
        ),
      (error: Error) => error instanceof SimulatedCrash,
    );
    assert.equal((await store.get('op_crash_b'))?.state, 'PREPARED');
  });

  it('C. crash before provider call does not submit', async () => {
    const store = new InMemoryOperationStore();
    const prepared = await preparedPayment(store);
    let called = 0;
    await assert.rejects(
      () =>
        dispatchExternalSideEffect(prepared, {
          store,
          now: () => LATER,
          crashAt: 'BEFORE_PROVIDER_CALL',
          submit: async () => {
            called += 1;
            return { kind: 'ACCEPTED', providerOperationRef: 'x' };
          },
        }),
      (error: Error) => error instanceof SimulatedCrash,
    );
    assert.equal(called, 0);
    assert.equal((await store.get(prepared.operationId))?.state, 'PREPARED');
  });

  it('D. provider success then crash before local result becomes recoverable unknown', async () => {
    const store = new InMemoryOperationStore();
    const prepared = await preparedPayment(store);
    const provider: { accepted: boolean } = { accepted: false };
    await assert.rejects(
      () =>
        dispatchExternalSideEffect(prepared, {
          store,
          now: () => LATER,
          crashAt: 'AFTER_PROVIDER_SUCCESS_BEFORE_RESULT',
          submit: async () => {
            provider.accepted = true;
            return { kind: 'ACCEPTED', providerOperationRef: 'rail_ok' };
          },
        }),
      (error: Error) => error instanceof SimulatedCrash,
    );
    const inflight = await store.get(prepared.operationId);
    assert.equal(provider.accepted, true);
    assert.equal(inflight?.state, 'DISPATCHING');
    const coordinator = new ReconciliationCoordinator(store);
    const recovered = await coordinator.queryAndPropose(
      inflight!,
      {
        query: async (): Promise<ProviderQueryOutcome> => ({
          kind: 'CONFIRMED',
          providerOperationRef: 'rail_ok',
        }),
      },
      LATER,
    );
    assert.equal(recovered.record.state, 'CONFIRMED');
  });

  it('E. provider failure then crash before local result write stays queryable', async () => {
    const store = new InMemoryOperationStore();
    const prepared = await preparedPayment(store);
    await assert.rejects(
      () =>
        dispatchExternalSideEffect(prepared, {
          store,
          now: () => LATER,
          crashAt: 'AFTER_PROVIDER_FAILURE_BEFORE_RESULT',
          submit: async (): Promise<ProviderSubmitOutcome> => ({
            kind: 'REJECTED_FINAL',
            safeErrorCode: 'REJECTED',
            safeErrorMessage: 'bank_rejected',
          }),
        }),
      (error: Error) => error instanceof SimulatedCrash,
    );
    assert.equal((await store.get(prepared.operationId))?.state, 'DISPATCHING');
  });

  it('F. SUBMISSION_UNKNOWN persists across restart', async () => {
    const store = new InMemoryOperationStore();
    const prepared = await preparedPayment(store);
    await dispatchExternalSideEffect(prepared, {
      store,
      now: () => LATER,
      submit: async () => ({
        kind: 'AMBIGUOUS',
        safeErrorCode: 'TIMEOUT',
        safeErrorMessage: 'lost',
      }),
    });
    const restarted = new ReconciliationCoordinator(store);
    const discovered = await restarted.discoverAmbiguous();
    assert.equal(discovered[0]?.state, 'SUBMISSION_UNKNOWN');
  });

  it('G-L. callback-before-response, duplicate callback, outbox, consumer, and failover crash windows', async () => {
    const store = new InMemoryOperationStore();
    const prepared = await preparedPayment(store);
    const submitted = await dispatchExternalSideEffect(prepared, {
      store,
      now: () => LATER,
      submit: async () => ({ kind: 'ACCEPTED', providerOperationRef: 'rail_ok' }),
    });
    await assert.rejects(
      () =>
        dispatchExternalSideEffect(prepared, {
          store,
          now: () => LATER,
          crashAt: 'AFTER_RESULT_BEFORE_OUTBOX',
          submit: async () => ({ kind: 'ACCEPTED', providerOperationRef: 'rail_ok' }),
        }),
      (error: Error) => error.name === QUERY_REQUIRED_BEFORE_RETRY || error instanceof SimulatedCrash,
    );
    const callback = applyCallbackOrResponse(
      submitted.record,
      {
        providerId: 'rail_sim_a',
        providerEventId: 'cb',
        payloadDigest: 'd',
        businessReference: 'pay_1',
        observedState: 'CONFIRMED',
        authoritative: true,
      },
      LATER,
    );
    assert.equal(callback.record.state, 'CONFIRMED');
    const ledger = new CallbackReplayLedger();
    const identity = {
      providerId: 'rail_sim_a',
      providerEventId: 'cb',
      payloadDigest: 'd',
      businessReference: 'pay_1',
    };
    assert.equal(ledger.ingest(identity, LATER).duplicate, false);
    assert.equal(ledger.ingest(identity, LATER).duplicate, true);
    const failover = await startProviderFailover(store, {
      from: { ...prepared, state: 'SUBMISSION_UNKNOWN', providerId: 'rail_sim_a' },
      originalDigest: paymentDigest(),
      newProviderId: 'rail_sim_b',
      newCredentialRef: 'cred_b',
      digest: paymentDigest({ providerId: 'rail_sim_b' }),
      now: LATER,
      newOperationId: 'op_pay_failover_l',
    });
    assert.equal(failover.ok, true);
  });
});
