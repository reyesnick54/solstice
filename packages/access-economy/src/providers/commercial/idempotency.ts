/**
 * Commercial booking idempotency store.
 *
 * Repeated commercial operations with the same SunRey idempotency key must
 * not create duplicate reservations or bookings.
 */

import type { CommercialProviderId } from './types.ts';

export type IdempotencyRecord = {
  readonly providerId: CommercialProviderId;
  readonly operation: 'RESERVE' | 'BOOK' | 'CANCEL' | 'REFUND';
  readonly idempotencyKey: string;
  readonly providerReference: string;
  readonly createdAt: string;
};

export class CommercialIdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  private key(providerId: CommercialProviderId, operation: IdempotencyRecord['operation'], idempotencyKey: string): string {
    return `${providerId}:${operation}:${idempotencyKey}`;
  }

  get(
    providerId: CommercialProviderId,
    operation: IdempotencyRecord['operation'],
    idempotencyKey: string,
  ): IdempotencyRecord | null {
    return this.records.get(this.key(providerId, operation, idempotencyKey)) ?? null;
  }

  put(record: IdempotencyRecord): void {
    const composite = this.key(record.providerId, record.operation, record.idempotencyKey);
    if (this.records.has(composite)) {
      return;
    }
    this.records.set(composite, Object.freeze({ ...record }));
  }

  has(
    providerId: CommercialProviderId,
    operation: IdempotencyRecord['operation'],
    idempotencyKey: string,
  ): boolean {
    return this.records.has(this.key(providerId, operation, idempotencyKey));
  }
}

export function createCommercialIdempotencyStore(): CommercialIdempotencyStore {
  return new CommercialIdempotencyStore();
}
