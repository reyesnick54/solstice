import type { AccountClass } from '../../domain/src/account-class.ts';
import type { AccountId } from '../../domain/src/account.ts';
import type { CustomerId, CustomerStatus } from '../../domain/src/customer.ts';
import type { UtcInstant } from '../../domain/src/time.ts';

import {
  sealEnvelope,
  type DurableEventEnvelope,
  type EnvelopeHints,
  type EventId,
} from './envelope.ts';

/**
 * Versioned domain events. schemaVersion is incremented when the payload
 * shape changes; readers must switch on both eventType and schemaVersion.
 *
 * Durable delivery adds the canonical envelope (eventId, correlation,
 * aggregate sequence, schemaRef). Those fields are sealed by
 * DomainEventLog.append — this is an extension of VersionedEvent, not a
 * second event model.
 */
export type VersionedEvent<T extends string, V extends number, P> = {
  readonly eventType: T;
  readonly schemaVersion: V;
  readonly occurredAt: UtcInstant;
  readonly payload: P;
} & EnvelopeHints;

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

export type CustomerStatusChangedV1 = VersionedEvent<
  'CustomerStatusChanged',
  1,
  {
    readonly customerId: CustomerId;
    readonly fromStatus: CustomerStatus;
    readonly toStatus: CustomerStatus;
    readonly customerVersion: number;
  }
>;

export type KernelDecisionRecordedV1 = VersionedEvent<
  'KernelDecisionRecorded',
  1,
  {
    readonly intentId: string;
    readonly actionType: string;
    readonly status: string;
    readonly evidenceRecordId: string;
    readonly executionAuthorityId: string | null;
  }
>;

export type PolicyPackActivatedV1 = VersionedEvent<
  'PolicyPackActivated',
  1,
  {
    readonly packId: string;
    readonly versionId: string;
    readonly packHash: string;
    readonly lifecycle: string;
  }
>;

export type PolicyPackRetiredV1 = VersionedEvent<
  'PolicyPackRetired',
  1,
  {
    readonly packId: string;
    readonly versionId: string;
    readonly packHash: string;
    readonly lifecycle: string;
  }
>;

export type PolicyReviewRequestedV1 = VersionedEvent<
  'PolicyReviewRequested',
  1,
  {
    readonly reviewId: string;
    readonly decision: string;
    readonly packId: string | null;
    readonly versionId: string | null;
    readonly factsHash: string;
  }
>;

export type PolicyReviewDecidedV1 = VersionedEvent<
  'PolicyReviewDecided',
  1,
  {
    readonly reviewId: string;
    readonly status: string;
    readonly decidedByKind: string;
    readonly packId: string | null;
    readonly factsHash: string;
  }
>;

export type DomainEvent =
  | AccountOpenedV1
  | DepositPostedV1
  | WithdrawalPostedV1
  | InternalTransferPostedV1
  | CustomerStatusChangedV1
  | KernelDecisionRecordedV1
  | PolicyPackActivatedV1
  | PolicyPackRetiredV1
  | PolicyReviewRequestedV1
  | PolicyReviewDecidedV1;

export type SealedDomainEvent = DomainEvent & DurableEventEnvelope<DomainEvent['eventType'], DomainEvent['schemaVersion']>;

export type EventPersistSink = {
  appendEvent(event: DomainEvent): void;
};

export class DomainEventLog {
  private readonly events: SealedDomainEvent[] = [];
  private readonly persist: EventPersistSink | undefined;
  private readonly sequences = new Map<string, number>();

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
    this.sequences.clear();
    this.replacePersistedEvents(events);
  }

  private replacePersistedEvents(events: readonly DomainEvent[]): void {
    for (const event of events) {
      const sealed = this.seal(event);
      this.events.push(sealed);
      this.noteSequence(sealed);
    }
  }

  append<E extends DomainEvent>(event: E): E & DurableEventEnvelope<E['eventType'], E['schemaVersion']> {
    const sealed = this.seal(event);
    this.events.push(sealed);
    this.noteSequence(sealed);
    this.persist?.appendEvent(sealed);
    return sealed as E & DurableEventEnvelope<E['eventType'], E['schemaVersion']>;
  }

  list(): readonly SealedDomainEvent[] {
    return this.events.slice();
  }

  getById(eventId: EventId | string): SealedDomainEvent | undefined {
    return this.events.find((event) => event.eventId === eventId);
  }

  private seal(event: DomainEvent): SealedDomainEvent {
    const inferred = `${event.aggregateType ?? ''}:${event.aggregateId ?? ''}`;
    const next = (event.aggregateSequence ?? (this.sequences.get(inferred) ?? 0) + 1);
    return sealEnvelope(
      {
        eventType: event.eventType,
        schemaVersion: event.schemaVersion,
        occurredAt: event.occurredAt,
        payload: event.payload,
        eventId: event.eventId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        aggregateSequence: event.aggregateSequence,
        correlationId: event.correlationId,
        causationId: event.causationId,
        intentId: event.intentId,
        evidenceId: event.evidenceId,
        jurisdiction: event.jurisdiction,
        cellId: event.cellId,
        schemaRef: event.schemaRef,
        metadata: event.metadata,
      },
      next,
    ) as SealedDomainEvent;
  }

  private noteSequence(event: SealedDomainEvent): void {
    const key = `${event.aggregateType}:${event.aggregateId}`;
    const current = this.sequences.get(key) ?? 0;
    if (event.aggregateSequence > current) {
      this.sequences.set(key, event.aggregateSequence);
    }
  }
}

export function isSealedEvent(event: DomainEvent): event is SealedDomainEvent {
  return typeof event.eventId === 'string' && typeof event.aggregateSequence === 'number';
}
