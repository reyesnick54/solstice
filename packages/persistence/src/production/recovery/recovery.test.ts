import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_BANKING_RAILS, LIVE_PAYMENTS_ENABLED } from '../../../../config/src/flags.ts';
import { DurableCustodyStore } from '../../custody/durable-store.ts';
import { DurableExchangeStore } from '../../exchange/durable-store.ts';
import { DurablePaymentStore } from '../../payments/durable-store.ts';
import { DurableProviderStore } from '../../provider/durable-store.ts';
import { LEDGER_AUTHORITY } from '../profile.ts';
import { CrashInjectedError, MemoryOperationalStore } from '../operational/memory-store.ts';
import { DurableStoreError, persistEnvelopeAtomic, wrapSnapshot } from '../snapshot-envelope.ts';
import { RECOVERY_AUTHORITY, assertDatabaseAuthorityBoundaries } from './authority.ts';
import { OPERATIONAL_BACKUP_RELATIONS } from './catalog.ts';
import { seedOperationalFixtures } from './fixtures.ts';
import { fileContainsForbiddenSecrets, scanForForbiddenSecrets } from './integrity.ts';
import { rehydrationOrder } from './rehydration.ts';
import { discoverUnresolved, recoverOutboxForRehydration } from './reconciliation.ts';
import { buildRecoveryReport } from './report.ts';

const ROOT = join(import.meta.dirname, '../../../../../');
const require = createRequire(import.meta.url);
const { REPOSITORY_TEST_GLOBS } = require('../../../../../scripts/run-repository-tests.mjs') as {
  REPOSITORY_TEST_GLOBS: string[];
};

