#!/usr/bin/env node
/**
 * Inspect outbox, inbox, and dead-letter rows in the local simulation database.
 *
 *   npm run events:outbox
 *   npm run events:inbox
 *   npm run events:dead-letters
 */
import { persistenceEnvFromProcess } from '../packages/persistence/src/env.ts';
import { createPersistencePools, closePersistencePools } from '../packages/persistence/src/postgres/pools.ts';

const kind = process.argv[2] ?? 'outbox';
const env = persistenceEnvFromProcess();
const pools = createPersistencePools(env);

const queries = {
  outbox: `SELECT event_id, delivery_state, attempt_count, next_attempt_at, last_error_code
             FROM ledger.outbox ORDER BY created_at`,
  inbox: `SELECT consumer_id, event_id, status, attempt_count, completed_at, last_error_code
            FROM ledger.inbox ORDER BY first_seen_at`,
  'dead-letters': `SELECT id, event_id, event_type, event_version, attempt_count, reason_code, replayed_at
                     FROM ledger.dead_letter ORDER BY id`,
};

const sql = queries[kind];
if (!sql) {
  console.error('usage: node scripts/events-inspect.mjs <outbox|inbox|dead-letters>');
  process.exit(1);
}

const result = await pools.ledger.query(sql);
console.log(JSON.stringify(result.rows, null, 2));
await closePersistencePools(pools);
