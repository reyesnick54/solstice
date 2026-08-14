import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Client } from 'pg';

import { randomUUID } from 'node:crypto';

import { DATABASES } from '../../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;

describePersistence('PostgreSQL financial constraints', () => {
  it('rejects an unbalanced journal at commit and refuses journal mutation', async () => {
    const env = await preparePersistence();
    const seeded = await createDurableRuntime(env);
    await seeded.close();
    const journalId = `j_unbalanced_${randomUUID()}`;
    const client = new Client({
      host: env.host,
      port: env.port,
      user: env.ledgerUser,
      password: env.ledgerPassword,
      database: DATABASES.ledger,
    });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO ledger.journal (
           id, idempotency_key, execution_authority_id, action_type, asset, created_at
         ) VALUES ($1, $2, 'ea', 'POST_DEPOSIT', 'USD', NOW())`,
        [journalId, `unbalanced_${journalId}`],
      );
      await client.query(
        `INSERT INTO ledger.posting (
           id, journal_id, account_id, direction, currency, minor_units, ordinal
         ) VALUES
           ($1, $3, 'SIMULATION.FUNDING_SOURCE', 'DEBIT', 'USD', 10, 0),
           ($2, $3, 'SIMULATION.FUNDING_SOURCE', 'CREDIT', 'USD', 9, 1)`,
        [`p1_${journalId}`, `p2_${journalId}`, journalId],
      );
      await assert.rejects(() => client.query('COMMIT'), /unbalanced/);
    } finally {
      try {
        await client.query('ROLLBACK');
      } catch {
        // already rolled back
      }
      await client.end();
    }
  });

  it('refuses UPDATE and DELETE on evidence as the runtime role', async () => {
    const env = await preparePersistence();
    const client = new Client({
      host: env.host,
      port: env.port,
      user: env.evidenceUser,
      password: env.evidencePassword,
      database: DATABASES.evidence,
    });
    await client.connect();
    try {
      await assert.rejects(
        () => client.query(`UPDATE evidence.evidence_record SET kind = 'x' WHERE seq = 1`),
        (error: unknown) =>
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          ((error as { code: string }).code === '42501' ||
            (error as { code: string }).code === '25006'),
      );
    } finally {
      await client.end();
    }
  });
});
