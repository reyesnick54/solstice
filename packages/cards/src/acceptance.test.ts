import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { ledgerScaledUnits } from '../../money/src/ledger-amount.ts';
import { Money } from '../../money/src/money.ts';
import { createCardWorld } from '../../../tests/card-world.ts';
import { AcceptanceService } from './acceptance/service.ts';
import { signAcceptanceCallback, type AcceptanceCallbackEnvelope } from './acceptance/callback.ts';
import { evaluateMerchantEligibility } from './acceptance/eligibility.ts';
import { asCurrencyCode } from '../../domain/src/currency.ts';
import { asSolsticeIdentityId } from '../../identity/src/ids.ts';

function acceptanceService(world: ReturnType<typeof createCardWorld>, feeMinor = 150n) {
  return new AcceptanceService({
    kernel: world.runtime.kernel,
    issuer: world.runtime.issuer,
    ledger: world.runtime.ledger,
    evidence: world.runtime.evidence,
    events: world.runtime.events,
    clock: world.clock,
    catalog: world.catalog,
    identity: world.runtime.identity.service,
    secrets: world.secrets,
    operationsActorId: world.operationsActorId,
    feeMinor,
  });
}

function verifiedMerchant(world: ReturnType<typeof createCardWorld>, acceptance: AcceptanceService, suffix: string) {
  const facts = world.runtime.identity.service.identityFactsFor(world.actorId);
  assert.ok(facts.subjectId);
  const business = world.runtime.identity.service.createBusinessIdentity({
    subjectId: asSolsticeIdentityId(facts.subjectId),
    legalNameRef: `sim-merchant-${suffix}`,
    jurisdiction: world.customer.jurisdiction,
  });
  if (!business.ok) {
    throw new Error(business.error.message);
  }
  const activated = world.runtime.identity.service.activateBusinessIdentity(business.value.id);
  assert.equal(activated.ok, true);
  return acceptance.registerMerchant({
    merchantId: `merch_${suffix}`,
    businessIdentityId: business.value.id,
    settlementAccountId: world.account.id,
    jurisdiction: world.customer.jurisdiction,
  });
}

function signedAcceptance(
  world: ReturnType<typeof createCardWorld>,
  eventType: AcceptanceCallbackEnvelope['eventType'],
  idempotencyKey: string,
  nonce: string,
  payload: Readonly<Record<string, unknown>>,
): AcceptanceCallbackEnvelope {
  const secret = world.secrets.resolve({
    scheme: 'secret',
    provider: 'simulation',
    path: 'acceptance-provider-callback',
    href: 'secret://simulation/acceptance-provider-callback',
  });
  if (!secret.ok) {
    throw new Error(secret.error.message);
  }
  return signAcceptanceCallback(secret.value, {
    providerId: 'sim-softpos-provider',
    eventType,
    idempotencyKey,
    nonce,
    timestampMs: BigInt(Date.parse(world.clock.now())),
    schemaVersion: 1,
    payload,
  });
}

