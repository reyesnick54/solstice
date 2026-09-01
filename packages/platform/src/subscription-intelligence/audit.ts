import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SubscriptionAuditEvent } from './models.ts';
import type { SubscriptionAuditEventKind } from './taxonomy.ts';

export function createAuditEvent(input: {
  readonly eventKind: SubscriptionAuditEventKind;
  readonly subjectId: string;
  readonly occurredAt: UtcInstant;
  readonly refs: readonly string[];
  readonly detail: string;
}): SubscriptionAuditEvent {
  return Object.freeze({
    eventKind: input.eventKind,
    subjectId: input.subjectId,
    occurredAt: input.occurredAt,
    refs: Object.freeze([...input.refs]),
    detail: input.detail,
  });
}

export class SubscriptionAuditLog {
  private readonly events: SubscriptionAuditEvent[] = [];

  append(event: SubscriptionAuditEvent): void {
    this.events.push(event);
  }

  list(subjectId?: string): readonly SubscriptionAuditEvent[] {
    if (!subjectId) {
      return Object.freeze([...this.events]);
    }
    return Object.freeze(this.events.filter((event) => event.subjectId === subjectId));
  }
}
