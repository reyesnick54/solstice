import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { backupMetadata } from './ops/backup.ts';
import { storageCapacityGuards } from './ops/capacity.ts';
import { runSunreyOps } from './ops/cli.ts';
import { databaseRestoreTest, databaseStatus, verifyDatabase } from './ops/database.ts';
import { createStorageSnapshot, migrateDevStore, storageStatus, verifyStorage } from './ops/storage.ts';
import { defaultDimensionCatalog } from './mainnet/dimensions.ts';

describe('Chunk 67 storage and database ops', () => {
  it('exposes production-candidate storage status and verify', () => {
    const status = storageStatus({ height: '4', blockId: 'aa'.repeat(32), stateRoot: 'bb'.repeat(32) });
    assert.equal(status.engine, 'redb');
    assert.equal(status.blockchainAuthority, true);
    assert.equal(status.notSecondLedger, true);
    assert.equal(verifyStorage(status).ok, true);
  });

  it('migrates development storage without promoting testnet to production', () => {
    const migrated = migrateDevStore({
      height: '4',
      blockId: 'aa'.repeat(32),
      stateRoot: 'bb'.repeat(32),
      nativeSupply: 'cc'.repeat(32),
      validatorSet: 'dd'.repeat(32),
    });
    assert.equal(migrated.ok, true);
    if (migrated.ok) {
      assert.equal(migrated.value.engineeringOnly, true);
      assert.equal(migrated.value.notTestnetToProduction, true);
      assert.equal(migrated.value.stateRootEqual, true);
    }
  });

  it('creates production-candidate snapshots with storage schema', () => {
    const created = createStorageSnapshot({
      height: 2n,
      blockId: 'block-2',
      stateRoot: '11'.repeat(32),
      payload: '{"state":"ok"}',
      createdAtUtc: '2026-08-17T00:00:00.000Z',
    });
    assert.equal(created.ok, true);
    if (created.ok) {
      assert.equal(created.value.manifest.storageSchema, 1);
    }
  });

  it('runs database status, verify, and restore-test without claiming managed PITR', () => {
    const status = databaseStatus();
    assert.equal(status.authority, 'APPLICATION_ONLY');
    assert.equal(status.blockchainAuthority, false);
    assert.equal(status.managedPitrClaimed, false);
    assert.equal(verifyDatabase().ok, true);
    const drill = databaseRestoreTest();
    assert.equal(drill.ok, true);
    if (drill.ok) {
      assert.equal(drill.value.managedPitrClaimed, false);
      assert.equal(drill.value.custodyReconciliation, true);
    }
  });

  it('warns before unsafe capacity and bounds logging', () => {
    const ok = storageCapacityGuards({
      chainDbBytes: 10,
      walBytes: 1,
      snapshotBytes: 1,
      logBytes: 1,
      postgresBytes: 1,
      capacityBytes: 10_000,
    });
    assert.equal(ok.ok, true);
    const warn = storageCapacityGuards({
      chainDbBytes: 9_000,
      walBytes: 2_000,
      snapshotBytes: 3_000,
      logBytes: 2_000,
      postgresBytes: 6_000,
      capacityBytes: 10_000,
    });
    assert.equal(warn.ok, false);
  });

  it('records backup metadata with hash and encryption reference', () => {
    const meta = backupMetadata({
      source: 'POSTGRES_APPLICATION_DATA',
      heightOrSchema: 'V005',
      bytes: Buffer.from('dump'),
      encrypted: true,
      retention: '30d',
      verified: true,
    });
    assert.equal(meta.encryptionReference, 'BACKUP_ENCRYPTION');
    assert.equal(meta.verificationStatus, 'VERIFIED');
    assert.equal(meta.hash.length, 64);
  });

  it('exposes sunrey-ops storage and database commands', () => {
    const status = JSON.parse(runSunreyOps(['storage', 'status'])) as { engine: string };
    assert.equal(status.engine, 'redb');
    const db = JSON.parse(runSunreyOps(['database', 'status'])) as { authority: string };
    assert.equal(db.authority, 'APPLICATION_ONLY');
    const restore = JSON.parse(runSunreyOps(['database', 'restore-test'])) as { ok: boolean };
    assert.equal(restore.ok, true);
  });

  it('adds production storage evidence to Chunk 65 readiness', () => {
    const slot = defaultDimensionCatalog().find((row) => row.requirementId === 'REQ-STORAGE-001');
    assert.ok(slot);
    assert.equal(slot.dimension, 'STORAGE');
    assert.equal(slot.chunkReference, 'CHUNK-67');
    assert.equal(slot.verificationStatus, 'ENGINEERING_VERIFIED');
    assert.match(slot.notes ?? '', /not imply a production provider/i);
  });
});
