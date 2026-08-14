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

export class DomainEventLog {
  private readonly events: DomainEvent[] = [];

  append<E extends DomainEvent>(event: E): E {
    this.events.push(Object.freeze(event));
    return event;
  }

  list(): readonly DomainEvent[] {
    return this.events.slice();
  }
}
