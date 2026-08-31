/**
 * ACCESS Wave 5 — Accounting event recording.
 *
 * Access accounting events reference canonical Money events where they exist.
 * This module does not post to the canonical ledger.
 */

import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessAccountingEventType, AccessLiabilityRecognitionStage } from './taxonomy.ts';
import type { AccessAccountingEvent, AccessAccountingEventId } from './types.ts';

const LIABILITY_STAGE_BY_EVENT: Partial<Record<AccessAccountingEventType, AccessLiabilityRecognitionStage>> =
  Object.freeze({
    ACCESS_ALLOCATION_CREATED: 'ALLOCATION_CREATED',
    ACCESS_FUNDING_RESERVED: 'FUNDING_RESERVATION_CREATED',
    ACCESS_PROVIDER_PAYMENT_AUTHORIZED: 'PROVIDER_PAYMENT_AUTHORIZED',
    ACCESS_PROVIDER_PAYMENT_CAPTURED: 'PROVIDER_PAYMENT_CAPTURED',
    ACCESS_PROVIDER_REFUND_RECEIVED: 'REFUND_PENDING',
    ACCESS_USER_REFUND_ISSUED: 'REFUND_PENDING',
  });

export function accountingEventId(): AccessAccountingEventId {
  return `aae_${randomUUID().replace(/-/g, '')}`;
}

export function createAccessAccountingEvent(input: {
  readonly eventType: AccessAccountingEventType;
  readonly accessTransactionId?: string | null;
  readonly fundingPoolId?: string | null;
  readonly currency?: string | null;
  readonly amountMinorUnits?: bigint | null;
  readonly canonicalMoneyEventRef?: string | null;
  readonly evidenceReference: string;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly createdAt: UtcInstant;
}): AccessAccountingEvent {
  return Object.freeze({
    eventId: accountingEventId(),
    eventType: input.eventType,
    liabilityStage: LIABILITY_STAGE_BY_EVENT[input.eventType] ?? null,
    accessTransactionId: input.accessTransactionId ?? null,
    fundingPoolId: input.fundingPoolId ?? null,
    currency: input.currency ?? null,
    amountMinorUnits: input.amountMinorUnits ?? null,
    canonicalMoneyEventRef: input.canonicalMoneyEventRef ?? null,
    evidenceReference: input.evidenceReference,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    createdAt: input.createdAt,
  });
}

export class AccessAccountingEventStore {
  private readonly events: AccessAccountingEvent[] = [];

  append(event: AccessAccountingEvent): AccessAccountingEvent {
    this.events.push(event);
    return event;
  }

  listByTransaction(transactionId: string): readonly AccessAccountingEvent[] {
    return Object.freeze(
      this.events.filter((row) => row.accessTransactionId === transactionId),
    );
  }

  listByType(eventType: AccessAccountingEventType): readonly AccessAccountingEvent[] {
    return Object.freeze(this.events.filter((row) => row.eventType === eventType));
  }

  all(): readonly AccessAccountingEvent[] {
    return Object.freeze([...this.events]);
  }
}

