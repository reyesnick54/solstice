/**
 * Provider-neutral mobile push ports (APNs-compatible, FCM-compatible,
 * future). Push providers receive generic events only. Sensitive detail
 * is retrieved by the authenticated app.
 */

import { createHash } from 'node:crypto';

import {
  PUSH_EVENT_CATEGORIES,
  reject,
  type MobileNotificationSubscription,
  type MobilePushEvent,
  type MobileSyncRejection,
  type PushEventCategory,
  type PushProviderClass,
} from './types.ts';

const FORBIDDEN_PUSH_MARKERS = [
  'seed phrase',
  'seedPhrase',
  'mnemonic',
  'private key',
  'privateKey',
  'kyc',
  'ssn',
  'passport',
  'account number',
  'iban',
  'pdvRaw',
] as const;

export type PushDeliveryResult = {
  readonly accepted: boolean;
  readonly duplicate: boolean;
  readonly providerClass: PushProviderClass;
  readonly pushId: string;
};

export type PushProviderPort = {
  readonly providerClass: PushProviderClass;
  deliver(event: MobilePushEvent, token: string): PushDeliveryResult;
};

export class InMemoryPushProvider implements PushProviderPort {
  readonly providerClass: PushProviderClass;
  readonly delivered: MobilePushEvent[] = [];
  private readonly seen = new Set<string>();

  constructor(providerClass: PushProviderClass) {
    this.providerClass = providerClass;
  }

  deliver(event: MobilePushEvent, _token: string): PushDeliveryResult {
    const duplicate = this.seen.has(event.pushId);
    this.seen.add(event.pushId);
    if (!duplicate) {
      this.delivered.push(event);
    }
    return Object.freeze({
      accepted: true,
      duplicate,
      providerClass: this.providerClass,
      pushId: event.pushId,
    });
  }
}

export function apnsCompatiblePort(): PushProviderPort {
  return new InMemoryPushProvider('APNS_COMPATIBLE');
}

export function fcmCompatiblePort(): PushProviderPort {
  return new InMemoryPushProvider('FCM_COMPATIBLE');
}

export function futurePushPort(): PushProviderPort {
  return new InMemoryPushProvider('FUTURE');
}

export class MobilePushRouter {
  private readonly subscriptions = new Map<string, MobileNotificationSubscription>();
  private readonly providers: readonly PushProviderPort[];
  readonly deliveries: PushDeliveryResult[] = [];

  constructor(providers: readonly PushProviderPort[] = [apnsCompatiblePort(), fcmCompatiblePort(), futurePushPort()]) {
    this.providers = providers;
  }

  subscribe(input: {
    readonly deviceId: string;
    readonly walletId: string;
    readonly providerClass: PushProviderClass;
    readonly pushToken: string;
    readonly categories: readonly PushEventCategory[];
    readonly securityCriticalAlwaysOn?: boolean;
  }): MobileNotificationSubscription {
    const subscription: MobileNotificationSubscription = Object.freeze({
      subscriptionId: `sub.${input.deviceId}`,
      deviceId: input.deviceId,
      walletId: input.walletId,
      providerClass: input.providerClass,
      pushToken: input.pushToken,
      categories: Object.freeze([...input.categories]),
      securityCriticalAlwaysOn: input.securityCriticalAlwaysOn ?? true,
      pushTokenIsAuthorization: false,
    });
    this.subscriptions.set(input.deviceId, subscription);
    return subscription;
  }

  unsubscribe(deviceId: string): void {
    this.subscriptions.delete(deviceId);
  }

  subscription(deviceId: string): MobileNotificationSubscription | undefined {
    return this.subscriptions.get(deviceId);
  }

  createEvent(category: PushEventCategory, retrievalHint: string): MobilePushEvent | MobileSyncRejection {
    const title = genericTitle(category);
    const body = 'Open the SunRey wallet to view this update.';
    const candidate = `${title} ${body} ${retrievalHint}`.toLowerCase();
    if (FORBIDDEN_PUSH_MARKERS.some((marker) => candidate.includes(marker.toLowerCase()))) {
      return reject('SENSITIVE_PUSH_PAYLOAD', 'push providers must not receive sensitive detail');
    }
    return Object.freeze({
      pushId: createHash('sha256').update(`${category}|${retrievalHint}`).digest('hex').slice(0, 24),
      category,
      title,
      body,
      retrievalHint,
      sensitiveDetailIncluded: false,
      seedPhrase: false,
      privateKey: false,
      kycPayload: false,
      rawPersonalData: false,
      sensitiveAccountDetails: false,
    });
  }

  publish(walletId: string, event: MobilePushEvent): readonly PushDeliveryResult[] {
    const results: PushDeliveryResult[] = [];
    for (const subscription of this.subscriptions.values()) {
      if (subscription.walletId !== walletId) {
        continue;
      }
      const securityCritical = event.category === 'SECURITY_EVENT' || event.category === 'NEW_DEVICE' || event.category === 'RECOVERY_REQUEST';
      if (!subscription.categories.includes(event.category) && !(securityCritical && subscription.securityCriticalAlwaysOn)) {
        continue;
      }
      const provider = this.providers.find((port) => port.providerClass === subscription.providerClass);
      if (!provider) {
        continue;
      }
      const result = provider.deliver(event, subscription.pushToken);
      this.deliveries.push(result);
      results.push(result);
    }
    return results;
  }

  categories(): readonly PushEventCategory[] {
    return PUSH_EVENT_CATEGORIES;
  }
}

function genericTitle(category: PushEventCategory): string {
  switch (category) {
    case 'TRANSACTION_FINALIZED':
      return 'Transaction update';
    case 'INCOMING_TRANSFER':
      return 'Incoming transfer';
    case 'WITHDRAWAL_STATE':
      return 'Withdrawal update';
    case 'SECURITY_EVENT':
      return 'Security notice';
    case 'NEW_DEVICE':
      return 'New device';
    case 'RECOVERY_REQUEST':
      return 'Recovery request';
    case 'DELEGATION_CHANGE':
      return 'Delegation update';
    case 'EXCHANGE_ORDER_UPDATE':
      return 'Exchange order update';
    case 'TRADE_SETTLEMENT':
      return 'Trade settlement';
    case 'AGENT_MANDATE_ACTION':
      return 'Agent mandate action';
    default:
      return 'Wallet update';
  }
}
