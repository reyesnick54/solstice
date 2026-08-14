import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSimulationKeyProvider } from '../../packages/security/src/simulation.ts';
import { PostgresKeyMetadataStore } from '../../packages/persistence/src/security/pg-key-metadata.ts';
import { closePersistencePools, createPersistencePools } from '../../packages/persistence/src/postgres/pools.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;

describePersistence('security key metadata persistence', () => {
  it('stores metadata only and survives a new pool after close', async () => {
    const env = await preparePersistence();
    const keys = createSimulationKeyProvider();
    keys.rotateKey('DATA_ENCRYPTION');
    const first = createPersistencePools(env);
    const store = new PostgresKeyMetadataStore(first.security);
    for (const meta of keys.listKeyMetadata()) {
      await store.upsert(meta);
    }
    await closePersistencePools(first);

    const second = createPersistencePools(env);
    const reloaded = new PostgresKeyMetadataStore(second.security);
    const rows = await reloaded.list('DATA_ENCRYPTION');
    await closePersistencePools(second);

    assert.ok(rows.length >= 2);
    assert.equal(rows.some((row) => row.version === 1 && row.status === 'DEPRECATED'), true);
    assert.equal(rows.some((row) => row.version === 2 && row.status === 'ACTIVE'), true);
    for (const row of rows) {
      assert.equal('material' in row, false);
      assert.ok(row.providerRef.startsWith('secret://'));
      assert.equal(row.publicMaterial, null);
    }
  });
});