export function settlementAccountingEventSequence(input: {
  readonly accessTransactionId: string;
  readonly fundingPoolId: string;
  readonly currency: string;
  readonly accessPoolContribution: bigint;
  readonly userCopay: bigint;
  readonly providerAmount: bigint;
  readonly tokenConversionContribution: bigint;
  readonly canonicalAuthorizeRef: string | null;
  readonly canonicalCaptureRef: string | null;
  readonly evidenceReference: string;
  readonly createdAt: UtcInstant;
}): readonly AccessAccountingEvent[] {
  if (input.tokenConversionContribution !== 0n) {
    throw new Error('TokenConversionContribution must be zero');
  }
  const events: AccessAccountingEvent[] = [];
  if (input.accessPoolContribution > 0n) {
    events.push(
      createAccessAccountingEvent({
        eventType: 'ACCESS_FUNDING_RESERVED',
        accessTransactionId: input.accessTransactionId,
        fundingPoolId: input.fundingPoolId,
        currency: input.currency,
        amountMinorUnits: input.accessPoolContribution,
        evidenceReference: input.evidenceReference,
        createdAt: input.createdAt,
      }),
    );
  }
  if (input.userCopay > 0n) {
    events.push(
      createAccessAccountingEvent({
        eventType: 'ACCESS_USER_COPAY_AUTHORIZED',
        accessTransactionId: input.accessTransactionId,
        currency: input.currency,
        amountMinorUnits: input.userCopay,
        canonicalMoneyEventRef: input.canonicalAuthorizeRef,
        evidenceReference: input.evidenceReference,
        createdAt: input.createdAt,
      }),
    );
  }
  events.push(
    createAccessAccountingEvent({
      eventType: 'ACCESS_PROVIDER_PAYMENT_AUTHORIZED',
      accessTransactionId: input.accessTransactionId,
      currency: input.currency,
      amountMinorUnits: input.providerAmount,
      canonicalMoneyEventRef: input.canonicalAuthorizeRef,
      evidenceReference: input.evidenceReference,
      createdAt: input.createdAt,
    }),
  );
  if (input.accessPoolContribution > 0n) {
    events.push(
      createAccessAccountingEvent({
        eventType: 'ACCESS_PROVIDER_PAYMENT_CAPTURED',
        accessTransactionId: input.accessTransactionId,
        fundingPoolId: input.fundingPoolId,
        currency: input.currency,
        amountMinorUnits: input.accessPoolContribution,
        canonicalMoneyEventRef: input.canonicalCaptureRef,
        evidenceReference: input.evidenceReference,
        createdAt: input.createdAt,
      }),
    );
  }
  if (input.userCopay > 0n) {
    events.push(
      createAccessAccountingEvent({
        eventType: 'ACCESS_USER_COPAY_CAPTURED',
        accessTransactionId: input.accessTransactionId,
        currency: input.currency,
        amountMinorUnits: input.userCopay,
        canonicalMoneyEventRef: input.canonicalCaptureRef,
        evidenceReference: input.evidenceReference,
        createdAt: input.createdAt,
      }),
    );
  }
  return Object.freeze(events);
}

export function refundAccountingEventSequence(input: {
  readonly accessTransactionId: string;
  readonly fundingPoolId: string;
  readonly currency: string;
  readonly providerRefund: bigint;
  readonly accessPoolRestored: bigint;
  readonly userRefund: bigint;
  readonly canonicalRefundRef: string | null;
  readonly evidenceReference: string;
  readonly createdAt: UtcInstant;
}): readonly AccessAccountingEvent[] {
  const events: AccessAccountingEvent[] = [];
  if (input.providerRefund > 0n) {
    events.push(
      createAccessAccountingEvent({
        eventType: 'ACCESS_PROVIDER_REFUND_RECEIVED',
        accessTransactionId: input.accessTransactionId,
        currency: input.currency,
        amountMinorUnits: input.providerRefund,
        canonicalMoneyEventRef: input.canonicalRefundRef,
        evidenceReference: input.evidenceReference,
        createdAt: input.createdAt,
      }),
    );
  }
  if (input.accessPoolRestored > 0n) {
    events.push(
      createAccessAccountingEvent({
        eventType: 'ACCESS_FUNDING_RELEASED',
        accessTransactionId: input.accessTransactionId,
        fundingPoolId: input.fundingPoolId,
        currency: input.currency,
        amountMinorUnits: input.accessPoolRestored,
        evidenceReference: input.evidenceReference,
        createdAt: input.createdAt,
      }),
    );
  }
  if (input.userRefund > 0n) {
    events.push(
      createAccessAccountingEvent({
        eventType: 'ACCESS_USER_REFUND_ISSUED',
        accessTransactionId: input.accessTransactionId,
        currency: input.currency,
        amountMinorUnits: input.userRefund,
        canonicalMoneyEventRef: input.canonicalRefundRef,
        evidenceReference: input.evidenceReference,
        createdAt: input.createdAt,
      }),
    );
  }
  return Object.freeze(events);
}
