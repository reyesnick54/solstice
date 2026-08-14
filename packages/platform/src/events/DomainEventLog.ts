import type { CatalogEventName } from '../../../contracts/src/events-catalog.ts';
import type { UtcInstant } from '../../../contracts/src/time.ts';
import { asEventId, type EventId } from '../../../contracts/src/ids.ts';

export type DomainEvent = {
  readonly id: EventId;
  readonly name: CatalogEventName;
  readonly occurredAt: UtcInstant;
  readonly payload: unknown;
};

export class DomainEventLog {
  private readonly events: DomainEvent[] = [];
  private seq = 0;

  append(name: CatalogEventName, occurredAt: UtcInstant, payload: unknown): DomainEvent {
    this.seq += 1;
    const event: DomainEvent = Object.freeze({
      id: asEventId(`evt_${this.seq}`),
      name,
      occurredAt,
      payload,
    });
    this.events.push(event);
    return event;
  }

  list(): readonly DomainEvent[] {
    return this.events.slice();
  }

  names(): readonly CatalogEventName[] {
    return this.events.map((e) => e.name);
  }
}
