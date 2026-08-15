import { randomUUID } from 'node:crypto';

import { type Brand, brandAs } from '../../domain/src/brand.ts';
import type { UtcInstant } from '../../domain/src/time.ts';

import { schemaRefFor } from './taxonomy.ts';

export type EventId = Brand<string, 'EventId'>;
export type CorrelationId = Brand<string, 'CorrelationId'>;
export type CausationId = Brand<string, 'CausationId'>;

export function asEventId(value: string): EventId {
  if (value.length === 0) {
    throw new TypeError('EventId must be a non-empty string');
  }
  return brandAs<string, 'EventId'>(value);
}

export function newEventId(): EventId {
  return asEventId(randomUUID());
}

export function asCorrelationId(value: string): CorrelationId {
  if (value.length === 0) {
    throw new TypeError('CorrelationId must be a non-empty string');
  }
  return brandAs<string, 'CorrelationId'>(value);
}

export function asCausationId(value: string): CausationId {
  if (value.length === 0) {
    throw new TypeError('CausationId must be a non-empty string');
  }
  return brandAs<string, 'CausationId'>(value);
}

export type AggregateRef = {
  readonly type: string;
  readonly id: string;
};

export type EventMetadata = Readonly<Record<string, string>>;

/**
 * Canonical durable envelope. This extends VersionedEvent; it is not a
 * second event model. schemaVersion remains the payload version.
 * eventVersion is the same integer, named for the envelope contract.
 */
export type DurableEventEnvelope<T extends string = string, V extends number = number, P = unknown> = {
  readonly eventId: EventId;
  readonly eventType: T;
  readonly eventVersion: V;
  readonly schemaVersion: V;
  readonly occurredAt: UtcInstant;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateSequence: number;
  readonly correlationId: CorrelationId;
  readonly causationId: CausationId | null;
  readonly intentId: string | null;
  readonly evidenceId: string | null;
  readonly jurisdiction: string | null;
  readonly cellId: string | null;
  readonly schemaRef: string;
  readonly payload: P;
  readonly metadata: EventMetadata;
};

export type EnvelopeHints = {
  readonly eventId?: string | undefined;
  readonly aggregateType?: string | undefined;
  readonly aggregateId?: string | undefined;
  readonly aggregateSequence?: number | undefined;
  readonly correlationId?: string | undefined;
  readonly causationId?: string | null | undefined;
  readonly intentId?: string | null | undefined;
  readonly evidenceId?: string | null | undefined;
  readonly jurisdiction?: string | null | undefined;
  readonly cellId?: string | null | undefined;
  readonly schemaRef?: string | undefined;
  readonly metadata?: EventMetadata | undefined;
};

export type SealedEventInput<T extends string, V extends number, P> = {
  readonly eventType: T;
  readonly schemaVersion: V;
  readonly occurredAt: UtcInstant;
  readonly payload: P;
} & EnvelopeHints;

const SENSITIVE_PAYLOAD_KEYS = [
  'password',
  'secret',
  'ssn',
  'taxId',
  'tax_id',
  'hmacKey',
  'signature',
  'kycDocument',
  'rawPii',
  'privateKey',
  'privateKeyMaterial',
  'plaintext',
  'secretValue',
  'accessToken',
  'sessionSecret',
  'iban',
  'accountNumber',
  'routingNumber',
  'accountCoordinateValue',
  'providerPayload',
  'rawProvider',
  'articleBody',
  'articleContent',
  'fullName',
  'dateOfBirth',
  'legalName',
  'pan',
  'PAN',
  'cvv',
  'CVV',
  'cvc',
  'CVC',
  'pin',
  'PIN',
  'trackData',
  'track1',
  'track2',
  'magstripe',
];

export function assertSafeEventPayload(payload: unknown): void {
  if (payload === null || typeof payload !== 'object') {
    return;
  }
  for (const key of Object.keys(payload as Record<string, unknown>)) {
    if (SENSITIVE_PAYLOAD_KEYS.includes(key)) {
      throw new Error(`event payload must not include sensitive field '${key}'`);
    }
  }
}

