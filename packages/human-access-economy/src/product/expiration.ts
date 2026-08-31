/**
 * Access Wave 4 entitlement expiration detection.
 */

import type { AccessEntitlement } from '../types.ts';
import { ACCESS_CATEGORY_LABELS, type AccessCategory } from '../taxonomy.ts';
import { ACCESS_EXPIRATION_NOTICE_DAYS } from './taxonomy.ts';
import { entitlementExpiringSoonEvent } from './events.ts';
import type { AccessProductEvent } from './events.ts';

export type ExpirationNotice = {
  readonly entitlementId: string;
  readonly customerId: string;
  readonly category: AccessCategory;
  readonly categoryLabel: string;
  readonly remainingUnits: number;
  readonly unitLabel: string;
  readonly daysRemaining: number;
  readonly expiresAt: string;
  readonly noticeDay: number;
};

function unitLabelFor(category: AccessCategory): string {
  switch (category) {
    case 'MOBILITY':
      return 'Mobility Days';
    case 'STAY_HOUSING':
      return 'Nights';
    case 'EXPERIENCES':
      return 'Experience Credits';
    case 'COMPUTE_AI':
      return 'Hours';
    default:
      return 'units';
  }
}

export function detectExpiringEntitlements(
  entitlements: readonly AccessEntitlement[],
  nowIso: string,
  alreadyNotified: ReadonlySet<string>,
): readonly ExpirationNotice[] {
  const now = Date.parse(nowIso);
  const notices: ExpirationNotice[] = [];
  for (const ent of entitlements) {
    if (ent.status !== 'ACTIVE' || !ent.validUntil) {
      continue;
    }
    if (ent.remainingUses !== null && ent.remainingUses <= 0) {
      continue;
    }
    const expires = Date.parse(ent.validUntil);
    const daysRemaining = Math.ceil((expires - now) / (24 * 60 * 60 * 1000));
    for (const noticeDay of ACCESS_EXPIRATION_NOTICE_DAYS) {
      if (daysRemaining !== noticeDay) {
        continue;
      }
      const key = `${ent.entitlementId}:${noticeDay}`;
      if (alreadyNotified.has(key)) {
        continue;
      }
      notices.push(
        Object.freeze({
          entitlementId: ent.entitlementId,
          customerId: ent.customerId,
          category: ent.category,
          categoryLabel: ACCESS_CATEGORY_LABELS[ent.category],
          remainingUnits: ent.remainingUses ?? 0,
          unitLabel: unitLabelFor(ent.category),
          daysRemaining: noticeDay,
          expiresAt: ent.validUntil,
          noticeDay,
        }),
      );
    }
  }
  return Object.freeze(notices);
}

export function expirationEventsFromNotices(
  notices: readonly ExpirationNotice[],
  nowIso: string,
  eventIdFactory: () => string,
): readonly AccessProductEvent[] {
  return Object.freeze(
    notices.map((notice) =>
      entitlementExpiringSoonEvent({
        eventId: eventIdFactory(),
        occurredAt: nowIso,
        customerId: notice.customerId,
        entitlementId: notice.entitlementId,
        categoryLabel: notice.categoryLabel,
        remainingUnits: notice.remainingUnits,
        unitLabel: notice.unitLabel,
        daysRemaining: notice.daysRemaining,
      }),
    ),
  );
}
