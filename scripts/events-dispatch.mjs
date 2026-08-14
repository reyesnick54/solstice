#!/usr/bin/env node
/**
 * Run one in-process dispatcher pass against the local simulation outbox.
 *
 *   npm run events:dispatch
 */
import { OutboxDispatcher } from '../packages/events/src/dispatcher.ts';
import { InProcessTransport } from '../packages/events/src/transport.ts';
import { persistenceEnvFromProcess } from '../packages/persistence/src/env.ts';
import { createPersistencePools, closePersistencePools } from '../packages/persistence/src/postgres/pools.ts';
import {
  PostgresDeadLetterStore,
  PostgresInboxStore,
  PostgresOutboxStore,
} from '../packages/persistence/src/ledger/event-fabric.ts';
import { InboxProcessor } from '../packages/events/src/consumer.ts';

const env = persistenceEnvFromProcess();
const pools = createPersistencePools(env);
const outbox = new PostgresOutboxStore(pools.ledger);
const inbox = new PostgresInboxStore(pools.ledger);
const deadLetters = new PostgresDeadLetterStore(pools.ledger);
const transport = new InProcessTransport();
const processor = new InboxProcessor(inbox, { now: () => new Date().toISOString() });
transport.subscribe(async (envelope) => {
  await processor.process(
    {
      consumerId: 'local.inspect',
      handle(event) {
        console.log(`consumed ${event.eventType} ${event.eventId}`);
      },
    },
    envelope,
  );
});
const dispatcher = new OutboxDispatcher(outbox, deadLetters, transport, {
  workerId: 'local-dispatcher',
  clock: { now: () => new Date().toISOString(), nowMs: () => Date.now() },
});
const result = await dispatcher.dispatchOnce();
console.log(JSON.stringify(result, null, 2));
await closePersistencePools(pools);
