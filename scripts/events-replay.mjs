#!/usr/bin/env node
/**
 * Explicitly replay a stored event by id. Preserves the original event identity.
 *
 *   npm run events:replay -- --event-id <id>
 *   npm run events:replay -- --event-type AccountOpened --consumer local.inspect
 */
import { replayEvents } from '../packages/events/src/replay.ts';
import { persistenceEnvFromProcess } from '../packages/persistence/src/env.ts';
import { createPersistencePools, closePersistencePools } from '../packages/persistence/src/postgres/pools.ts';
import {
  PostgresDeadLetterStore,
  PostgresEventCatalog,
  PostgresInboxStore,
  PostgresOutboxStore,
} from '../packages/persistence/src/ledger/event-fabric.ts';

const args = process.argv.slice(2);
function flag(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const env = persistenceEnvFromProcess();
const pools = createPersistencePools(env);
const result = await replayEvents({
  catalog: new PostgresEventCatalog(pools.ledger),
  outbox: new PostgresOutboxStore(pools.ledger),
  inbox: new PostgresInboxStore(pools.ledger),
  deadLetters: new PostgresDeadLetterStore(pools.ledger),
  filter: {
    eventId: flag('--event-id'),
    eventType: flag('--event-type'),
    aggregateId: flag('--aggregate-id'),
    consumerId: flag('--consumer'),
  },
  now: new Date().toISOString(),
});
console.log(JSON.stringify(result, null, 2));
await closePersistencePools(pools);
