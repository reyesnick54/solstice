import { DurableCustodyStore } from '../../custody/durable-store.ts';
import { DurableExchangeStore } from '../../exchange/durable-store.ts';
import { DurablePaymentStore } from '../../payments/durable-store.ts';
import { DurableProviderStore } from '../../provider/durable-store.ts';
import { MemoryOperationalStore } from '../operational/memory-store.ts';

export function seedOperationalFixtures(directory: string): {
  readonly payments: DurablePaymentStore;
  readonly custody: DurableCustodyStore;
  readonly exchange: DurableExchangeStore;
  readonly providers: DurableProviderStore;
  readonly memory: MemoryOperationalStore;
} {
  const payments = new DurablePaymentStore(directory);
  const custody = new DurableCustodyStore(directory);
  const exchange = new DurableExchangeStore(directory);
  const providers = new DurableProviderStore(directory);
  const memory = new MemoryOperationalStore();

  payments.upsertPayment({
    paymentId: 'pay_1',
    customerId: 'cust_1',
    status: 'FUNDS_RESERVED',
    idempotencyKey: 'pay-idem-1',
    railSubmissionId: null,
    providerIdempotencyKey: null,
    quoteExecutionRef: 'fx_exec_1',
    revision: 1,
  });
  payments.upsertPayment({
    paymentId: 'pay_1',
    customerId: 'cust_1',
    status: 'SUBMISSION_UNKNOWN',
    idempotencyKey: 'pay-idem-1',
    railSubmissionId: 'rail_1',
    providerIdempotencyKey: 'provider-idem-pay-1',
    quoteExecutionRef: 'fx_exec_1',
    revision: 1,
  });
  payments.upsertSubmission({
    railSubmissionId: 'rail_1',
    paymentId: 'pay_1',
    provider: 'fixture-rail',
    idempotencyKey: 'provider-idem-pay-1',
    status: 'SUBMISSION_UNKNOWN',
    executionUnknown: true,
    revision: 1,
  });

  custody.upsertVault({
    vaultId: 'vault_1',
    label: 'institutional',
    controlPolicy: 'DUAL_CONTROL',
    authorizedAssets: ['SUNREY_COIN', 'MOONREY_COIN'],
  });
  custody.upsertWallet({ walletId: 'wal_sunrey', vaultId: 'vault_1', assetId: 'SUNREY_COIN' });
  custody.upsertWallet({ walletId: 'wal_moonrey', vaultId: 'vault_1', assetId: 'MOONREY_COIN' });
  custody.createWithdrawal({
    withdrawalId: 'wd_sunrey',
    customerId: 'cust_1',
    assetId: 'SUNREY_COIN',
    quantity: '10',
    state: 'APPROVED',
    submittedOnce: false,
    submissionId: null,
    providerIdempotencyKey: null,
    approvalIds: ['ap1'],
    journalId: null,
    revision: 1,
  });
  custody.markUnknown('wd_sunrey', 'sub_sunrey');
  custody.createWithdrawal({
    withdrawalId: 'wd_moonrey',
    customerId: 'cust_1',
    assetId: 'MOONREY_COIN',
    quantity: '4',
    state: 'APPROVED',
    submittedOnce: false,
    submissionId: null,
    providerIdempotencyKey: null,
    approvalIds: ['ap2'],
    journalId: null,
    revision: 1,
  });
  custody.markUnknown('wd_moonrey', 'sub_moonrey');
  custody.upsertReservation({
    reservationId: 'res_sunrey',
    vaultId: 'vault_1',
    assetId: 'SUNREY_COIN',
    quantity: '3',
    released: false,
    debited: false,
    revision: 1,
  });

  exchange.upsertOrder({
    orderId: 'ord_1',
    clientIdempotencyKey: 'client-ord-1',
    state: 'RESERVED',
    holdId: 'hold_1',
    baseAsset: 'SUNREY_COIN',
    quoteAsset: 'MOONREY_COIN',
    revision: 1,
  });
  exchange.reserve({
    reservationId: 'ex_res_1',
    orderId: 'ord_1',
    assetId: 'SUNREY_COIN',
    quantity: '5',
    revision: 1,
  });
  exchange.recordTrade({ tradeId: 'tr_1', buyOrderId: 'ord_1', sellOrderId: 'ord_2' });
  exchange.recordSettlement({
    intentId: 'set_1',
    tradeId: 'tr_1',
    baseAsset: 'SUNREY_COIN',
    quoteAsset: 'MOONREY_COIN',
    submission: 'SUBMISSION_UNKNOWN',
    journalId: null,
    revision: 1,
  });

  providers.upsertProfile({
    providerId: 'prov_1',
    profileVersion: '1',
    profileHash: 'a'.repeat(64),
    acceptanceStatus: 'ACCEPTED',
    credentialDescriptorId: 'cred_1',
    credentialVersion: 2,
    credentialReferenceHash: 'b'.repeat(64),
    endpointProfileRef: 'endpoint://fixture',
    certificationRef: 'cert://fixture',
    revalidationState: 'PENDING',
    suspensionState: 'NONE',
    rawCredentialPresent: false,
    revision: 1,
  });

  memory.putPayment({
    paymentId: 'pay_1',
    customerId: 'cust_1',
    status: 'SUBMISSION_UNKNOWN',
    idempotencyKey: 'pay-idem-1',
    railSubmissionId: 'rail_1',
    providerIdempotencyKey: 'provider-idem-pay-1',
    quoteExecutionRef: 'fx_exec_1',
    revision: 2,
  });
  memory.putWithdrawal({
    withdrawalId: 'wd_sunrey',
    customerId: 'cust_1',
    vaultId: 'vault_1',
    walletId: 'wal_sunrey',
    assetId: 'SUNREY_COIN',
    quantity: '10',
    state: 'SUBMISSION_UNKNOWN',
    submittedOnce: true,
    submissionId: 'sub_sunrey',
    providerIdempotencyKey: 'provider-idem-wd-sunrey',
    journalId: null,
    revision: 2,
  });
  memory.putWithdrawal({
    withdrawalId: 'wd_moonrey',
    customerId: 'cust_1',
    vaultId: 'vault_1',
    walletId: 'wal_moonrey',
    assetId: 'MOONREY_COIN',
    quantity: '4',
    state: 'SUBMISSION_UNKNOWN',
    submittedOnce: true,
    submissionId: 'sub_moonrey',
    providerIdempotencyKey: 'provider-idem-wd-moonrey',
    journalId: null,
    revision: 2,
  });
  memory.putSettlement({
    intentId: 'set_1',
    tradeId: 'tr_1',
    baseAsset: 'SUNREY_COIN',
    quoteAsset: 'MOONREY_COIN',
    submission: 'SUBMISSION_UNKNOWN',
    journalId: null,
    revision: 1,
  });
  memory.putProvider({
    providerId: 'prov_1',
    profileVersion: '1',
    profileHash: 'a'.repeat(64),
    acceptanceStatus: 'ACCEPTED',
    credentialDescriptorId: 'cred_1',
    credentialVersion: 2,
    credentialReferenceHash: 'b'.repeat(64),
    endpointProfileRef: 'endpoint://fixture',
    certificationRef: 'cert://fixture',
    revalidationState: 'PENDING',
    suspensionState: 'NONE',
    rawCredentialPresent: false,
    revision: 1,
  });
  memory.putOutbox({
    eventId: 'evt_1',
    aggregateId: 'pay_1',
    kind: 'PAYMENT_SUBMISSION_UNKNOWN',
    state: 'IN_FLIGHT',
    leaseExpiresAt: '2020-01-01T00:00:00.000Z',
    notAJournal: true,
  });
  memory.putInbox({
    consumerId: 'payments-reconciler',
    eventId: 'evt_1',
    state: 'PROCESSING',
    interrupted: true,
  });

  return { payments, custody, exchange, providers, memory };
}
