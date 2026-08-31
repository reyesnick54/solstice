/**
 * Access Wave 4 Action Center bridge — user-safe cards from product events.
 */

import type { AccessProductEvent } from './events.ts';
import type { AccessEventPriority } from './taxonomy.ts';

export type AccessActionCenterCard = {
  readonly cardId: string;
  readonly eventId: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly priority: AccessEventPriority;
  readonly view: 'AWAITING_APPROVAL' | 'PROCESSING' | 'COMPLETED' | 'REQUIRES_ATTENTION' | 'INFO';
  readonly transactionId: string | null;
  readonly occurredAt: string;
  readonly availableActions: readonly string[];
  readonly dataState: 'SIMULATED' | 'LIVE';
  readonly dismissible: boolean;
};

function viewForEventType(type: string): AccessActionCenterCard['view'] {
  switch (type) {
    case 'ACCESS_PAYMENT_ACTION_REQUIRED':
    case 'ACCESS_QUOTE_EXPIRING':
    case 'ACCESS_EXPIRING_SOON':
      return 'REQUIRES_ATTENTION';
    case 'ACCESS_BOOKING_PROCESSING':
    case 'ACCESS_RECONCILIATION_REQUIRED':
    case 'ACCESS_REFUND_PENDING':
      return 'PROCESSING';
    case 'ACCESS_BOOKING_CONFIRMED':
    case 'ACCESS_FULFILLED':
    case 'ACCESS_REFUNDED':
    case 'ACCESS_PARTIAL_REFUND':
    case 'ACCESS_ALLOCATION_AVAILABLE':
      return 'COMPLETED';
    case 'ACCESS_TRANSACTION_FAILED':
    case 'ACCESS_PROVIDER_TEMPORARILY_UNAVAILABLE':
      return 'REQUIRES_ATTENTION';
    default:
      return 'INFO';
  }
}

export function toActionCenterCard(event: AccessProductEvent): AccessActionCenterCard {
  return Object.freeze({
    cardId: `acc_card_${event.eventId}`,
    eventId: event.eventId,
    type: event.type,
    title: event.userTitle,
    body: event.userBody,
    priority: event.priority,
    view: viewForEventType(event.type),
    transactionId: event.transactionId,
    occurredAt: event.occurredAt,
    availableActions: event.availableActions,
    dataState: event.dataState,
    dismissible: event.channel === 'PROMOTIONAL',
  });
}

export function listAccessActionCenterCards(events: readonly AccessProductEvent[]): readonly AccessActionCenterCard[] {
  return Object.freeze(
    events
      .map(toActionCenterCard)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
  );
}

export type AccessActionCenterExternalEvent = {
  readonly type: string;
  readonly occurredAt: string;
  readonly providerId: string | null;
  readonly resourceId: string;
  readonly summary: string;
  readonly evidenceRef: string | null;
  readonly autoNotify: false;
  readonly domain: 'access';
  readonly priority: AccessEventPriority;
  readonly transactionId: string | null;
};

export function toExternalEvent(card: AccessActionCenterCard): AccessActionCenterExternalEvent {
  return Object.freeze({
    type: card.type,
    occurredAt: card.occurredAt,
    providerId: null,
    resourceId: card.transactionId ?? card.cardId,
    summary: card.title,
    evidenceRef: `access:${card.eventId}`,
    autoNotify: false,
    domain: 'access',
    priority: card.priority,
    transactionId: card.transactionId,
  });
}
