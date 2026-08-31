/**
 * Access Wave 4 canonical product events.
 * Feeds Action Center and notification surfaces — no second event bus.
 */

import type { AccessEventPriority, AccessProductEventType } from './taxonomy.ts';
import { ACCESS_EVENT_PRIORITY_BY_TYPE } from './taxonomy.ts';

export type AccessProductEvent = {
  readonly eventId: string;
  readonly type: AccessProductEventType;
  readonly occurredAt: string;
  readonly customerId: string;
  readonly transactionId: string | null;
  readonly stateTransitionId: string | null;
  readonly resourceId: string;
  readonly summary: string;
  readonly userTitle: string;
  readonly userBody: string;
  readonly priority: AccessEventPriority;
  readonly channel: 'TRANSACTIONAL' | 'PROMOTIONAL';
  readonly autoNotify: boolean;
  readonly deduplicationKey: string;
  readonly availableActions: readonly string[];
  readonly dataState: 'SIMULATED' | 'LIVE';
};

export type AccessProductEventInput = {
  readonly eventId: string;
  readonly type: AccessProductEventType;
  readonly occurredAt: string;
  readonly customerId: string;
  readonly transactionId?: string | null;
  readonly stateTransitionId?: string | null;
  readonly resourceId: string;
  readonly summary: string;
  readonly userTitle: string;
  readonly userBody: string;
  readonly channel?: 'TRANSACTIONAL' | 'PROMOTIONAL';
  readonly autoNotify?: boolean;
  readonly availableActions?: readonly string[];
  readonly dataState?: 'SIMULATED' | 'LIVE';
};

export function createAccessProductEvent(input: AccessProductEventInput): AccessProductEvent {
  const channel = input.channel ?? (input.type === 'ACCESS_OPPORTUNITY_AVAILABLE' ? 'PROMOTIONAL' : 'TRANSACTIONAL');
  const deduplicationKey = [
    input.type,
    input.transactionId ?? '',
    input.stateTransitionId ?? '',
    input.resourceId,
  ].join(':');
  return Object.freeze({
    eventId: input.eventId,
    type: input.type,
    occurredAt: input.occurredAt,
    customerId: input.customerId,
    transactionId: input.transactionId ?? null,
    stateTransitionId: input.stateTransitionId ?? null,
    resourceId: input.resourceId,
    summary: input.summary,
    userTitle: input.userTitle,
    userBody: input.userBody,
    priority: ACCESS_EVENT_PRIORITY_BY_TYPE[input.type],
    channel,
    autoNotify: input.autoNotify ?? channel === 'TRANSACTIONAL',
    deduplicationKey,
    availableActions: input.availableActions ?? Object.freeze([]),
    dataState: input.dataState ?? 'SIMULATED',
  });
}

export function bookingConfirmedEvent(input: {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly customerId: string;
  readonly transactionId: string;
  readonly stateTransitionId: string;
  readonly serviceName: string;
  readonly providerDisplayName: string;
}): AccessProductEvent {
  return createAccessProductEvent({
    eventId: input.eventId,
    type: 'ACCESS_BOOKING_CONFIRMED',
    occurredAt: input.occurredAt,
    customerId: input.customerId,
    transactionId: input.transactionId,
    stateTransitionId: input.stateTransitionId,
    resourceId: input.transactionId,
    summary: `Booking confirmed: ${input.serviceName}`,
    userTitle: 'Your booking is confirmed',
    userBody: `Your ${input.serviceName} with ${input.providerDisplayName} is confirmed.`,
    channel: 'TRANSACTIONAL',
  });
}

export function bookingProcessingEvent(input: {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly customerId: string;
  readonly transactionId: string;
  readonly stateTransitionId: string;
  readonly serviceName: string;
}): AccessProductEvent {
  return createAccessProductEvent({
    eventId: input.eventId,
    type: 'ACCESS_BOOKING_PROCESSING',
    occurredAt: input.occurredAt,
    customerId: input.customerId,
    transactionId: input.transactionId,
    stateTransitionId: input.stateTransitionId,
    resourceId: input.transactionId,
    summary: `Booking processing: ${input.serviceName}`,
    userTitle: "We're confirming your booking",
    userBody: `We're confirming your ${input.serviceName}. We'll update you shortly.`,
    channel: 'TRANSACTIONAL',
  });
}

export function paymentActionRequiredEvent(input: {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly customerId: string;
  readonly transactionId: string;
  readonly stateTransitionId: string;
  readonly amountLabel: string;
}): AccessProductEvent {
  return createAccessProductEvent({
    eventId: input.eventId,
    type: 'ACCESS_PAYMENT_ACTION_REQUIRED',
    occurredAt: input.occurredAt,
    customerId: input.customerId,
    transactionId: input.transactionId,
    stateTransitionId: input.stateTransitionId,
    resourceId: input.transactionId,
    summary: `Payment action required: ${input.amountLabel}`,
    userTitle: 'Payment method needed',
    userBody: `We need a payment method for your ${input.amountLabel} contribution.`,
    channel: 'TRANSACTIONAL',
    availableActions: Object.freeze(['ADD_PAYMENT_METHOD']),
  });
}

