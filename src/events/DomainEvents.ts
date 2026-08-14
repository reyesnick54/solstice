export type DomainEvent =
  | DepositPostedEvent
  | DepositRefusedEvent;

export interface DepositPostedEvent {
  readonly type: "DepositPosted";
  readonly journalId: string;
  readonly customerAccountId: string;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly occurredAt: string;
}

export interface DepositRefusedEvent {
  readonly type: "DepositRefused";
  readonly customerAccountId: string;
  readonly reason: string;
  readonly occurredAt: string;
}

export class DomainEventLog {
  private readonly events: DomainEvent[] = [];

  append<E extends DomainEvent>(event: E): E {
    this.events.push(event);
    return event;
  }

  list(): readonly DomainEvent[] {
    return this.events.slice();
  }
}
