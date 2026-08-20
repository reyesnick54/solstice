import type { PoolClient } from 'pg';

import type { DomainEvent } from '../../../events/src/events.ts';
import type { OperationExecutionRecord } from '../../../events/src/operation/types.ts';
import { insertSealedDomainEvent } from '../ledger/event-fabric.ts';
import { withTransaction } from '../postgres/write.ts';
import type { PersistenceSession } from '../session.ts';
import { insertOperationExecution } from './pg-operation-store.ts';

/**
 * Domain persistence mutation + sealed outbox insert in one ledger
 * transaction. The caller must not hold this transaction across a
 * provider call.
 */
export async function persistOperationWithOutbox(
  session: PersistenceSession,
  input: {
    readonly record: OperationExecutionRecord;
    readonly events?: readonly DomainEvent[];
  },
): Promise<void> {
  await withTransaction(session.pools.ledger, async (client: PoolClient) => {
    await insertOperationExecution(client, input.record);
    for (const event of input.events ?? []) {
      await insertSealedDomainEvent(client, event);
    }
  });
}
