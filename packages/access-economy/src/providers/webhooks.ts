/**
 * ACCESS-14 — Provider webhook normalization.
 */

import type {
  AccessProviderId,
  CanonicalFulfillmentEventKind,
  ProviderEvidenceReference,
  ProviderWebhookEvent,
} from './types.ts';

export type RawProviderWebhook = {
  readonly providerId: AccessProviderId;
  readonly providerEventId: string;
  readonly providerKind: string;
  readonly payloadSummary: string;
  readonly providerTimestamp: string | null;
  readonly signature: string | null;
  readonly idempotencyKey: string;
  readonly receivedAt: string;
  readonly simulationOnly: true;
};

const PROVIDER_KIND_MAP: Readonly<Record<string, CanonicalFulfillmentEventKind>> = Object.freeze({
  booking_confirmed: 'BOOKING_CONFIRMED',
  booking_cancelled: 'BOOKING_CANCELLED',
  booking_modified: 'BOOKING_MODIFIED',
  service_started: 'SERVICE_STARTED',
  check_in: 'CHECK_IN',
  check_out: 'CHECK_OUT',
  order_preparing: 'ORDER_PREPARING',
  out_for_delivery: 'OUT_FOR_DELIVERY',
  delivered: 'DELIVERED',
  vehicle_pickup: 'VEHICLE_PICKUP',
  vehicle_return: 'VEHICLE_RETURN',
  refund_initiated: 'REFUND_INITIATED',
  refund_completed: 'REFUND_COMPLETED',
  provider_failure: 'PROVIDER_FAILURE',
});

export class ProviderWebhookNormalizer {
  private readonly seen = new Set<string>();

  normalize(
    raw: RawProviderWebhook,
    verify: (input: { readonly providerId: AccessProviderId; readonly payload: string; readonly signature: string | null }) => boolean,
  ): ProviderWebhookEvent | { readonly duplicate: true; readonly webhookEventId: string } | { readonly refused: true; readonly reason: string } {
    if (this.seen.has(raw.idempotencyKey)) {
      return { duplicate: true, webhookEventId: `wh_dup_${raw.idempotencyKey}` };
    }
    const signatureVerified = raw.simulationOnly
      ? true
      : verify({ providerId: raw.providerId, payload: raw.payloadSummary, signature: raw.signature });
    if (!signatureVerified) {
      return { refused: true, reason: 'unsigned production webhook rejected' };
    }
    const canonicalKind = PROVIDER_KIND_MAP[raw.providerKind.toLowerCase()];
    if (!canonicalKind) {
      return { refused: true, reason: `unknown provider event kind ${raw.providerKind}` };
    }
    this.seen.add(raw.idempotencyKey);
    const evidenceRef: ProviderEvidenceReference = Object.freeze({
      evidenceId: `ev_${raw.providerEventId}`,
      kind: raw.simulationOnly ? 'SIMULATION' : 'PROVIDER_RECEIPT',
      providerEventId: raw.providerEventId,
    });
    return Object.freeze({
      webhookEventId: `wh_${raw.idempotencyKey}`,
      providerId: raw.providerId,
      providerEventId: raw.providerEventId,
      receivedAt: raw.receivedAt,
      providerTimestamp: raw.providerTimestamp,
      canonicalKind,
      idempotencyKey: raw.idempotencyKey,
      signatureVerified,
      simulationOnly: true,
      evidenceRef,
    });
  }
}
