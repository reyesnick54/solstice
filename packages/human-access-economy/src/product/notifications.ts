/**
 * Access Wave 4 notification service — deduplication, cooldowns, preferences.
 * Reuses transactional vs promotional channel distinction.
 */

import type { AccessProductEvent } from './events.ts';
import type { AccessNotificationChannel } from './taxonomy.ts';

export type AccessNotificationPreferences = {
  readonly promotionalEnabled: boolean;
  readonly transactionalEnabled: boolean;
  readonly pushEnabled: boolean;
  readonly emailEnabled: boolean;
};

export const DEFAULT_ACCESS_NOTIFICATION_PREFERENCES: AccessNotificationPreferences = Object.freeze({
  promotionalEnabled: true,
  transactionalEnabled: true,
  pushEnabled: true,
  emailEnabled: true,
});

export type AccessDeliveredNotification = {
  readonly notificationId: string;
  readonly eventId: string;
  readonly deduplicationKey: string;
  readonly channel: AccessNotificationChannel;
  readonly title: string;
  readonly body: string;
  readonly deliveredAt: string;
  readonly transactionId: string | null;
};

export type AccessNotificationCooldownPolicy = {
  readonly cooldownMs: number;
  readonly eventTypes: readonly string[];
};

const DEFAULT_COOLDOWNS: readonly AccessNotificationCooldownPolicy[] = Object.freeze([
  Object.freeze({
    cooldownMs: 15 * 60 * 1000,
    eventTypes: Object.freeze(['ACCESS_PROVIDER_TEMPORARILY_UNAVAILABLE']),
  }),
  Object.freeze({
    cooldownMs: 60 * 60 * 1000,
    eventTypes: Object.freeze(['ACCESS_OPPORTUNITY_AVAILABLE']),
  }),
]);

export class AccessNotificationService {
  private readonly delivered = new Map<string, AccessDeliveredNotification>();
  private readonly dedupKeys = new Set<string>();
  private readonly lastDeliveredAt = new Map<string, number>();
  private readonly preferences = new Map<string, AccessNotificationPreferences>();
  private readonly cooldowns: readonly AccessNotificationCooldownPolicy[];

  constructor(cooldowns: readonly AccessNotificationCooldownPolicy[] = DEFAULT_COOLDOWNS) {
    this.cooldowns = cooldowns;
  }

  setPreferences(customerId: string, prefs: AccessNotificationPreferences): void {
    this.preferences.set(customerId, Object.freeze({ ...prefs }));
  }

  getPreferences(customerId: string): AccessNotificationPreferences {
    return this.preferences.get(customerId) ?? DEFAULT_ACCESS_NOTIFICATION_PREFERENCES;
  }

  shouldDeliver(event: AccessProductEvent, nowMs: number): boolean {
    const prefs = this.getPreferences(event.customerId);
    if (event.channel === 'PROMOTIONAL' && !prefs.promotionalEnabled) {
      return false;
    }
    if (event.channel === 'TRANSACTIONAL' && !prefs.transactionalEnabled) {
      return false;
    }
    if (this.dedupKeys.has(event.deduplicationKey)) {
      return false;
    }
    for (const policy of this.cooldowns) {
      if (!policy.eventTypes.includes(event.type)) {
        continue;
      }
      const cooldownKey = `${event.customerId}:${event.type}:${event.resourceId}`;
      const last = this.lastDeliveredAt.get(cooldownKey);
      if (last !== undefined && nowMs - last < policy.cooldownMs) {
        return false;
      }
    }
    return true;
  }

  deliver(event: AccessProductEvent, nowMs: number, nowIso: string): AccessDeliveredNotification | null {
    if (!this.shouldDeliver(event, nowMs)) {
      return null;
    }
    const notificationId = `ntf_${event.deduplicationKey}`;
    const notification: AccessDeliveredNotification = Object.freeze({
      notificationId,
      eventId: event.eventId,
      deduplicationKey: event.deduplicationKey,
      channel: event.channel,
      title: event.userTitle,
      body: event.userBody,
      deliveredAt: nowIso,
      transactionId: event.transactionId,
    });
    this.delivered.set(notificationId, notification);
    this.dedupKeys.add(event.deduplicationKey);
    const cooldownKey = `${event.customerId}:${event.type}:${event.resourceId}`;
    this.lastDeliveredAt.set(cooldownKey, nowMs);
    return notification;
  }

  listDelivered(customerId: string): readonly AccessDeliveredNotification[] {
    return [...this.delivered.values()].filter(
      (row) => row.deduplicationKey.startsWith('') && row.notificationId.includes(customerId) === false
        ? false
        : true,
    );
  }

  listForCustomer(customerId: string, events: readonly AccessProductEvent[]): readonly AccessDeliveredNotification[] {
    const eventIds = new Set(events.filter((e) => e.customerId === customerId).map((e) => e.eventId));
    return [...this.delivered.values()].filter((n) => eventIds.has(n.eventId));
  }

  isDuplicate(deduplicationKey: string): boolean {
    return this.dedupKeys.has(deduplicationKey);
  }
}
