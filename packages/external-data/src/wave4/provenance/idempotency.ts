/**
 * Durable idempotency for externally triggered economic event paths.
 */

export type IdempotencyRecord = {
  readonly idempotencyKey: string;
  readonly eventId: string;
  readonly outcome: 'accepted' | 'duplicate' | 'quarantined';
  readonly firstSeenAt: string;
  readonly completedAt: string | null;
};

export type IdempotencyStore = {
  get(key: string): Promise<IdempotencyRecord | undefined>;
  tryClaim(input: {
    readonly idempotencyKey: string;
    readonly eventId: string;
    readonly now: string;
  }): Promise<'claimed' | 'duplicate'>;
  complete(key: string, outcome: IdempotencyRecord['outcome'], now: string): Promise<void>;
  list(): Promise<readonly IdempotencyRecord[]>;
};

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly rows = new Map<string, IdempotencyRecord>();

  async get(key: string): Promise<IdempotencyRecord | undefined> {
    return this.rows.get(key);
  }

  async tryClaim(input: {
    readonly idempotencyKey: string;
    readonly eventId: string;
    readonly now: string;
  }): Promise<'claimed' | 'duplicate'> {
    const existing = this.rows.get(input.idempotencyKey);
    if (existing?.completedAt !== null && existing?.completedAt !== undefined) {
      return 'duplicate';
    }
    if (existing) {
      return 'duplicate';
    }
    this.rows.set(input.idempotencyKey, {
      idempotencyKey: input.idempotencyKey,
      eventId: input.eventId,
      outcome: 'accepted',
      firstSeenAt: input.now,
      completedAt: null,
    });
    return 'claimed';
  }

  async complete(key: string, outcome: IdempotencyRecord['outcome'], now: string): Promise<void> {
    const existing = this.rows.get(key);
    if (!existing) {
      return;
    }
    this.rows.set(key, { ...existing, outcome, completedAt: now });
  }

  async list(): Promise<readonly IdempotencyRecord[]> {
    return [...this.rows.values()];
  }
}

export function buildTransportIdempotencyKey(input: {
  readonly providerId: string;
  readonly capability: string;
  readonly transportEventId: string;
}): string {
  return `transport:${input.providerId}:${input.capability}:${input.transportEventId}`;
}

export function buildProcessingIdempotencyKey(input: {
  readonly stage: string;
  readonly nodeId: string;
}): string {
  return `process:${input.stage}:${input.nodeId}`;
}
