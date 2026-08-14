import type { AccountClass } from '../../domain/src/account-class.ts';
import type { AccountId } from '../../domain/src/account.ts';
import type { CustomerId } from '../../domain/src/customer.ts';
import type { UtcInstant } from '../../domain/src/time.ts';

/**
 * Versioned domain events. schemaVersion is incremented when the payload
 * shape changes; readers must switch on both eventType and schemaVersion.
 */
export type VersionedEvent<T extends string, V extends number, P> = {
  readonly eventType: T;
  readonly schemaVersion: V;
  readonly occurredAt: UtcInstant;
  readonly payload: P;
};

export type AccountOpenedV1 = VersionedEvent<
  'AccountOpened',
  1,
  {
    readonly accountId: AccountId;
    readonly ownerId: CustomerId;
    readonly accountClass: AccountClass;
    readonly executionAuthorityId: string;
    readonly intentId: string;
  }
>;

export type DepositPostedV1 = VersionedEvent<
  'DepositPosted',
  1,
  {
    readonly journalId: string;
    readonly accountId: AccountId;
    readonly amountMinorUnits: string;
    readonly currency: string;
  }
>;

export type WithdrawalPostedV1 = VersionedEvent<
  'WithdrawalPosted',
  1,
  {
    readonly journalId: string;
    readonly accountId: AccountId;
    readonly amountMinorUnits: string;
    readonly currency: string;
  }
>;

export type InternalTransferPostedV1 = VersionedEvent<
  'InternalTransferPosted',
  1,
  {
    readonly journalId: string;
    readonly sourceAccountId: AccountId;
    readonly destinationAccountId: AccountId;
    readonly amountMinorUnits: string;
    readonly currency: string;
    readonly classBridgeName: string | null;
  }
>;

export type DomainEvent =
  | AccountOpenedV1
  | DepositPostedV1
  | WithdrawalPostedV1
  | InternalTransferPostedV1;

export type EventPersistSink = {
  appendEvent(event: DomainEvent): void;
};

export class DomainEventLog {
  private readonly events: DomainEvent[] = [];
  private readonly persist: EventPersistSink | undefined;

  constructor(persist?: EventPersistSink) {
    this.persist = persist;
  }

  hydrateFromPersisted(events: readonly DomainEvent[]): void {
    if (this.events.length !== 0) {
      throw new Error('cannot hydrate a domain event log that already has events');
    }
    this.replacePersistedEvents(events);
  }

  reloadFromPersisted(events: readonly DomainEvent[]): void {
    this.events.length = 0;
    this.replacePersistedEvents(events);
  }

  private replacePersistedEvents(events: readonly DomainEvent[]): void {
    for (const event of events) {
      this.events.push(Object.freeze(event) as DomainEvent);
    }
  }

  append<E extends DomainEvent>(event: E): E {
    this.events.push(Object.freeze(event) as DomainEvent);
    this.persist?.appendEvent(event);
    return event;
  }

  list(): readonly DomainEvent[] {
    return this.events.slice();
  }
}
