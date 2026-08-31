/**
 * ACCESS Wave 2 — Canonical Access provider webhook events.
 *
 * Interface + fixtures only. No unsecured webhook endpoints.
 */

import type { AccessProviderId } from '../types.ts';
import type { AccessProviderEvidenceRecord } from './evidence.ts';

export const ACCESS_PROVIDER_WEBHOOK_EVENTS = [
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'BOOKING_CHANGED',
  'REFUND_CREATED',
  'REFUND_COMPLETED',
  'FULFILLMENT_UPDATED',
] as const;
export type AccessProviderWebhookEventKind = (typeof ACCESS_PROVIDER_WEBHOOK_EVENTS)[number];

export type AccessProviderWebhookPayload = {
  readonly providerId: AccessProviderId;
  readonly providerEventId: string;
  readonly kind: AccessProviderWebhookEventKind;
  readonly providerTimestamp: string | null;
  readonly payloadSummary: string;
  readonly signature: string | null;
  readonly idempotencyKey: string;
  readonly receivedAt: string;
  readonly simulationOnly: boolean;
  readonly sandboxOnly?: true;
};

export type AccessProviderWebhookEvent = {
  readonly webhookEventId: string;
  readonly providerId: AccessProviderId;
  readonly providerEventId: string;
  readonly kind: AccessProviderWebhookEventKind;
  readonly receivedAt: string;
  readonly providerTimestamp: string | null;
  readonly idempotencyKey: string;
  readonly signatureVerified: boolean;
  readonly simulationOnly: boolean;
  readonly sandboxOnly?: true;
  readonly evidence: AccessProviderEvidenceRecord;
};

export type WebhookSignatureVerifier = (input: {
  readonly providerId: AccessProviderId;
  readonly payload: string;
  readonly signature: string | null;
}) => boolean;

const PROVIDER_KIND_MAP: Readonly<Record<string, AccessProviderWebhookEventKind>> = Object.freeze({
  booking_confirmed: 'BOOKING_CONFIRMED',
  booking_cancelled: 'BOOKING_CANCELLED',
  booking_changed: 'BOOKING_CHANGED',
  booking_modified: 'BOOKING_CHANGED',
  refund_created: 'REFUND_CREATED',
  refund_completed: 'REFUND_COMPLETED',
  fulfillment_updated: 'FULFILLMENT_UPDATED',
});

export class AccessProviderWebhookNormalizer {
  private readonly seen = new Set<string>();

  normalize(
    raw: AccessProviderWebhookPayload,
    verify: WebhookSignatureVerifier,
  ): AccessProviderWebhookEvent | { readonly duplicate: true; readonly webhookEventId: string } | { readonly refused: true; readonly reason: string } {
    if (this.seen.has(raw.idempotencyKey)) {
      return { duplicate: true, webhookEventId: `wh_dup_${raw.idempotencyKey}` };
    }
    const signatureVerified = raw.simulationOnly
      ? true
      : verify({ providerId: raw.providerId, payload: raw.payloadSummary, signature: raw.signature });
    if (!signatureVerified) {
      return { refused: true, reason: 'unsigned production webhook rejected' };
    }
    const kind = PROVIDER_KIND_MAP[raw.kind.toLowerCase()] ?? raw.kind;
    if (!(ACCESS_PROVIDER_WEBHOOK_EVENTS as readonly string[]).includes(kind)) {
      return { refused: true, reason: `unknown provider event kind ${raw.kind}` };
    }
    this.seen.add(raw.idempotencyKey);
    return Object.freeze({
      webhookEventId: `wh_${raw.idempotencyKey}`,
      providerId: raw.providerId,
      providerEventId: raw.providerEventId,
      kind: kind as AccessProviderWebhookEventKind,
      receivedAt: raw.receivedAt,
      providerTimestamp: raw.providerTimestamp,
      idempotencyKey: raw.idempotencyKey,
      signatureVerified,
      simulationOnly: raw.simulationOnly,
      ...(raw.sandboxOnly ? { sandboxOnly: true as const } : {}),
      evidence: Object.freeze({
        evidenceId: `ev_${raw.providerEventId}`,
        providerId: raw.providerId,
        providerReference: raw.providerEventId,
        requestId: raw.idempotencyKey,
        responseHash: null,
        timestamp: raw.receivedAt,
        status: 'RECEIVED',
        operation: 'WEBHOOK',
      }),
    });
  }
}
