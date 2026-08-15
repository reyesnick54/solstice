import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { asCurrencyCode } from '../../domain/src/currency.ts';
import { Money } from '../../money/src/money.ts';
import { createCardWorld } from '../../../tests/card-world.ts';
import { AcceptanceService } from './acceptance/service.ts';
import { signAcceptanceCallback } from './acceptance/callback.ts';

async function main(): Promise<void> {
  const world = createCardWorld('demo_softpos', 0n);
  const acceptance = new AcceptanceService({
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
    feeMinor: 150n,
  });

  console.log('1. Simulated verified merchant exists.');
  const facts = world.runtime.identity.service.identityFactsFor(world.actorId);
  if (!facts.subjectId) {
    throw new Error('missing identity');
  }
  const business = world.runtime.identity.service.createBusinessIdentity({
    subjectId: facts.subjectId,
    legalNameRef: 'sim-merchant-demo',
    jurisdiction: world.customer.jurisdiction,
  });
  if (!business.ok) {
    throw new Error(business.error.message);
  }
  const activatedBiz = world.runtime.identity.service.activateBusinessIdentity(business.value.id);
  if (!activatedBiz.ok) {
    throw new Error(activatedBiz.error.message);
  }
  const merchant = acceptance.registerMerchant({
    merchantId: 'merch_demo',
    businessIdentityId: business.value.id,
    settlementAccountId: world.account.id,
    jurisdiction: world.customer.jurisdiction,
  });
  console.log(`   merchant=${merchant.merchantId} business=${merchant.businessIdentityId} license=${merchant.acquiringLicenseClaim}`);

  console.log('2. Merchant settlement account exists.');
  console.log(`   account=${world.account.id} class=${world.account.accountClass}`);

  console.log('3. Acceptance device is registered.');
  const device = acceptance.registerDevice({
    id: asIntentId('reg_demo'),
    actionType: ACTION_TYPES.REGISTER_ACCEPTANCE_DEVICE,
    idempotencyKey: 'reg_demo',
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'MERCHANT_ACCEPTANCE',
    payload: {
      merchantId: merchant.merchantId,
      accountId: world.account.id,
      deviceId: 'adev_demo',
      providerDeviceReference: 'sim_adev_adev_demo',
    },
  });
  if (device.outcome !== 'OK') {
    throw new Error(`register device failed: ${device.outcome}`);
  }
  console.log(`   device=${device.value.deviceId} status=${device.value.status}`);

  console.log('4. Simulated provider attestation passes.');
  console.log(`   attestation=${device.value.attestationReference}`);

  console.log('5. Acceptance session starts.');
  const session = acceptance.createSession({
    id: asIntentId('sess_demo'),
    actionType: ACTION_TYPES.CREATE_ACCEPTANCE_SESSION,
    idempotencyKey: 'sess_demo',
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'MERCHANT_ACCEPTANCE',
    payload: {
      merchantId: merchant.merchantId,
      accountId: world.account.id,
      deviceId: device.value.deviceId,
      sessionId: 'asess_demo',
      currency: asCurrencyCode('USD'),
    },
  });
  if (session.outcome !== 'OK') {
    throw new Error('session failed');
  }
  console.log(`   session=${session.value.sessionId} expires=${session.value.expiresAt}`);

  console.log('6. Merchant enters $50.');
  const started = acceptance.startPayment({
    id: asIntentId('pay_demo'),
    actionType: ACTION_TYPES.START_ACCEPTANCE_PAYMENT,
    idempotencyKey: 'pay_demo',
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'MERCHANT_ACCEPTANCE',
    payload: {
      sessionId: session.value.sessionId,
      accountId: world.account.id,
      paymentId: 'apay_demo',
      amount: Money.fromMinorUnits(5_000n, 'USD'),
      merchantReference: 'sale-50',
    },
  });
  if (started.outcome !== 'OK') {
    throw new Error('start payment failed');
  }
  console.log(`   amount=${started.value.amount.minorUnits.toString()} ${started.value.amount.currency}`);

  console.log('7. Simulated contactless provider returns APPROVED.');
  console.log(`   result=${started.value.result} providerTxn=${started.value.providerTransactionRef}`);

  console.log('8. Pending merchant settlement created.');
  console.log(`   state=${started.value.state}`);

  console.log('9. Settlement arrives.');
  const settled = acceptance.settlePayment({
    id: asIntentId('settle_demo'),
    actionType: ACTION_TYPES.SETTLE_ACCEPTANCE_PAYMENT,
    idempotencyKey: 'settle_demo',
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'MERCHANT_ACCEPTANCE',
    payload: {
      paymentId: started.value.paymentId,
      accountId: world.account.id,
      providerTransactionRef: started.value.providerTransactionRef ?? '',
    },
  });
  if (settled.outcome !== 'OK') {
    throw new Error('settle failed');
  }
  console.log(`   state=${settled.value.state} journal=${settled.value.settlementJournalId}`);

  console.log('10. Balanced journal credits merchant.');
  const journal = world.runtime.ledger.getJournal(settled.value.settlementJournalId!);
  if (!journal) {
    throw new Error('journal missing');
  }
  const debit = journal.postings
    .filter((posting) => posting.direction === 'DEBIT')
    .reduce((sum, posting) => sum + posting.amount.minorUnits, 0n);
  const credit = journal.postings
    .filter((posting) => posting.direction === 'CREDIT')
    .reduce((sum, posting) => sum + posting.amount.minorUnits, 0n);
  if (debit !== credit) {
    throw new Error('unbalanced settlement journal');
  }
  console.log(`    debit=${debit.toString()} credit=${credit.toString()}`);

  console.log('11. Explicit fee if configured.');
  if (!settled.value.feeJournalId) {
    throw new Error('expected explicit fee journal');
  }
  console.log(`    feeJournal=${settled.value.feeJournalId}`);

  console.log('12. Reconciliation = MATCHED.');
  const reconciliation = acceptance.store.getReconciliation(settled.value.paymentId);
  if (reconciliation?.status !== 'MATCHED') {
    throw new Error(`expected MATCHED, got ${reconciliation?.status}`);
  }
  console.log(`    status=${reconciliation.status}`);

  console.log('13. Duplicate callback does not duplicate credit.');
  const secret = world.secrets.resolve({
    scheme: 'secret',
    provider: 'simulation',
    path: 'acceptance-provider-callback',
    href: 'secret://simulation/acceptance-provider-callback',
  });
  if (!secret.ok) {
    throw new Error(secret.error.message);
  }
  const firstCb = acceptance.ingestAcceptanceCallback(
    signAcceptanceCallback(secret.value, {
      providerId: 'sim-softpos-provider',
      eventType: 'SETTLEMENT',
      idempotencyKey: 'settle_cb_demo',
      nonce: 'settle_cb_demo',
      timestampMs: BigInt(Date.parse(world.clock.now())),
      schemaVersion: 1,
      payload: { paymentId: settled.value.paymentId, actorId: world.actorId },
    }),
  );
  if (firstCb.outcome !== 'OK') {
    throw new Error('first settlement callback failed');
  }
  const secondCb = acceptance.ingestAcceptanceCallback(
    signAcceptanceCallback(secret.value, {
      providerId: 'sim-softpos-provider',
      eventType: 'SETTLEMENT',
      idempotencyKey: 'settle_cb_demo',
      nonce: 'settle_cb_demo',
      timestampMs: BigInt(Date.parse(world.clock.now())),
      schemaVersion: 1,
      payload: { paymentId: settled.value.paymentId, actorId: world.actorId },
    }),
  );
  if (secondCb.outcome !== 'REJECTED' && secondCb.replay !== true) {
    throw new Error('duplicate callback credited again');
  }
  console.log(`    duplicate=${secondCb.outcome} replay=${secondCb.replay ?? false}`);

  console.log('14. Suspended device cannot transact.');
  const suspended = acceptance.suspendDevice(device.value.deviceId);
  if (suspended.outcome !== 'OK') {
    throw new Error('suspend failed');
  }
  const blocked = acceptance.createSession({
    id: asIntentId('sess_blocked'),
    actionType: ACTION_TYPES.CREATE_ACCEPTANCE_SESSION,
    idempotencyKey: 'sess_blocked',
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'MERCHANT_ACCEPTANCE',
    payload: {
      merchantId: merchant.merchantId,
      accountId: world.account.id,
      deviceId: device.value.deviceId,
      sessionId: 'asess_blocked',
      currency: asCurrencyCode('USD'),
    },
  });
  if (blocked.outcome !== 'REJECTED') {
    throw new Error('suspended device was allowed to transact');
  }
  console.log(`    blocked=${blocked.outcome} code=${blocked.outcome === 'REJECTED' ? blocked.code : ''}`);

  console.log('TAP-TO-PAY DEMO COMPLETE');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
