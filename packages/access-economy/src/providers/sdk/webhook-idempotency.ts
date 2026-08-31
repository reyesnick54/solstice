/**
 * ACCESS Wave 2 — Provider webhook idempotency handling.
 *
 * Duplicate provider webhooks must not duplicate booking, refund, capacity,
 * or entitlement consumption side effects.
 */

import type { AccessProviderWebhookEventKind } from './webhook-events.ts';

export type ProviderEventIdRecord = {
  readonly providerEventId: string;
  readonly idempotencyKey: string;
  readonly kind: AccessProviderWebhookEventKind;
  readonly processedAt: string;
  readonly webhookEventId: string;
};

export class AccessProviderEventIdStore {
  private readonly byEventId = new Map<string, ProviderEventIdRecord>();
  private readonly byIdempotencyKey = new Map<string, ProviderEventIdRecord>();

  hasSeen(providerEventId: string): boolean {
    return this.byEventId.has(providerEventId);
  }

  hasIdempotencyKey(idempotencyKey: string): boolean {
    return this.byIdempotencyKey.has(idempotencyKey);
  }

  record(record: ProviderEventIdRecord): 'NEW' | 'DUPLICATE' {
    if (this.byEventId.has(record.providerEventId) || this.byIdempotencyKey.has(record.idempotencyKey)) {
      return 'DUPLICATE';
    }
    const frozen = Object.freeze({ ...record });
    this.byEventId.set(record.providerEventId, frozen);
    this.byIdempotencyKey.set(record.idempotencyKey, frozen);
    return 'NEW';
  }

  getByEventId(providerEventId: string): ProviderEventIdRecord | null {
    return this.byEventId.get(providerEventId) ?? null;
  }
}
