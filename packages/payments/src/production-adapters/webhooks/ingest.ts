/**
 * Certification webhook ingest harness.
 * Missing verification fails closed. Duplicate events are acknowledged
 * without reprocessing.
 */

import {
  ProviderWebhookGuard,
  type ProviderWebhookEnvelope,
} from '../../../security/src/regulated/webhook.ts';
import type { SecretValue } from '../../../security/src/redaction.ts';
import {
  isFinancialWebhookEvent,
  normalizeWebhookEventType,
  type FinancialWebhookEvent,
  type NormalizedFinancialWebhook,
} from './schemas.ts';

export type FinancialWebhookIngestResult =
  | { readonly accepted: true; readonly duplicate: boolean; readonly event: NormalizedFinancialWebhook }
  | { readonly accepted: false; readonly code: string; readonly message: string };

export class FinancialWebhookIngestor {
  private readonly guard: ProviderWebhookGuard;
  private readonly processed = new Set<string>();

  constructor(guard: ProviderWebhookGuard = new ProviderWebhookGuard()) {
    this.guard = guard;
  }

  registerProvider(providerId: string, secret: SecretValue): void {
    this.guard.registerProvider(providerId, secret);
  }

  sign(input: Omit<ProviderWebhookEnvelope, 'signatureHex'>, secret: SecretValue): ProviderWebhookEnvelope {
    return this.guard.sign(input, secret);
  }

  ingest(input: {
    readonly envelope: ProviderWebhookEnvelope;
    readonly payload: Readonly<Record<string, unknown>>;
    readonly nowMs: number;
    readonly verificationRequired?: boolean;
  }): FinancialWebhookIngestResult {
    if (input.verificationRequired === false) {
      return {
        accepted: false,
        code: 'WEBHOOK_VERIFICATION_REQUIRED',
        message: 'missing webhook verification prevents callback processing',
      };
    }
    const validated = this.guard.validate(input.envelope, input.nowMs);
    if (!validated.ok) {
      return {
        accepted: false,
        code: validated.code,
        message: 'webhook verification failed',
      };
    }
    const eventType = resolveEventType(input.envelope.eventType);
    if (!eventType) {
      return {
        accepted: false,
        code: 'UNSUPPORTED_EVENT',
        message: `unsupported financial webhook event ${input.envelope.eventType}`,
      };
    }
    const event: NormalizedFinancialWebhook = Object.freeze({
      eventType,
      providerId: input.envelope.providerId,
      providerEventId: input.envelope.nonce,
      occurredAt: input.envelope.timestampUtc,
      originalProviderEventType: input.envelope.eventType,
      payload: input.payload,
    });
    if (validated.duplicate || this.processed.has(input.envelope.idempotencyKey)) {
      return { accepted: true, duplicate: true, event };
    }
    this.processed.add(input.envelope.idempotencyKey);
    return { accepted: true, duplicate: false, event };
  }
}

function resolveEventType(value: string): FinancialWebhookEvent | null {
  if (isFinancialWebhookEvent(value)) {
    return value;
  }
  return normalizeWebhookEventType(value);
}