describe('CHUNK-154 operational persistence recovery', () => {
  it('package.json has exactly one test key and includes nested suites', () => {
    const text = readFileSync(join(ROOT, 'package.json'), 'utf8');
    assert.equal([...text.matchAll(/^\s*"test"\s*:/gm)].length, 1);
    assert.equal(text.includes('"test": "node scripts/run-repository-tests.mjs"'), true);
    const coverage = REPOSITORY_TEST_GLOBS.join(' ');
    assert.match(coverage, /packages\/security\/src\/regulated\/\*\*\/\*\.test\.ts/);
    assert.match(coverage, /packages\/payments\/src\/\*\*\/\*\.test\.ts/);
    assert.match(coverage, /packages\/persistence\/src\/\*\*\/\*\.test\.ts/);
    assert.match(coverage, /packages\/sunrey-chain\/src\/release-candidate\/economic\/\*\*\/\*\.test\.ts/);
  });

  it('CI runs JSON integrity before npm ci', () => {
    const text = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    const preflightJson = text.indexOf('node scripts/check-json-integrity.mjs');
    const preflightValidate = text.indexOf('node scripts/validate-json.mjs');
    const preflightMerge = text.indexOf('node scripts/check-merge-integrity.mjs');
    const install = text.indexOf('npm ci --ignore-scripts');
    assert.ok(preflightJson >= 0 && preflightValidate >= 0 && preflightMerge >= 0 && install >= 0);
    assert.ok(preflightJson < install);
    assert.ok(preflightValidate < install);
    assert.ok(preflightMerge < install);
  });

  it('missing fixture snapshot initializes safely', () => {
    const dir = mkdtempSync(join(tmpdir(), 'empty-fixture-'));
    const store = new DurableCustodyStore(dir);
    assert.deepEqual(store.list().withdrawals, []);
    assert.equal(store.list().notQuantityAuthority, true);
  });

  it('corrupted fixture snapshot fails closed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'corrupt-fixture-'));
    writeFileSync(join(dir, 'custody.durable.json'), '{not-json', { mode: 0o600 });
    assert.throws(() => new DurableCustodyStore(dir), (error: unknown) => {
      return error instanceof DurableStoreError && error.code === 'CORRUPT_JSON';
    });
  });

  it('checksum mismatch fails closed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'checksum-fixture-'));
    persistEnvelopeAtomic(
      join(dir, 'custody.durable.json'),
      {
        ...wrapSnapshot({
          storeKind: 'CUSTODY',
          sequence: 1,
          createdAt: '2026-08-20T00:00:00.000Z',
          payload: {
            vaults: [],
            wallets: [],
            withdrawals: [],
            deposits: [],
            reservations: [],
            submissions: [],
            reconciliations: [],
            notQuantityAuthority: true,
          },
        }),
        contentHash: '0'.repeat(64),
      },
    );
    assert.throws(() => new DurableCustodyStore(dir), (error: unknown) => {
      return error instanceof DurableStoreError && error.code === 'CHECKSUM_MISMATCH';
    });
  });

  it('unsupported snapshot schema fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'schema-fixture-'));
    writeFileSync(
      join(dir, 'exchange.durable.json'),
      JSON.stringify({
        schemaVersion: 99,
        storeKind: 'EXCHANGE',
        createdAt: '2026-08-20T00:00:00.000Z',
        sequence: 1,
        contentHash: 'a'.repeat(64),
        payload: {},
      }),
      { mode: 0o600 },
    );
    assert.throws(() => new DurableExchangeStore(dir), (error: unknown) => {
      return error instanceof DurableStoreError && error.code === 'UNSUPPORTED_SCHEMA_VERSION';
    });
  });

  it('payment persists through restart including SUBMISSION_UNKNOWN', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pay-restart-'));
    const store = new DurablePaymentStore(dir);
    store.upsertPayment({
      paymentId: 'pay_1',
      customerId: 'cust_1',
      status: 'FUNDS_RESERVED',
      idempotencyKey: 'idem-1',
      railSubmissionId: null,
      providerIdempotencyKey: null,
      quoteExecutionRef: null,
      revision: 1,
    });
    store.upsertPayment({
      paymentId: 'pay_1',
      customerId: 'cust_1',
      status: 'SUBMISSION_UNKNOWN',
      idempotencyKey: 'idem-1',
      railSubmissionId: 'rail_1',
      providerIdempotencyKey: 'prov-idem-1',
      quoteExecutionRef: 'fx_1',
      revision: 1,
    });
    const reopened = store.reopen();
    const payment = reopened.list().payments[0];
    assert.equal(payment?.status, 'SUBMISSION_UNKNOWN');
    assert.equal(payment?.providerIdempotencyKey, 'prov-idem-1');
    assert.notEqual(payment?.status, 'DRAFT');
  });

  it('custody v2 SunRey and MoonRey identities survive restart', () => {
    const dir = mkdtempSync(join(tmpdir(), 'custody-assets-'));
    const store = new DurableCustodyStore(dir);
    store.createWithdrawal({
      withdrawalId: 'wd_s',
      customerId: 'cust_1',
      assetId: 'SUNREY_COIN',
      quantity: '1',
      state: 'APPROVED',
      submittedOnce: false,
      submissionId: null,
      providerIdempotencyKey: null,
      approvalIds: [],
      journalId: null,
      revision: 1,
    });
    store.createWithdrawal({
      withdrawalId: 'wd_m',
      customerId: 'cust_1',
      assetId: 'MOONREY_COIN',
      quantity: '2',
      state: 'APPROVED',
      submittedOnce: false,
      submissionId: null,
      providerIdempotencyKey: null,
      approvalIds: [],
      journalId: null,
      revision: 1,
    });
    const reopened = store.reopen();
    const assets = reopened.list().withdrawals.map((row) => row.assetId).sort();
    assert.deepEqual(assets, ['MOONREY_COIN', 'SUNREY_COIN']);
  });

  it('exchange reservation and settlement uncertainty survive restart', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ex-restart-'));
    const store = new DurableExchangeStore(dir);
    store.upsertOrder({
      orderId: 'o1',
      clientIdempotencyKey: 'c1',
      state: 'RESERVED',
      holdId: 'h1',
      baseAsset: 'SUNREY_COIN',
      quoteAsset: 'MOONREY_COIN',
      revision: 1,
    });
    store.reserve({
      reservationId: 'r1',
      orderId: 'o1',
      assetId: 'SUNREY_COIN',
      quantity: '9',
      revision: 1,
    });
    store.recordSettlement({
      intentId: 's1',
      tradeId: 't1',
      baseAsset: 'SUNREY_COIN',
      quoteAsset: 'MOONREY_COIN',
      submission: 'SUBMISSION_UNKNOWN',
      journalId: null,
      revision: 1,
    });
    const reopened = store.reopen();
    assert.equal(reopened.list().reservations[0]?.quantity, '9');
    assert.equal(reopened.list().settlements[0]?.submission, 'SUBMISSION_UNKNOWN');
    assert.equal(reopened.list().chainRemainsNativeAssetAuthority, true);
  });

  it('provider profile survives restart and revoked stays revoked', () => {
    const dir = mkdtempSync(join(tmpdir(), 'prov-restart-'));
    const store = new DurableProviderStore(dir);
    store.upsertProfile({
      providerId: 'p1',
      profileVersion: '1',
      profileHash: 'c'.repeat(64),
      acceptanceStatus: 'ACCEPTED',
      credentialDescriptorId: 'd1',
      credentialVersion: 1,
      credentialReferenceHash: 'd'.repeat(64),
      endpointProfileRef: 'endpoint://fixture',
      certificationRef: null,
      revalidationState: 'CURRENT',
      suspensionState: 'NONE',
      rawCredentialPresent: false,
      revision: 1,
    });
    store.upsertProfile({
      providerId: 'p1',
      profileVersion: '1',
      profileHash: 'c'.repeat(64),
      acceptanceStatus: 'REVOKED',
      credentialDescriptorId: 'd1',
      credentialVersion: 1,
      credentialReferenceHash: 'd'.repeat(64),
      endpointProfileRef: 'endpoint://fixture',
      certificationRef: null,
      revalidationState: 'EXPIRED',
      suspensionState: 'REVOKED',
      rawCredentialPresent: false,
      revision: 1,
    });
    const reopened = store.reopen();
    assert.equal(reopened.list().profiles[0]?.acceptanceStatus, 'REVOKED');
    assert.throws(
      () =>
        reopened.upsertProfile({
          ...reopened.list().profiles[0]!,
          acceptanceStatus: 'ACCEPTED',
        }),
      (error: unknown) => error instanceof DurableStoreError && error.code === 'ILLEGAL_TRANSITION',
    );
  });

  it('credential references persist but values do not', () => {
    const memory = new MemoryOperationalStore();
    memory.putCredentialRef({
      descriptorId: 'd1',
      providerId: 'p1',
      credentialKind: 'API_KEY',
      version: 1,
      referenceHash: 'e'.repeat(64),
      endpointProfileRef: 'endpoint://fixture',
      status: 'ACTIVE',
      rawCredentialPresent: false,
      privateKeyPresent: false,
    });
    assert.equal(memory.export().credentialRefs[0]?.rawCredentialPresent, false);
    assert.equal(JSON.stringify(memory.export()).includes('sk-live'), false);
    assert.equal(scanForForbiddenSecrets(JSON.stringify(memory.export())).length, 0);
    assert.throws(
      () =>
        memory.putCredentialRef({
          descriptorId: 'd2',
          providerId: 'p1',
          credentialKind: 'API_KEY',
          version: 1,
          referenceHash: 'e'.repeat(64),
          endpointProfileRef: null,
          status: 'ACTIVE',
          rawCredentialPresent: true as unknown as false,
          privateKeyPresent: false,
        }),
      (error: unknown) => error instanceof DurableStoreError,
    );
  });

  it('optimistic concurrency rejects a stale writer', () => {
    const memory = new MemoryOperationalStore();
    memory.upsertOperationalPayment({
      paymentId: 'pay_stale',
      customerId: 'cust_1',
      status: 'READY',
      idempotencyKey: 'stale',
      railSubmissionId: null,
      providerIdempotencyKey: null,
      quoteExecutionRef: null,
      revision: 1,
    });
    assert.throws(
      () =>
        memory.upsertOperationalPayment(
          {
            paymentId: 'pay_stale',
            customerId: 'cust_1',
            status: 'FUNDS_RESERVED',
            idempotencyKey: 'stale',
            railSubmissionId: null,
            providerIdempotencyKey: null,
            quoteExecutionRef: null,
            revision: 1,
          },
          0,
        ),
      (error: unknown) => error instanceof DurableStoreError && error.code === 'STALE_REVISION',
    );
  });

  it('rejects illegal domain transitions', () => {
    const memory = new MemoryOperationalStore();
    memory.upsertOperationalPayment({
      paymentId: 'pay_term',
      customerId: 'cust_1',
      status: 'SETTLED',
      idempotencyKey: 'term',
      railSubmissionId: 'r',
      providerIdempotencyKey: 'k',
      quoteExecutionRef: null,
      revision: 1,
    });
    assert.throws(
      () =>
        memory.upsertOperationalPayment({
          paymentId: 'pay_term',
          customerId: 'cust_1',
          status: 'SUBMITTED',
          idempotencyKey: 'term',
          railSubmissionId: 'r',
          providerIdempotencyKey: 'k',
          quoteExecutionRef: null,
          revision: 1,
        }),
      (error: unknown) => error instanceof DurableStoreError && error.code === 'ILLEGAL_TRANSITION',
    );
    memory.putOrder({
      orderId: 'filled',
      clientIdempotencyKey: 'filled',
      state: 'FILLED',
      holdId: 'h',
      baseAsset: 'SUNREY_COIN',
      quoteAsset: 'MOONREY_COIN',
      revision: 1,
    });
    assert.throws(
      () =>
        memory.putOrder({
          orderId: 'filled',
          clientIdempotencyKey: 'filled',
          state: 'OPEN',
          holdId: 'h',
          baseAsset: 'SUNREY_COIN',
          quoteAsset: 'MOONREY_COIN',
          revision: 1,
        }),
      (error: unknown) => error instanceof DurableStoreError && error.code === 'ILLEGAL_TRANSITION',
    );
  });

  it('outbox and interrupted inbox state recover without repeating submissions', () => {
    const memory = new MemoryOperationalStore();
    memory.putOutbox({
      eventId: 'e1',
      aggregateId: 'pay_1',
      kind: 'PAYMENT',
      state: 'IN_FLIGHT',
      leaseExpiresAt: '2020-01-01T00:00:00.000Z',
      notAJournal: true,
    });
    memory.putInbox({
      consumerId: 'c1',
      eventId: 'e1',
      state: 'PROCESSING',
      interrupted: true,
    });
    const recovered = recoverOutboxForRehydration(memory.export());
    assert.equal(recovered.outbox[0]?.state, 'PENDING');
    const unresolved = discoverUnresolved(memory.export());
    assert.ok(unresolved.some((row) => row.reason === 'IN_FLIGHT_LEASE_EXPIRED'));
    assert.ok(unresolved.some((row) => row.reason === 'INBOX_INTERRUPTED'));
    assert.ok(unresolved.every((row) => row.queryBeforeRetry === true));
  });

  it('startup reconciliation identifies unresolved effects', () => {
    const seeded = seedOperationalFixtures(mkdtempSync(join(tmpdir(), 'recon-')));
    const report = buildRecoveryReport({ snapshot: seeded.memory.export(), jsonIntegrityPass: true });
    assert.equal(report.readiness, 'RECONCILIATION_REQUIRED');
    assert.ok(report.unresolved.some((row) => row.domain === 'PAYMENT' && row.reason === 'SUBMISSION_UNKNOWN'));
    assert.ok(report.unresolved.some((row) => row.domain === 'CUSTODY'));
    assert.ok(report.unresolved.some((row) => row.domain === 'EXCHANGE'));
    assert.deepEqual(report.rehydrationOrder, rehydrationOrder());
  });

  it('ledger and AssetSupplyBook remain the financial and native authorities', () => {
    assertDatabaseAuthorityBoundaries(RECOVERY_AUTHORITY);
    assert.match(LEDGER_AUTHORITY, /Ledger\.postJournal/);
    assert.equal(RECOVERY_AUTHORITY.postgresIsLedger, false);
    assert.equal(RECOVERY_AUTHORITY.postgresIsNativeSupplyAuthority, false);
    assert.equal(RECOVERY_AUTHORITY.postgresCannotMintSunReyCoin, true);
    assert.equal(RECOVERY_AUTHORITY.postgresCannotMintMoonReyCoin, true);
    assert.equal(RECOVERY_AUTHORITY.postgresCannotMutateAssetSupplyBook, true);
  });

  it('corruption never creates empty financial operational state silently', () => {
    const dir = mkdtempSync(join(tmpdir(), 'no-silent-empty-'));
    const store = new DurablePaymentStore(dir);
    store.upsertPayment({
      paymentId: 'pay_keep',
      customerId: 'cust_1',
      status: 'SUBMITTED',
      idempotencyKey: 'keep',
      railSubmissionId: 'rail',
      providerIdempotencyKey: 'idem',
      quoteExecutionRef: null,
      revision: 1,
    });
    writeFileSync(store.path, '{', { mode: 0o600 });
    assert.throws(() => store.reopen(), (error: unknown) => {
      return error instanceof DurableStoreError && error.code === 'CORRUPT_JSON';
    });
  });

  it('does not change LIVE flags or make real network calls', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    assert.equal(LIVE_BANKING_RAILS, false);
    assert.ok(OPERATIONAL_BACKUP_RELATIONS.includes('payments.operational_payment'));
  });

  it('injects crashes around local commit and file rename deterministically', () => {
    const memory = new MemoryOperationalStore();
    memory.crashBeforeCommit = 'BEFORE_COMMIT';
    assert.throws(
      () =>
        memory.upsertOperationalPayment({
          paymentId: 'crash',
          customerId: 'cust_1',
          status: 'DRAFT',
          idempotencyKey: 'crash',
          railSubmissionId: null,
          providerIdempotencyKey: null,
          quoteExecutionRef: null,
          revision: 1,
        }),
      (error: unknown) => error instanceof CrashInjectedError && error.phase === 'BEFORE_COMMIT',
    );
    assert.equal(memory.export().payments.length, 0);

    const dir = mkdtempSync(join(tmpdir(), 'rename-crash-'));
    const crashing = new DurableCustodyStore(dir, { injectCrash: 'BEFORE_RENAME' });
    assert.throws(
      () =>
        crashing.createWithdrawal({
          withdrawalId: 'wd_crash',
          customerId: 'cust_1',
          assetId: 'SUNREY_COIN',
          quantity: '1',
          state: 'PENDING',
          submittedOnce: false,
          submissionId: null,
          providerIdempotencyKey: null,
          approvalIds: [],
          journalId: null,
          revision: 1,
        }),
      (error: unknown) => error instanceof DurableStoreError && error.code === 'PARTIAL_WRITE',
    );
    mkdirSync(dir, { recursive: true });
    assert.throws(() => new DurableCustodyStore(dir), (error: unknown) => {
      return error instanceof DurableStoreError && error.code === 'PARTIAL_WRITE';
    });
  });

  it('seeded fixtures do not persist raw credentials', () => {
    const dir = mkdtempSync(join(tmpdir(), 'secrets-'));
    const seeded = seedOperationalFixtures(dir);
    assert.equal(fileContainsForbiddenSecrets(seeded.providers.path), false);
    assert.equal(fileContainsForbiddenSecrets(seeded.payments.path), false);
    assert.match(readFileSync(seeded.providers.path, 'utf8'), /rawCredentialPresent":false/);
  });
});
