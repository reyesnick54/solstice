import { ENVIRONMENT, LIVE_PAYMENTS_ENABLED } from '../../../config/src/flags.ts';

import {
  EFFECTIVELY_ONCE_BY_IDEMPOTENCY_AND_RECONCILIATION,
  EXACTLY_ONCE_CLAIMED,
  InMemoryOperationStore,
  QUERY_REQUIRED_BEFORE_RETRY,
  ReconciliationCoordinator,
  RECONCILIATION_CAN_POST_LEDGER,
  computeRequestDigest,
  dispatchExternalSideEffect,
  prepareOperation,
  providerIdempotencyKeyFor,
  refuseBlindRetry,
  type ProviderQueryOutcome,
} from './index.ts';

const NOW = '2026-08-20T11:14:00.000Z';
const RESTART = '2026-08-20T11:14:30.000Z';

async function demonstratePaymentRecovery(): Promise<{
  readonly duplicatePayment: boolean;
  readonly blindRetry: boolean;
}> {
  const store = new InMemoryOperationStore();
  const provider = { received: 0, confirmed: false };
  const digest = {
    operationKind: 'PAYMENT_RAIL_SUBMIT',
    amountMinor: '250000',
    assetId: 'USD',
    currency: 'USD',
    beneficiary: 'ben_acme',
    destination: 'acct_ext_acme',
    providerId: 'rail_sim_a',
    network: null,
    nativeAssetId: null,
  };
  const prepared = await prepareOperation(store, {
    operationId: 'op_pay_demo',
    operationKind: 'PAYMENT_RAIL_SUBMIT',
    businessKey: 'pay_demo_1',
    idempotencyKey: providerIdempotencyKeyFor({
      businessKey: 'pay_demo_1',
      providerId: 'rail_sim_a',
      attemptLineage: 'lineage_1',
    }),
    digest,
    now: NOW,
  });
  const unknown = await dispatchExternalSideEffect(prepared, {
    store,
    now: () => NOW,
    submit: async () => {
      provider.received += 1;
      provider.confirmed = true;
      return {
        kind: 'AMBIGUOUS',
        safeErrorCode: 'RESPONSE_LOST',
        safeErrorMessage: 'provider_accepted_but_response_lost',
        providerOperationRef: 'rail_ref_demo',
      };
    },
  });
  const restarted = await store.get(prepared.operationId);
  if (!unknown.ok || unknown.record === undefined) {
    throw new Error(unknown.ok ? 'missing unknown record' : unknown.code);
  }
  const unknownRecord = unknown.record;
  const refused = await refuseBlindRetry(restarted ?? unknownRecord);
  const coordinator = new ReconciliationCoordinator(store);
  const recovered = await coordinator.queryAndPropose(
    restarted ?? unknownRecord,
    {
      query: async (): Promise<ProviderQueryOutcome> =>
        provider.confirmed
          ? { kind: 'CONFIRMED', providerOperationRef: 'rail_ref_demo' }
          : { kind: 'NOT_FOUND' },
    },
    RESTART,
  );
  return {
    duplicatePayment: provider.received !== 1,
    blindRetry: refused.code !== QUERY_REQUIRED_BEFORE_RETRY,
    confirmed: recovered.record.state === 'CONFIRMED',
  } as { readonly duplicatePayment: boolean; readonly blindRetry: boolean; readonly confirmed?: boolean };
}

