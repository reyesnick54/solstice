import type { InformationCategory } from './taxonomy.ts';
import type { MobileEventKind } from './taxonomy.ts';
import type { MobileNotification } from './types.ts';

export function privacyMinimizedNotification(input: {
  readonly kind: MobileEventKind;
  readonly subjectHandle: string;
  readonly category?: InformationCategory;
  readonly requesterClass?: string;
  readonly purpose?: string;
}): MobileNotification {
  return Object.freeze({
    kind: input.kind,
    subjectHandle: input.subjectHandle,
    category: input.category ?? null,
    requesterClass: input.requesterClass ?? null,
    purpose: input.purpose ?? null,
    rawPayload: false,
    legalName: false,
  });
}