describe('merchant SoftPOS / tap-to-pay', () => {
  it('registers a device, starts a $50 session, settles, and reconciles MATCHED', () => {
    const world = createCardWorld('softpos', 0n);
    const acceptance = acceptanceService(world);
    const merchant = verifiedMerchant(world, acceptance, 'softpos');
    const device = acceptance.registerDevice({
      id: asIntentId('reg_dev_sp'),
      actionType: ACTION_TYPES.REGISTER_ACCEPTANCE_DEVICE,
      idempotencyKey: 'reg_dev_sp',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'MERCHANT_ACCEPTANCE',
      payload: {
        merchantId: merchant.merchantId,
        accountId: world.account.id,
        deviceId: 'adev_softpos',
        providerDeviceReference: 'sim_adev_adev_softpos',
      },
    });
    if (device.outcome !== 'OK') {
      throw new Error(`device register failed: ${device.outcome}`);
    }
    const session = acceptance.createSession({
      id: asIntentId('sess_sp'),
      actionType: ACTION_TYPES.CREATE_ACCEPTANCE_SESSION,
      idempotencyKey: 'sess_sp',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'MERCHANT_ACCEPTANCE',
      payload: {
        merchantId: merchant.merchantId,
        accountId: world.account.id,
        deviceId: device.value.deviceId,
        sessionId: 'asess_softpos',
        currency: asCurrencyCode('USD'),
      },
    });
    assert.equal(session.outcome, 'OK');
    if (session.outcome !== 'OK') {
      throw new Error('session failed');
    }
    const started = acceptance.startPayment({
      id: asIntentId('pay_sp'),
      actionType: ACTION_TYPES.START_ACCEPTANCE_PAYMENT,
      idempotencyKey: 'pay_sp',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'MERCHANT_ACCEPTANCE',
      payload: {
        sessionId: session.value.sessionId,
        accountId: world.account.id,
        paymentId: 'apay_softpos',
        amount: Money.fromMinorUnits(5_000n, 'USD'),
        merchantReference: 'sale-50',
      },
    });
    assert.equal(started.outcome, 'OK');
    if (started.outcome !== 'OK') {
      throw new Error('payment failed');
    }
    assert.equal(started.value.result, 'APPROVED');
    assert.equal(started.value.state, 'PENDING_SETTLEMENT');

    const settled = acceptance.settlePayment({
      id: asIntentId('settle_sp'),
      actionType: ACTION_TYPES.SETTLE_ACCEPTANCE_PAYMENT,
      idempotencyKey: 'settle_sp',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'MERCHANT_ACCEPTANCE',
      payload: {
        paymentId: started.value.paymentId,
        accountId: world.account.id,
        providerTransactionRef: started.value.providerTransactionRef ?? '',
      },
    });
    assert.equal(settled.outcome, 'OK');
    if (settled.outcome !== 'OK') {
      throw new Error('settle failed');
    }
    assert.equal(settled.value.state, 'SETTLED');
    assert.ok(settled.value.settlementJournalId);
    assert.ok(settled.value.feeJournalId);
    const journal = world.runtime.ledger.getJournal(settled.value.settlementJournalId!);
    assert.ok(journal);
    const debit = journal.postings
      .filter((posting) => posting.direction === 'DEBIT')
      .reduce((sum, posting) => sum + ledgerScaledUnits(posting.amount), 0n);
    const credit = journal.postings
      .filter((posting) => posting.direction === 'CREDIT')
      .reduce((sum, posting) => sum + ledgerScaledUnits(posting.amount), 0n);
    assert.equal(debit, credit);
    const reconciliation = acceptance.store.getReconciliation(settled.value.paymentId);
    assert.equal(reconciliation?.status, 'MATCHED');

    const duplicate = acceptance.settlePayment({
      id: asIntentId('settle_sp_dup'),
      actionType: ACTION_TYPES.SETTLE_ACCEPTANCE_PAYMENT,
      idempotencyKey: 'settle_sp',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'MERCHANT_ACCEPTANCE',
      payload: {
        paymentId: started.value.paymentId,
        accountId: world.account.id,
        providerTransactionRef: started.value.providerTransactionRef ?? '',
      },
    });
    assert.equal(duplicate.outcome, 'OK');
    if (duplicate.outcome === 'OK') {
      assert.equal(duplicate.replay, true);
      assert.equal(duplicate.value.settlementJournalId, settled.value.settlementJournalId);
    }
  });

  it('rejects an unverified acceptance callback and a suspended device', () => {
    const world = createCardWorld('softpos_fail', 0n);
    const acceptance = acceptanceService(world, 0n);
    const merchant = verifiedMerchant(world, acceptance, 'fail');
    const device = acceptance.registerDevice({
      id: asIntentId('reg_dev_fail'),
      actionType: ACTION_TYPES.REGISTER_ACCEPTANCE_DEVICE,
      idempotencyKey: 'reg_dev_fail',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'MERCHANT_ACCEPTANCE',
      payload: {
        merchantId: merchant.merchantId,
        accountId: world.account.id,
        deviceId: 'adev_fail',
        providerDeviceReference: 'sim_adev_adev_fail',
      },
    });
    assert.equal(device.outcome, 'OK');
    if (device.outcome !== 'OK') {
      throw new Error('device failed');
    }
    const forged: AcceptanceCallbackEnvelope = {
      providerId: 'sim-softpos-provider',
      eventType: 'SETTLEMENT',
      idempotencyKey: 'forged',
      nonce: 'forged',
      timestampMs: BigInt(Date.parse(world.clock.now())),
      schemaVersion: 1,
      payload: { paymentId: 'missing' },
      signatureHex: '00',
    };
    const unverified = acceptance.ingestAcceptanceCallback(forged);
    assert.equal(unverified.outcome, 'REJECTED');

    const suspended = acceptance.suspendDevice(device.value.deviceId);
    assert.equal(suspended.outcome, 'OK');
    const session = acceptance.createSession({
      id: asIntentId('sess_fail'),
      actionType: ACTION_TYPES.CREATE_ACCEPTANCE_SESSION,
      idempotencyKey: 'sess_fail',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'MERCHANT_ACCEPTANCE',
      payload: {
        merchantId: merchant.merchantId,
        accountId: world.account.id,
        deviceId: device.value.deviceId,
        sessionId: 'asess_fail',
        currency: asCurrencyCode('USD'),
      },
    });
    assert.equal(session.outcome, 'REJECTED');
    if (session.outcome === 'REJECTED') {
      assert.equal(session.code, 'DEVICE_NOT_ACTIVE');
    }
  });

  it('defaults merchant eligibility to deny', () => {
    const result = evaluateMerchantEligibility({
      merchant: undefined,
      business: undefined,
      settlementAccount: undefined,
      jurisdictionPermitted: true,
      complianceClear: true,
      fraudClear: true,
    });
    assert.equal(result.outcome, 'INELIGIBLE');
  });

  it('does not treat a signed callback as a second credit', () => {
    const world = createCardWorld('softpos_cb', 0n);
    const acceptance = acceptanceService(world, 0n);
    const merchant = verifiedMerchant(world, acceptance, 'cb');
    const device = acceptance.registerDevice({
      id: asIntentId('reg_dev_cb'),
      actionType: ACTION_TYPES.REGISTER_ACCEPTANCE_DEVICE,
      idempotencyKey: 'reg_dev_cb',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'MERCHANT_ACCEPTANCE',
      payload: {
        merchantId: merchant.merchantId,
        accountId: world.account.id,
        deviceId: 'adev_cb',
        providerDeviceReference: 'sim_adev_adev_cb',
      },
    });
    assert.equal(device.outcome, 'OK');
    if (device.outcome !== 'OK') {
      throw new Error('device failed');
    }
    const session = acceptance.createSession({
      id: asIntentId('sess_cb'),
      actionType: ACTION_TYPES.CREATE_ACCEPTANCE_SESSION,
      idempotencyKey: 'sess_cb',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'MERCHANT_ACCEPTANCE',
      payload: {
        merchantId: merchant.merchantId,
        accountId: world.account.id,
        deviceId: device.value.deviceId,
        sessionId: 'asess_cb',
        currency: asCurrencyCode('USD'),
      },
    });
    assert.equal(session.outcome, 'OK');
    if (session.outcome !== 'OK') {
      throw new Error('session failed');
    }
    const started = acceptance.startPayment({
      id: asIntentId('pay_cb'),
      actionType: ACTION_TYPES.START_ACCEPTANCE_PAYMENT,
      idempotencyKey: 'pay_cb',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'MERCHANT_ACCEPTANCE',
      payload: {
        sessionId: session.value.sessionId,
        accountId: world.account.id,
        paymentId: 'apay_cb',
        amount: Money.fromMinorUnits(5_000n, 'USD'),
        merchantReference: 'sale-cb',
      },
    });
    assert.equal(started.outcome, 'OK');
    if (started.outcome !== 'OK') {
      throw new Error('pay failed');
    }
    const first = acceptance.ingestAcceptanceCallback(
      signedAcceptance(world, 'SETTLEMENT', 'cb_settle_1', 'cb_nonce_1', {
        paymentId: started.value.paymentId,
        actorId: world.actorId,
      }),
    );
    assert.equal(first.outcome, 'OK');
    const second = acceptance.ingestAcceptanceCallback(
      signedAcceptance(world, 'SETTLEMENT', 'cb_settle_1', 'cb_nonce_1', {
        paymentId: started.value.paymentId,
        actorId: world.actorId,
      }),
    );
    assert.equal(second.outcome, 'REJECTED');
    if (second.outcome === 'REJECTED') {
      assert.equal(second.code, 'CALLBACK_REPLAY');
    }
  });
});