async function demonstrateCustodyRecovery(): Promise<{ readonly duplicateWithdrawal: boolean }> {
  const store = new InMemoryOperationStore();
  const provider = { broadcasts: 0 };
  const digest = {
    operationKind: 'CUSTODY_NATIVE_WITHDRAWAL',
    amountMinor: '100000000',
    assetId: 'MOONREY_COIN',
    currency: null,
    beneficiary: null,
    destination: 'addr_moon_demo',
    providerId: 'custody_sim_a',
    network: 'sunrey-chain',
    nativeAssetId: 'MOONREY_COIN',
  };
  const prepared = await prepareOperation(store, {
    operationId: 'op_wd_demo',
    operationKind: 'CUSTODY_NATIVE_WITHDRAWAL',
    businessKey: 'wd_demo_1',
    idempotencyKey: providerIdempotencyKeyFor({
      businessKey: 'wd_demo_1',
      providerId: 'custody_sim_a',
      attemptLineage: 'lineage_1',
    }),
    digest,
    now: NOW,
  });
  await dispatchExternalSideEffect(prepared, {
    store,
    now: () => NOW,
    submit: async () => {
      provider.broadcasts += 1;
      return {
        kind: 'AMBIGUOUS',
        safeErrorCode: 'BROADCAST_TIMEOUT',
        safeErrorMessage: 'chain_or_provider_ambiguous',
        providerOperationRef: 'tx_moon_demo',
      };
    },
  });
  const unknown = await store.get('op_wd_demo');
  const second = unknown
    ? await dispatchExternalSideEffect(unknown, {
        store,
        now: () => RESTART,
        submit: async () => {
          provider.broadcasts += 1;
          return { kind: 'ACCEPTED', providerOperationRef: 'tx_moon_dup' };
        },
      })
    : { ok: false, providerCalled: false };
  const coordinator = new ReconciliationCoordinator(store);
  if (unknown) {
    await coordinator.queryAndPropose(
      unknown,
      {
        query: async (): Promise<ProviderQueryOutcome> => ({
          kind: 'CONFIRMED',
          providerOperationRef: 'tx_moon_demo',
        }),
      },
      RESTART,
    );
  }
  return {
    duplicateWithdrawal: provider.broadcasts !== 1 || second.providerCalled === true,
  };
}

export async function runIdempotentRecoveryFabricDemo(): Promise<void> {
  const payment = await demonstratePaymentRecovery();
  const custody = await demonstrateCustodyRecovery();
  const sunrey = computeRequestDigest({
    operationKind: 'CUSTODY_NATIVE_WITHDRAWAL',
    amountMinor: '100',
    assetId: 'SUNREY_COIN',
    currency: null,
    beneficiary: null,
    destination: 'addr',
    providerId: 'custody_sim_a',
    network: 'sunrey-chain',
    nativeAssetId: 'SUNREY_COIN',
  });
  const moonrey = computeRequestDigest({
    operationKind: 'CUSTODY_NATIVE_WITHDRAWAL',
    amountMinor: '100',
    assetId: 'MOONREY_COIN',
    currency: null,
    beneficiary: null,
    destination: 'addr',
    providerId: 'custody_sim_a',
    network: 'sunrey-chain',
    nativeAssetId: 'MOONREY_COIN',
  });

  console.log('SunRey idempotent recovery fabric (Chunk 155)');
  console.log(`EXACTLY_ONCE_CLAIMED=${EXACTLY_ONCE_CLAIMED}`);
  console.log(
    `EFFECTIVELY_ONCE_BY_IDEMPOTENCY_AND_RECONCILIATION=${EFFECTIVELY_ONCE_BY_IDEMPOTENCY_AND_RECONCILIATION}`,
  );
  console.log(`DUPLICATE_PAYMENT_CREATED=${payment.duplicatePayment}`);
  console.log(`DUPLICATE_WITHDRAWAL_CREATED=${custody.duplicateWithdrawal}`);
  console.log(`BLIND_RETRY_AFTER_UNKNOWN=${payment.blindRetry}`);
  console.log(`CROSS_ASSET_IDEMPOTENCY_COLLISION=${sunrey === moonrey}`);
  console.log(`RECONCILIATION_CAN_POST_LEDGER=${RECONCILIATION_CAN_POST_LEDGER}`);
  console.log('REAL_PROVIDER_CALLED=false');
  console.log(`PRODUCTION_ACTIVE=${ENVIRONMENT !== 'simulation' || LIVE_PAYMENTS_ENABLED}`);
}

const isDirect = process.argv[1]?.includes('operation/demo.ts') === true;
if (isDirect) {
  await runIdempotentRecoveryFabricDemo();
}
