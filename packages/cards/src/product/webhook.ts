import { createHash } from 'node:crypto';

import {
  ProviderWebhookGuard,
  type ProviderWebhookEnvelope,
} from '../../../security/src/regulated/webhook.ts';
import type { SecretValue } from '../../../security/src/redaction.ts';
import { assertNoSensitiveCardData } from '../pci-boundary.ts';
import {
  signProcessorCallback,
  type ProcessorCallbackEnvelope,
} from '../callback.ts';
import type { CardsService, CardsServiceOutcome } from '../service.ts';

export const CARD_WEBHOOK_EVENT_TYPES = [
  'authorization',
  'capture',
  'reversal',
  'refund',
  'card_status_update',
] as const;
export type CardWebhookEventType = (typeof CARD_WEBHOOK_EVENT_TYPES)[number];

export type CardWebhookIngestResult = {
  readonly accepted: boolean;
  readonly duplicate: boolean;
  readonly eventType: string;
  readonly outcome: string;
  readonly code?: string;
};

/**
 * Maps Phase B provider-webhook envelopes onto the simulated card
 * processor callback path. Real scheme webhooks arrive in Phase D.
 */
export function ingestProviderWebhook(input: {
  readonly cards: CardsService;
  readonly guard: ProviderWebhookGuard;
  readonly envelope: ProviderWebhookEnvelope;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly nowMs: number;
  readonly processorSecret: SecretValue;
  readonly providerId?: string;
}): CardWebhookIngestResult | Promise<CardWebhookIngestResult> {
  assertNoSensitiveCardData(input.payload, 'cardWebhook.payload');
  const validated = input.guard.validate(input.envelope, input.nowMs);
  if (!validated.ok) {
    return {
      accepted: false,
      duplicate: false,
      eventType: input.envelope.eventType,
      outcome: 'REJECTED',
      code: validated.code,
    };
  }
  if (validated.duplicate) {
    return {
      accepted: true,
      duplicate: true,
      eventType: input.envelope.eventType,
      outcome: 'DUPLICATE',
    };
  }
  const mapped = mapEventType(input.envelope.eventType);
  if (!mapped) {
    return {
      accepted: false,
      duplicate: false,
      eventType: input.envelope.eventType,
      outcome: 'REJECTED',
      code: 'UNSUPPORTED_EVENT',
    };
  }
  const processorEnvelope = signProcessorCallback(input.processorSecret, {
    providerId: input.providerId ?? 'sim-card-processor',
    eventType: mapped,
    idempotencyKey: input.envelope.idempotencyKey,
    nonce: input.envelope.nonce,
    timestampMs: BigInt(input.nowMs),
    schemaVersion: 1,
    payload: input.payload,
  });
  return dispatch(input.cards, mapped, processorEnvelope);
}

export function payloadHash(payload: Readonly<Record<string, unknown>>): string {
  assertNoSensitiveCardData(payload, 'cardWebhook.payload');
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function mapEventType(eventType: string): ProcessorCallbackEnvelope['eventType'] | null {
  switch (eventType) {
    case 'authorization':
      return 'AUTHORIZATION';
    case 'capture':
      return 'CAPTURE';
    case 'reversal':
      return 'REVERSAL';
    case 'refund':
      return 'REFUND';
    case 'card_status_update':
      return 'CARD_STATUS';
    default:
      return null;
  }
}

async function dispatch(
  cards: CardsService,
  eventType: ProcessorCallbackEnvelope['eventType'],
  envelope: ProcessorCallbackEnvelope,
): Promise<CardWebhookIngestResult> {
  let result: CardsServiceOutcome<unknown>;
  switch (eventType) {
    case 'AUTHORIZATION':
      result = await cards.ingestAuthorizationCallback(envelope);
      break;
    case 'CAPTURE':
    case 'CLEARING':
      result = await cards.ingestClearingCallback(envelope);
      break;
    case 'REVERSAL':
      result = await cards.ingestReversalCallback(envelope);
      break;
    case 'REFUND':
      result = cards.ingestRefundCallback(envelope);
      break;
    case 'CARD_STATUS':
      result = cards.ingestCardStatusCallback(envelope);
      break;
  }
  return {
    accepted: result.outcome === 'OK',
    duplicate: result.outcome === 'OK' && result.replay === true,
    eventType,
    outcome: result.outcome,
    ...(result.outcome === 'REJECTED' ? { code: result.code } : {}),
  };
}
