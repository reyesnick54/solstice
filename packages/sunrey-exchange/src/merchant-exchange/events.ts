import type { UtcInstant } from '../../../domain/src/time.ts';
import type { DomainEventLog } from '../../../events/src/events.ts';

export const MERCHANT_EXCHANGE_EVENT_TYPES = [
  'MerchantExchangeIntentCreated',
  'MerchantExchangeIntentVerified',
  'MerchantExchangeIntentOpened',
  'MerchantExchangeMerchantMatched',
  'MerchantExchangeOfferSubmitted',
  'MerchantExchangeOfferUpdated',
  'MerchantExchangeOfferExpired',
  'MerchantExchangeOfferSelected',
  'MerchantExchangePurchaseAuthorized',
  'MerchantExchangePurchaseStarted',
  'MerchantExchangePurchaseCompleted',
  'MerchantExchangeSettlementCompleted',
  'MerchantExchangePurchaseFailed',
] as const;

export type MerchantExchangeEventType = (typeof MERCHANT_EXCHANGE_EVENT_TYPES)[number];

export type MerchantExchangeEventPayload = {
  readonly intentId?: string;
  readonly offerId?: string;
  readonly merchantId?: string;
  readonly purchaseId?: string;
  readonly userId?: string;
  readonly status?: string;
  readonly reason?: string;
  readonly offerVersion?: number;
  readonly contentHash?: string;
  readonly authorizationContext?: string;
};

export function emitMerchantExchangeEvent(
  events: DomainEventLog,
  eventType: MerchantExchangeEventType,
  aggregateId: string,
  payload: MerchantExchangeEventPayload,
  occurredAt: UtcInstant,
): void {
  events.append({
    eventType: eventType as never,
    schemaVersion: 1 as never,
    occurredAt,
    aggregateType: 'MerchantExchange',
    aggregateId,
    payload: payload as never,
  });
}

/** Map internal lifecycle events to canonical audit event names. */
export const AUDIT_EVENT_MAP = Object.freeze({
  intent_created: 'MerchantExchangeIntentCreated',
  intent_verified: 'MerchantExchangeIntentVerified',
  intent_opened: 'MerchantExchangeIntentOpened',
  merchant_matched: 'MerchantExchangeMerchantMatched',
  offer_submitted: 'MerchantExchangeOfferSubmitted',
  offer_updated: 'MerchantExchangeOfferUpdated',
  offer_expired: 'MerchantExchangeOfferExpired',
  offer_selected: 'MerchantExchangeOfferSelected',
  purchase_authorized: 'MerchantExchangePurchaseAuthorized',
  purchase_started: 'MerchantExchangePurchaseStarted',
  purchase_completed: 'MerchantExchangePurchaseCompleted',
  settlement_completed: 'MerchantExchangeSettlementCompleted',
  purchase_failed: 'MerchantExchangePurchaseFailed',
} as const);
