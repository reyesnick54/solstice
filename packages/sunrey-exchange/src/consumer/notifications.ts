import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ConsumerNotificationKind } from './taxonomy.ts';
import type { ConsumerNotification } from './types.ts';

export type ConsumerNotificationPort = {
  publish(notification: ConsumerNotification): void;
  list(participantId: string): readonly ConsumerNotification[];
};

export class InMemoryConsumerNotificationPort implements ConsumerNotificationPort {
  readonly rows: ConsumerNotification[] = [];

  publish(notification: ConsumerNotification): void {
    this.rows.push(notification);
  }

  list(participantId: string): readonly ConsumerNotification[] {
    return this.rows.filter((row) => row.participantId === participantId);
  }
}

export function consumerNotification(input: {
  readonly kind: ConsumerNotificationKind;
  readonly participantId: string;
  readonly body: string;
  readonly now: UtcInstant;
}): ConsumerNotification {
  return Object.freeze({
    notificationId: `cnote_${randomUUID().replace(/-/g, '')}`,
    kind: input.kind,
    participantId: input.participantId,
    body: input.body,
    at: input.now,
    confidentialSurveillance: false,
  });
}
