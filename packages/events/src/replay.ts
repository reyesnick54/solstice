import type { DurableEventEnvelope, EventId } from './envelope.ts';
import type { DeadLetterStore, OutboxStore } from './dispatcher.ts';
import type { InboxStore } from './consumer.ts';

export type ReplayFilter = {
  readonly eventId?: EventId | string;
  readonly eventType?: string;
  readonly aggregateType?: string;
  readonly aggregateId?: string;
  readonly fromOccurredAt?: string;
  readonly toOccurredAt?: string;
  readonly consumerId?: string;
};

export type EventCatalog = {
  get(eventId: string): Promise<DurableEventEnvelope | undefined>;
  list(): Promise<readonly DurableEventEnvelope[]>;
};

/**
 * Explicit operator replay. Preserves the original event identity.
 * Does not create a new event. Consumers remain idempotent via inbox.
 */
export async function replayEvents(input: {
  readonly catalog: EventCatalog;
  readonly outbox: OutboxStore;
  readonly inbox: InboxStore;
  readonly deadLetters: DeadLetterStore;
  readonly filter: ReplayFilter;
  readonly now: string;
}): Promise<{ readonly replayed: number; readonly eventIds: readonly string[] }> {
  const matches = (await input.catalog.list()).filter((envelope) => matchesFilter(envelope, input.filter));
  const eventIds: string[] = [];
  for (const envelope of matches) {
    await input.outbox.requeue(envelope.eventId, input.now);
    if (input.filter.consumerId) {
      await input.inbox.resetForReplay(input.filter.consumerId, envelope.eventId);
    }
    await input.deadLetters.markReplayed(envelope.eventId, input.now);
    eventIds.push(envelope.eventId);
  }
  return { replayed: eventIds.length, eventIds };
}

function matchesFilter(envelope: DurableEventEnvelope, filter: ReplayFilter): boolean {
  if (filter.eventId && envelope.eventId !== filter.eventId) {
    return false;
  }
  if (filter.eventType && envelope.eventType !== filter.eventType) {
    return false;
  }
  if (filter.aggregateType && envelope.aggregateType !== filter.aggregateType) {
    return false;
  }
  if (filter.aggregateId && envelope.aggregateId !== filter.aggregateId) {
    return false;
  }
  if (filter.fromOccurredAt && envelope.occurredAt < filter.fromOccurredAt) {
    return false;
  }
  if (filter.toOccurredAt && envelope.occurredAt > filter.toOccurredAt) {
    return false;
  }
  return true;
}
