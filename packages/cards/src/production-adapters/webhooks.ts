/**
 * Normalized card.* webhook events. Missing verification fails closed.
 */

import {
  ProviderWebhookGuard,
  type ProviderWebhookEnvelope,
} from '../../../security/src/regulated/webhook.ts';
import type { SecretValue } from '../../../security/src/redaction.ts';
import { assertNoSensitiveCardData } from '../pci-boundary.ts';

export const CARD_PRODUCTION_WEBHOOK_EVENTS = [
  'card.issued',
  'card.frozen',
  'card.unfrozen',
  'card.authorization',
  'card.declined',
  'card.capture',
  'card.reversal',
  'card.refund',
  'card.dispute',
  'card.wallet.eligibility',
] as const;
export type CardProductionWebhookEvent = (typeof CARD_PRODUCTION_WEBHOOK_EVENTS)[number];

export type CardWebhookIngest =
  | { readonly accepted: true; readonly duplicate: boolean; readonly eventType: CardProductionWebhookEvent }
  | { readonly accepted: false; readonly code: string };

export class CardProductionWebhookIngestor {
  private readonly guard: ProviderWebhookGuard;

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
  }): CardWebhookIngest {
    assertNoSensitiveCardData(input.payload, 'card.production.webhook');
    if (input.verificationRequired === false) {
      return { accepted: false, code: 'WEBHOOK_VERIFICATION_REQUIRED' };
    }
    const validated = this.guard.validate(input.envelope, input.nowMs);
    if (!validated.ok) {
      return { accepted: false, code: validated.code };
    }
    if (!(CARD_PRODUCTION_WEBHOOK_EVENTS as readonly string[]).includes(input.envelope.eventType)) {
      return { accepted: false, code: 'UNSUPPORTED_EVENT' };
    }
    return {
      accepted: true,
      duplicate: validated.duplicate,
      eventType: input.envelope.eventType as CardProductionWebhookEvent,
    };
  }
}
