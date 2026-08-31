/**
 * Access Wave 4 privacy-safe funnel analytics.
 */

import type { AccessFunnelEventType } from './taxonomy.ts';

export type AccessFunnelEvent = {
  readonly eventType: AccessFunnelEventType;
  readonly occurredAt: string;
  readonly customerId: string;
  readonly category: string | null;
  readonly transactionId: string | null;
  readonly sessionId: string | null;
};

export class AccessFunnelTracker {
  private readonly events: AccessFunnelEvent[] = [];

  record(input: {
    readonly eventType: AccessFunnelEventType;
    readonly occurredAt: string;
    readonly customerId: string;
    readonly category?: string | null;
    readonly transactionId?: string | null;
    readonly sessionId?: string | null;
  }): void {
    this.events.push(
      Object.freeze({
        eventType: input.eventType,
        occurredAt: input.occurredAt,
        customerId: input.customerId,
        category: input.category ?? null,
        transactionId: input.transactionId ?? null,
        sessionId: input.sessionId ?? null,
      }),
    );
  }

  list(): readonly AccessFunnelEvent[] {
    return Object.freeze([...this.events]);
  }

  count(eventType: AccessFunnelEventType): number {
    return this.events.filter((row) => row.eventType === eventType).length;
  }
}