export function quoteExpiringEvent(input: {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly customerId: string;
  readonly transactionId: string;
  readonly minutesRemaining: number;
}): AccessProductEvent {
  return createAccessProductEvent({
    eventId: input.eventId,
    type: 'ACCESS_QUOTE_EXPIRING',
    occurredAt: input.occurredAt,
    customerId: input.customerId,
    transactionId: input.transactionId,
    stateTransitionId: null,
    resourceId: input.transactionId,
    summary: `Quote expiring in ${input.minutesRemaining} minutes`,
    userTitle: 'Your Access quote expires soon',
    userBody: `Your Access quote expires in ${input.minutesRemaining} minutes.`,
    channel: 'TRANSACTIONAL',
    availableActions: Object.freeze(['REQUOTE']),
  });
}

export function refundProcessedEvent(input: {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly customerId: string;
  readonly transactionId: string;
  readonly stateTransitionId: string;
  readonly amountLabel: string;
  readonly partial: boolean;
}): AccessProductEvent {
  return createAccessProductEvent({
    eventId: input.eventId,
    type: input.partial ? 'ACCESS_PARTIAL_REFUND' : 'ACCESS_REFUNDED',
    occurredAt: input.occurredAt,
    customerId: input.customerId,
    transactionId: input.transactionId,
    stateTransitionId: input.stateTransitionId,
    resourceId: input.transactionId,
    summary: `Refund processed: ${input.amountLabel}`,
    userTitle: input.partial ? 'Partial refund processed' : 'Your refund has been processed',
    userBody: input.partial
      ? `A partial refund of ${input.amountLabel} has been processed.`
      : `Your ${input.amountLabel} refund has been processed.`,
    channel: 'TRANSACTIONAL',
  });
}

export function entitlementExpiringSoonEvent(input: {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly customerId: string;
  readonly entitlementId: string;
  readonly categoryLabel: string;
  readonly remainingUnits: number;
  readonly unitLabel: string;
  readonly daysRemaining: number;
}): AccessProductEvent {
  return createAccessProductEvent({
    eventId: input.eventId,
    type: 'ACCESS_EXPIRING_SOON',
    occurredAt: input.occurredAt,
    customerId: input.customerId,
    transactionId: null,
    stateTransitionId: null,
    resourceId: input.entitlementId,
    summary: `${input.categoryLabel} expiring in ${input.daysRemaining} days`,
    userTitle: `Your ${input.categoryLabel} expires soon`,
    userBody: `You have ${input.remainingUnits} ${input.unitLabel} remaining. Expires in ${input.daysRemaining} days.`,
    channel: 'TRANSACTIONAL',
  });
}

export function opportunityAvailableEvent(input: {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly customerId: string;
  readonly opportunityId: string;
  readonly title: string;
  readonly categoryLabel: string;
}): AccessProductEvent {
  return createAccessProductEvent({
    eventId: input.eventId,
    type: 'ACCESS_OPPORTUNITY_AVAILABLE',
    occurredAt: input.occurredAt,
    customerId: input.customerId,
    transactionId: null,
    stateTransitionId: null,
    resourceId: input.opportunityId,
    summary: `Opportunity: ${input.title}`,
    userTitle: `Use Access for ${input.categoryLabel}`,
    userBody: input.title,
    channel: 'PROMOTIONAL',
    autoNotify: false,
  });
}

export function allocationAvailableEvent(input: {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly customerId: string;
  readonly entitlementId: string;
  readonly categoryLabel: string;
  readonly units: number;
  readonly unitLabel: string;
}): AccessProductEvent {
  return createAccessProductEvent({
    eventId: input.eventId,
    type: 'ACCESS_ALLOCATION_AVAILABLE',
    occurredAt: input.occurredAt,
    customerId: input.customerId,
    transactionId: null,
    stateTransitionId: null,
    resourceId: input.entitlementId,
    summary: `${input.units} ${input.unitLabel} available`,
    userTitle: `Your ${input.units} ${input.unitLabel} are available`,
    userBody: `You have ${input.units} ${input.categoryLabel} ${input.unitLabel} available.`,
    channel: 'TRANSACTIONAL',
  });
}

export function providerUnavailableEvent(input: {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly customerId: string;
  readonly categoryLabel: string;
}): AccessProductEvent {
  return createAccessProductEvent({
    eventId: input.eventId,
    type: 'ACCESS_PROVIDER_TEMPORARILY_UNAVAILABLE',
    occurredAt: input.occurredAt,
    customerId: input.customerId,
    transactionId: null,
    stateTransitionId: null,
    resourceId: `provider:${input.categoryLabel}`,
    summary: `${input.categoryLabel} provider temporarily unavailable`,
    userTitle: `${input.categoryLabel} temporarily unavailable`,
    userBody: `Some ${input.categoryLabel} services are temporarily unavailable. Your Available Access is unchanged.`,
    channel: 'TRANSACTIONAL',
    autoNotify: false,
  });
}
