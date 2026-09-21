import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import { GROW_NOTIFICATION_PRIORITY_BY_TYPE, type GrowNotificationChannel } from './taxonomy.ts';
import type {
  GrowNotificationDeliveryAdapter,
  GrowNotificationDeliveryRecord,
  GrowNotificationEvent,
  GrowNotificationEventType,
  GrowNotificationPreferences,
} from './types.ts';

export const DEFAULT_GROW_NOTIFICATION_PREFERENCES: GrowNotificationPreferences = Object.freeze({
  timeZone: 'UTC',
  morningBriefEnabled: true,
  eveningRecapEnabled: true,
  materialPositionEventsEnabled: true,
  riskEventsEnabled: true,
  operationalEventsEnabled: true,
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  quietHoursStartMinutes: null,
  quietHoursEndMinutes: null,
});

export type GrowNotificationEventInput = {
  readonly type: GrowNotificationEventType;
  readonly occurredAt: UtcInstant;
  readonly customerId: string;
  readonly subjectId: string;
  readonly resourceId: string;
  readonly reportId?: string | null;
  readonly summary: string;
  readonly userTitle: string;
  readonly userBody: string;
  readonly autoNotify?: boolean;
};

export function createGrowNotificationEvent(input: GrowNotificationEventInput): GrowNotificationEvent {
  const deduplicationKey = [input.type, input.customerId, input.resourceId, input.reportId ?? ''].join(':');
  return Object.freeze({
    eventId: `gne_${randomUUID()}`,
    type: input.type,
    occurredAt: input.occurredAt,
    customerId: input.customerId,
    subjectId: input.subjectId,
    resourceId: input.resourceId,
    reportId: input.reportId ?? null,
    summary: input.summary,
    userTitle: input.userTitle,
    userBody: input.userBody,
    priority: GROW_NOTIFICATION_PRIORITY_BY_TYPE[input.type],
    channelHints: Object.freeze(['IN_APP', 'PUSH', 'EMAIL', 'SMS'] as readonly GrowNotificationChannel[]),
    deduplicationKey,
    autoNotify: input.autoNotify ?? true,
    environment: 'simulation',
    externalProviderRequired: true,
    deliveryAdapterAvailable: false,
  });
}

function eventEnabled(type: GrowNotificationEventType, prefs: GrowNotificationPreferences): boolean {
  switch (type) {
    case 'GROW_MORNING_BRIEF_AVAILABLE':
      return prefs.morningBriefEnabled;
    case 'GROW_EVENING_RECAP_AVAILABLE':
      return prefs.eveningRecapEnabled;
    case 'GROW_MATERIAL_POSITION_OPENED':
    case 'GROW_MATERIAL_POSITION_CLOSED':
      return prefs.materialPositionEventsEnabled;
    case 'GROW_RISK_STATE_CHANGED':
      return prefs.riskEventsEnabled;
    case 'GROW_PAUSED':
    case 'GROW_PROVIDER_DEGRADED':
    case 'GROW_RECONCILIATION_PROBLEM':
    case 'GROW_CUSTOMER_ACTION_REQUIRED':
      return prefs.operationalEventsEnabled;
    default:
      return true;
  }
}

export function isWithinQuietHours(input: {
  readonly nowMinutes: number;
  readonly prefs: GrowNotificationPreferences;
}): boolean {
  const { prefs, nowMinutes } = input;
  if (prefs.quietHoursStartMinutes === null || prefs.quietHoursEndMinutes === null) {
    return false;
  }
  const start = prefs.quietHoursStartMinutes;
  const end = prefs.quietHoursEndMinutes;
  if (start === end) {
    return false;
  }
  if (start < end) {
    return nowMinutes >= start && nowMinutes < end;
  }
  return nowMinutes >= start || nowMinutes < end;
}

export class GrowNotificationService {
  private readonly deliveredKeys = new Set<string>();
  private readonly deliveries: GrowNotificationDeliveryRecord[] = [];
  private readonly preferences = new Map<string, GrowNotificationPreferences>();

  setPreferences(customerId: string, prefs: GrowNotificationPreferences): void {
    this.preferences.set(customerId, Object.freeze({ ...prefs }));
  }

  getPreferences(customerId: string): GrowNotificationPreferences {
    return this.preferences.get(customerId) ?? DEFAULT_GROW_NOTIFICATION_PREFERENCES;
  }

  shouldDeliver(event: GrowNotificationEvent, nowMinutes: number): boolean {
    const prefs = this.getPreferences(event.customerId);
    if (!eventEnabled(event.type, prefs)) {
      return false;
    }
    if (this.deliveredKeys.has(event.deduplicationKey)) {
      return false;
    }
    if (isWithinQuietHours({ nowMinutes, prefs })) {
      return false;
    }
    return true;
  }

  deliver(
    event: GrowNotificationEvent,
    nowMinutes: number,
    now: UtcInstant,
    adapter?: GrowNotificationDeliveryAdapter,
  ): GrowNotificationDeliveryRecord | null {
    if (!this.shouldDeliver(event, nowMinutes)) {
      return null;
    }
    const delivery: GrowNotificationDeliveryRecord = Object.freeze({
      deliveryId: `gnd_${randomUUID()}`,
      eventId: event.eventId,
      customerId: event.customerId,
      deduplicationKey: event.deduplicationKey,
      channel: 'IN_APP',
      deliveredAt: now,
      adapterKind: adapter?.adapterAvailable ? 'EXTERNAL_PENDING' : 'IN_APP',
    });
    this.deliveredKeys.add(event.deduplicationKey);
    this.deliveries.push(delivery);
    if (adapter?.adapterAvailable) {
      adapter.deliver(event, 'IN_APP');
    }
    return delivery;
  }

  listDeliveries(customerId?: string): readonly GrowNotificationDeliveryRecord[] {
    if (!customerId) {
      return Object.freeze([...this.deliveries]);
    }
    return Object.freeze(this.deliveries.filter((row) => row.customerId === customerId));
  }

  restoreDeliveredKeys(keys: readonly string[]): void {
    for (const key of keys) {
      this.deliveredKeys.add(key);
    }
  }

  isDuplicate(deduplicationKey: string): boolean {
    return this.deliveredKeys.has(deduplicationKey);
  }

  snapshotDeliveredKeys(): readonly string[] {
    return Object.freeze([...this.deliveredKeys]);
  }
}