export function inferAggregate(eventType: string, payload: unknown): AggregateRef {
  const body = payload !== null && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  if (eventType === 'AccountOpened' || eventType === 'DepositPosted' || eventType === 'WithdrawalPosted') {
    return { type: 'account', id: String(body.accountId ?? 'unknown') };
  }
  if (eventType === 'InternalTransferPosted') {
    return { type: 'account', id: String(body.sourceAccountId ?? 'unknown') };
  }
  if (eventType === 'CustomerStatusChanged') {
    return { type: 'customer', id: String(body.customerId ?? 'unknown') };
  }
  if (eventType === 'KernelDecisionRecorded') {
    return { type: 'intent', id: String(body.intentId ?? 'unknown') };
  }
  if (eventType === 'PolicyPackActivated' || eventType === 'PolicyPackRetired') {
    return { type: 'policy_pack', id: String(body.packId ?? 'unknown') };
  }
  if (eventType === 'PolicyReviewRequested' || eventType === 'PolicyReviewDecided') {
    return { type: 'policy_review', id: String(body.reviewId ?? 'unknown') };
  }
  if (eventType.startsWith('Identity')) {
    return { type: 'identity', id: String(body.identityId ?? 'unknown') };
  }
  if (eventType.startsWith('Payment') || eventType === 'BeneficiaryCreated') {
    return {
      type: 'payment',
      id: String(body.paymentId ?? body.beneficiaryId ?? 'unknown'),
    };
  }
  if (eventType.startsWith('FxQuote')) {
    return { type: 'fx_quote', id: String(body.quoteId ?? 'unknown') };
  }
  if (
    eventType === 'KeyCreated' ||
    eventType === 'KeyRotated' ||
    eventType === 'KeyRetired' ||
    eventType === 'KeyRevoked'
  ) {
    return { type: 'key', id: String(body.keyId ?? 'unknown') };
  }
  if (
    eventType === 'ComplianceScreeningCompleted' ||
    eventType === 'ComplianceScreeningReviewRequired'
  ) {
    return { type: 'compliance_screening', id: String(body.screeningId ?? 'unknown') };
  }
  if (eventType === 'ComplianceCaseOpened' || eventType === 'ComplianceCaseDecided') {
    return { type: 'compliance_case', id: String(body.caseId ?? 'unknown') };
  }
  if (eventType === 'ComplianceAlertCreated') {
    return { type: 'compliance_alert', id: String(body.alertId ?? 'unknown') };
  }
  if (eventType === 'FraudRiskEvaluated') {
    return { type: 'fraud_evaluation', id: String(body.evaluationId ?? 'unknown') };
  }
  if (eventType.startsWith('Card')) {
    return {
      type: 'card',
      id: String(
        body.cardId ??
          body.authorizationId ??
          body.clearingId ??
          body.refundId ??
          body.disputeId ??
          'unknown',
      ),
    };
  }
  if (eventType.startsWith('Rail')) {
    return {
      type: 'rail',
      id: String(body.railSubmissionId ?? body.paymentId ?? body.inboundId ?? 'unknown'),
    };
  }
  return { type: 'unknown', id: String(body.id ?? eventType) };
}

export function sealEnvelope<T extends string, V extends number, P>(
  input: SealedEventInput<T, V, P>,
  sequence: number,
): DurableEventEnvelope<T, V, P> {
  assertSafeEventPayload(input.payload);
  const inferred = inferAggregate(input.eventType, input.payload);
  const eventId = asEventId(input.eventId ?? randomUUID());
  const correlation = asCorrelationId(input.correlationId ?? input.intentId ?? eventId);
  return Object.freeze({
    eventId,
    eventType: input.eventType,
    eventVersion: input.schemaVersion,
    schemaVersion: input.schemaVersion,
    occurredAt: input.occurredAt,
    aggregateType: input.aggregateType ?? inferred.type,
    aggregateId: input.aggregateId ?? inferred.id,
    aggregateSequence: input.aggregateSequence ?? sequence,
    correlationId: correlation,
    causationId: input.causationId ? asCausationId(input.causationId) : null,
    intentId: input.intentId ?? null,
    evidenceId: input.evidenceId ?? null,
    jurisdiction: input.jurisdiction ?? null,
    cellId: input.cellId ?? null,
    schemaRef: input.schemaRef ?? schemaRefFor(input.eventType, input.schemaVersion),
    payload: input.payload,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

export function serializeEnvelope(envelope: DurableEventEnvelope): string {
  return JSON.stringify({
    eventId: envelope.eventId,
    eventType: envelope.eventType,
    eventVersion: envelope.eventVersion,
    schemaVersion: envelope.schemaVersion,
    occurredAt: envelope.occurredAt,
    aggregateType: envelope.aggregateType,
    aggregateId: envelope.aggregateId,
    aggregateSequence: envelope.aggregateSequence,
    correlationId: envelope.correlationId,
    causationId: envelope.causationId,
    intentId: envelope.intentId,
    evidenceId: envelope.evidenceId,
    jurisdiction: envelope.jurisdiction,
    cellId: envelope.cellId,
    schemaRef: envelope.schemaRef,
    payload: envelope.payload,
    metadata: envelope.metadata,
  });
}

export function parseEnvelope(serialized: string): DurableEventEnvelope {
  const raw = JSON.parse(serialized) as DurableEventEnvelope;
  if (typeof raw.eventId !== 'string' || typeof raw.eventType !== 'string') {
    throw new Error('serialized envelope is missing eventId or eventType');
  }
  if (typeof raw.schemaVersion !== 'number' && typeof raw.eventVersion !== 'number') {
    throw new Error('serialized envelope is unversioned');
  }
  const version = (raw.schemaVersion ?? raw.eventVersion) as number;
  return sealEnvelope(
    {
      eventType: raw.eventType,
      schemaVersion: version,
      occurredAt: raw.occurredAt,
      payload: raw.payload,
      eventId: raw.eventId,
      aggregateType: raw.aggregateType,
      aggregateId: raw.aggregateId,
      aggregateSequence: raw.aggregateSequence,
      correlationId: raw.correlationId,
      causationId: raw.causationId,
      intentId: raw.intentId,
      evidenceId: raw.evidenceId,
      jurisdiction: raw.jurisdiction,
      cellId: raw.cellId,
      schemaRef: raw.schemaRef,
      metadata: raw.metadata,
    },
    raw.aggregateSequence,
  );
}
