import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PostgresOperationalStore } from '../../packages/persistence/src/production/operational/pg-store.ts';
import { createPersistencePools } from '../../packages/persistence/src/index.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;

describePersistence('CHUNK-154 PostgreSQL operational persistence', () => {
  it('persists payment SUBMISSION_UNKNOWN and dual-asset custody through reopen', async () => {
    const env = await preparePersistence();
    const pools = createPersistencePools(env);
    try {
      const store = new PostgresOperationalStore(pools.customer, pools.security);
      const payment = await store.upsertOperationalPayment({
        paymentId: 'pay_pg_1',
        customerId: 'cust_1',
        status: 'SUBMISSION_UNKNOWN',
        idempotencyKey: 'pg-idem-1',
        railSubmissionId: 'rail_pg_1',
        providerIdempotencyKey: 'prov-pg-1',
        quoteExecutionRef: 'fx_pg_1',
        revision: 1,
      });
      assert.equal(payment.status, 'SUBMISSION_UNKNOWN');
      await store.putRailSubmission({
        railSubmissionId: 'rail_pg_1',
        paymentId: 'pay_pg_1',
        provider: 'fixture-rail',
        idempotencyKey: 'prov-pg-1',
        status: 'SUBMISSION_UNKNOWN',
        executionUnknown: true,
        revision: 1,
      });
      await store.putWallet({
        walletId: 'wal_s',
        vaultId: 'vault_pg',
        assetId: 'SUNREY_COIN',
        revision: 1,
      });
      await store.putWithdrawal({
        withdrawalId: 'wd_s',
        customerId: 'cust_1',
        vaultId: 'vault_pg',
        walletId: 'wal_s',
        assetId: 'SUNREY_COIN',
        quantity: '8',
        state: 'SUBMISSION_UNKNOWN',
        submittedOnce: true,
        submissionId: 'sub_s',
        providerIdempotencyKey: 'wd-s',
        journalId: null,
        revision: 1,
      });
      await store.putWithdrawal({
        withdrawalId: 'wd_m',
        customerId: 'cust_1',
        vaultId: 'vault_pg',
        walletId: 'wal_m',
        assetId: 'MOONREY_COIN',
        quantity: '3',
        state: 'SUBMISSION_UNKNOWN',
        submittedOnce: true,
        submissionId: 'sub_m',
        providerIdempotencyKey: 'wd-m',
        journalId: null,
        revision: 1,
      });
      await store.putSettlement({
        intentId: 'set_pg',
        tradeId: 'tr_pg',
        baseAsset: 'SUNREY_COIN',
        quoteAsset: 'MOONREY_COIN',
        submission: 'SUBMISSION_UNKNOWN',
        journalId: null,
        revision: 1,
      });
      await store.putProvider({
        providerId: 'prov_pg',
        profileVersion: '1',
        profileHash: 'f'.repeat(64),
        acceptanceStatus: 'REVOKED',
        credentialDescriptorId: 'cred_pg',
        credentialVersion: 1,
        credentialReferenceHash: '1'.repeat(64),
        endpointProfileRef: 'endpoint://fixture',
        certificationRef: null,
        revalidationState: 'PENDING',
        suspensionState: 'REVOKED',
        rawCredentialPresent: false,
        revision: 1,
      });
      await store.putCredentialRef({
        descriptorId: 'cred_pg',
        providerId: 'prov_pg',
        credentialKind: 'API_KEY',
        version: 1,
        referenceHash: '2'.repeat(64),
        endpointProfileRef: 'endpoint://fixture',
        status: 'ACTIVE',
        rawCredentialPresent: false,
        privateKeyPresent: false,
      });
      const unresolved = await store.loadUnresolved();
      assert.equal(unresolved.payments[0]?.providerIdempotencyKey, 'prov-pg-1');
      assert.ok(unresolved.withdrawals.some((row) => row.assetId === 'SUNREY_COIN'));
      assert.ok(unresolved.withdrawals.some((row) => row.assetId === 'MOONREY_COIN'));
      assert.equal(unresolved.settlements[0]?.submission, 'SUBMISSION_UNKNOWN');
      assert.equal(unresolved.providers[0]?.acceptanceStatus, 'REVOKED');
    } finally {
      await Promise.all([
        pools.customer.end(),
        pools.ledger.end(),
        pools.evidence.end(),
        pools.security.end(),
      ]);
    }
  });
});
