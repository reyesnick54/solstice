/**
 * Access virtual-card webhook ingestion with signature verification.
 *
 * Uses an injected webhook guard port so access-economy does not import
 * packages/security directly.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import { assertNoSensitiveCardPayload } from './pci-keys.ts';
import type { AccessCardLifecycleEvent } from './taxonomy.ts';

export const ACCESS_VIRTUAL_CARD_WEBHOOK_EVENTS = [
  'access.card.created',
  'access.card.authorization_pending',
  'access.card.authorization_approved',
  'access.card.authorization_declined',
  'access.card.captured',
  'access.card.reversed',
  'access.card.refunded',
  'access.card.disabled',
] as const;
export type AccessVirtualCardWebhookEvent = (typeof ACCESS_VIRTUAL_CARD_WEBHOOK_EVENTS)[number];

const EVENT_MAP: Readonly<Record<AccessVirtualCardWebhookEvent, AccessCardLifecycleEvent>> = Object.freeze({
  'access.card.created': 'CARD_CREATED',
  'access.card.authorization_pending': 'AUTHORIZATION_PENDING',
  'access.card.authorization_approved': 'AUTHORIZATION_APPROVED',
  'access.card.authorization_declined': 'AUTHORIZATION_DECLINED',
  'access.card.captured': 'CAPTURED',
  'access.card.reversed': 'REVERSED',
  'access.card.refunded': 'REFUNDED',
  'access.card.disabled': 'CARD_DISABLED',
});

export type AccessWebhookEnvelope = {
  readonly schemaVersion: number;
  readonly providerId: string;
  readonly eventType: string;
  readonly timestampUtc: string;
  readonly nonce: string;
  readonly idempotencyKey: string;
  readonly payloadHash: string;
  readonly signatureHex: string;
  readonly environment?: string;
};

export type WebhookGuardPort = {
  registerProvider(providerId: string, secret: string): void;
  sign(input: Omit<AccessWebhookEnvelope, 'signatureHex'>, secret: string): AccessWebhookEnvelope;
  validate(
    envelope: AccessWebhookEnvelope,
    nowMs: number,
  ):
    | { readonly ok: true; readonly duplicate: boolean }
    | { readonly ok: false; readonly code: string };
};

export type AccessVirtualCardWebhookIngestResult =
  | {
      readonly accepted: true;
      readonly duplicate: boolean;
      readonly eventType: AccessCardLifecycleEvent;
      readonly settlementId: string;
      readonly cardId: string;
    }
  | { readonly accepted: false; readonly code: string };

export class AccessVirtualCardWebhookIngestor {
  private readonly guard: WebhookGuardPort;
  private readonly processed = new Set<string>();

  constructor(guard: WebhookGuardPort) {
    this.guard = guard;
  }

  registerProvider(providerId: string, secret: string): void {
    this.guard.registerProvider(providerId, secret);
  }

  sign(input: Omit<AccessWebhookEnvelope, 'signatureHex'>, secret: string): AccessWebhookEnvelope {
    return this.guard.sign(input, secret);
  }

  ingest(input: {
    readonly envelope: AccessWebhookEnvelope;
    readonly payload: Readonly<Record<string, unknown>>;
    readonly nowMs: number;
    readonly verificationRequired?: boolean;
  }): AccessVirtualCardWebhookIngestResult {
    assertNoSensitiveCardPayload(input.payload, 'access.virtual-card.webhook');
    if (input.verificationRequired === false) {
      return { accepted: false, code: 'WEBHOOK_SIGNATURE_INVALID' };
    }
    const validated = this.guard.validate(input.envelope, input.nowMs);
    if (!validated.ok) {
      if (validated.code === 'REPLAYED') {
        return { accepted: false, code: 'DUPLICATE_WEBHOOK' };
      }
      return {
        accepted: false,
        code:
          validated.code === 'INVALID_SIGNATURE' || validated.code === 'STALE_TIMESTAMP'
            ? 'WEBHOOK_SIGNATURE_INVALID'
            : validated.code,
      };
    }
    if (validated.duplicate) {
      return { accepted: false, code: 'DUPLICATE_WEBHOOK' };
    }
    if (
      !(ACCESS_VIRTUAL_CARD_WEBHOOK_EVENTS as readonly string[]).includes(input.envelope.eventType)
    ) {
      return { accepted: false, code: 'UNSUPPORTED_EVENT' };
    }
    const settlementId = String(input.payload.settlementId ?? '');
    const cardId = String(input.payload.cardId ?? '');
    if (!settlementId || !cardId) {
      return { accepted: false, code: 'MISSING_REFERENCE' };
    }
    const dedupeKey = `${input.envelope.providerId}:${input.envelope.idempotencyKey}`;
    if (this.processed.has(dedupeKey)) {
      return { accepted: false, code: 'DUPLICATE_WEBHOOK' };
    }
    this.processed.add(dedupeKey);
    return {
      accepted: true,
      duplicate: validated.duplicate,
      eventType: EVENT_MAP[input.envelope.eventType as AccessVirtualCardWebhookEvent],
      settlementId,
      cardId,
    };
  }
}

export function normalizeLifecycleEvent(
  eventType: AccessCardLifecycleEvent,
  payload: Readonly<Record<string, unknown>>,
  now: UtcInstant,
): {
  readonly eventId: string;
  readonly eventType: AccessCardLifecycleEvent;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAt: UtcInstant;
} {
  return Object.freeze({
    eventId: String(payload.eventId ?? `evt_${now}`),
    eventType,
    payload,
    createdAt: now,
  });
}
