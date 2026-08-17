import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { DurableCustodyStore } from './custody/durable-store.ts';
import { DurableExchangeStore } from './exchange/durable-store.ts';
import {
  EVENT_FABRIC_IS_NOT_A_JOURNAL,
  assertNotJournal,
  crashRecoverOutbox,
} from './production/event-fabric.ts';
import { postgresReadiness } from './production/health.ts';
import { assertMigrationSafe, planDomainMigration } from './production/migration-control.ts';
import { evaluateCapacity, loggingBounded } from './production/monitoring.ts';
import { createLocalPitrArchive, restoreLocalPitr } from './production/pitr.ts';
import {
  LEDGER_AUTHORITY,
  POSTGRES_AUTHORITY,
  assertNoInlineProductionPassword,
  productionCandidateProfile,
  simulationEnvRemainsLocal,
} from './production/profile.ts';
import { acceptReplicaRead, routeFinancialWrite } from './production/replication.ts';

describe('Chunk 67 PostgreSQL production durability', () => {
  it('keeps application PostgreSQL off the blockchain and ledger authority', () => {
    const profile = productionCandidateProfile();
    assert.equal(profile.authority, POSTGRES_AUTHORITY);
    assert.equal(profile.notBlockchainConsensus, true);
    assert.equal(profile.notSecondLedger, true);
    assert.equal(profile.tls.enabled, true);
    assert.equal(profile.managedPitrClaimed, false);
    assert.equal(LEDGER_AUTHORITY.includes('Ledger.postJournal'), true);
    assertNoInlineProductionPassword(profile);
    assert.equal(simulationEnvRemainsLocal(), true);
    assert.equal(postgresReadiness(profile).ready, true);
  });

  it('routes financial writes to primary and rejects stale replica mutation', () => {
    const profile = productionCandidateProfile();
    const write = routeFinancialWrite(profile.topology);
    assert.equal(write.allowed, true);
    assert.equal(write.route, 'PRIMARY');
    const stale = acceptReplicaRead(profile.topology, {
      role: 'READ_REPLICA',
      observedLagMs: 10_000n,
      consistency: 'CANONICAL',
      financialMutation: false,
    });
    assert.equal(stale.allowed, false);
    const mutation = acceptReplicaRead(profile.topology, {
      role: 'READ_REPLICA',
      observedLagMs: 0n,
      consistency: 'EVENTUAL',
      financialMutation: true,
    });
    assert.equal(mutation.allowed, false);
  });

  it('reproduces local PITR without claiming a managed provider', () => {
    const archive = createLocalPitrArchive('base', ['wal-a', 'wal-b']);
    const restored = restoreLocalPitr(archive, 'base', archive.segments[0]!.lsn);
    assert.equal(restored.restored, true);
    assert.equal(restored.managedPitrClaimed, false);
    assert.equal(restored.appliedSegments, 1);
  });

  it('requires backup verification before a production schema migration', () => {
    const plan = planDomainMigration({
      domain: 'ledger',
      sourceSchema: 'V001',
      files: [
        {
          version: 1,
          filename: 'V001__ledger.sql',
          absolutePath: '/tmp/V001__ledger.sql',
          checksum: 'a'.repeat(64),
          sql: 'SELECT 1',
        },
      ],
      backupChecksum: 'b'.repeat(64),
      expectedBackupChecksum: 'b'.repeat(64),
    });
    assert.equal(plan.backupVerified, true);
    assert.equal(plan.compatible, true);
    assertMigrationSafe(plan);
  });

  it('recovers custody withdrawals without duplicates and keeps SUBMISSION_UNKNOWN', () => {
    const dir = mkdtempSync(join(tmpdir(), 'custody-durable-'));
    const store = new DurableCustodyStore(dir);
    store.createWithdrawal({
      withdrawalId: 'w1',
      customerId: 'cust_1',
      state: 'APPROVED',
      submittedOnce: false,
      submissionId: null,
      approvalIds: ['ap1'],
      journalId: null,
    });
    store.markUnknown('w1', 'sub_unknown');
    assert.throws(() =>
      store.createWithdrawal({
        withdrawalId: 'w1',
        customerId: 'cust_1',
        state: 'PENDING',
        submittedOnce: false,
        submissionId: null,
        approvalIds: [],
        journalId: null,
      }),
    );
    const reopened = store.reopen();
    const [row] = reopened.list().withdrawals;
    assert.equal(row?.state, 'SUBMISSION_UNKNOWN');
    assert.equal(row?.submittedOnce, true);
    assert.equal(row?.journalId, null);
    assert.equal(reopened.list().notQuantityAuthority, true);
  });

  it('recovers exchange orders and reservations after restart', () => {
    const dir = mkdtempSync(join(tmpdir(), 'exchange-durable-'));
    const store = new DurableExchangeStore(dir);
    store.upsertOrder({
      orderId: 'o1',
      clientIdempotencyKey: 'client-1',
      state: 'RESERVED',
      holdId: 'hold-1',
    });
    store.reserve({ reservationId: 'r1', orderId: 'o1', quantity: '10' });
    store.recordTrade({ tradeId: 't1', buyOrderId: 'o1', sellOrderId: 'o2' });
    store.recordSettlement({
      intentId: 's1',
      tradeId: 't1',
      submission: 'SUBMISSION_UNKNOWN',
      journalId: null,
    });
    const again = store.upsertOrder({
      orderId: 'o1-dup',
      clientIdempotencyKey: 'client-1',
      state: 'OPEN',
      holdId: null,
    });
    assert.equal(again.orderId, 'o1');
    const reopened = store.reopen();
    assert.equal(reopened.list().orders.length, 1);
    assert.equal(reopened.list().reservations.length, 1);
    assert.equal(reopened.list().trades.length, 1);
    assert.equal(reopened.list().chainRemainsNativeAssetAuthority, true);
  });

  it('does not treat outbox records as journals after crash recovery', () => {
    assert.equal(EVENT_FABRIC_IS_NOT_A_JOURNAL, true);
    const recovered = crashRecoverOutbox([
      { eventId: 'e1', state: 'IN_FLIGHT', notAJournal: true },
      { eventId: 'e2', state: 'DELIVERED', notAJournal: true },
    ]);
    assert.equal(recovered[0]?.state, 'PENDING');
    assert.equal(recovered[1]?.state, 'DELIVERED');
    for (const row of recovered) {
      assertNotJournal(row);
    }
  });

  it('warns before disk, WAL, snapshot, database, and log exhaustion', () => {
    const guards = evaluateCapacity({
      usedBytes: 90n,
      capacityBytes: 100n,
      walBytes: 20n,
      snapshotBytes: 30n,
      logBytes: 10n,
      postgresBytes: 60n,
      warnRatio: 0.8,
    });
    assert.equal(guards.some((row) => row.code === 'DISK_EXHAUSTION'), true);
    assert.equal(loggingBounded(5n, 10n), false);
  });
});
