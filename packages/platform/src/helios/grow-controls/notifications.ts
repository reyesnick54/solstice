import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { GrowControlNotificationKind } from './taxonomy.ts';
import type { GrowControlNotification } from './types.ts';

export function createGrowControlNotification(input: {
  readonly kind: GrowControlNotificationKind;
  readonly customerId: string;
  readonly subjectId: string;
  readonly message: string;
  readonly now: UtcInstant;
  readonly evidenceRef?: string | null;
  readonly material?: boolean;
}): GrowControlNotification {
  return Object.freeze({
    notificationId: `gcn_${randomUUID()}`,
    kind: input.kind,
    customerId: input.customerId,
    subjectId: input.subjectId,
    message: input.message,
    evidenceRef: input.evidenceRef ?? null,
    createdAt: input.now,
    material: input.material ?? true,
  });
}
