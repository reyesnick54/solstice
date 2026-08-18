import type { RpcAbuseProtection } from './policy.ts';
import type { SubscriptionRecord, SubscriptionTopic } from './types.ts';

const DEFAULT_BOUND = 64;

export class RpcSubscriptionGateway {
  private readonly abuse: RpcAbuseProtection;
  private readonly subscriptions = new Map<string, SubscriptionRecord>();
  private nextId = 1;

  constructor(abuse: RpcAbuseProtection) {
    this.abuse = abuse;
  }

  open(input: {
    readonly identity: string;
    readonly topic: SubscriptionTopic;
    readonly bound?: number;
  }): SubscriptionRecord | { readonly ok: false; readonly error: 'SUBSCRIPTION_EXHAUSTED' } {
    const bound = input.bound ?? DEFAULT_BOUND;
    if (bound <= 0 || bound > 256) {
      return { ok: false, error: 'SUBSCRIPTION_EXHAUSTED' };
    }
    const current = [...this.subscriptions.values()].filter((row) => row.identity === input.identity).length;
    if (current >= 8) {
      return { ok: false, error: 'SUBSCRIPTION_EXHAUSTED' };
    }
    const record: SubscriptionRecord = {
      subscriptionId: `sub_${this.nextId}`,
      identity: input.identity,
      topic: input.topic,
      bound,
      delivered: 0,
    };
    this.nextId += 1;
    this.subscriptions.set(record.subscriptionId, record);
    this.abuse.openSubscription(input.identity);
    return record;
  }

  publish(topic: SubscriptionTopic, _payload: unknown): readonly SubscriptionRecord[] {
    const delivered: SubscriptionRecord[] = [];
    for (const record of this.subscriptions.values()) {
      if (record.topic !== topic) {
        continue;
      }
      if (record.delivered >= record.bound) {
        this.close(record.subscriptionId);
        continue;
      }
      const next = { ...record, delivered: record.delivered + 1 };
      this.subscriptions.set(record.subscriptionId, next);
      delivered.push(next);
    }
    return delivered;
  }

  close(subscriptionId: string): void {
    const existing = this.subscriptions.get(subscriptionId);
    if (!existing) {
      return;
    }
    this.subscriptions.delete(subscriptionId);
    this.abuse.closeSubscription(existing.identity);
  }

  list(): readonly SubscriptionRecord[] {
    return [...this.subscriptions.values()];
  }

  count(): number {
    return this.subscriptions.size;
  }
}
